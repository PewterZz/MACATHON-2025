import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';
import { triage } from '@/lib/ai';
import { storeConversation } from '@/lib/weaviate';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// App URL for sharing
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meld-git-main-pewterzzs-projects.vercel.app';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Speech-to-text using Whisper API
const speechToText = async (audioBuffer: ArrayBuffer): Promise<string> => {
  try {
    const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg' });
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });
    
    const result = await response.json();
    return result.text || '';
  } catch (error) {
    console.error('Error in speech-to-text:', error);
    return '';
  }
};

// Text-to-speech using OpenAI TTS
const textToSpeech = async (text: string): Promise<ArrayBuffer> => {
  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
    });
    
    const buffer = await mp3.arrayBuffer();
    return buffer;
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    return new ArrayBuffer(0);
  }
};

// Store conversation in Weaviate
const storeInWeaviate = async (callSid: string, transcript: string, aiResponse: string, requestId: number) => {
  return storeConversation({
    className: 'VoiceChat',
    data: {
      callSid,
      transcript,
      aiResponse,
      requestId: requestId.toString(),
      timestamp: new Date().toISOString()
    }
  });
};

// Get AI response to user input
const getAIResponse = async (transcript: string, isLongInteraction: boolean = false, referenceCode?: string): Promise<string> => {
  try {
    const systemContent = isLongInteraction
      ? `You are a compassionate mental health first responder. 
         Your role is to provide immediate support, validation, and guidance to someone in distress.
         Keep responses conversational, warm and under 50 words so they can be easily converted to speech.
         Tell them their reference code is ${referenceCode || "not available"}, which they can use to continue this conversation on our web platform at ${APP_URL}.
         Include the reference code and website in your response.
         Do not identify yourself as an AI - just respond naturally as a supportive listener.`
      : `You are a compassionate mental health first responder. 
         Your role is to provide immediate support, validation, and guidance to someone in distress.
         Keep responses conversational, warm and under 50 words so they can be easily converted to speech.
         Do not identify yourself as an AI - just respond naturally as a supportive listener.`;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: transcript }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });
    
    return response.choices[0].message.content || "I'm here to listen and help. Can you tell me more about what's going on?";
  } catch (error) {
    console.error('Error getting AI response:', error);
    if (isLongInteraction && referenceCode) {
      return `I'm here to support you. To continue our conversation on our web platform, please use reference code ${referenceCode} at ${APP_URL}.`;
    }
    return "I'm here to listen. Please tell me what's on your mind.";
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callSid = searchParams.get('callSid');
  const referenceCode = searchParams.get('referenceCode');
  
  if (!callSid) {
    return new Response('Missing CallSid', { status: 400 });
  }
  
  console.log(`WebSocket stream request for call ${callSid} with reference code ${referenceCode || 'none'}`);
  
  const audioBuffers: ArrayBuffer[] = [];
  let transcriptText = '';
  let requestId: string | null = null;
  let interactionTime = 0;
  let referenceCodeProvided = false;
  
  try {
    const upgradeHeader = req.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }
    
    const { socket, response } = Deno.upgradeWebSocket(req as any);
    
    socket.onopen = () => {
      console.log(`WebSocket connection established for call ${callSid}`);
    };
    
    // Set up an interval to track conversation length
    const intervalId = setInterval(() => {
      interactionTime += 5;
    }, 5000);
    
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
              
              // Check if the request already exists or create it
              if (!requestId) {
                // Look up the request using callSid
                const { data: existingRequest } = await supabaseAdmin
                  .from('requests')
                  .select('id, reference_code')
                  .eq('channel', 'phone')
                  .eq('external_id', callSid)
                  .maybeSingle();
                
                if (existingRequest) {
                  requestId = existingRequest.id;
                  console.log(`Found existing request ID: ${requestId}`);
                } else {
                  // Create a new request if it doesn't exist yet
                  const result = await triage(transcriptText);
                  
                  const { data: newRequest, error } = await supabaseAdmin
                    .from('requests')
                    .insert({
                      channel: 'phone',
                      external_id: callSid,
                      summary: result.summary,
                      risk: result.risk,
                      status: result.risk >= 0.7 ? 'urgent' : 'open',
                      reference_code: referenceCode || null
                    })
                    .select()
                    .single();
                  
                  if (error) {
                    console.error('Error creating request:', error);
                  } else {
                    requestId = newRequest.id;
                    console.log(`Created new request ID: ${requestId}`);
                  }
                }
              }
              
              // Get AI response once we have enough transcript
              if (transcriptText.length > 20 && requestId) {
                // Determine if we should provide the reference code based on interaction time
                const shouldProvideReferenceCode = (interactionTime >= 60 || audioBuffers.length >= 500) && !referenceCodeProvided;
                
                let aiResponse;
                if (shouldProvideReferenceCode) {
                  // Get the reference code
                  let code = referenceCode;
                  if (!code) {
                    const { data } = await supabaseAdmin
                      .from('requests')
                      .select('reference_code')
                      .eq('id', requestId)
                      .single();
                    
                    code = data?.reference_code;
                  }
                  
                  aiResponse = await getAIResponse(transcriptText, true, code);
                  referenceCodeProvided = true;
                } else {
                  aiResponse = await getAIResponse(transcriptText);
                }
                
                // Convert AI response to speech and send it back
                const speechBuffer = await textToSpeech(aiResponse);
                if (speechBuffer.byteLength > 0) {
                  // Encode the audio to base64 and send it back as a media message
                  const base64Audio = Buffer.from(speechBuffer).toString('base64');
                  socket.send(JSON.stringify({
                    event: 'media',
                    streamSid: msg.streamSid,
                    media: {
                      payload: base64Audio
                    }
                  }));
                }
                
                // Store in Weaviate
                if (requestId) {
                  storeInWeaviate(callSid, transcriptText, aiResponse, parseInt(requestId)).catch(err => {
                    console.error('Non-blocking Weaviate storage error:', err);
                  });
                  
                  // Add user message
                  await supabaseAdmin
                    .from('messages')
                    .insert({
                      request_id: requestId,
                      sender: 'caller',
                      content: newTranscript.trim()
                    });
                  
                  // Add AI response
                  await supabaseAdmin
                    .from('messages')
                    .insert({
                      request_id: requestId,
                      sender: 'ai',
                      content: aiResponse
                    });
                }
              }
            }
          }
        } else if (msg.event === 'stop') {
          // Handle end of stream
          console.log('Streaming stopped');
          clearInterval(intervalId);
          socket.close();
        }
      }
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error: ${error}`);
      clearInterval(intervalId);
    };
    
    socket.onclose = async () => {
      console.log(`WebSocket connection closed for call ${callSid}`);
      clearInterval(intervalId);
      
      // If we have transcript but no messages saved yet
      if (transcriptText.length > 0 && !requestId) {
        // Create a new request if it doesn't exist
        const result = await triage(transcriptText);
        
        // Check if a request already exists for this call
        const { data: existingRequest } = await supabaseAdmin
          .from('requests')
          .select('id, reference_code')
          .eq('channel', 'phone')
          .eq('external_id', callSid)
          .maybeSingle();
        
        if (existingRequest) {
          // Update the existing request
          await supabaseAdmin
            .from('requests')
            .update({
              summary: result.summary,
              risk: result.risk,
              status: result.risk >= 0.7 ? 'urgent' : 'open',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingRequest.id);
          
          // Add initial message from caller
          await supabaseAdmin
            .from('messages')
            .insert({
              request_id: existingRequest.id,
              sender: 'caller',
              content: transcriptText.trim()
            });
          
          console.log(`Updated and added transcript to request ${existingRequest.id} for call ${callSid}`);
        } else {
          // Create a new request
          const { data, error } = await supabaseAdmin
            .from('requests')
            .insert({
              channel: 'phone',
              external_id: callSid,
              summary: result.summary,
              risk: result.risk,
              status: result.risk >= 0.7 ? 'urgent' : 'open',
              reference_code: referenceCode || null
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
    };
    
    return response;
  } catch (error) {
    console.error('Stream error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 