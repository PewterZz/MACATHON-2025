import { NextRequest, NextResponse } from 'next/server';
import { generateStreamTwiML, generateReferenceCode } from '@/lib/twilio';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// App URL for sharing
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meld-git-main-pewterzzs-projects.vercel.app';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid') as string;
  const from = formData.get('From') as string;
  
  // Get origin for websocket URL
  const host = headers().get('host') || '';
  const protocol = host.includes('localhost') ? 'ws' : 'wss';
  let websocketUrl = `${protocol}://${host}/api/voice/stream`;
  
  let referenceCode: string | undefined = undefined;
  
  try {
    // Check if we already have a request for this call
    const { data: existingRequest } = await supabaseAdmin
      .from('requests')
      .select('id, reference_code')
      .eq('channel', 'phone')
      .eq('external_id', callSid)
      .maybeSingle();
    
    if (!existingRequest) {
      // Generate a reference code for this call
      referenceCode = generateReferenceCode();
      console.log(`Generated reference code for call ${callSid}: ${referenceCode}`);
      
      // Create a placeholder entry in the database
      // The actual request with all details will be created in the stream handler
      await supabaseAdmin
        .from('requests')
        .insert({
          channel: 'phone',
          external_id: callSid,
          status: 'open',
          reference_code: referenceCode,
          summary: 'Voice call in progress'
        });
        
      // Add websocket query param to pass the referenceCode
      websocketUrl += `?callSid=${callSid}&referenceCode=${referenceCode}`;
    } else {
      // Use the existing reference code
      referenceCode = existingRequest.reference_code || undefined;
      websocketUrl += `?callSid=${callSid}&referenceCode=${referenceCode || ''}`;
    }
  } catch (error) {
    console.error('Error setting up the call:', error);
    // Continue with the call anyway, but without a reference code
    websocketUrl += `?callSid=${callSid}`;
    referenceCode = undefined;
  }
  
  // Generate TwiML with Stream directive to our websocket
  const twiml = generateStreamTwiML(websocketUrl, referenceCode);
  
  // Log the incoming call
  console.log(`New call from ${from} with SID ${callSid}`);
  
  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml'
    }
  });
} 