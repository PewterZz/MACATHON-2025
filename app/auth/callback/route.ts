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
    
    // If we have a user, ensure they have a profile
    if (data?.user) {
      try {
        console.log('Checking profile for user:', data.user.id);
        
        // Check if user already has a profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();
        
        // Create profile if it doesn't exist
        if (profileError && profileError.code === 'PGRST116') {
          // Get user name from metadata or email
          const userName = data.user.user_metadata?.name || 
                          data.user.email?.split('@')[0] || 
                          'New User';
          
          // Get role from metadata or default to user
          const isHelper = data.user.user_metadata?.role === 'helper';
          
          console.log('Creating new profile with data:', {
            id: data.user.id,
            name: userName,
            is_helper: isHelper
          });
          
          // Create the profile
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              name: userName,
              is_helper: isHelper,
              helper_score: 0
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('Error creating profile:', insertError);
          } else {
            console.log('Profile created successfully:', newProfile);
          }
          
          // Force a small delay to ensure the profile creation is processed
          await new Promise(resolve => setTimeout(resolve, 500));
        } else if (profileError) {
          console.error('Error checking profile:', profileError);
        } else {
          console.log('Profile already exists:', profile);
        }
      } catch (profileErr) {
        console.error('Unexpected error in profile creation:', profileErr);
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