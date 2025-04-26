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

// Store conversation in Weaviate
const storeInWeaviate = async (phoneNumber: string, userMessage: string, aiResponse: string, requestId: number) => {
  try {
    return storeConversation({
      className: 'SMSChat',
      data: {
        phoneNumber,
        userMessage,
        aiResponse,
        requestId: requestId.toString(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    // Log but don't throw - ensure this never breaks the main flow
    console.error('Error storing in Weaviate:', error);
    return false;
  }
};

// Generate a unique reference code
const generateReferenceCode = () => {
  // Generate a 6-character alphanumeric code
  return randomUUID().substring(0, 6).toUpperCase();
};

// Get AI response to user input
const getAIResponse = async (userMessage: string, conversationHistory: string[] = [], isNewConversation: boolean = false, referenceCode?: string): Promise<string> => {
  try {
    const systemMessage = isNewConversation 
      ? `You are a compassionate mental health first responder via SMS. 
      Your role is to provide immediate support, validation, and guidance to someone in distress.
      Ask questions to understand their situation better. Be empathetic but professional.
      Let them know they can access our full support platform at ${APP_URL} using reference code ${referenceCode || "[CODE]"}.
      Focus on asking questions to understand their situation first before suggesting next steps.
      Keep responses very concise (under 160 characters if possible) since this is SMS.
      Never identify yourself as AI.`
      : `You are a compassionate mental health first responder via SMS. 
      Your role is to provide immediate support, validation, and guidance to someone in distress.
      Continue the conversation naturally, referring to previous messages as appropriate.
      If they seem to need additional support, remind them they can access our platform at ${APP_URL}.
      Keep responses concise (under 160 characters if possible) since this is SMS.
      Be warm, empathetic and conversational. Never identify yourself as AI.`;
    
    const messages = [
      { role: "system", content: systemMessage }
    ];
    
    // Add conversation history if available
    if (conversationHistory.length > 0) {
      for (let i = 0; i < conversationHistory.length; i++) {
        const role = i % 2 === 0 ? "user" : "assistant";
        messages.push({ role, content: conversationHistory[i] });
      }
    }
    
    // Add the current message
    messages.push({ role: "user", content: userMessage });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: messages as any, // Type assertion to satisfy OpenAI API typing
      temperature: 0.7,
      max_tokens: 150,
    });
    
    let aiResponse = response.choices[0].message.content || "I'm here to listen. What's going on?";
    
    // If this is a new conversation and we have a reference code, make sure it's included
    if (isNewConversation && referenceCode && !aiResponse.includes(referenceCode)) {
      // For SMS, we need to be extra concise
      aiResponse += ` Use code ${referenceCode} at ${APP_URL}`;
    }
    
    return aiResponse;
  } catch (error) {
    console.error('Error getting AI response:', error);
    return "I'm here to listen. Please tell me what's on your mind.";
  }
};

// Fetch conversation history
const getConversationHistory = async (requestId: number): Promise<string[]> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('sender, content')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });
    
    if (error || !data) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
    
    return data.map(msg => msg.content);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const messageSid = formData.get('MessageSid') as string;
  const from = formData.get('From') as string;
  const body = formData.get('Body') as string;
  
  // Skip if we don't have the necessary data
  if (!messageSid || !from || !body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  try {
    // Check if this is a new conversation or continuing an existing one
    const { data: existingRequest } = await supabaseAdmin
      .from('requests')
      .select('id, status, reference_code')
      .eq('channel', 'sms')
      .eq('external_id', from)
      .eq('status', 'open')
      .maybeSingle();
    
    let aiResponse = '';
    
    if (existingRequest) {
      // Get conversation history
      const history = await getConversationHistory(existingRequest.id);
      
      // Get AI response with conversation context
      aiResponse = await getAIResponse(body, history, false, existingRequest.reference_code);
      
      // Add the user message to an existing request
      await supabaseAdmin
        .from('messages')
        .insert({
          request_id: existingRequest.id,
          sender: 'caller',
          content: body
        });
      
      // Add the AI response
      await supabaseAdmin
        .from('messages')
        .insert({
          request_id: existingRequest.id,
          sender: 'ai',
          content: aiResponse
        });
      
      // Store in Weaviate (non-blocking) with request ID for better tracking
      storeInWeaviate(from, body, aiResponse, existingRequest.id).catch(err => {
        console.error('Non-blocking Weaviate storage error:', err);
      });
      
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
      // This is a new conversation, analyze with AI
      const result = await triage(body);
      
      // Generate a reference code for anonymous web access
      const referenceCode = generateReferenceCode();
      
      // Create a new request in the database
      const { data: newRequest, error: requestError } = await supabaseAdmin
        .from('requests')
        .insert({
          channel: 'sms',
          external_id: from,
          reference_code: referenceCode,
          summary: result.summary,
          risk: result.risk,
          status: result.risk >= 0.6 ? 'urgent' : 'open',
        })
        .select()
        .single();
      
      if (requestError) {
        console.error('Error creating request:', requestError);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
      }
      
      // Get AI response for the initial message (with reference code)
      aiResponse = await getAIResponse(body, [], true, referenceCode);
      
      // Add the initial message
      await supabaseAdmin
        .from('messages')
        .insert({
          request_id: newRequest.id,
          sender: 'caller',
          content: body
        });
      
      // Add AI response
      await supabaseAdmin
        .from('messages')
        .insert({
          request_id: newRequest.id,
          sender: 'ai',
          content: aiResponse
        });
      
      // Store in Weaviate (non-blocking) with request ID for better tracking
      storeInWeaviate(from, body, aiResponse, newRequest.id).catch(err => {
        console.error('Non-blocking Weaviate storage error:', err);
      });
      
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
  } catch (error) {
    console.error('SMS webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 