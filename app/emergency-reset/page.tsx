"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react"
import Link from "next/link"

export default function EmergencyReset() {
  const [isClearing, setIsClearing] = useState(false)
  const [isCleared, setIsCleared] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const clearAllTokens = async () => {
    setIsClearing(true)
    setError(null)
    
    try {
      // List of known auth token prefixes
      const supabaseProjects = [
        'mvhgizltbvswhntrwjzt', // Old project
        'uofmouuathyuapthudyp', // Current project
      ]
      
      // List of generic auth tokens
      const genericTokens = [
        'sb-auth-token',
        'supabase.auth.token',
        'sb-auth-token-code-verifier',
      ]
      
      // Clear all project-specific tokens
      supabaseProjects.forEach(project => {
        const tokenName = `sb-${project}-auth-token`
        localStorage.removeItem(tokenName)
        document.cookie = `${tokenName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      })
      
      // Clear generic tokens
      genericTokens.forEach(token => {
        localStorage.removeItem(token)
        document.cookie = `${token}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      })
      
      // Clear loading flags
      document.cookie = `profile_loading_in_progress=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      
      // Clear any other application state
      localStorage.removeItem('cached_profile')
      localStorage.removeItem('cached_user_session')
      localStorage.removeItem('signupEmail')
      localStorage.removeItem('signupName')
      localStorage.removeItem('signupIsHelper')
      localStorage.removeItem('signupUserId')
      
      // Clear profile cache for any user
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('profile_cache_')) {
          localStorage.removeItem(key)
        }
      })
      
      // Clear debug state
      localStorage.removeItem('_dashboard_last_render')
      localStorage.removeItem('_dashboard_loop_count')
      localStorage.removeItem('_dashboard_last_loading_state')
      
      // Clear all localStorage as a final measure
      if (confirm('Clear all localStorage data? This will reset all app preferences.')) {
        localStorage.clear()
      }
      
      setIsCleared(true)
    } catch (e) {
      console.error('Error clearing tokens:', e)
      setError(e instanceof Error ? e.message : 'Unknown error occurred')
    } finally {
      setIsClearing(false)
    }
  }
  
  return (
    <div className="container flex items-center justify-center min-h-screen py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl text-center">Emergency Authentication Reset</CardTitle>
          <CardDescription className="text-center">
            Use this page to clear all authentication tokens if you're experiencing login issues
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              This will log you out of the app on this device and clear all stored authentication data.
              You will need to sign in again after this process.
            </AlertDescription>
          </Alert>
          
          {isCleared && (
            <Alert variant="success" className="bg-green-900/20 border-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                All authentication tokens have been cleared. Please <Link href="/signin" className="underline">sign in again</Link>.
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="bg-slate-800/50 p-4 rounded-md text-sm">
            <p className="flex items-start gap-2">
              <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                If you continue to experience issues after using this tool, please clear your browser cookies and cache manually or try using a private/incognito window.
              </span>
            </p>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between flex-wrap gap-2">
          <Button
            variant="outline"
            asChild
          >
            <Link href="/signin">
              Cancel
            </Link>
          </Button>
          
          <Button
            variant="destructive"
            onClick={clearAllTokens}
            disabled={isClearing || isCleared}
          >
            {isClearing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Clearing...
              </>
            ) : (
              'Clear All Auth Tokens'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 