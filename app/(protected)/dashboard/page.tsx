"use client"

import { useEffect, useState, useRef } from "react"
import { useProfile } from "@/context/profile-context"
import HelperDashboard from "./helper-dashboard"
import StudentDashboard from "./student-dashboard"
import { useAuth } from "@/context/auth-context"
import { CustomLoader } from "@/components/ui/custom-loader"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Bug } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { createSupabaseClient } from "@/lib/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Debug panel for tracking state changes
function DebugPanel({ data }: { data: Record<string, any> }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-gray-800 rounded p-3 text-xs font-mono max-w-xs overflow-auto max-h-96">
      <div className="flex justify-between mb-1">
        <h4 className="font-semibold text-yellow-400">Debug Panel</h4>
        <span className="text-gray-400">{new Date().toISOString()}</span>
      </div>
      <div className="space-y-1">
        {Object.entries(data).map(([key, value]) => (
          <div key={key}>
            <span className="text-blue-400">{key}:</span>{" "}
            <span className="text-gray-300">
              {typeof value === "object" 
                ? JSON.stringify(value, null, 2) 
                : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, isLoading: profileLoading, error: profileError, refreshProfile } = useProfile()
  const { user, isLoading: authLoading, ensureProfileExists } = useAuth()
  const { toast } = useToast()
  const [isFixingProfile, setIsFixingProfile] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [hasError, setHasError] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const loadStartTime = useRef(Date.now())
  const loadingTime = useRef(0)
  const channelRef = useRef<RealtimeChannel | null>(null)
  
  // Track loading time
  useEffect(() => {
    const interval = setInterval(() => {
      if (profileLoading || authLoading || isFixingProfile) {
        loadingTime.current = Date.now() - loadStartTime.current
      }
    }, 100)
    
    return () => clearInterval(interval)
  }, [profileLoading, authLoading, isFixingProfile])
  
  // Force break infinite loading after 20 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (profileLoading || authLoading || isFixingProfile) {
        console.error('Force breaking potential infinite loading state', {
          profileLoading,
          authLoading,
          isFixingProfile,
          loadingTime: loadingTime.current,
          profile: !!profile,
          user: !!user
        })
        
        // Store loading state for debugging
        if (typeof window !== 'undefined') {
          localStorage.setItem('_dashboard_last_loading_state', JSON.stringify({
            timestamp: new Date().toISOString(),
            profileLoading,
            authLoading,
            isFixingProfile,
            loadingTime: loadingTime.current,
            hasProfile: !!profile,
            hasUser: !!user,
            profileError: profileError?.message
          }))
        }
        
        // Show debug panel
        setShowDebug(true)
      }
    }, 20000) // 20 seconds
    
    return () => clearTimeout(timeout)
  }, [profileLoading, authLoading, isFixingProfile, profile, user, profileError])
  
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
      console.log('Starting profile creation attempt', { retryCount, userId: user.id })
      
      const attemptProfileCreation = async () => {
        setIsFixingProfile(true)
        setHasError(false)
        
        try {
          console.log('Ensuring profile exists for user', user.id)
          const profileData = await ensureProfileExists(user)
          console.log('Profile ensured, refreshing profile data', profileData)
          
          // Short delay before refreshing profile to allow database to update
          await new Promise(resolve => setTimeout(resolve, 500))
          await refreshProfile()
          console.log('Profile refreshed successfully')
          
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
        
        // Store loading state timestamp
        if (typeof window !== 'undefined') {
          localStorage.setItem('_dashboard_last_render', Date.now().toString())
        }
      }
    }, 10000) // 10 seconds
    
    return () => clearTimeout(timer)
  }, [profileLoading, authLoading, isFixingProfile])
  
  // Setup Supabase realtime subscription for new requests
  useEffect(() => {
    // Only run if profile is loaded and the user is a helper
    if (profile?.is_helper) {
      const supabase = createSupabaseClient();
      if (!supabase) {
        console.error("Failed to initialize Supabase client for realtime");
        return;
      }

      console.log("Setting up realtime subscription for new requests...");

      const channel = supabase
        .channel('new-request-notifications')
        .on<Database['public']['Tables']['requests']['Row']>(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'requests' 
          },
          (payload) => {
            console.log('New request received:', payload.new);
            const newRequest = payload.new;
            
            // Generate a unique ID for the toast if needed
            const toastId = `new-request-${newRequest.id}`; 
            
            toast({
              id: toastId,
              title: "✨ New Help Request",
              description: `${newRequest.summary || 'A new request has arrived.'} (Risk: ${newRequest.risk})`,
              // Optional: Add an action, e.g., navigate to the request
              // action: (
              //   <ToastAction altText="View" onClick={() => console.log('Navigate to request', newRequest.id)}>
              //     View
              //   </ToastAction>
              // ),
            });
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Subscribed to new requests channel!');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`Realtime subscription error: ${status}`, err);
            toast({
              title: "Realtime Error",
              description: "Could not connect to live updates. Please refresh.",
              variant: "destructive",
            });
          }
        });

      channelRef.current = channel;

      // Cleanup function to remove the channel subscription on unmount
      return () => {
        if (channelRef.current) {
          console.log("Removing realtime subscription for new requests.");
          supabase.removeChannel(channelRef.current)
            .then(() => console.log("Successfully removed channel."))
            .catch(err => console.error("Error removing channel:", err));
          channelRef.current = null; // Clear the ref
        }
      };
    } else {
       // Ensure cleanup if the user is not a helper or logs out
       if (channelRef.current) {
         const supabase = createSupabaseClient();
         if (supabase) {
            console.log("Removing realtime subscription (user not helper).");
            supabase.removeChannel(channelRef.current)
              .then(() => console.log("Successfully removed channel (user not helper)."))
              .catch(err => console.error("Error removing channel (user not helper):", err));
            channelRef.current = null;
         }
       }
    }
  // Depend on profile?.is_helper to setup/teardown subscription when role changes
  }, [profile?.is_helper, toast]);

  // Debug data to track
  const debugData = {
    profileLoading,
    authLoading,
    isFixingProfile,
    retryCount,
    hasProfile: !!profile,
    hasUser: !!user,
    userId: user?.id,
    loadTime: `${loadingTime.current / 1000}s`,
    profileError: profileError?.message || 'none'
  }
  
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
            <Button 
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setShowDebug(prev => !prev)}
            >
              <Bug className="h-4 w-4 mr-2" />
              {showDebug ? "Hide Debug Info" : "Show Debug Info"}
            </Button>
          </div>
        )}
        
        {showDebug && <DebugPanel data={debugData} />}
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
          
          <Button 
            onClick={() => window.location.href = "/emergency-reset"}
            variant="outline"
            className="mt-2 ml-2"
          >
            Reset Auth Data
          </Button>
          
          <Button 
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowDebug(prev => !prev)}
          >
            <Bug className="h-4 w-4 mr-2" />
            {showDebug ? "Hide Debug Info" : "Show Debug Info"}
          </Button>
        </div>
        
        {showDebug && <DebugPanel data={debugData} />}
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
          
          <Button 
            onClick={() => window.location.href = "/emergency-reset"}
            variant="outline"
            className="mt-2 ml-2"
          >
            Reset Auth Data
          </Button>
          
          <Button 
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setShowDebug(prev => !prev)}
          >
            <Bug className="h-4 w-4 mr-2" />
            {showDebug ? "Hide Debug Info" : "Show Debug Info"}
          </Button>
        </div>
        
        {showDebug && <DebugPanel data={debugData} />}
      </div>
    )
  }
  
  // Store successful render timestamp
  if (typeof window !== 'undefined') {
    localStorage.setItem('_dashboard_last_render', Date.now().toString())
  }
  
  // If we have a profile but it's potentially incomplete, still render but with a type check
  if (profile && typeof profile === 'object') {
    // Debug button in corner for troubleshooting
    return (
      <>
        {'is_helper' in profile && profile.is_helper ? <HelperDashboard /> : <StudentDashboard />}
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowDebug(prev => !prev)}
          >
            <Bug className="h-4 w-4" />
          </Button>
          {showDebug && <DebugPanel data={debugData} />}
        </div>
      </>
    )
  }
  
  // Fallback to student dashboard if we somehow get here
  return (
    <>
      <StudentDashboard />
      <Button 
        variant="ghost" 
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={() => setShowDebug(prev => !prev)}
      >
        <Bug className="h-4 w-4" />
      </Button>
      {showDebug && <DebugPanel data={{...debugData, note: "Fallback render"}} />}
    </>
  )
}
