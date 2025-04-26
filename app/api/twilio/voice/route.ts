import { NextRequest, NextResponse } from 'next/server';
import { generateReferenceCode, twiml } from '@/lib/twilio';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// App URL for sharing
// const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'meld-git-main-pewterzzs-projects.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    
    // Log the incoming call
    console.log(`New call from ${from} with SID ${callSid}`);
    
    // Generate the reference code
    const referenceCode = generateReferenceCode();
    const spelledOutCode = referenceCode.split('').join(' '); // Add pauses between letters
    
    // Create a new TwiML response object
    const response = new twiml.VoiceResponse();
    
    // Initial message
    response.say(
      {
        voice: 'Polly.Joanna-Neural', // Example voice
      },
      'Hello, thank you for calling Meld. Your reference code is:'
    );
    
    // Repeat the code 4 times slowly
    for (let i = 0; i < 4; i++) {
      // Say the code spelled out
      response.say(
        {
          voice: 'Polly.Joanna-Neural',
        },
        `Code: <say-as interpret-as="spell-out">${referenceCode}</say-as>.`
      );
      // Add a pause after each repetition (except the last one)
      if (i < 3) {
        response.pause({ length: 2 }); // Pause for 2 seconds
      }
    }
    
    // Final message
    response.say(
      {
        voice: 'Polly.Joanna-Neural',
      },
      'Please use this code on our website to continue. Thank you for reaching out. Goodbye.'
    );
    
    // Hang up the call
    response.hangup();

    // Return the generated TwiML
    return new NextResponse(response.toString(), {
      headers: {
        'Content-Type': 'text/xml'
      }
    });
  } catch (error) {
    console.error('Error handling voice call:', error);
    
    // Return a simple error TwiML
    const errorResponse = new twiml.VoiceResponse();
    errorResponse.say('Sorry, there was an error processing your call.');
    errorResponse.hangup();
    
    return new NextResponse(
      errorResponse.toString(),
      {
        headers: {
          'Content-Type': 'text/xml'
        }
      }
    );
  }
} 