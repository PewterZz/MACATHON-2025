"use client"

import { useEffect } from "react"
import { useProfile } from "@/context/profile-context"
import HelperDashboard from "./helper-dashboard"
import StudentDashboard from "./student-dashboard"
import { useAuth } from "@/context/auth-context"
import { CustomLoader } from "@/components/ui/custom-loader"

export default function Dashboard() {
  const { profile, isLoading: profileLoading } = useProfile()
  const { user, isLoading: authLoading } = useAuth()
  
  if (profileLoading || authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <CustomLoader size="lg" color="default" label="Loading..." />
      </div>
    )
  }
  
  // If no profile found, show a message
  if (!profile) {
    return (
      <div className="flex h-screen w-full items-center justify-center flex-col gap-4 p-6">
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-slate-100">Profile Not Found</h2>
          <p className="text-slate-300">There was an issue loading your profile. Please refresh the page or contact support.</p>
        </div>
      </div>
    )
  }
  
  // Render appropriate dashboard based on user role
  return profile.is_helper ? <HelperDashboard /> : <StudentDashboard />
}
