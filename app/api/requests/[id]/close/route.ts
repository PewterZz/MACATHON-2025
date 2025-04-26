import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/supabase';

export const runtime = 'nodejs';

// Initialize Supabase client with service role for admin operations
const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE');
    throw new Error('Database configuration error - please check server logs');
  }
  
  return createClient<Database>(supabaseUrl, supabaseKey);
};

// Next.js 14 route handler as a standalone function (not using context.params)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the request ID directly
    const requestId = params.id;
    
    // Parse the request body to get user ID
    const requestBody: { userId?: string } = await req.json().catch(() => ({}));
    const userIdFromRequest = requestBody.userId;
    
    // Create admin client for all database operations
    const supabaseAdmin = createSupabaseAdmin();
    
    // If userId was provided in the request body, use it directly
    // Otherwise try to get it from the session
    let userId: string | undefined = userIdFromRequest;
    
    if (!userId) {
      console.log("No userId in request body, trying to get from session");
      // Try to get user from session as fallback
      const { data, error } = await supabaseAdmin.auth.getSession();
      
      if (error || !data.session) {
        console.error("No user session:", error || "Session is null");
        return NextResponse.json({ 
          error: 'Not authenticated', 
          message: 'Please provide userId in the request body or ensure you are logged in'
        }, { status: 401 });
      }
      
      userId = data.session.user.id;
    }
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log("Using user ID:", userId);
    
    // Get the request details first to ensure it exists and belongs to this user
    const { data: requestData, error: requestError } = await supabaseAdmin
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', userId)
      .single();
    
    if (requestError) {
      console.error("Request query error:", requestError);
      return NextResponse.json({ error: 'Failed to fetch request details' }, { status: 500 });
    }
    
    if (!requestData) {
      return NextResponse.json({ error: 'Request not found or you don\'t have permission to close it' }, { status: 404 });
    }
    
    console.log("Found request:", { requestId, ownerId: requestData.user_id });
    
    // Update the request status to closed
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('requests')
      .update({ status: 'closed' })
      .eq('id', requestId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: 'Failed to close request' }, { status: 500 });
    }
    
    // Add system message to indicate the request was closed by the user
    const { error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        request_id: requestId,
        sender: 'ai',
        content: 'This request has been marked as resolved by the user.'
      });
       
    if (messageError) {
      console.error("Error adding system message:", messageError);
      // Continue despite message error since the request was successfully closed
    }
    
    console.log("Request successfully closed:", { requestId });
    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error closing request:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 