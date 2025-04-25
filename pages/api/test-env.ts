import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check environment variables
  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      firstFewChars: process.env.NEXT_PUBLIC_SUPABASE_URL 
        ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 8) + '...' 
        : null
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0
    },
    SUPABASE_SERVICE_ROLE: {
      exists: !!process.env.SUPABASE_SERVICE_ROLE,
      length: process.env.SUPABASE_SERVICE_ROLE?.length || 0
    }
  };

  res.status(200).json({ 
    message: 'Environment variables status',
    envStatus,
    nodeEnv: process.env.NODE_ENV
  });
} 