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
  const [isLoading, setIsLoading] = useState(false)
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
      }
    }
  }, [])

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
      </CardFooter>
    </Card>
  )
}
