import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { triage } from '@/lib/ai';

export const runtime = 'nodejs';

const speechToText = async (audioBuffer: ArrayBuffer): Promise<string> => {
  try {
    // In a real implementation, you would connect to a speech-to-text service 
    // like Whisper API or similar
    // This is a placeholder
    return "I've been feeling very anxious lately and having trouble sleeping. My finals are coming up and I'm worried about failing.";
  } catch (error) {
    console.error('Error in speech-to-text:', error);
    return '';
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callSid = searchParams.get('callSid');
  
  if (!callSid) {
    return new Response('Missing CallSid', { status: 400 });
  }
  
  const audioBuffers: ArrayBuffer[] = [];
  let transcriptText = '';
  let requestCreated = false;
  
  try {
    const upgradeHeader = req.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    
    const { socket, response } = Deno.upgradeWebSocket(req as any);
    
    socket.onopen = () => {
      console.log(`WebSocket connection established for call ${callSid}`);
    };
    
    socket.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        
        // Handle Twilio WebSocket protocol messages
        if (msg.event === 'start') {
          console.log('Streaming started:', msg);
        } else if (msg.event === 'media') {
          // Decode base64 audio data
          const audioData = Uint8Array.from(atob(msg.media.payload), c => c.charCodeAt(0)).buffer;
          audioBuffers.push(audioData);
          
          // Process audio in chunks (e.g., every 5 seconds)
          if (audioBuffers.length % 100 === 0) {
            // Process accumulated audio
            const newTranscript = await speechToText(new Blob([...audioBuffers]).arrayBuffer());
            
            if (newTranscript && newTranscript.length > 0) {
              transcriptText += ' ' + newTranscript;
              
              // Create a request once we have enough transcript
              if (!requestCreated && transcriptText.length > 50) {
                requestCreated = true;
                
                // Analyze with AI
                const result = await triage(transcriptText);
                
                // Create request in database
                const { data, error } = await supabaseAdmin
                  .from('requests')
                  .insert({
                    channel: 'phone',
                    external_id: callSid,
                    summary: result.summary,
                    risk: result.risk,
                    status: result.risk >= 0.7 ? 'urgent' : 'open'
                  })
                  .select()
                  .single();
                
                if (error) {
                  console.error('Error creating request:', error);
                } else {
                  // Add initial message from caller
                  await supabaseAdmin
                    .from('messages')
                    .insert({
                      request_id: data.id,
                      sender: 'caller',
                      content: transcriptText.trim()
                    });
                    
                  console.log(`Created request ${data.id} for call ${callSid}`);
                }
              }
            }
          }
        } else if (msg.event === 'stop') {
          // Handle end of stream
          console.log('Streaming stopped');
          socket.close();
        }
      }
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error: ${error}`);
    };
    
    socket.onclose = async () => {
      console.log(`WebSocket connection closed for call ${callSid}`);
      
      // If we have transcript but no request yet, create one
      if (transcriptText.length > 0 && !requestCreated) {
        // Analyze with AI
        const result = await triage(transcriptText);
        
        // Create request in database
        const { data, error } = await supabaseAdmin
          .from('requests')
          .insert({
            channel: 'phone',
            external_id: callSid,
            summary: result.summary,
            risk: result.risk,
            status: result.risk >= 0.7 ? 'urgent' : 'open'
          })
          .select()
          .single();
        
        if (error) {
          console.error('Error creating request:', error);
        } else {
          // Add initial message from caller
          await supabaseAdmin
            .from('messages')
            .insert({
              request_id: data.id,
              sender: 'caller',
              content: transcriptText.trim()
            });
            
          console.log(`Created request ${data.id} for call ${callSid}`);
        }
      }
    };
    
    return response;
  } catch (error) {
    console.error('Stream error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 