import { NextRequest, NextResponse } from 'next/server';
import { generateStreamTwiML } from '@/lib/twilio';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// App URL for sharing
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'meld-git-main-pewterzzs-projects.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    
    // Log the incoming call
    console.log(`New call from ${from} with SID ${callSid}`);
    
    // Generate a StreamURL without a reference code - we'll only create one when the user consents
    const streamUrl = `wss://${APP_URL}/api/voice/stream?callSid=${callSid}`;
    
    // Generate TwiML using the helper function (without providing a reference code)
    const twimlResponse = generateStreamTwiML(streamUrl);
    
    // Return TwiML 
    return new NextResponse(twimlResponse, {
      headers: {
        'Content-Type': 'text/xml'
      }
    });
  } catch (error) {
    console.error('Error handling voice call:', error);
    
    // Return a simple error TwiML
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, there was an error processing your call.</Say>
</Response>`,
      {
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    );
  }
} 