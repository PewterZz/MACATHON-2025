import { NextRequest, NextResponse } from 'next/server';
import { analyzeConversation } from '@/lib/ai';
import { supabaseAdmin } from '@/lib/supabase';
import { CoachingResponse } from '@/lib/ai';

// Mock response for test requests
const mockAnalysis: CoachingResponse = {
  suggestion: "Try asking open-ended questions to better understand their situation. Show empathy by acknowledging their feelings.",
  tone: "supportive",
  nextSteps: [
    "Ask about their support network",
    "Explore coping strategies they've used before",
    "Check if they have immediate safety concerns"
  ]
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Await the params before accessing the id property
  const { id: requestId } = await params;
  
  try {
    // Check if this is a test request
    const isTestRequest = requestId.startsWith('00000000');
    
    // Skip database verification for test requests
    if (!isTestRequest) {
      // Verify request exists and is claimed
      const { data: request, error: requestError } = await supabaseAdmin
        .from('requests')
        .select('id, claimed_by')
        .eq('id', requestId)
        .eq('status', 'claimed')
        .single();
      
      if (requestError || !request) {
        console.error('Request not found or not claimed:', requestError);
        return NextResponse.json({ error: 'Request not found or not claimed' }, { status: 404 });
      }
    } else {
      console.log('Processing test request:', requestId);
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { messages } = body;

    if (!Array.isArray(messages)) {
      console.error('Invalid messages format:', typeof messages);
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // For test requests, return mock data instead of calling OpenAI
    if (isTestRequest) {
      console.log('Returning mock analysis for test request');
      return NextResponse.json(mockAnalysis);
    }

    try {
      const analysis = await analyzeConversation(messages);
      return NextResponse.json(analysis);
    } catch (aiError) {
      console.error('OpenAI API error:', aiError.message);
      console.error('Full error:', JSON.stringify(aiError, null, 2));
      return NextResponse.json({ 
        error: 'AI analysis failed', 
        message: aiError.message,
        details: JSON.stringify(aiError)
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error analyzing chat:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 