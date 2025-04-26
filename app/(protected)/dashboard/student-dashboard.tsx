"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LogOut, RefreshCw, Send, Book, MessageCircle, FileText, Clock, User, PlusCircle, School, Lightbulb, Calendar, Settings, AlertTriangle, AlertCircle, CheckCircle, Loader2, MessageSquare, History } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useProfile } from "@/context/profile-context"
import { useSessionHistory, type SessionHistory } from "@/hooks/useSessionHistory"
import ChatPanel from "@/components/ChatPanel"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { LoadingErrorDisplay } from "@/components/LoadingTimeout"
import { CustomLoader } from "@/components/ui/custom-loader"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase"
import { cn } from "@/lib/utils"

// Animation variants for tab content
const tabContentVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

// Animation variants for card elements
const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    transition: { duration: 0.3 } 
  }
}

// Animation variants for staggered items
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

// Database connection error component
const ConnectionErrorDisplay = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center h-full p-6 bg-red-50 border border-red-100 rounded-lg">
    <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
    <h3 className="text-xl font-bold text-red-700 mb-2">Connection Error</h3>
    <p className="text-red-600 mb-4 text-center">
      We couldn't connect to the database. This might be due to missing environment variables or a server issue.
    </p>
    <div className="flex gap-4">
      <Button onClick={onRetry} className="bg-red-600 hover:bg-red-700">
        <RefreshCw className="mr-2 h-4 w-4" /> Try Again
      </Button>
    </div>
    <div className="mt-4 p-4 bg-red-100 rounded text-red-700 text-sm">
      <p className="font-bold mb-1">Troubleshooting Steps:</p>
      <ol className="list-decimal list-inside">
        <li>Check if your Supabase service is running</li>
        <li>Verify your environment variables (.env.local file)</li>
        <li>Check your internet connection</li>
      </ol>
    </div>
  </div>
);

// A component that runs a callback after a timeout when loading is active
const EnhancedLoadingTimeout = ({ 
  isLoading, 
  onTimeout, 
  timeoutMs = 8000,
  children 
}: {
  isLoading: boolean;
  onTimeout: () => void;
  timeoutMs?: number;
  children: React.ReactNode;
}) => {
  // Set up timeout effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (isLoading) {
      timeoutId = setTimeout(() => {
        onTimeout();
      }, timeoutMs);
    }
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading, onTimeout, timeoutMs]);
  
  // Just render the children
  return <>{children}</>;
};

// Fix createSupabaseClient function to properly type the client
const createSupabaseClient = () => {
  try {
    const supabase = createClientComponentClient<Database>()
    return supabase
  } catch (error) {
    console.error("Failed to create Supabase client:", error)
    return null
  }
}

export default function StudentDashboard() {
  const { user, signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { history: sessionHistory, isLoading: historyLoading, error: historyError, refreshHistory } = useSessionHistory()
  const [name, setName] = useState('')
  const [activeRequests, setActiveRequests] = useState<string[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [issueDescription, setIssueDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [refreshingRequests, setRefreshingRequests] = useState(false)
  const [isFixingProfile, setIsFixingProfile] = useState(false)
  const [mood, setMood] = useState('neutral')
  const [requestsCount, setRequestsCount] = useState(0)
  const [newMessagesByRequest, setNewMessagesByRequest] = useState<Record<string, number>>({})
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  
  // Get current tab from URL or default to 'request'
  const currentTab = searchParams?.get('tab') || 'request'

  const [loadingError, setLoadingError] = useState(false)
  const [connectionError, setConnectionError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isClosingRequest, setIsClosingRequest] = useState(false)
  const [requestsData, setRequestsData] = useState<Record<string, any>>({})

  // Handle tab change
  const handleTabChange = (value: string) => {
    router.push(`/dashboard?tab=${value}`, { scroll: false })
  }

  // Set name from profile when loaded
  useEffect(() => {
    if (profile?.name) {
      setName(profile.name)
    }
    if (user?.email) {
      setEmail(user.email)
      if (!profile?.contact_email) {
        setContactEmail(user.email)
      }
    }
    if (profile?.contact_email) {
      setContactEmail(profile.contact_email)
    }
  }, [profile?.name, profile?.contact_email, user?.email])

  // 1. Define both functions with useCallback BEFORE the useEffect that references them

  // Fetch user stats (number of requests)
  const fetchUserStats = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const supabase = createSupabaseClient()
      if (!supabase) {
        console.error("Supabase client not available")
        return
      }
      
      const { data, error } = await supabase
        .from('requests')
        .select('id')
        .eq('user_id', user.id)
      
      if (error) {
        console.error("Supabase error fetching stats (stringified):", JSON.stringify(error, null, 2));
        console.error("Supabase error fetching stats (raw):", error);
        return
      }
      
      if (data) {
        setRequestsCount(data.length)
      }
    } catch (error) {
      console.error("Failed to fetch user stats:", error)
    }
  }, [user?.id])

  // Fetch existing user requests
  const fetchUserRequests = useCallback(async () => {
    if (!user?.id) {
      console.log("No user ID available for fetching requests");
      return;
    }
    
    try {
      console.log("Starting fetch requests for user:", user.id);
      setRefreshingRequests(true)
      setLoadingError(false)
      setConnectionError(false)
      
      const supabase = createSupabaseClient()
      if (!supabase) {
        console.error("Failed to initialize Supabase client")
        setConnectionError(true)
        throw new Error("Supabase client initialization failed")
      }
      
      console.log("Supabase client initialized successfully, executing query");
      console.log("Query parameters:", { userId: user.id });
      
      // Find active (non-closed) requests created by this user
      const { data, error } = await supabase
        .from('requests')
        .select('id, summary, risk, status, created_at')
        .eq('user_id', user.id)
        .neq('status', 'closed') // Only get non-closed requests
        .order('created_at', { ascending: false })
      
      console.log("Query executed. Response:", { hasData: Boolean(data), hasError: Boolean(error) });
      
      if (error) {
        // Safely log the error, handling the case where error might be an empty object
        console.error("Supabase error fetching requests (stringified):", JSON.stringify(error, null, 2));
        console.error("Supabase error fetching requests (raw):", error, {
          message: error?.message || 'No error message',
          details: error?.details || 'No details',
          hint: error?.hint || 'No hint',
          code: error?.code || 'No code'
        });
        
        // Check if it's a connection error
        if (error?.message?.includes('Failed to fetch') || 
            error?.message?.includes('NetworkError') ||
            error?.message?.includes('network') ||
            error?.code === 'PGRST') {
          console.log("Setting connection error flag based on error type");
          setConnectionError(true)
        }
        
        throw error
      }
      
      if (!data) {
        console.error("No data returned from Supabase")
        throw new Error("No data returned")
      }
      
      console.log("Request data retrieved successfully:", { count: data.length });
      const requests = data.map((r) => r.id)
      setActiveRequests(requests)
      
      // Store the full request data in state for display
      const requestsMap = data.reduce((acc, request) => {
        acc[request.id] = request;
        return acc;
      }, {} as Record<string, any>);
      setRequestsData(requestsMap);
      
      // Set the first request as selected if there is one and nothing is currently selected
      if (requests.length > 0 && !selectedChat) {
        console.log("Auto-selecting first request:", requests[0]);
        setSelectedChat(requests[0])
      } else if (requests.length === 0) {
        // If no active requests remain, clear the selected chat
        setSelectedChat(null)
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error)
      toast({
        title: "Error",
        description: "Failed to load your help requests. Please try again.",
        variant: "destructive"
      })
      setLoadingError(true)
    } finally {
      setRefreshingRequests(false)
    }
  }, [user?.id, selectedChat, toast])

  // 2. THEN use the functions in useEffect
  useEffect(() => {
    if (user?.id) {
      fetchUserRequests()
      fetchUserStats()
    }
  }, [user?.id, fetchUserRequests, fetchUserStats])

  // Debug Supabase env variables and initialization
  useEffect(() => {
    // Check if essential env variables are set
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    console.log('Supabase environment status:', {
      hasUrl: Boolean(supabaseUrl),
      hasAnonKey: Boolean(supabaseAnonKey)
    });
    
    // Test Supabase client initialization
    try {
      const supabase = createSupabaseClient();
      console.log('Supabase client initialization:', {
        success: Boolean(supabase),
        clientReady: supabase ? 'yes' : 'no'
      });
    } catch (error) {
      console.error('Supabase client initialization error:', error);
    }
  }, []);

  // Add useEffect for Supabase realtime subscription to track new messages
  useEffect(() => {
    if (!user?.id) return

    const supabase = createSupabaseClient()
    if (!supabase) {
      console.error("Failed to initialize Supabase client for realtime subscription")
      return
    }

    // Create a channel that listens for all new messages across all user's requests
    const channel = supabase
      .channel('student-dashboard-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          // New message came in, check if it's for one of our requests
          const message = payload.new as any
          if (!message || !message.request_id) return
          
          // Check if this message is from a request that belongs to the user
          const requestId = message.request_id
          
          // If this is a request we're tracking and it's not our current selected one
          // or we're not on the active chats tab, increment the unread count
          if (activeRequests.includes(requestId) && 
              (requestId !== selectedChat || currentTab !== 'active')) {
            setNewMessagesByRequest(prev => ({
              ...prev,
              [requestId]: (prev[requestId] || 0) + 1
            }))
          }
        }
      )
      .subscribe((status) => {
        console.log(`Dashboard messages subscription status: ${status}`)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, activeRequests, selectedChat, currentTab])

  // Clear new message count when selecting a chat
  useEffect(() => {
    if (selectedChat && newMessagesByRequest[selectedChat]) {
      setNewMessagesByRequest(prev => ({
        ...prev,
        [selectedChat]: 0
      }))
    }
  }, [selectedChat, newMessagesByRequest])

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueDescription.trim() || isSubmitting) return
    
    try {
      setIsSubmitting(true)
      
      const supabase = createSupabaseClient()
      if (!supabase) {
        toast({
          title: "Connection Error",
          description: "Could not connect to the database. Please try again later.",
          variant: "destructive"
        });
        throw new Error("Failed to initialize Supabase client")
      }
      
      // Check if the user has reached the request limit (max 5 active requests)
      const { data: activeRequestsData, error: activeRequestsError } = await supabase
        .from('requests')
        .select('id')
        .eq('user_id', user?.id)
        .neq('status', 'closed')
      
      if (activeRequestsError) {
        console.error("Failed to check active requests:", activeRequestsError);
        throw activeRequestsError;
      }
      
      if (activeRequestsData && activeRequestsData.length >= 5) {
        toast({
          title: "Request Limit Reached",
          description: "You can have a maximum of 5 active requests at a time. Please close some existing requests before creating a new one.",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log("Submitting request:", {
        userId: user?.id,
        descriptionLength: issueDescription.length
      });
      
      // Process with AI triage first to get summary and risk assessment
      let triageResult;
      try {
        // Import the triage function
        const { triage } = await import('@/lib/ai');
        triageResult = await triage(issueDescription);
        console.log("Triage result:", triageResult);
      } catch (triageError) {
        console.error("Triage analysis failed:", triageError);
        // Enhanced fallback with more complete data structure and higher default risk as precaution
        triageResult = {
          summary: issueDescription,
          risk: 0.5, // Moderate risk as a precaution
          tags: ['needs-review'], // Add a tag indicating this needs manual review
          suggestedApproach: 'Please review this request manually as AI analysis failed.'
        };
      }
      
      // Create a new request with the triage results
      const { data, error } = await supabase
        .from('requests')
        .insert({
          summary: triageResult.summary,
          channel: 'web',
          status: triageResult.risk >= 0.6 ? 'urgent' : 'open',
          user_id: user?.id,
          risk: triageResult.risk,
          external_id: `web_${Date.now()}`
        })
        .select('id')
        .single()
      
      if (error) {
        console.error("Failed to create request (stringified):", JSON.stringify(error, null, 2));
        console.error("Failed to create request (raw):", error);
        throw error;
      }
      
      if (!data || !data.id) {
        console.error("Created request but no ID returned");
        throw new Error("No request ID returned");
      }
      
      console.log("Request created successfully:", { requestId: data.id });
      
      // Add initial message from user
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          request_id: data.id,
          sender: 'caller',
          content: issueDescription
        })
      
      if (messageError) {
        console.error("Failed to add message:", messageError);
        throw messageError;
      }
      
      // Reset form and show success message
      setIssueDescription('')
      toast({
        title: "Request submitted",
        description: "Your help request has been submitted. A helper will respond soon.",
        variant: "default"
      })
      
      // Refresh the requests list
      await fetchUserRequests()
      await fetchUserStats()
      
      // Switch to active chats tab
      handleTabChange('active')
    } catch (error) {
      console.error("Failed to submit request:", error)
      toast({
        title: "Error",
        description: "Failed to submit your help request. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveProfile = async () => {
    if (profile) {
      try {
        setIsSavingProfile(true)
        await updateProfile({ 
          name: name.trim(),
          contact_email: contactEmail.trim() 
        })
        toast({
          title: "Profile updated",
          description: "Your profile has been updated successfully.",
          variant: "default"
        })
      } catch (error) {
        console.error("Failed to update profile:", error)
        toast({
          title: "Error",
          description: "Failed to update your profile. Please try again.",
          variant: "destructive"
        })
      } finally {
        setIsSavingProfile(false)
      }
    }
  }

  const handleFixProfile = async () => {
    if (!user) return
    
    setIsFixingProfile(true)
    try {
      const response = await fetch('/api/debug/profile?fix=true')
      const result = await response.json()
      
      if (result.profile.profileCreationResult?.success) {
        toast({
          title: "Profile fixed",
          description: "Your profile has been created successfully.",
          variant: "default"
        })
        // Force page reload to refresh profile data
        window.location.reload()
      } else {
        toast({
          title: "Profile fix failed",
          description: "There was a problem creating your profile. Please contact support.",
          variant: "destructive"
        })
        console.error("Profile fix result:", result)
      }
    } catch (error) {
      console.error("Failed to fix profile:", error)
      toast({
        title: "Error",
        description: "Failed to fix profile. Please try again later.",
        variant: "destructive"
      })
    } finally {
      setIsFixingProfile(false)
    }
  }

  const handleChangeMood = (newMood: string) => {
    setMood(newMood)
    toast({
      title: "Mood Updated",
      description: `Your mood is now set to ${newMood}`,
      variant: "default"
    })
  }

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
      setIsLoading(false);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    };
  };

  // Function to close/resolve a request
  const handleCloseRequest = async (requestId: string) => {
    if (!requestId || isClosingRequest) return
    
    try {
      setIsClosingRequest(true)
      
      // Ensure we're authenticated before making the request
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please make sure you're logged in to close this request.",
          variant: "destructive"
        })
        router.push('/signin')
        return
      }
      
      const response = await fetch(`/api/requests/${requestId}/close`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        // Send the user ID explicitly
        body: JSON.stringify({ userId: user.id }),
        // Ensure cookies are sent with the request
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        console.error("Error closing request:", data)
        
        // Handle authentication errors
        if (response.status === 401) {
          toast({
            title: "Authentication Error",
            description: data.message || "Session error. Please try signing in again.",
            variant: "destructive"
          })
          
          // Only sign out if explicitly told to in the response
          if (data.forceSignOut) {
            setTimeout(() => {
              signOut()
            }, 2000)
          }
          
          return
        }
        
        throw new Error(data.error || 'Failed to close request')
      }
      
      toast({
        title: "Request Resolved",
        description: "Your help request has been marked as resolved and moved to history.",
        variant: "default"
      })
      
      // Remove from active requests immediately
      setActiveRequests(prev => prev.filter(id => id !== requestId))
      
      // If this was the selected chat, reset selection
      if (selectedChat === requestId) {
        setSelectedChat(null)
      }
      
      // Refresh data to update UI
      await fetchUserRequests()
      await fetchUserStats()
    } catch (error) {
      console.error("Failed to close request:", error)
      toast({
        title: "Error",
        description: "Failed to resolve your help request. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsClosingRequest(false)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-indigo-950">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-900 border-r border-indigo-800 fixed h-full left-0 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-center mb-8 mt-4">
            <div className="h-24 w-24">
              <img src="/logo.png" alt="Meld logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-xl font-bold text-white ml-3 tracking-tight">Meld</h1>
          </div>
          
          <div className="mb-6 pb-6 border-b border-indigo-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white">
                {name ? name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div>
                <p className="font-medium text-white">{name || 'Student'}</p>
                <Badge className="bg-indigo-600 text-white hover:bg-indigo-500">Student</Badge>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-xs text-indigo-300 mb-1">How are you feeling today?</p>
              <div className="grid grid-cols-3 gap-1 text-center text-xs">
                <Button 
                  variant={mood === 'great' ? 'default' : 'outline'} 
                  className={mood === 'great' ? 'bg-green-600 text-white hover:bg-green-500' : 'border-indigo-700 hover:bg-indigo-800 text-white'} 
                  size="sm"
                  onClick={() => handleChangeMood('great')}
                >
                  Great
                </Button>
                <Button 
                  variant={mood === 'neutral' ? 'default' : 'outline'} 
                  className={mood === 'neutral' ? 'bg-blue-600 text-white hover:bg-blue-500' : 'border-indigo-700 hover:bg-indigo-800 text-white'} 
                  size="sm"
                  onClick={() => handleChangeMood('neutral')}
                >
                  Okay
                </Button>
                <Button 
                  variant={mood === 'struggling' ? 'default' : 'outline'} 
                  className={mood === 'struggling' ? 'bg-amber-600 text-white hover:bg-amber-500' : 'border-indigo-700 hover:bg-indigo-800 text-white'} 
                  size="sm"
                  onClick={() => handleChangeMood('struggling')}
                >
                  Struggling
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'request' ? 'bg-indigo-800 text-indigo-300 border-l-4 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.3)]' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('request')}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>New Request</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'active' ? 'bg-indigo-800 text-indigo-300 border-l-4 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.3)]' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('active')}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              <span>My Chats</span>
              {activeRequests.length > 0 && (
                <Badge className="ml-auto bg-indigo-500 text-white">{activeRequests.length}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'history' ? 'bg-indigo-800 text-indigo-300 border-l-4 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.3)]' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('history')}
            >
              <History className="mr-2 h-4 w-4" />
              <span>History</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'resources' ? 'bg-indigo-800 text-indigo-300 border-l-4 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.3)]' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('resources')}
            >
              <Book className="mr-2 h-4 w-4" />
              <span>Resources</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'schedule' ? 'bg-indigo-800 text-indigo-300 border-l-4 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.3)]' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('schedule')}
            >
              <Calendar className="mr-2 h-4 w-4" />
              <span>Appointments</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'settings' ? 'bg-indigo-800 text-indigo-300 border-l-4 border-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.3)]' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
          </div>
          
          <div className="absolute bottom-4 left-4 right-4">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-white hover:text-white hover:bg-indigo-800" 
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pl-64">
        <div className="container mx-auto p-6 max-w-[1600px]">
          <Tabs defaultValue={currentTab} value={currentTab} onValueChange={handleTabChange} className="w-full space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-white">Student User</h1>
            </div>

            <TabsList className="bg-indigo-900 border-indigo-800 hidden">
              <TabsTrigger value="request" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                Request Help
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                Active Chats
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                History
              </TabsTrigger>
              <TabsTrigger value="resources" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                Resources
              </TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                Schedule
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                Settings
              </TabsTrigger>
            </TabsList>
            
            {/* Request help tab content */}
            <TabsContent value="request" className="mt-0">
              <motion.div
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Stats cards - only visible on request tab */}
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={cardVariants}>
                    <Card className="bg-indigo-900 border-indigo-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-white text-sm font-medium">Total Requests</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-white">{requestsCount}</div>
                          <div className="p-2 bg-indigo-500/10 rounded-full">
                            <MessageCircle className="h-4 w-4 text-indigo-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  <motion.div variants={cardVariants}>
                    <Card className="bg-indigo-900 border-indigo-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-white text-sm font-medium">Active Conversations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-white">{activeRequests.length}</div>
                          <div className="p-2 bg-blue-500/10 rounded-full">
                            <User className="h-4 w-4 text-blue-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  <motion.div variants={cardVariants}>
                    <Card className="bg-indigo-900 border-indigo-800">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-white text-sm font-medium">Response Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-white">~5 min</div>
                          <div className="p-2 bg-purple-500/10 rounded-full">
                            <Clock className="h-4 w-4 text-purple-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
                
                {/* Form card */}
                <Card className="border-indigo-800 bg-indigo-900">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Request Peer Support</CardTitle>
                    <CardDescription className="text-indigo-300">
                      Describe what you're going through, and a helper will be with you shortly
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmitRequest} className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="issue" className="text-sm font-medium text-white">
                          What's on your mind?
                        </label>
                        <Textarea
                          id="issue"
                          placeholder="I'm feeling overwhelmed with my coursework and not sure how to manage my time effectively..."
                          value={issueDescription}
                          onChange={(e) => setIssueDescription(e.target.value)}
                          rows={10}
                          className="bg-indigo-950 border-indigo-700 text-white placeholder:text-indigo-400 resize-none"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center pt-2">
                        <div className="text-sm text-indigo-300">
                          A helper will respond as soon as possible
                        </div>
                        <EnhancedLoadingTimeout 
                          isLoading={isSubmitting} 
                          onTimeout={() => {
                            setIsSubmitting(false)
                            toast({
                              title: "Submission taking too long",
                              description: "Please try again. If the problem persists, contact support.",
                              variant: "destructive"
                            })
                          }}
                          timeoutMs={12000}
                        >
                          <Button 
                            type="submit" 
                            disabled={isSubmitting || !issueDescription.trim()} 
                            className="bg-indigo-500 hover:bg-indigo-400 text-white"
                          >
                            {isSubmitting ? (
                              <>
                                <CustomLoader size="sm" color="indigo" className="mr-2" />
                                Submitting...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Submit Request
                              </>
                            )}
                          </Button>
                        </EnhancedLoadingTimeout>
                      </div>
                    </form>
                  </CardContent>
                </Card>
                
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={cardVariants}>
                    <Card className="bg-indigo-900 border-indigo-800">
                      <CardHeader>
                        <CardTitle className="text-lg text-white">Need immediate help?</CardTitle>
                      </CardHeader>
                      <CardContent className="text-indigo-200">
                        <p className="mb-4">If you're in crisis or need immediate assistance, please use one of these resources:</p>
                        <ul className="space-y-2 list-disc pl-5">
                          <li>Call or text 988 for the Suicide & Crisis Lifeline</li>
                          <li>Text HOME to 741741 for Crisis Text Line</li>
                          <li>Call campus health services at (123) 456-7890</li>
                        </ul>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  <motion.div variants={cardVariants}>
                    <Card className="bg-indigo-900 border-indigo-800">
                      <CardHeader>
                        <CardTitle className="text-lg text-white">Self-Help Tips</CardTitle>
                      </CardHeader>
                      <CardContent className="text-indigo-200">
                        <div className="space-y-3">
                          <div className="flex items-start space-x-3">
                            <Lightbulb className="h-5 w-5 text-amber-400 mt-0.5" />
                            <span>Try deep breathing exercises to reduce stress</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <Lightbulb className="h-5 w-5 text-amber-400 mt-0.5" />
                            <span>Take short breaks between study sessions</span>
                          </div>
                          <div className="flex items-start space-x-3">
                            <Lightbulb className="h-5 w-5 text-amber-400 mt-0.5" />
                            <span>Stay hydrated and maintain regular sleep patterns</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              </motion.div>
            </TabsContent>
            
            {/* Active chats tab content */}
            <TabsContent value="active" className="mt-0">
              <motion.div 
                className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <div className="lg:col-span-1">
                  <Card className="bg-indigo-900 border-indigo-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-lg font-semibold text-white">My Conversations</CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchUserRequests} 
                        disabled={refreshingRequests}
                        className="border-indigo-700 hover:bg-indigo-800 text-white"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshingRequests ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {refreshingRequests ? (
                        <div className="flex justify-center p-4">
                          <CustomLoader size="lg" color="indigo" label="Loading your conversations..." />
                        </div>
                      ) : loadingError ? (
                        <LoadingErrorDisplay 
                          title="Failed to Load Conversations"
                          description="There was a problem loading your conversations."
                          onRetry={fetchUserRequests}
                          theme="indigo"
                        />
                      ) : connectionError ? (
                        <ConnectionErrorDisplay 
                          onRetry={() => fetchUserRequests()} 
                        />
                      ) : activeRequests.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageCircle className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-white">No Active Conversations</h3>
                          <p className="text-indigo-300 mt-2">You don't have any active help requests. Submit a request to get started.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeRequests.map((requestId) => {
                            const request = requestsData[requestId] || {};
                            const risk = request.risk || 0;
                            const riskLabel = risk >= 0.8 ? "Critical" : 
                                             risk >= 0.6 ? "High" : 
                                             risk >= 0.3 ? "Medium" : "Low";
                            const timeDiff = request.created_at ? new Date(Date.now() - new Date(request.created_at).getTime()) : null;
                            const timeAgo = timeDiff ? 
                              timeDiff.getUTCHours() >= 1 ? 
                                `${timeDiff.getUTCHours()} hr${timeDiff.getUTCHours() > 1 ? 's' : ''} ago` : 
                                `${timeDiff.getUTCMinutes()} min ago` : '0 min ago';
                            
                            return (
                              <div
                                key={requestId}
                                onClick={() => setSelectedChat(requestId)}
                                className={cn(
                                  "flex flex-col w-full p-3 mb-1 rounded-md transition-colors cursor-pointer",
                                  selectedChat === requestId
                                    ? "bg-indigo-600 text-white"
                                    : "bg-indigo-800 text-white hover:bg-indigo-700"
                                )}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center">
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    <span className="truncate">#{requestId.substring(0, 8)}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    {newMessagesByRequest[requestId] > 0 && (
                                      <Badge variant="destructive" className="ml-auto">
                                        {newMessagesByRequest[requestId]}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="mt-2 text-xs flex justify-between items-center">
                                  <Badge className={
                                    risk >= 0.8 ? "bg-purple-600" : 
                                    risk >= 0.6 ? "bg-red-600" : 
                                    risk >= 0.3 ? "bg-amber-600" : "bg-green-600"
                                  }>
                                    {riskLabel}
                                    {risk >= 0.3 && <span className="ml-1">{Math.round(risk * 100)}%</span>}
                                  </Badge>
                                  <span className="text-indigo-200">{timeAgo}</span>
                                </div>

                                <p className="mt-2 text-sm line-clamp-4 text-indigo-100 min-h-[4rem]">
                                  {request.summary || ""}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add timeout effect separately */}
                      {refreshingRequests && (
                        <EnhancedLoadingTimeout
                          isLoading={refreshingRequests}
                          onTimeout={() => {
                            setRefreshingRequests(false);
                            setLoadingError(true);
                            console.warn("Request loading timed out after 10 seconds");
                          }}
                          timeoutMs={10000}
                        >
                          {/* This is just for the timeout effect - children aren't rendered */}
                          <span className="hidden" />
                        </EnhancedLoadingTimeout>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                <div className="lg:col-span-2">
                  {selectedChat ? (
                    <>
                      <ChatPanel
                        chatId={selectedChat}
                      />
                      <div className="flex items-center justify-end mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCloseRequest(selectedChat)}
                          disabled={isClosingRequest}
                          className="text-xs"
                        >
                          {isClosingRequest ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Resolving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Mark as Resolved
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Card className="bg-indigo-900 border-indigo-800 h-full flex items-center justify-center">
                      <CardContent className="text-center p-8">
                        <MessageCircle className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-white">No Conversation Selected</h3>
                        <p className="text-indigo-300 mt-2 max-w-md mx-auto">
                          Select an active conversation from the sidebar or create a new help request to start chatting.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </motion.div>
            </TabsContent>
            
            {/* History tab content */}
            <TabsContent value="history" className="mt-0">
              <motion.div
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="bg-indigo-900 border-indigo-800">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-xl text-white">Session History</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => refreshHistory()}
                      disabled={historyLoading}
                      className="border-indigo-700 hover:bg-indigo-800 text-white"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${historyLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="flex justify-center p-6">
                        <CustomLoader size="lg" color="indigo" label="Loading your session history..." />
                      </div>
                    ) : historyError ? (
                      <LoadingErrorDisplay 
                        title="Failed to Load History"
                        description="There was a problem loading your session history."
                        onRetry={() => refreshHistory()}
                        theme="indigo"
                      />
                    ) : sessionHistory.length === 0 ? (
                      <div className="text-center py-10">
                        <History className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white">No Session History</h3>
                        <p className="text-indigo-300 mt-2 max-w-md mx-auto">
                          When you resolve help requests, they will appear here in your history.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sessionHistory.map((session) => (
                          <Card key={session.id} className="bg-indigo-800 border-indigo-700">
                            <CardHeader className="p-4 pb-2">
                              <div className="flex justify-between items-center">
                                <CardTitle className="text-md text-white">
                                  {session.issue}
                                </CardTitle>
                                <Badge 
                                  className={
                                    session.role === 'user' 
                                      ? "bg-indigo-500 text-white" 
                                      : "bg-green-500 text-white"
                                  }
                                >
                                  {session.role === 'user' ? 'Your Request' : 'Helper'}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 pt-2">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-indigo-300">Status</p>
                                  <p className="text-white font-medium">{session.outcome}</p>
                                </div>
                                <div>
                                  <p className="text-indigo-300">Duration</p>
                                  <p className="text-white font-medium">{session.timeSpent}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            
            {/* Resources tab content */}
            <TabsContent value="resources" className="mt-0">
              <motion.div
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="bg-indigo-900 border-indigo-800">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Support Resources</CardTitle>
                    <CardDescription className="text-indigo-300">
                      Helpful resources for common student challenges
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <Card className="bg-indigo-800 border-indigo-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-white">Stress Management</CardTitle>
                        </CardHeader>
                        <CardContent className="text-indigo-200">
                          <p>Techniques and resources to help you manage academic stress and anxiety.</p>
                        </CardContent>
                        <CardFooter>
                          <Button variant="outline" className="w-full border-indigo-600 text-white hover:bg-indigo-700">
                            View Resources
                          </Button>
                        </CardFooter>
                      </Card>
                      
                      <Card className="bg-indigo-800 border-indigo-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-white">Time Management</CardTitle>
                        </CardHeader>
                        <CardContent className="text-indigo-200">
                          <p>Strategies to help you balance coursework, extracurriculars, and personal time.</p>
                        </CardContent>
                        <CardFooter>
                          <Button variant="outline" className="w-full border-indigo-600 text-white hover:bg-indigo-700">
                            View Resources
                          </Button>
                        </CardFooter>
                      </Card>
                      
                      <Card className="bg-indigo-800 border-indigo-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-white">Academic Support</CardTitle>
                        </CardHeader>
                        <CardContent className="text-indigo-200">
                          <p>Tutoring services, study groups, and other academic resources available on campus.</p>
                        </CardContent>
                        <CardFooter>
                          <Button variant="outline" className="w-full border-indigo-600 text-white hover:bg-indigo-700">
                            View Resources
                          </Button>
                        </CardFooter>
                      </Card>

                      <Card className="bg-indigo-800 border-indigo-700">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg text-white">Discord Community</CardTitle>
                        </CardHeader>
                        <CardContent className="text-indigo-200">
                          <p>Join our Discord community for peer support, resources, and to connect with other students.</p>
                          <div className="mt-3 flex flex-col space-y-2">
                            <a 
                              href="https://discord.gg/5FZqTHnRhq" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-indigo-300 hover:text-indigo-100 flex items-center"
                            >
                              <svg width="20" height="15" viewBox="0 0 71 55" fill="none" className="mr-2">
                                <g clipPath="url(#clip0)">
                                  <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.4349C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="currentColor"/>
                                </g>
                                <defs>
                                  <clipPath id="clip0">
                                    <rect width="71" height="55" fill="currentColor"/>
                                  </clipPath>
                                </defs>
                              </svg>
                              Join our Discord server
                            </a>
                            <a 
                              href="https://discord.com/oauth2/authorize?client_id=1364959908067410011&integration_type=0&scope=applications.commands" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-indigo-300 hover:text-indigo-100 flex items-center"
                            >
                              <svg width="20" height="15" viewBox="0 0 71 55" fill="none" className="mr-2">
                                <g clipPath="url(#clip0)">
                                  <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.4349C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="currentColor"/>
                                </g>
                                <defs>
                                  <clipPath id="clip0">
                                    <rect width="71" height="55" fill="currentColor"/>
                                  </clipPath>
                                </defs>
                              </svg>
                              Add our bot to your server
                            </a>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button 
                            variant="outline" 
                            className="w-full border-indigo-600 text-white hover:bg-indigo-700"
                            onClick={() => window.open('https://discord.gg/5FZqTHnRhq', '_blank')}
                          >
                            Join Discord
                          </Button>
                        </CardFooter>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            
            {/* Schedule tab content */}
            <TabsContent value="schedule" className="mt-0">
              <motion.div
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="bg-indigo-900 border-indigo-800">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Schedule an Appointment</CardTitle>
                    <CardDescription className="text-indigo-300">
                      Book a session with a helper or counselor
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Calendar className="h-16 w-16 text-indigo-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white">Coming Soon</h3>
                      <p className="text-indigo-300 mt-2 max-w-md mx-auto">
                        This feature is currently under development. Check back soon to schedule appointments with helpers.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
            
            {/* Settings tab content */}
            <TabsContent value="settings" className="mt-0">
              <motion.div
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="bg-indigo-900 border-indigo-800">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">Profile Settings</CardTitle>
                    <CardDescription className="text-indigo-300">
                      Manage your profile information and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="name" className="text-sm font-medium text-white">
                            Display Name
                          </label>
                          <Input
                            id="name"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-indigo-950 border-indigo-700 text-white placeholder:text-indigo-400"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium text-white">
                            Email Address
                          </label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            disabled
                            className="bg-indigo-950 border-indigo-700 text-white placeholder:text-indigo-400 opacity-70"
                          />
                          <p className="text-xs text-indigo-400">This is your account email and cannot be changed</p>
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="contactEmail" className="text-sm font-medium text-white">
                            Contact Email
                          </label>
                          <Input
                            id="contactEmail"
                            type="email"
                            placeholder="Contact email address"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="bg-indigo-950 border-indigo-700 text-white placeholder:text-indigo-400"
                          />
                          <p className="text-xs text-indigo-400">This email will be used for notifications</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 pt-4 border-t border-indigo-800">
                        <h3 className="text-lg font-medium text-white">Notification Preferences</h3>
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-white">Email Notifications</p>
                            <p className="text-xs text-indigo-300">Receive email updates about your conversations</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="emailNotifications"
                              className="rounded-sm bg-indigo-950 border-indigo-700 text-indigo-500"
                              defaultChecked
                            />
                            <label htmlFor="emailNotifications" className="text-sm text-white">Enabled</label>
                          </div>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-white">Browser Notifications</p>
                            <p className="text-xs text-indigo-300">Receive browser notifications for new messages</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="browserNotifications"
                              className="rounded-sm bg-indigo-950 border-indigo-700 text-indigo-500"
                              defaultChecked
                            />
                            <label htmlFor="browserNotifications" className="text-sm text-white">Enabled</label>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <EnhancedLoadingTimeout 
                          isLoading={isSavingProfile} 
                          onTimeout={() => {
                            setIsSavingProfile(false)
                            toast({
                              title: "Saving taking too long",
                              description: "Please try again. If the problem persists, contact support.",
                              variant: "destructive"
                            })
                          }}
                          timeoutMs={8000}
                        >
                          <Button 
                            onClick={handleSaveProfile}
                            disabled={isSavingProfile}
                            className="bg-indigo-500 hover:bg-indigo-400 text-white ml-auto"
                          >
                            {isSavingProfile ? (
                              <>
                                <CustomLoader size="sm" color="indigo" className="mr-2" />
                                Saving...
                              </>
                            ) : (
                              <>
                                Save Changes
                              </>
                            )}
                          </Button>
                        </EnhancedLoadingTimeout>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
} 