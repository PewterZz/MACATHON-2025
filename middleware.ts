import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Always allow static resources and API routes to pass through without auth checks
  // This prevents infinite loops when loading resources
  if (
    req.nextUrl.pathname.includes('/_next/static/') ||
    req.nextUrl.pathname.includes('/_next/image/') ||
    req.nextUrl.pathname.includes('/_next/data/') ||
    req.nextUrl.pathname.includes('/static/') ||
    req.nextUrl.pathname.includes('/media/') ||
    req.nextUrl.pathname.includes('.woff2') ||
    req.nextUrl.pathname.includes('.ttf') ||
    req.nextUrl.pathname.includes('.svg') ||
    req.nextUrl.pathname.includes('.png') ||
    req.nextUrl.pathname.includes('.jpg') ||
    req.nextUrl.pathname.includes('.css') ||
    req.nextUrl.pathname.includes('.js')
  ) {
    return res;
  }
  
  // Also allow emergency-reset page
  if (req.nextUrl.pathname === '/emergency-reset') {
    return res;
  }
  
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
    !req.nextUrl.pathname.startsWith('/api');
  
  try {
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
    
    // Check if this is a direct page load (not an API call or navigation)
    const isPageLoad = !req.headers.get('x-middleware-prefetch') && 
                      req.headers.get('sec-fetch-dest') === 'document';
    
    // If this is a dashboard page load, check for a loading flag in the request
    const isDashboardPage = req.nextUrl.pathname.startsWith('/dashboard');
    const hasLoadingFlag = req.cookies.get('profile_loading_in_progress');
    
    // If we're in the middle of loading the profile, allow access to the dashboard
    if (isDashboardPage && hasLoadingFlag && isPageLoad) {
      console.log('Profile loading in progress, allowing access to dashboard');
      return res;
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      // Set a cookie flag for profile loading in progress
      if (isDashboardPage && isPageLoad) {
        const response = NextResponse.next();
        response.cookies.set('profile_loading_in_progress', 'true', { 
          maxAge: 30, // 30 seconds
          path: '/',
        });
        return response;
      }
      
      // For authentication paths: if user is already logged in, redirect to dashboard
      if (isAuthPath) {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    } else {
      // Clear the loading flag if no session
      if (isDashboardPage) {
        const response = NextResponse.redirect(new URL('/signin', req.url));
        response.cookies.delete('profile_loading_in_progress');
        return response;
      }
      
      // For protected paths: if user is not logged in, redirect to sign in
      if (isProtectedPath) {
        return NextResponse.redirect(new URL('/signin', req.url));
      }
    }
    
    return res;
  } catch (error) {
    console.error('Middleware error:', error);
    
    // In case of error, don't redirect from public paths
    if (isPublicPath) {
      return res;
    }
    
    // Don't redirect from auth paths, let them work normally
    if (isAuthPath) {
      return res;
    }
    
    // Allow access to emergency-reset page even if there's an error
    if (req.nextUrl.pathname === '/emergency-reset') {
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
    '/emergency-reset',
    // List specific paths instead of using negative lookahead with capturing groups
    '/:path*',
  ],
}; 