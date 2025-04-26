import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { triage } from '@/lib/ai';
import OpenAI from 'openai';
import { storeConversation } from '@/lib/weaviate';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

// App URL for sharing
const APP_URL = 'https://meld-git-main-pewterzzs-projects.vercel.app';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation in Weaviate - make completely non-blocking
const storeInWeaviate = async (phoneNumber: string, userMessage: string, aiResponse: string, requestId: number) => {
  // Run in a separate try/catch to ensure it never affects the main flow
  try {
    console.log(`Attempting to store WhatsApp message in Weaviate for ${phoneNumber}, requestId: ${requestId}`);
    
    // Don't await this - make it completely non-blocking
    storeConversation({
      className: 'WhatsAppChat',
      data: {
        phoneNumber,
        userMessage,
        aiResponse,
        requestId: requestId.toString(),
        timestamp: new Date().toISOString()
      }
    }).then(result => {
      console.log(`Weaviate storage result for ${phoneNumber}: ${result}`);
    }).catch(err => {
      console.error('Weaviate storage error (non-blocking):', err);
    });
    
    return true;
  } catch (error) {
    console.error('Error initiating Weaviate storage:', error);
    return false;
  }
};

// Generate a unique reference code
const generateReferenceCode = () => {
  // Generate a 6-character alphanumeric code
  return randomUUID().substring(0, 6).toUpperCase();
};

// Fetch conversation history - Return sender info as well
const getConversationHistory = async (requestId: number): Promise<{ sender: string, content: string }[]> => {
  try {
    console.log(`Fetching conversation history for request ID: ${requestId}`);
    
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('sender, content') // Keep sender
      .eq('request_id', requestId)
      .order('created_at', { ascending: true }); // Re-enabled ordering
    
    if (error) {
      console.error('Error fetching conversation history from Supabase:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('No conversation history found');
      return [];
    }
    
    console.log(`Found ${data.length} messages in history`);
    // Return the full objects
    return data.map(msg => ({ sender: msg.sender, content: msg.content }));
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return [];
  }
};

// Get AI response to user input - Use sender info from history
const getAIResponse = async (userMessage: string, conversationHistory: { sender: string, content: string }[] = [], isNewConversation: boolean = false, referenceCode?: string): Promise<string> => {
  try {
    console.log('Getting AI response with OpenAI');
    
    const systemMessage = isNewConversation 
      ? `You are a compassionate mental health first responder via WhatsApp. 
      Your role is to provide immediate support, validation, and guidance to someone in distress.
      Ask follow-up questions to understand their situation better. Be empathetic but professional.
      Let them know they can access our full support platform at ${APP_URL} using reference code ${referenceCode || "[CODE]"}.
      Focus on asking questions to understand their situation first before suggesting next steps.
      Never identify yourself as AI.`
      : `You are a compassionate mental health first responder via WhatsApp. 
      Your role is to provide immediate support, validation, and guidance to someone in distress.
      Carefully review the previous messages provided in the conversation history to understand the context.
      Continue the conversation naturally, referring to previous messages (like the user's name if mentioned) appropriately.
      If they seem to need additional support, remind them they can access our platform at ${APP_URL}.
      Be warm, empathetic and conversational. Never identify yourself as AI.`; // Strengthened prompt
    
    const messages: { role: "system" | "user" | "assistant", content: string }[] = [
      { role: "system", content: systemMessage }
    ];
    
    // Add conversation history if available - using sender info
    if (conversationHistory.length > 0) {
      console.log('Adding conversation history to prompt:', conversationHistory);
      conversationHistory.forEach(msg => {
        // Map 'caller' to 'user' and 'ai' or 'assistant' to 'assistant'
        const role = (msg.sender === 'caller') ? 'user' : 'assistant';
        messages.push({ role, content: msg.content });
      });
    }
    
    // Add the current message
    messages.push({ role: "user", content: userMessage });
    
    console.log('Sending messages to OpenAI:', JSON.stringify(messages, null, 2)); // Log the exact messages sent
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any, // Type assertion to satisfy OpenAI API typing
      temperature: 0.7,
      max_tokens: 350,
    });
    
    let aiResponse = response.choices[0].message.content || "I'm here to listen and help. Can you tell me more about what's going on?";
    
    // If this is a new conversation and we have a reference code, make sure it's included
    if (isNewConversation && referenceCode && !aiResponse.includes(referenceCode)) {
      aiResponse += `\n\nYou can access our full support platform at ${APP_URL} using reference code: ${referenceCode}`;
    }
    
    console.log('OpenAI response received successfully');
    return aiResponse;
  } catch (error) {
    console.error('Error getting AI response from OpenAI:', error);
    return "I'm here to listen. Please tell me what's on your mind. (Note: We're experiencing some technical difficulties, but I'm still here to help)";
  }
};

export async function POST(req: NextRequest) {
  console.log('WhatsApp webhook received');
  
  try {
    const formData = await req.formData();
    const messageSid = formData.get('MessageSid') as string;
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    
    console.log(`WhatsApp message received - SID: ${messageSid}, From: ${from}`);
    
    // Skip if we don't have the necessary data
    if (!messageSid || !from || !body) {
      console.error('Missing required fields in webhook');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Extract the phone number from the WhatsApp ID (format: whatsapp:+1234567890)
    const phoneNumber = from.replace('whatsapp:', '');
    console.log(`Processing message from phone number: ${phoneNumber}`);
    
    try {
      // Check if this is a new conversation or continuing an existing one
      console.log('Checking for existing request in Supabase');
      const { data: existingRequest, error: requestError } = await supabaseAdmin
        .from('requests')
        .select('id, status, reference_code')
        .eq('channel', 'whatsapp')
        .eq('external_id', phoneNumber)
        .eq('status', 'open')
        .maybeSingle();
      
      if (requestError) {
        console.error('Error querying Supabase for existing request:', requestError);
      }
      
      let aiResponse = '';
      
      if (existingRequest) {
        console.log(`Found existing request ID: ${existingRequest.id}`);
        
        // Get conversation history
        const history = await getConversationHistory(existingRequest.id);
        
        // Get AI response with conversation context
        aiResponse = await getAIResponse(body, history, false, existingRequest.reference_code);
        
        console.log('Adding user message to Supabase');
        // Add the user message to an existing request
        const { error: msgError } = await supabaseAdmin
          .from('messages')
          .insert({
            request_id: existingRequest.id,
            sender: 'caller',
            content: body
          });
        
        if (msgError) {
          console.error('Error adding user message to Supabase:', msgError);
        }
        
        console.log('Adding AI response to Supabase');
        // Add the AI response
        const { error: aiMsgError } = await supabaseAdmin
          .from('messages')
          .insert({
            request_id: existingRequest.id,
            sender: 'ai',
            content: aiResponse
          });
        
        if (aiMsgError) {
          console.error('Error adding AI response to Supabase:', aiMsgError);
        }
        
        // Store in Weaviate with request ID for better tracking - non-blocking
        storeInWeaviate(phoneNumber, body, aiResponse, existingRequest.id);
        
        console.log('Returning TwiML response for existing conversation');
        // Return a TwiML response with the AI message
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Message>${aiResponse}</Message>
          </Response>`,
          {
            headers: {
              'Content-Type': 'text/xml'
            }
          }
        );
      } else {
        console.log('Creating new conversation');
        
        // This is a new conversation, analyze with AI
        console.log('Performing triage analysis');
        let result;
        try {
          result = await triage(body);
          console.log('Triage result:', result);
        } catch (triageError) {
          console.error('Error in triage:', triageError);
          result = { summary: "User reached out for support", risk: 0.5 };
        }
        
        // Generate a reference code for anonymous web access
        const referenceCode = generateReferenceCode();
        console.log(`Generated reference code: ${referenceCode}`);
        
        // Create a new request in the database
        const { data: newRequest, error: requestError } = await supabaseAdmin
          .from('requests')
          .insert({
            channel: 'whatsapp',
            external_id: phoneNumber,
            reference_code: referenceCode,
            summary: result.summary,
            risk: result.risk,
            status: result.risk >= 0.6 ? 'urgent' : 'open',
          })
          .select()
          .single();
        
        if (requestError) {
          console.error('Error creating request in Supabase:', requestError);
          throw new Error('Failed to create request in database');
        }
        
        if (!newRequest) {
          console.error('No request returned from Supabase insert');
          throw new Error('Failed to create request - no data returned');
        }
        
        console.log(`Created new request with ID: ${newRequest.id}`);
        
        // Get AI response for the initial message (with reference code)
        aiResponse = await getAIResponse(body, [], true, referenceCode);
        
        console.log('Adding initial user message to Supabase');
        // Add the initial message
        const { error: initMsgError } = await supabaseAdmin
          .from('messages')
          .insert({
            request_id: newRequest.id,
            sender: 'caller',
            content: body
          });
        
        if (initMsgError) {
          console.error('Error adding initial message to Supabase:', initMsgError);
        }
        
        console.log('Adding AI response to Supabase');
        // Add AI response
        const { error: aiRespError } = await supabaseAdmin
          .from('messages')
          .insert({
            request_id: newRequest.id,
            sender: 'ai',
            content: aiResponse
          });
        
        if (aiRespError) {
          console.error('Error adding AI response to Supabase:', aiRespError);
        }
        
        // Store in Weaviate with request ID for better tracking - non-blocking
        storeInWeaviate(phoneNumber, body, aiResponse, newRequest.id);
        
        console.log('Returning TwiML response for new conversation');
        // Return a TwiML response with the AI response
        return new NextResponse(
          `<?xml version="1.0" encoding="UTF-8"?>
          <Response>
            <Message>${aiResponse}</Message>
          </Response>`,
          {
            headers: {
              'Content-Type': 'text/xml'
            }
          }
        );
      }
    } catch (processingError) {
      console.error('Error processing WhatsApp message:', processingError);
      
      // Always try to send a response, even if we encountered an error
      const errorResponse = "I'm here to help, but I'm experiencing some technical difficulties. Please try again in a moment.";
      
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${errorResponse}</Message>
        </Response>`,
        {
          headers: {
            'Content-Type': 'text/xml'
          }
        }
      );
    }
  } catch (outerError) {
    console.error('WhatsApp webhook critical error:', outerError);
    
    // Send a basic response in case of critical error
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>I'm here to help, but our system is having issues. Please try again shortly.</Message>
      </Response>`,
      {
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    );
  }
} 