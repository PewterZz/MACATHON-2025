"use client"

import React from "react"
import { useState, useEffect, useRef, Component, type ErrorInfo, type ReactNode } from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Github } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useSimpleToast, ToastContextType } from "@/components/SimpleToaster"
// Fallback if context isn't available
import { showToast } from "@/components/SimpleToaster"

// Simple Error Boundary Component with try/catch wrapper
export default function SignIn() {
  try {
    return (
      <ErrorBoundaryWrapper>
        <SignInForm />
      </ErrorBoundaryWrapper>
    );
  } catch (error) {
    console.error("Error rendering SignIn:", error);
    return <SignInErrorFallback />;
  }
}

// Normal functional component wrapper around class component to avoid React namespace issues
function ErrorBoundaryWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary fallback={<SignInErrorFallback />}>
      {children}
    </ErrorBoundary>
  );
}

// Simple Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error in component:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Fallback component to render when error occurs
function SignInErrorFallback() {
  return (
    <Card className="w-full bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100">Sign In</CardTitle>
        <CardDescription className="text-slate-300">Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="p-4 mb-4 bg-red-900/20 border border-red-800 rounded-md">
          <h3 className="text-red-400 font-medium mb-2">Something went wrong</h3>
          <p className="text-sm text-slate-300">
            We encountered an error while loading the sign-in form. Please try refreshing the page.
          </p>
          <Button 
            className="mt-4 bg-slate-700 hover:bg-slate-600 text-slate-100"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </div>
        <p className="text-center text-slate-400 mt-4">
          Don't have an account?{" "}
          <a href="/signup" className="text-[#3ECF8E] hover:underline">Sign up</a>
        </p>
      </CardContent>
    </Card>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)
  const router = useRouter()
  const { user, isLoading: authLoading, signIn } = useAuth()
  const errorShownRef = useRef(false);
  
  // Initialize toastContext with a proper type
  let toastContext: ToastContextType | undefined;
  try {
    toastContext = useSimpleToast();
  } catch (error) {
    console.error("Toast context not available:", error);
    // We'll use the direct DOM method as fallback
  }

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (user && !authLoading) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    errorShownRef.current = false;

    try {
      await signIn(email, password)
    } catch (error: any) {
      console.error("Sign in failed:", error)
      
      try {
        // Prevent duplicate error messages
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          
          // Check for specific error messages related to invalid credentials
          if (error.message === 'Invalid login credentials' || 
              error.message?.includes('invalid') || 
              error.message?.includes('credentials') ||
              error.name === 'AuthApiError') {
            
            if (toastContext) {
              toastContext.addToast(
                "The email or password you entered is incorrect. Please try again.",
                "error",
                "Invalid Credentials"
              );
            } else {
              // Fallback to direct DOM method
              showToast(
                "The email or password you entered is incorrect. Please try again.", 
                "error", 
                "Invalid Credentials"
              );
            }
          } else {
            // Generic error handling for other types of errors
            if (toastContext) {
              toastContext.addToast(
                "There was a problem signing in. Please try again later.",
                "error",
                "Sign in failed"
              );
            } else {
              // Fallback to direct DOM method
              showToast(
                "There was a problem signing in. Please try again later.", 
                "error", 
                "Sign in failed"
              );
            }
          }
        }
      } catch (toastError) {
        console.error("Failed to show toast notification:", toastError);
        // Ultimate fallback alert if all toast methods fail
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          window.setTimeout(() => {
            alert("Sign in failed: " + (error.message || "Please check your credentials and try again."));
          }, 100);
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGithubSignIn = async () => {
    setIsGithubLoading(true)
    errorShownRef.current = false;
    
    try {
      router.push('/api/auth/github')
    } catch (error) {
      console.error("GitHub sign in failed:", error)
      try {
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          if (toastContext) {
            toastContext.addToast(
              "There was a problem logging in with GitHub. Please try again.",
              "error",
              "GitHub login failed"
            );
          } else {
            // Fallback to direct DOM method
            showToast(
              "There was a problem logging in with GitHub. Please try again.", 
              "error", 
              "GitHub login failed"
            );
          }
        }
      } catch (toastError) {
        console.error("Failed to show toast notification:", toastError);
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          window.setTimeout(() => {
            alert("GitHub login failed. Please try again later.");
          }, 100);
        }
      }
      setIsGithubLoading(false)
    }
  }

  return (
    <Card className="w-full bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100">Sign In</CardTitle>
        <CardDescription className="text-slate-300">Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-200">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-slate-200">
                Password
              </label>
              <Link href="/reset-password" className="text-xs text-[#3ECF8E] hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-800 px-2 text-slate-400">Or continue with</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full border-slate-700 text-slate-100 hover:bg-slate-700"
          onClick={handleGithubSignIn}
          disabled={isGithubLoading}
        >
          <Github className="mr-2 h-4 w-4" />
          {isGithubLoading ? "Loading..." : "GitHub"}
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#3ECF8E] hover:underline">
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
