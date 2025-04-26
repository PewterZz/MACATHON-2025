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
const getAIResponse = async (transcript: string, userContext: {
  interactionTime: number,
  hasAskedForConsent: boolean,
  userHasConsented: boolean,
  referenceCode?: string,
}): Promise<string> => {
  try {
    let systemContent = '';
    
    // Different prompts based on the stage of the conversation
    if (userContext.userHasConsented && userContext.referenceCode) {
      // User has already consented and we have a reference code to provide
      systemContent = `You are Meldy, a compassionate mental health first responder from Meld. 
         Your role is to provide immediate support, validation, and guidance to someone in distress.
         Keep responses conversational, warm and under 50 words so they can be easily converted to speech.
         Tell them their reference code is ${userContext.referenceCode}, which they can use to continue this conversation on our web platform at ${APP_URL}.
         Include the reference code (spelled out letter by letter) and website in your response.
         Do not identify yourself as an AI - respond as Meldy, a supportive listener from Meld.`;
    } else if (userContext.hasAskedForConsent && !userContext.userHasConsented) {
      // We've asked for consent but haven't received clear confirmation yet
      systemContent = `You are Meldy, a compassionate mental health first responder from Meld.
         Your role is to determine if the user has given consent to create a session.
         If their response sounds like agreement (yes, sure, okay, etc.), respond with CONSENT_GIVEN at the start of your message, then continue with a supportive response.
         If they haven't clearly given consent, continue to be supportive but don't pressure them.
         Keep responses conversational, warm and under 50 words so they can be easily converted to speech.
         Do not identify yourself as an AI - respond as Meldy, a supportive listener from Meld.`;
    } else if (userContext.interactionTime >= 30 && !userContext.hasAskedForConsent) {
      // After 30 seconds, ask for consent to create a session if we haven't already
      systemContent = `You are Meldy, a compassionate mental health first responder from Meld.
         Your role is to provide immediate support, validation, and guidance to someone in distress.
         It's been over 30 seconds in the conversation, so you should now ask if they would like to create a session to speak with a peer supporter.
         Explain that you'll provide a reference code they can use to continue this conversation on our web platform.
         Keep responses conversational, warm and under 50 words so they can be easily converted to speech.
         Do not identify yourself as an AI - respond as Meldy, a supportive listener from Meld.`;
    } else {
      // Standard response for early in the conversation
      systemContent = `You are Meldy, a compassionate mental health first responder from Meld. 
         Your role is to provide immediate support, validation, and guidance to someone in distress.
         Keep responses conversational, warm and under 50 words so they can be easily converted to speech.
         Do not identify yourself as an AI - respond as Meldy, a supportive listener from Meld.`;
    }
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: transcript }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });
    
    const aiResponse = response.choices[0].message.content || "I'm Meldy from Meld. I'm here to listen and help. Can you tell me more about what's going on?";
    
    // Check if the AI detected consent
    if (aiResponse.startsWith("CONSENT_GIVEN")) {
      return aiResponse.replace("CONSENT_GIVEN", "").trim();
    }
    
    return aiResponse;
  } catch (error) {
    console.error('Error getting AI response:', error);
    return "I'm Meldy from Meld. I'm here to listen. Please tell me what's on your mind.";
  }
};

// Generate a text summary of the conversation
const generateConversationSummary = async (transcript: string): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: "You are a mental health conversation summarizer. Create a brief, compassionate summary of the key concerns and emotional state expressed by the caller. Focus on the main issues they're facing. Keep it under 100 words and maintain a respectful, clinical tone."
        },
        { role: "user", content: transcript }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });
    
    return response.choices[0].message.content || "Voice call in progress";
  } catch (error) {
    console.error('Error generating conversation summary:', error);
    return "Voice call in progress";
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callSid = searchParams.get('callSid');
  
  if (!callSid) {
    return new Response('Missing CallSid', { status: 400 });
  }
  
  console.log(`WebSocket stream request for call ${callSid}`);
  
  const audioBuffers: ArrayBuffer[] = [];
  let transcriptText = '';
  let requestId: string | null = null;
  
  // Context to track the conversation state
  const userContext = {
    interactionTime: 0,
    hasAskedForConsent: false,
    userHasConsented: false,
    referenceCode: undefined as string | undefined
  };
  
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
      userContext.interactionTime += 5;
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
              
              // Get AI response once we have enough transcript
              if (transcriptText.length > 20) {
                // Check if enough time has passed to ask for consent
                if (userContext.interactionTime >= 30 && !userContext.hasAskedForConsent) {
                  userContext.hasAskedForConsent = true;
                }
                
                // Get AI response based on the current context
                const aiResponse = await getAIResponse(transcriptText, userContext);
                
                // Check if this is the first time we're detecting consent
                if (userContext.hasAskedForConsent && !userContext.userHasConsented && 
                    (transcriptText.toLowerCase().includes('yes') || 
                     transcriptText.toLowerCase().includes('sure') || 
                     transcriptText.toLowerCase().includes('okay') || 
                     transcriptText.toLowerCase().includes('ok'))) {
                  
                  userContext.userHasConsented = true;
                  
                  // Generate a reference code now that we have consent
                  const { generateReferenceCode } = await import('@/lib/twilio');
                  userContext.referenceCode = generateReferenceCode();
                  
                  // Generate a text summary of the conversation so far
                  const conversationSummary = await generateConversationSummary(transcriptText);
                  
                  // Create or update the request in the database
                  const result = await triage(transcriptText);
                  
                  const { data: newRequest, error: requestError } = await supabaseAdmin
                    .from('requests')
                    .insert({
                      channel: 'phone',
                      external_id: callSid,
                      reference_code: userContext.referenceCode,
                      summary: conversationSummary,
                      risk: result.risk,
                      status: result.risk >= 0.6 ? 'urgent' : 'open',
                    })
                    .select()
                    .single();
                  
                  if (requestError) {
                    console.error('Error creating request:', requestError);
                  } else {
                    requestId = newRequest.id;
                    console.log(`Created new request ID: ${requestId} with reference code ${userContext.referenceCode}`);
                  }
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
                
                // Store in Weaviate and database only if we have created a request
                if (requestId) {
                  storeInWeaviate(callSid, transcriptText, aiResponse, parseInt(requestId)).catch(err => {
                    console.error('Non-blocking Weaviate storage error:', err);
                  });
                  
                  // Add user message and AI response to the database
                  await supabaseAdmin
                    .from('messages')
                    .insert([
                      {
                        request_id: requestId,
                        role: 'user',
                        content: transcriptText,
                      },
                      {
                        request_id: requestId,
                        role: 'assistant',
                        content: aiResponse,
                      }
                    ]);
                  
                  // Periodically update the conversation summary
                  if (audioBuffers.length % 300 === 0) { // Update summary every ~15 seconds
                    const updatedSummary = await generateConversationSummary(transcriptText);
                    
                    await supabaseAdmin
                      .from('requests')
                      .update({
                        summary: updatedSummary,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', requestId);
                  }
                }
              }
            }
          }
        } else if (msg.event === 'stop') {
          console.log('Streaming stopped:', msg);
          clearInterval(intervalId);
          
          // If we have a request ID, make sure to update the summary one last time
          if (requestId && transcriptText.length > 20) {
            const finalSummary = await generateConversationSummary(transcriptText);
            
            await supabaseAdmin
              .from('requests')
              .update({
                summary: finalSummary,
                updated_at: new Date().toISOString()
              })
              .eq('id', requestId);
          }
          
          socket.close();
        }
      }
    };
    
    socket.onclose = () => {
      console.log(`WebSocket connection closed for call ${callSid}`);
      clearInterval(intervalId);
    };
    
    socket.onerror = (error) => {
      console.error(`WebSocket error for call ${callSid}:`, error);
      clearInterval(intervalId);
    };
    
    return response;
  } catch (error) {
    console.error('Error in voice stream handler:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 