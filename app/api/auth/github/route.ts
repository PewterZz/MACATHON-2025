import { createSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient();
  
  // Get the URL of the current request
  const requestUrl = new URL(req.url);
  
  // Create a Supabase auth URL for GitHub OAuth
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${requestUrl.origin}/auth/callback`,
      scopes: 'read:user user:email'
    },
  });

  if (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Redirect to the GitHub OAuth login page
  return NextResponse.redirect(data.url);
} 