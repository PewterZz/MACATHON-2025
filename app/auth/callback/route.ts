import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/signin?error=auth', request.url));
    }
    
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
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            name: userName,
            is_helper: true,
            helper_score: 0
          });
        
        if (insertError) {
          console.error('Error creating profile:', insertError);
        }
      } else if (profileError) {
        console.error('Error checking profile:', profileError);
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL('/dashboard', request.url));
} 