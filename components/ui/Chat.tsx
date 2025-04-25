import { useRef, useState, useEffect } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Mic, MicOff, Send } from 'lucide-react';
import { useChat } from '@/hooks/useChat';

interface ChatProps {
  requestId: string;
  isHelper: boolean;
}

export function Chat({ requestId, isHelper }: ChatProps) {
  const { messages, isConnecting, isVoiceActive, sendMessage, toggleVoice } = useChat(
    requestId,
    isHelper
  );
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === (isHelper ? 'helper' : 'caller')
                ? 'justify-end'
                : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-3 ${
                message.sender === (isHelper ? 'helper' : 'caller')
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p>{message.content}</p>
              <span className="text-xs opacity-75">
                {new Date(message.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={isConnecting}
          />
          <Button type="submit" disabled={isConnecting || !newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={isVoiceActive ? 'destructive' : 'secondary'}
            onClick={toggleVoice}
            disabled={isConnecting}
          >
            {isVoiceActive ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
} 