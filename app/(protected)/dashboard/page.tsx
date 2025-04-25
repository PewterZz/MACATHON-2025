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
  
  // Check if profile doesn't exist but user does, and try to create it
  useEffect(() => {
    if (!profileLoading && !profile && user && retryCount < 2) {
      const attemptProfileCreation = async () => {
        setIsFixingProfile(true)
        try {
          if (user) {
            await ensureProfileExists(user)
            await refreshProfile()
            toast({
              title: "Profile created",
              description: "Your profile has been created successfully"
            })
          }
        } catch (error) {
          console.error("Error creating profile:", error)
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
  }, [profile, profileLoading, user, retryCount, ensureProfileExists, refreshProfile, toast])
  
  // Show loading spinner while any loading is happening
  if (profileLoading || authLoading || isFixingProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <CustomLoader size="lg" color="default" label="Loading..." />
      </div>
    )
  }
  
  // If no profile found and we've tried to create it, show an error and retry button
  if (!profile && retryCount >= 1) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 p-6">
        <div className="text-center space-y-2 max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-slate-100">Profile Not Found</h2>
          <p className="text-slate-300">There was an issue loading your profile. Please try again or contact support.</p>
          <Button 
            onClick={async () => {
              setIsFixingProfile(true)
              try {
                if (user) {
                  await ensureProfileExists(user)
                  await refreshProfile()
                  toast({
                    title: "Profile created",
                    description: "Your profile has been created successfully"
                  })
                }
              } catch (error) {
                console.error("Error creating profile:", error)
              } finally {
                setIsFixingProfile(false)
              }
            }}
            className="mt-4"
            disabled={isFixingProfile}
          >
            {isFixingProfile ? "Creating Profile..." : "Create Profile"}
          </Button>
        </div>
      </div>
    )
  }
  
  // Render appropriate dashboard based on user role
  // Default to student dashboard if profile is undefined somehow
  return profile?.is_helper ? <HelperDashboard /> : <StudentDashboard />
}
