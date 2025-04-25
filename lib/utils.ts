import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validates that all required environment variables are present
 * Log warnings for missing variables
 */
export function validateEnvironment() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]

  const missingVars = requiredVars.filter(
    varName => typeof process.env[varName] === 'undefined' || process.env[varName] === ''
  )

  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`)
    
    // In development, provide more helpful information
    if (process.env.NODE_ENV === 'development') {
      console.error(`
==========================================================
ENVIRONMENT VARIABLE ERROR
==========================================================
Some required environment variables are missing. 
Make sure you have a .env.local file in your project root
with the following variables:

${requiredVars.map(v => `${v}=your_value_here`).join('\n')}

For Supabase variables:
1. Go to your Supabase project dashboard
2. Navigate to Project Settings > API
3. Copy the URL and anon/public key
==========================================================
`)
    }
    
    return false
  }
  
  return true
}
