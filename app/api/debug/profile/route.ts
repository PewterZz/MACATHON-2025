import { createSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url);
    const supabase = createSupabaseClient();
    
    // Get current user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authData.user) {
      return NextResponse.json(
        { 
          error: 'Authentication error', 
          details: authError,
          message: 'User not authenticated'
        }, 
        { status: 401 }
      );
    }
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();
    
    // Check for profile creation
    let profileCreationResult = null;
    let fixAttempted = false;
    
    // If no profile exists, create one
    if (profileError && profileError.code === 'PGRST116' && requestUrl.searchParams.get('fix') === 'true') {
      fixAttempted = true;
      
      // Get user name from metadata or email
      const userName = authData.user.user_metadata?.name || 
                       authData.user.email?.split('@')[0] || 
                       'New User';
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          name: userName,
          is_helper: true,
          helper_score: 0
        })
        .select()
        .single();
      
      profileCreationResult = {
        success: !insertError,
        data: newProfile || null,
        error: insertError || null
      };
    }
    
    // Check RLS permissions
    const { data: rlsTest, error: rlsError } = await supabase
      .from('profiles')
      .select('count(*)', { count: 'exact', head: true });
    
    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        metadata: authData.user.user_metadata
      },
      profile: {
        exists: !!profile,
        data: profile || null,
        error: profileError || null,
        fixAttempted,
        profileCreationResult
      },
      rlsPermissions: {
        canReadProfiles: !rlsError,
        error: rlsError
      },
      instructions: profileError && !fixAttempted 
        ? "Add ?fix=true to create missing profile" 
        : null
    });

  } catch (error) {
    console.error('Debug profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 