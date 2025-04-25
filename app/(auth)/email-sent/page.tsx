"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CheckCircle } from "lucide-react"
import Link from "next/link"
import { createSupabaseClient } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"

export default function EmailSent() {
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('signupEmail') || ""
    }
    return ""
  })
  const [userId, setUserId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('signupUserId') || ""
    }
    return ""
  })
  const [name, setName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('signupName') || ""
    }
    return ""
  })
  const [isHelper, setIsHelper] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('signupIsHelper') === 'true'
    }
    return false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  const supabase = createSupabaseClient()

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address to resend the verification email.",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }

      toast({
        title: "Verification email sent",
        description: "Please check your inbox for the verification link.",
      })
    } catch (error) {
      console.error("Failed to resend verification email:", error)
      toast({
        title: "Failed to resend",
        description: "There was a problem sending the verification email. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('signupEmail')
        localStorage.removeItem('signupName')
        localStorage.removeItem('signupIsHelper')
        localStorage.removeItem('signupUserId')
      }
    }
  }, [])

  const handleEnsureProfile = async () => {
    if (!userId) {
      toast({
        title: "User ID required",
        description: "No user ID found for profile creation",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      // Call debug endpoint with fix=true
      const response = await fetch(`/api/debug/profile?fix=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      toast({
        title: "Profile check complete",
        description: data.profile.exists 
          ? "Profile already exists" 
          : (data.fix?.result?.success ? "Profile created successfully" : "Could not create profile"),
      })
      
      console.log('Profile debug data:', data)
    } catch (error) {
      console.error("Failed to check profile:", error)
      toast({
        title: "Profile check failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full bg-slate-800 border-slate-700 text-center">
      <CardHeader>
        <div className="flex justify-center mb-2">
          <CheckCircle className="h-16 w-16 text-[#3ECF8E]" />
        </div>
        <CardTitle className="text-slate-100">Email Verification Sent</CardTitle>
        <CardDescription className="text-slate-300">We've sent a verification link to your email</CardDescription>
      </CardHeader>
      <CardContent className="text-slate-300">
        <p>
          Please check your inbox and click on the verification link to complete your registration. If you don't see the
          email, check your spam folder.
        </p>
        <div className="mt-4">
          <Input
            id="email"
            type="email"
            placeholder="Enter your email to resend"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-900 border-slate-700 text-slate-100"
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <Button className="w-full bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900" asChild>
          <Link href="/signin">Return to Sign In</Link>
        </Button>
        <Button 
          variant="outline" 
          className="w-full border-slate-700 text-slate-100 hover:bg-slate-700"
          onClick={handleResendEmail}
          disabled={isLoading}
        >
          {isLoading ? "Sending..." : "Resend Verification Email"}
        </Button>
        
        {/* Debug section */}
        <div className="pt-4 border-t border-slate-700 mt-4">
          <Button 
            variant="ghost" 
            className="text-xs text-slate-400 hover:text-slate-300"
            onClick={() => setDebugMode(!debugMode)}
          >
            {debugMode ? "Hide Debug Options" : "Show Debug Options"}
          </Button>
          
          {debugMode && (
            <div className="mt-4 space-y-4 text-left">
              <div>
                <p className="text-sm text-slate-400 mb-2">User ID: {userId || 'Not available'}</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full border-slate-700 text-slate-100 hover:bg-slate-700"
                  onClick={handleEnsureProfile}
                  disabled={isLoading || !userId}
                >
                  {isLoading ? "Checking..." : "Check/Create Profile"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
