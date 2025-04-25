import { createSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
      
      // Try with regular client first
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
      
      // If that fails, try with admin client to bypass RLS
      if (insertError) {
        const { data: adminProfile, error: adminInsertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: authData.user.id,
            name: userName,
            is_helper: true,
            helper_score: 0
          })
          .select()
          .single();
          
        profileCreationResult.adminAttempt = {
          success: !adminInsertError,
          data: adminProfile || null,
          error: adminInsertError || null
        };
      }
    }
    
    // Check RLS permissions
    const { data: rlsTest, error: rlsError } = await supabase
      .from('profiles')
      .select('count(*)', { count: 'exact', head: true });
    
    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        metadata: authData.user.user_metadata,
        emailConfirmed: authData.user.email_confirmed_at,
        createdAt: authData.user.created_at
      },
      profile: {
        exists: !!profile,
        data: profile || null,
        error: profileError ? {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details
        } : null
      },
      fix: {
        attempted: fixAttempted,
        result: profileCreationResult
      },
      permissions: {
        rlsTest: rlsTest !== null,
        canReadProfiles: !rlsError,
        error: rlsError ? {
          message: rlsError.message,
          code: rlsError.code,
          details: rlsError.details
        } : null
      },
      debug: {
        url: requestUrl.toString(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Profile debug error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error)
      }, 
      { status: 500 }
    );
  }
} 