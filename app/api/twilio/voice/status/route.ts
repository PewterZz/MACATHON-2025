import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

// App URL for sharing
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://meld-git-main-pewterzzs-projects.vercel.app';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const duration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    
    console.log(`Call ${callSid} status: ${callStatus}, duration: ${duration}s`);
    
    // Store call status in database
    const { data: existingRequest } = await supabaseAdmin
      .from('requests')
      .select('id, reference_code')
      .eq('channel', 'phone')
      .eq('external_id', callSid)
      .maybeSingle();
    
    if (existingRequest) {
      // Update the request with call status
      await supabaseAdmin
        .from('requests')
        .update({
          call_status: callStatus,
          call_duration: duration ? parseInt(duration) : null,
          recording_url: recordingUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRequest.id);
      
      // Add a system message with the call status
      if (['completed', 'failed', 'busy', 'no-answer'].includes(callStatus)) {
        let systemMessage = `Call ${callStatus}${duration ? `, duration: ${duration}s` : ''}`;
        
        // Add reference code information if available
        if (existingRequest.reference_code && callStatus === 'completed') {
          systemMessage += `. Reference code ${existingRequest.reference_code} can be used to continue this conversation at ${APP_URL}.`;
        }
        
        await supabaseAdmin
          .from('messages')
          .insert({
            request_id: existingRequest.id,
            sender: 'system',
            content: systemMessage
          });
      }
    }
    
    return new NextResponse('', { status: 200 });
  } catch (error) {
    console.error('Error handling call status:', error);
    return new NextResponse('Error processing call status', { status: 500 });
  }
} 