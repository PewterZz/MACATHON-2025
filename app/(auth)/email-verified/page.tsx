"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"

export default function EmailVerified() {
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createSupabaseClient()

  useEffect(() => {
    let redirectTimer: NodeJS.Timeout
    let isMounted = true

    const checkSession = async () => {
      try {
        // Check if the user is already logged in
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          // User is authenticated, show success message and redirect
          if (isMounted) {
            toast({
              title: "Email verified successfully",
              description: "Your account has been verified. Redirecting to dashboard...",
            })
            
            // Set a timer to redirect to dashboard
            redirectTimer = setTimeout(() => {
              if (isMounted) {
                router.push('/dashboard')
              }
            }, 3000)
          }
        } else {
          // No session found, they should sign in
          if (isMounted) {
            toast({
              title: "Session expired",
              description: "Please sign in with your verified email.",
              variant: "destructive"
            })
            
            // Redirect to sign in after a brief delay
            redirectTimer = setTimeout(() => {
              if (isMounted) {
                router.push('/signin')
              }
            }, 3000)
          }
        }
      } catch (error) {
        console.error("Error checking session:", error)
        
        if (isMounted) {
          toast({
            title: "Error",
            description: "Something went wrong. Please try signing in manually.",
            variant: "destructive"
          })
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    checkSession()

    return () => {
      isMounted = false
      clearTimeout(redirectTimer)
    }
  }, [router, supabase.auth])

  const handleContinue = () => {
    router.push('/dashboard')
  }

  return (
    <Card className="w-full bg-slate-800 border-slate-700 text-center">
      <CardHeader>
        <div className="flex justify-center mb-2">
          <CheckCircle className="h-16 w-16 text-[#3ECF8E]" />
        </div>
        <CardTitle className="text-slate-100">Email Verified!</CardTitle>
        <CardDescription className="text-slate-300">Your account has been successfully verified</CardDescription>
      </CardHeader>
      <CardContent className="text-slate-300">
        <p>
          Thank you for verifying your email address. Your account is now active and you can access all features of the platform.
        </p>
        <p className="mt-2">
          You will be automatically redirected to your dashboard in a few seconds.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button 
          className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900"
          onClick={handleContinue}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Continue to Dashboard"}
        </Button>
      </CardFooter>
    </Card>
  )
} 