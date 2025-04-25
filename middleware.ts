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
    req.nextUrl.pathname.startsWith('/auth/') ||
    req.nextUrl.pathname.includes('.woff2') ||
    req.nextUrl.pathname.includes('.ttf') ||
    req.nextUrl.pathname.includes('.css') ||
    req.nextUrl.pathname.includes('.js');

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
    // Skip auth checks for static resources to prevent infinite loops
    if (req.nextUrl.pathname.includes('static') || 
        req.nextUrl.pathname.includes('media') ||
        req.nextUrl.pathname.includes('.woff2')) {
      return res;
    }
    
    const supabase = createMiddlewareClient({ 
      req, 
      res,
      options: {
        cookies: {
          name: 'sb-auth-token',
          lifetime: 60 * 60 * 24 * 7, // 1 week
          domain: req.nextUrl.hostname,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production'
        }
      }
    });
    
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
    
    // In case of error, don't redirect from public paths or static assets
    if (isPublicPath) {
      return res;
    }
    
    // Don't redirect from auth paths, let them work normally
    if (isAuthPath) {
      return res;
    }
    
    // For protected paths, redirect to sign in
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