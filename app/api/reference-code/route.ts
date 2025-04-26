import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  
  if (!code) {
    // Redirect to home page if no code provided
    return NextResponse.redirect(new URL('/', req.url));
  }

  console.log(`Attempting to lookup reference code: [${code}]`); // Log the exact code value

  try {
    // Look up the reference code in the database
    const { data: request, error } = await supabaseAdmin
      .from('requests')
      .select('id, channel, reference_code, status')
      .eq('reference_code', code)
      .not('status', 'eq', 'closed')
      .maybeSingle();
    
    if (error || !request) {
      console.error('Error looking up reference code:', error);
      // Redirect to home page with error parameter
      return NextResponse.redirect(new URL('/?error=invalid_code', req.url));
    }
    
    // Redirect to anonymous chat page with the request ID
    return NextResponse.redirect(new URL(`/chat/anonymous/${request.id}?code=${code}`, req.url));
  } catch (error) {
    console.error('Error processing reference code:', error);
    return NextResponse.redirect(new URL('/?error=server_error', req.url));
  }
} 