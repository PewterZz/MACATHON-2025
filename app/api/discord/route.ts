import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDiscordClient } from '@/lib/discord';
import { verifyDiscordRequest } from '@/lib/discord/verify';
import { triage } from '@/lib/ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Verify the request is coming from Discord
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  
  if (!signature || !timestamp) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
  }
  
  const body = await req.text();
  
  const isValid = await verifyDiscordRequest(
    process.env.DISCORD_PUBLIC_KEY!,
    signature,
    timestamp,
    body
  );
  
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const jsonBody = JSON.parse(body);
  
  // Handle Discord interactions
  if (jsonBody.type === 1) {
    // Respond to ping
    return NextResponse.json({ type: 1 });
  } else if (jsonBody.type === 2) {
    // Command interaction
    const { name } = jsonBody.data;
    
    if (name === 'helpme') {
      const message = jsonBody.data.options.find((opt: any) => opt.name === 'message')?.value || '';
      const userId = jsonBody.member.user.id;
      const username = jsonBody.member.user.username;
      
      try {
        // Immediately acknowledge the interaction
        await fetch(`https://discord.com/api/v10/interactions/${jsonBody.id}/${jsonBody.token}/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 5, // Deferred channel message with source
          }),
        });
        
        // Process with AI
        const result = await triage(message);
        
        // Create a new request
        const { data: newRequest, error: requestError } = await supabaseAdmin
          .from('requests')
          .insert({
            channel: 'discord',
            external_id: userId,
            summary: result.summary,
            risk: result.risk,
            status: result.risk >= 0.6 ? 'urgent' : 'open'
          })
          .select()
          .single();
        
        if (requestError) {
          throw new Error(`Failed to create request: ${requestError.message}`);
        }
        
        // Add the initial message
        await supabaseAdmin
          .from('messages')
          .insert({
            request_id: newRequest.id,
            sender: 'caller',
            content: message
          });
        
        // Reply with a follow-up message
        await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${jsonBody.token}/messages/@original`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: "Thank you for reaching out to Meld. A supporter will be with you shortly. Please check your DMs for further communication.",
            flags: 64, // Ephemeral flag - only visible to the user
          }),
        });
        
        try {
          // Send a DM to the user using the Discord client
          const client = await getDiscordClient();
          const user = await client.users.fetch(userId);
          
          await user.send({
            content: "Thank you for reaching out to Meld. A supporter will be with you shortly. Please feel free to share more about what's going on."
          });
        } catch (dmError) {
          console.error('Failed to send DM:', dmError);
          // Continue even if DM fails - don't break the entire flow
        }
        
        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Discord command error:', error);
        
        // Send an error response
        await fetch(`https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${jsonBody.token}/messages/@original`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: "Sorry, there was an error processing your request. Please try again later.",
            flags: 64, // Ephemeral flag
          }),
        });
        
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
    }
  }
  
  return NextResponse.json({ error: 'Unhandled interaction type' }, { status: 400 });
} 