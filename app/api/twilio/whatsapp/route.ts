import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { triage } from '@/lib/ai';

export const runtime = 'nodejs';

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
    // Extract the phone number from the WhatsApp ID (format: whatsapp:+1234567890)
    const phoneNumber = from.replace('whatsapp:', '');
    
    // Check if this is a new conversation or continuing an existing one
    const { data: existingRequest } = await supabaseAdmin
      .from('requests')
      .select('id, status')
      .eq('channel', 'whatsapp')
      .eq('external_id', phoneNumber)
      .eq('status', 'open')
      .maybeSingle();
    
    if (existingRequest) {
      // Add the message to an existing request
      await supabaseAdmin
        .from('messages')
        .insert({
          request_id: existingRequest.id,
          sender: 'caller',
          content: body
        });
      
      // Return a TwiML response with no message (we'll respond through the system)
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: {
          'Content-Type': 'text/xml'
        }
      });
    } else {
      // This is a new conversation, analyze with AI
      const result = await triage(body);
      
      // Create a new request
      const { data: newRequest, error } = await supabaseAdmin
        .from('requests')
        .insert({
          channel: 'whatsapp',
          external_id: phoneNumber,
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
      
      // Add automated initial response
      await supabaseAdmin
        .from('messages')
        .insert({
          request_id: newRequest.id,
          sender: 'ai',
          content: "Thank you for reaching out to Meld. A supporter will be with you shortly. Please feel free to share more about what's going on."
        });
      
      // Return a TwiML response with the initial auto-reply
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>Thank you for reaching out to Meld. A supporter will be with you shortly. Please feel free to share more about what's going on.</Message>
        </Response>`,
        {
          headers: {
            'Content-Type': 'text/xml'
          }
        }
      );
    }
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 