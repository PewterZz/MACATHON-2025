import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import {
  initializePeerConnection,
  handleSignalingMessage,
  sendMessage as sendWebRTCMessage,
  startVoiceCall,
  closeConnection,
} from '@/lib/webrtc';

interface Message {
  id: number;
  sender: string;
  content: string;
  created_at: string;
}

interface UseChatReturn {
  messages: Message[];
  isConnecting: boolean;
  isVoiceActive: boolean;
  sendMessage: (content: string) => Promise<void>;
  toggleVoice: () => Promise<void>;
}

export function useChat(requestId: string, isHelper: boolean): UseChatReturn {
  const supabase = useSupabaseClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
    } else {
      setMessages(data || []);
    }
  }, [requestId, supabase]);

  useEffect(() => {
    const initConnection = async () => {
      try {
        await initializePeerConnection(requestId, isHelper);
        setIsConnecting(false);
      } catch (error) {
        console.error('Error initializing connection:', error);
      }
    };

    const messageSubscription = supabase
      .channel(`messages:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `request_id=eq.${requestId}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as Message]);
        }
      )
      .subscribe();

    const signalingSubscription = supabase
      .channel(`signaling:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rtc_signaling',
          filter: `request_id=eq.${requestId}`,
        },
        async (payload) => {
          await handleSignalingMessage(requestId, isHelper, payload.new);
        }
      )
      .subscribe();

    initConnection();
    loadMessages();

    return () => {
      messageSubscription.unsubscribe();
      signalingSubscription.unsubscribe();
      closeConnection(requestId);
    };
  }, [requestId, isHelper, supabase, loadMessages]);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    try {
      sendWebRTCMessage(requestId, content, isHelper ? 'helper' : 'caller');
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback to direct database insert if WebRTC fails
      const { error: dbError } = await supabase.from('messages').insert({
        request_id: requestId,
        sender: isHelper ? 'helper' : 'caller',
        content: content,
      });

      if (dbError) {
        console.error('Error saving message to database:', dbError);
        throw dbError;
      }
    }
  };

  const toggleVoice = async () => {
    try {
      if (!isVoiceActive) {
        await startVoiceCall(requestId);
        setIsVoiceActive(true);
      } else {
        closeConnection(requestId);
        setIsVoiceActive(false);
      }
    } catch (error) {
      console.error('Error toggling voice:', error);
      throw error;
    }
  };

  return {
    messages,
    isConnecting,
    isVoiceActive,
    sendMessage,
    toggleVoice,
  };
} 