import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSMS, sendWhatsApp } from '@/lib/twilio';
import { getDiscordClient } from '@/lib/discord';

export const runtime = 'nodejs';

// Initialize Supabase client with service role for admin operations
const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and service role key are required');
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = params.id;
  
  try {
    const supabaseAdmin = createSupabaseAdmin();
    
    // Extract user ID from session
    const { data: { session }, error: authError } = await supabaseAdmin.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Check if the user is a helper
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_helper')
      .eq('id', userId)
      .single();
    
    if (profileError || !profile || !profile.is_helper) {
      return NextResponse.json({ error: 'Only helpers can claim requests' }, { status: 403 });
    }
    
    // Get the request details to determine the notification channel
    const { data: request, error: requestError } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'open')
      .single();
    
    if (requestError || !request) {
      return NextResponse.json({ error: 'Request not found or already claimed' }, { status: 404 });
    }
    
    // Update the request status to claimed
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('requests')
      .update({ status: 'claimed', claimed_by: userId })
      .eq('id', requestId)
      .eq('status', 'open')
      .select()
      .single();
    
    if (updateError) {
      return NextResponse.json({ error: 'Failed to claim request' }, { status: 500 });
    }
    
    // Send notification based on channel
    try {
      const channel = request.channel;
      const message = "A peer supporter has joined the conversation and will be with you shortly.";
      
      if (channel === 'phone') {
        // For phone, send an SMS
        await sendSMS(request.external_id, message);
      } else if (channel === 'whatsapp') {
        // For WhatsApp, send a WhatsApp message
        await sendWhatsApp(request.external_id, message);
      } else if (channel === 'discord') {
        // For Discord, send a DM
        try {
          const client = await getDiscordClient();
          const user = await client.users.fetch(request.external_id);
          await user.send({ content: message });
        } catch (discordError) {
          console.error('Error sending Discord message:', discordError);
        }
      }
      
      // Add system message
      await supabaseAdmin
        .from('messages')
        .insert({
          request_id: requestId,
          sender: 'ai',
          content: 'A peer supporter has joined the conversation.'
        });
    } catch (notifyError) {
      console.error('Error sending notification:', notifyError);
      // Continue despite notification error
    }
    
    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error claiming request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 