"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createSupabaseClient } from "@/lib/supabase"
import { toast } from "@/components/ui/use-toast"

export default function ResetPassword() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const supabase = createSupabaseClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })

      if (error) {
        throw error
      }

      setIsSuccess(true)
      toast({
        title: "Password reset email sent",
        description: "Please check your inbox for the password reset link.",
      })
    } catch (error) {
      console.error("Password reset failed:", error)
      toast({
        title: "Reset failed",
        description: "There was a problem sending the reset email. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="w-full bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100">Check Your Email</CardTitle>
          <CardDescription className="text-slate-300">
            We've sent a password reset link to your email
          </CardDescription>
        </CardHeader>
        <CardContent className="text-slate-300">
          <p>
            Please check your inbox and click on the reset link to set a new password. If you don't see the
            email, check your spam folder.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900" asChild>
            <Link href="/signin">Return to Sign In</Link>
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100">Reset Password</CardTitle>
        <CardDescription className="text-slate-300">
          Enter your email to receive a password reset link
        </CardDescription>
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
          <Button
            type="submit"
            className="w-full bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-slate-400">
          Remember your password?{" "}
          <Link href="/signin" className="text-[#3ECF8E] hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
} 