import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { streamCoach } from '@/lib/ai';

export const runtime = 'edge';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = params.id;
  
  try {
    const upgradeHeader = req.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    
    const { socket, response } = Deno.upgradeWebSocket(req as any);
    
    // Verify request exists and get initial messages
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select('id, claimed_by')
      .eq('id', requestId)
      .eq('status', 'claimed')
      .single();
    
    if (requestError || !request) {
      socket.close(1000, 'Request not found or not claimed');
      return response;
    }
    
    // Set up Supabase subscription to listen for new messages
    const channel = supabaseAdmin
      .channel(`messages:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `request_id=eq.${requestId}`
        },
        async (payload) => {
          // Fetch all messages for context (limited to last 20 for performance)
          const { data: messages } = await supabaseAdmin
            .from('messages')
            .select('*')
            .eq('request_id', requestId)
            .order('ts', { ascending: true })
            .limit(20);
          
          if (!messages || messages.length < 2) {
            return; // Need at least 2 messages for a conversation
          }
          
          const formattedMessages = messages.map(msg => ({
            sender: msg.sender,
            content: msg.content
          }));
          
          // Generate AI coaching suggestion
          let suggestionText = '';
          for await (const chunk of streamCoach({ messages: formattedMessages })) {
            suggestionText += chunk;
            // Send the chunk through the WebSocket
            socket.send(JSON.stringify({ type: 'chunk', content: chunk }));
          }
          
          // Once complete, save the full coaching message to the database
          if (suggestionText.trim()) {
            await supabaseAdmin
              .from('messages')
              .insert({
                request_id: requestId,
                sender: 'ai',
                content: suggestionText.trim()
              });
            
            // Send completion message
            socket.send(JSON.stringify({ type: 'complete' }));
          }
        }
      )
      .subscribe();
    
    socket.onopen = () => {
      console.log(`WebSocket connection established for coaching on request ${requestId}`);
      socket.send(JSON.stringify({ type: 'connected' }));
    };
    
    socket.onclose = () => {
      console.log(`WebSocket connection closed for coaching on request ${requestId}`);
      supabaseAdmin.removeChannel(channel);
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error for coaching on request ${requestId}:`, error);
    };
    
    return response;
  } catch (error) {
    console.error('Coaching WebSocket error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 