import { NextRequest, NextResponse } from 'next/server';
import { generateStreamTwiML } from '@/lib/twilio';
import { headers } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid') as string;
  const from = formData.get('From') as string;
  
  // Get origin for websocket URL
  const host = headers().get('host') || '';
  const protocol = host.includes('localhost') ? 'ws' : 'wss';
  const websocketUrl = `${protocol}://${host}/api/voice/stream`;
  
  // Generate TwiML with Stream directive to our websocket
  const twiml = generateStreamTwiML(websocketUrl);
  
  // Log the incoming call
  console.log(`New call from ${from} with SID ${callSid}`);
  
  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml'
    }
  });
} 