"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Github } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { toast } from "@/components/ui/use-toast"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGithubLoading, setIsGithubLoading] = useState(false)
  const router = useRouter()
  const { user, isLoading: authLoading, signIn } = useAuth()

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (user && !authLoading) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await signIn(email, password)
    } catch (error) {
      console.error("Sign in failed:", error)
      toast({
        title: "Authentication failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGithubSignIn = async () => {
    setIsGithubLoading(true)
    try {
      router.push('/api/auth/github')
    } catch (error) {
      console.error("GitHub sign in failed:", error)
      toast({
        title: "GitHub login failed",
        description: "There was a problem logging in with GitHub. Please try again.",
        variant: "destructive"
      })
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
  )
}
