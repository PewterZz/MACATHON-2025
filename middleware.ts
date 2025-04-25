import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  
  try {
    // Refresh session if expired
    const { data: { session } } = await supabase.auth.getSession();
    
    // If the user is signed in and trying to access the auth pages, redirect them to the dashboard
    if (session && (req.nextUrl.pathname.startsWith('/signin') || req.nextUrl.pathname.startsWith('/signup'))) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    
    // If user is not signed in and trying to access protected routes, redirect to sign in
    if (!session && 
        !req.nextUrl.pathname.startsWith('/signin') && 
        !req.nextUrl.pathname.startsWith('/signup') && 
        !req.nextUrl.pathname.startsWith('/api/auth') && 
        !req.nextUrl.pathname.startsWith('/_next') && 
        !req.nextUrl.pathname.startsWith('/auth') &&
        req.nextUrl.pathname !== '/') {
      return NextResponse.redirect(new URL('/signin', req.url));
    }
  } catch (error) {
    console.error('Middleware error:', error);
    // In case of error, allow the request to continue
    // This prevents blocking legitimate requests due to auth errors
  }
  
  return res;
}

// Only run middleware on the relevant routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|logo.png|styles|public).*)',
  ],
}; 