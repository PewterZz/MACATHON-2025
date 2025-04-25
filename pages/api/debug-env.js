export default function handler(req, res) {
  return res.status(200).json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not found',
    hasAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'yes' : 'no',
    nodeEnv: process.env.NODE_ENV,
  });
} 