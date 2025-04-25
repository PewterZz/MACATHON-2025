import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Public paths that should never redirect users regardless of auth state
  const isPublicPath = 
    req.nextUrl.pathname === '/' || 
    req.nextUrl.pathname === '/email-sent' ||
    req.nextUrl.pathname.startsWith('/api/') || 
    req.nextUrl.pathname.startsWith('/_next/') || 
    req.nextUrl.pathname.startsWith('/auth/');

  // Auth paths that should redirect authenticated users
  const isAuthPath = 
    req.nextUrl.pathname.startsWith('/signin') || 
    req.nextUrl.pathname.startsWith('/signup') || 
    req.nextUrl.pathname.startsWith('/reset-password');
  
  // Protected paths that need authentication
  const isProtectedPath = 
    !isPublicPath && 
    !isAuthPath &&
    !req.nextUrl.pathname.startsWith('/api') &&
    !req.nextUrl.pathname.includes('.');
  
  try {
    const supabase = createMiddlewareClient({ req, res });
    const { data: { session } } = await supabase.auth.getSession();
    
    // For authentication paths: if user is already logged in, redirect to dashboard
    if (session && isAuthPath) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    
    // For protected paths: if user is not logged in, redirect to sign in
    if (!session && isProtectedPath) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }
    
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // In case of error:
    // - Don't redirect from public paths
    if (isPublicPath) {
      return res;
    }
    
    // - Don't redirect from auth paths, let them work normally
    if (isAuthPath) {
      return res;
    }
    
    // - For protected paths, redirect to sign in
    if (isProtectedPath) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }
    
    return res;
  }
}

// Only run middleware on the relevant routes, explicit to avoid unnecessary processing
export const config = {
  matcher: [
    // Include paths that should be protected or redirected
    '/',
    '/signin',
    '/signup',
    '/dashboard/:path*',
    '/auth/:path*',
    '/reset-password',
    '/email-sent',
    // Exclude static files and API routes (except auth)
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|logo.png|styles|public).*)',
  ],
}; 