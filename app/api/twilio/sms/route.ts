import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { triage } from '@/lib/ai';
import OpenAI from 'openai';
import { storeConversation } from '@/lib/weaviate';

export const runtime = 'nodejs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation in Weaviate
const storeInWeaviate = async (phoneNumber: string, userMessage: string, aiResponse: string) => {
  return storeConversation({
    className: 'SMSChat',
    data: {
      phoneNumber,
      userMessage,
      aiResponse,
      timestamp: new Date().toISOString()
    }
  });
};

// Get AI response to user input
const getAIResponse = async (userMessage: string, conversationHistory: string[] = []): Promise<string> => {
  try {
    const messages = [
      {
        role: "system",
        content: `You are a compassionate mental health first responder via SMS. 
        Your role is to provide immediate support, validation, and guidance to someone in distress.
        Keep responses conversational, warm, and helpful. 
        Be very concise (under 160 characters if possible) since this is SMS.
        Do not identify yourself as an AI - just respond naturally as a supportive listener.`
      }
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
      messages,
      temperature: 0.7,
      max_tokens: 150,
    });
    
    return response.choices[0].message.content || "I'm here to listen. What's going on?";
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
      .select('id, status')
      .eq('channel', 'sms')
      .eq('external_id', from)
      .eq('status', 'open')
      .maybeSingle();
    
    let aiResponse = '';
    
    if (existingRequest) {
      // Get conversation history
      const history = await getConversationHistory(existingRequest.id);
      
      // Get AI response with conversation context
      aiResponse = await getAIResponse(body, history);
      
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
      
      // Store in Weaviate (non-blocking)
      storeInWeaviate(from, body, aiResponse).catch(err => {
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
      
      // Get AI response for the initial message
      aiResponse = await getAIResponse(body);
      
      // Create a new request
      const { data: newRequest, error } = await supabaseAdmin
        .from('requests')
        .insert({
          channel: 'sms',
          external_id: from,
          summary: result.summary,
          risk: result.risk,
          status: result.risk >= 0.7 ? 'urgent' : 'open'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating request:', error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
      }
      
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
      
      // Store in Weaviate (non-blocking)
      storeInWeaviate(from, body, aiResponse).catch(err => {
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