import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { triage } from '@/lib/ai';
import OpenAI from 'openai';
import weaviate from 'weaviate-ts-client';

export const runtime = 'nodejs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Weaviate client
const weaviateClient = weaviate.client({
  scheme: process.env.WEAVIATE_SCHEME || 'https',
  host: process.env.WEAVIATE_HOST || 'localhost:8080',
  apiKey: process.env.WEAVIATE_API_KEY ? 
    new weaviate.ApiKey(process.env.WEAVIATE_API_KEY) : 
    undefined,
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
const storeInWeaviate = async (callSid: string, transcript: string, aiResponse: string) => {
  try {
    // Check if the class exists, if not create it
    const classObj = {
      class: 'CallTranscript',
      properties: [
        { name: 'callSid', dataType: ['string'] },
        { name: 'transcript', dataType: ['text'] },
        { name: 'aiResponse', dataType: ['text'] },
        { name: 'timestamp', dataType: ['date'] }
      ],
    };
    
    // Create the schema class if it doesn't exist
    try {
      await weaviateClient.schema.classCreator().withClass(classObj).do();
    } catch (e) {
      // Class might already exist, which is fine
    }
    
    // Add the data object
    await weaviateClient.data.creator()
      .withClassName('CallTranscript')
      .withProperties({
        callSid,
        transcript,
        aiResponse,
        timestamp: new Date().toISOString(),
      })
      .do();
      
    console.log(`Stored conversation in Weaviate for call ${callSid}`);
  } catch (error) {
    console.error('Error storing in Weaviate:', error);
  }
};

// Get AI response to user input
const getAIResponse = async (transcript: string): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a compassionate mental health first responder. 
          Your role is to provide immediate support, validation, and guidance to someone in distress.
          Keep responses conversational, warm and under 50 words so they can be easily converted to speech.
          Do not identify yourself as an AI - just respond naturally as a supportive listener.`
        },
        { role: "user", content: transcript }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });
    
    return response.choices[0].message.content || "I'm here to listen and help. Can you tell me more about what's going on?";
  } catch (error) {
    console.error('Error getting AI response:', error);
    return "I'm here to listen. Please tell me what's on your mind.";
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
              
              // Get AI response once we have enough transcript
              if (transcriptText.length > 20) {
                const aiResponse = await getAIResponse(transcriptText);
                
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
                storeInWeaviate(callSid, transcriptText, aiResponse);
                
                // Create a request once if not already done
                if (!requestCreated) {
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
                      
                    // Add AI response
                    await supabaseAdmin
                      .from('messages')
                      .insert({
                        request_id: data.id,
                        sender: 'ai',
                        content: aiResponse
                      });
                      
                    console.log(`Created request ${data.id} for call ${callSid}`);
                  }
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