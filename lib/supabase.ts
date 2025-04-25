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
  console.log('Creating Supabase client with:', { hasUrl: Boolean(supabaseUrl), hasKey: Boolean(supabaseAnonKey) });
  return createClientComponentClient<Database>({
    supabaseUrl,
    supabaseKey: supabaseAnonKey,
  });
};

// For direct use on the client
export const supabase = typeof window !== 'undefined' ? createSupabaseClient() : null; 