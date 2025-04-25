"use client"

import { useEffect, useState } from "react"
import { useProfile } from "@/context/profile-context"
import HelperDashboard from "./helper-dashboard"
import StudentDashboard from "./student-dashboard"
import { useAuth } from "@/context/auth-context"
import { CustomLoader } from "@/components/ui/custom-loader"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function Dashboard() {
  const { profile, isLoading: profileLoading, refreshProfile } = useProfile()
  const { user, isLoading: authLoading, ensureProfileExists } = useAuth()
  const { toast } = useToast()
  const [isFixingProfile, setIsFixingProfile] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [hasError, setHasError] = useState(false)
  
  // Maximum number of automatic retries
  const MAX_AUTO_RETRIES = 1
  
  // Check if profile doesn't exist but user does, and try to create it
  useEffect(() => {
    // Only attempt profile creation if:
    // 1. Auth and profile data have finished loading
    // 2. User exists but profile doesn't
    // 3. We haven't exceeded retry count
    // 4. We're not already fixing a profile
    if (!profileLoading && !authLoading && !profile && user && retryCount < MAX_AUTO_RETRIES && !isFixingProfile) {
      const attemptProfileCreation = async () => {
        setIsFixingProfile(true)
        setHasError(false)
        
        try {
          await ensureProfileExists(user)
          // Short delay before refreshing profile to allow database to update
          await new Promise(resolve => setTimeout(resolve, 500))
          await refreshProfile()
          
          toast({
            title: "Profile created",
            description: "Your profile has been created successfully"
          })
        } catch (error) {
          console.error("Error creating profile:", error)
          setHasError(true)
          toast({
            title: "Profile creation failed",
            description: "There was a problem creating your profile"
          })
        } finally {
          setIsFixingProfile(false)
          setRetryCount(prev => prev + 1)
        }
      }
      
      attemptProfileCreation()
    }
  }, [profile, profileLoading, authLoading, user, retryCount, ensureProfileExists, refreshProfile, toast, isFixingProfile])
  
  // If still loading after 10 seconds, show a different message
  const [showLongLoadingMessage, setShowLongLoadingMessage] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (profileLoading || authLoading || isFixingProfile) {
        setShowLongLoadingMessage(true)
      }
    }, 10000) // 10 seconds
    
    return () => clearTimeout(timer)
  }, [profileLoading, authLoading, isFixingProfile])
  
  // Show loading spinner while any loading is happening
  if (profileLoading || authLoading || isFixingProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col">
        <CustomLoader size="lg" color="default" label={showLongLoadingMessage ? "Still loading... This is taking longer than expected" : "Loading..."} />
        {showLongLoadingMessage && (
          <div className="mt-4 text-center max-w-md p-4">
            <p className="text-sm text-slate-300">
              If loading persists, try refreshing the page or clearing your browser cache.
            </p>
          </div>
        )}
      </div>
    )
  }
  
  // If no profile found and we've tried to create it, show an error and retry button
  if ((!profile && retryCount >= MAX_AUTO_RETRIES) || hasError) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 p-6">
        <div className="text-center space-y-2 max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-slate-100">Profile Not Found</h2>
          <p className="text-slate-300">There was an issue loading your profile. Please try again or contact support.</p>
          <Button 
            onClick={async () => {
              setIsFixingProfile(true)
              setHasError(false)
              
              try {
                if (user) {
                  await ensureProfileExists(user)
                  // Short delay before refreshing profile
                  await new Promise(resolve => setTimeout(resolve, 500))
                  await refreshProfile()
                  
                  toast({
                    title: "Profile created",
                    description: "Your profile has been created successfully"
                  })
                }
              } catch (error) {
                console.error("Error creating profile:", error)
                setHasError(true)
                toast({
                  title: "Profile creation failed",
                  description: "There was a problem creating your profile"
                })
              } finally {
                setIsFixingProfile(false)
              }
            }}
            className="mt-4"
            disabled={isFixingProfile}
          >
            {isFixingProfile ? "Creating Profile..." : "Create Profile"}
          </Button>
          
          <Button 
            onClick={() => window.location.reload()}
            variant="outline"
            className="mt-2 ml-2"
          >
            Refresh Page
          </Button>
        </div>
      </div>
    )
  }
  
  // If no user, show a helpful message about authentication
  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 p-6">
        <div className="text-center space-y-2 max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-slate-100">Authentication Required</h2>
          <p className="text-slate-300">You need to be signed in to access this page.</p>
          <Button 
            onClick={() => window.location.href = "/signin"}
            className="mt-4"
          >
            Sign In
          </Button>
        </div>
      </div>
    )
  }
  
  // If we have a profile but it's potentially incomplete, still render but with a type check
  if (profile && typeof profile === 'object') {
    return 'is_helper' in profile && profile.is_helper ? <HelperDashboard /> : <StudentDashboard />
  }
  
  // Fallback to student dashboard if we somehow get here
  return <StudentDashboard />
}
