import { supabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const debug = {
    env: {
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE),
    },
    tables: {},
    requestTest: null,
    messageTest: null,
    insertTest: null
  };

  try {
    // Test database connection and table access
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
    
    debug.tables = {
      success: !tablesError,
      tables: tables?.map(t => t.tablename),
      error: tablesError ? tablesError.message : null
    };

    // Test requests table
    const { data: requests, error: requestsError } = await supabaseAdmin
      .from('requests')
      .select('*')
      .limit(1);
    
    debug.requestTest = {
      success: !requestsError,
      data: requests,
      error: requestsError ? requestsError.message : null
    };

    // Test messages table
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .limit(1);
    
    debug.messageTest = {
      success: !messagesError,
      data: messages,
      error: messagesError ? messagesError.message : null
    };

    // Test inserting a message with admin rights to a test request
    if (requests && requests.length > 0) {
      const testRequestId = requests[0].id;
      const { data: insertData, error: insertError } = await supabaseAdmin
        .from('messages')
        .insert({
          request_id: testRequestId,
          sender: 'ai',
          content: 'Debug test message'
        })
        .select()
        .single();
      
      debug.insertTest = {
        success: !insertError,
        data: insertData,
        error: insertError ? insertError.message : null,
        requestId: testRequestId
      };
    }

    return NextResponse.json(debug);
  } catch (error) {
    return NextResponse.json({
      error: (error instanceof Error) ? error.message : 'Unknown error',
      debug
    }, { status: 500 });
  }
} 