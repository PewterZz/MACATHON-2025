"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Github, Loader2 } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { toast } from "@/components/ui/use-toast"
import { createSupabaseClient } from "@/lib/supabase"

export default function SignUp() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isHelper, setIsHelper] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)
  const router = useRouter()
  const { signUp, user } = useAuth()
  
  // Redirect if user is already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (isLoading) return
    setIsLoading(true)

    try {
      // Create a dedicated supabase client for this operation
      const supabase = createSupabaseClient()
      
      // Clear any existing session first to prevent conflicts
      if (typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token')
      }
      
      console.log('Starting signup process with email:', email)
      
      // Use Supabase directly instead of context
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role: isHelper ? "helper" : "user"
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?type=signup`,
        }
      })
      
      if (error) throw error
      
      console.log('Signup response:', {
        userId: data?.user?.id,
        emailConfirmedAt: data?.user?.email_confirmed_at,
        identities: data?.user?.identities?.length,
      })
      
      // Store the user data for access in the email-sent page
      if (typeof window !== 'undefined' && data?.user) {
        // Store signup info in localStorage
        localStorage.setItem('signupEmail', email)
        localStorage.setItem('signupName', name)
        localStorage.setItem('signupIsHelper', isHelper ? 'true' : 'false')
        localStorage.setItem('signupUserId', data.user.id)
        
        // Try to create a profile immediately, even if email isn't confirmed yet
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              name: name,
              is_helper: isHelper,
              helper_score: 0
            })
            .select()
            .single()
          
          if (profileError) {
            console.error('Could not create profile during signup:', profileError)
          } else {
            console.log('Profile created during signup:', profile)
          }
        } catch (profileErr) {
          console.error('Error creating profile during signup:', profileErr)
        }
      }
      
      // Explicitly don't wait for email confirmation
      if (data?.user) {
        if (!data.user.email_confirmed_at) {
          router.push("/email-sent")
        } else {
          // Already confirmed (rare case)
          router.push("/dashboard")
        }
      } else {
        router.push("/email-sent")
      }
    } catch (error: any) {
      console.error("Sign up failed:", error)
      toast({
        title: "Registration failed",
        description: error?.message || "There was a problem with your registration. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGithubSignUp = () => {
    if (isGithubLoading) return
    setIsGithubLoading(true)
    
    try {
      // Just redirect to the GitHub auth endpoint
      router.push('/api/auth/github')
    } catch (error) {
      console.error("GitHub sign up failed:", error)
      toast({
        title: "GitHub registration failed",
        description: "There was a problem registering with GitHub. Please try again.",
        variant: "destructive"
      })
      setIsGithubLoading(false)
    }
  }

  return (
    <Card className="w-full bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="text-slate-100">Create an account</CardTitle>
        <CardDescription className="text-slate-300">Join <span className="font-medium tracking-tight">Meld</span> to help or get help</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-slate-700/40 rounded-md text-sm text-slate-300">
          <p>After creating your account, you'll need to verify your email address. Once verified, you'll be automatically logged in.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-200">
              Full Name
            </label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>
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
              disabled={isLoading}
              className="bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-200">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="helper"
              checked={isHelper}
              onCheckedChange={(checked) => setIsHelper(checked as boolean)}
              disabled={isLoading}
              className="border-slate-500 data-[state=checked]:bg-[#3ECF8E] data-[state=checked]:border-[#3ECF8E]"
            />
            <label
              htmlFor="helper"
              className="text-sm font-medium leading-none text-slate-200 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I want to become a helper
            </label>
          </div>
          <Button
            type="submit"
            className="w-full bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </span>
            ) : (
              "Create account"
            )}
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
          onClick={handleGithubSignUp}
          disabled={isGithubLoading}
        >
          {isGithubLoading ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : (
            <>
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </>
          )}
        </Button>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/signin" className="text-[#3ECF8E] hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
