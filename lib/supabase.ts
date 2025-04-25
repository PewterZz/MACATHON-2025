import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';

// Get environment variables or fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE || '';

// Check for required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required Supabase environment variables:', { 
    hasUrl: Boolean(supabaseUrl), 
    hasAnonKey: Boolean(supabaseAnonKey)
  });
}

// For use in server components and API routes
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceRole || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
);

// For use in client components
export const createSupabaseClient = () => {
  // Check if the environment variables are available
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase client creation failed: Missing environment variables', { 
      hasUrl: Boolean(supabaseUrl), 
      hasKey: Boolean(supabaseAnonKey),
      url: supabaseUrl ? supabaseUrl.substring(0, 10) + '...' : 'undefined',
    });
    // We still attempt to create the client, but it will likely fail on operations
  }

  try {
    return createClientComponentClient<Database>({
      supabaseUrl,
      supabaseKey: supabaseAnonKey,
    });
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    // Throw the error for better debugging in development
    if (process.env.NODE_ENV === 'development') {
      throw error;
    }
    // Return a minimal client that will gracefully fail on operations
    return createClientComponentClient<Database>();
  }
};

// For direct use on the client
export const supabase = typeof window !== 'undefined' ? createSupabaseClient() : null; 