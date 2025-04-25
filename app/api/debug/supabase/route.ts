import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  // Check for required environment variables
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE: Boolean(process.env.SUPABASE_SERVICE_ROLE),
  };

  // Check if the URL is properly formatted
  let validUrl = false;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
      validUrl = true;
    }
  } catch (e) {
    validUrl = false;
  }

  // Test a simple Supabase query
  let dbConnected = false;
  let tables = [];
  let error = null;
  
  try {
    // Try to list all tables to check connection
    const { data, error: queryError } = await supabaseAdmin
      .from('requests')
      .select('count')
      .limit(1);
    
    if (!queryError) {
      dbConnected = true;
    } else {
      error = {
        message: queryError.message,
        code: queryError.code,
        details: queryError.details,
      };
    }
    
    // Get table list if possible
    const { data: tableData } = await supabaseAdmin.rpc('get_table_list');
    if (tableData) {
      tables = tableData;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error connecting to Supabase';
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: envStatus,
    supabase: {
      validUrl,
      dbConnected,
      tables,
      error,
    },
  });
} 