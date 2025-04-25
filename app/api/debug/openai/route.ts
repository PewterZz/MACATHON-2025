import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  try {
    // Log environment variable (masked for security)
    const apiKey = process.env.OPENAI_API_KEY || '';
    console.log('OPENAI_API_KEY length:', apiKey.length);
    console.log('OPENAI_API_KEY first 10 chars:', apiKey.substring(0, 10) + '...');
    
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key is not set' }, { status: 500 });
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Try a simple API call
    const models = await openai.models.list();
    
    return NextResponse.json({ 
      status: 'success',
      message: 'OpenAI API is properly configured',
      modelCount: models.data.length,
      firstFewModels: models.data.slice(0, 3).map(model => model.id)
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    return NextResponse.json({ 
      status: 'error',
      message: 'Failed to connect to OpenAI API',
      error: error.message,
      fullError: JSON.stringify(error)
    }, { status: 500 });
  }
} 