import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const origin = requestUrl.origin;
  
  if (!code) {
    // If no code is present, redirect to signin
    return NextResponse.redirect(new URL('/signin', origin));
  }

  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/signin?error=auth', origin));
    }
    
    // If we have a user, check if they need a profile
    if (data?.user) {
      // Check if user already has a profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();
      
      // If no profile exists, create one
      if (profileError && profileError.code === 'PGRST116') {
        // Get user name from metadata or email
        const userName = data.user.user_metadata?.name || 
                         data.user.email?.split('@')[0] || 
                         'New User';
        
        // Get role from metadata or default to user
        const isHelper = data.user.user_metadata?.role === 'helper';
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name: userName,
            is_helper: isHelper,
            helper_score: 0
          });
        
        if (insertError) {
          console.error('Error creating profile:', insertError);
        }
      } else if (profileError) {
        console.error('Error checking profile:', profileError);
      }

      // Check if this is a new user (no email verified)
      if (!data.user.email_confirmed_at) {
        // If email isn't verified yet, redirect to email-sent page
        return NextResponse.redirect(new URL('/email-sent', origin));
      }
    }

    // URL to redirect to after sign in process completes
    return NextResponse.redirect(new URL('/dashboard', origin));
  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    return NextResponse.redirect(new URL('/signin?error=unknown', origin));
  }
} 