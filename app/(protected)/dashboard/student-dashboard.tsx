"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LogOut, RefreshCw, Send, Book, MessageCircle, FileText, Clock, User, PlusCircle, School, Lightbulb, Calendar, Settings, AlertTriangle, AlertCircle } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useProfile } from "@/context/profile-context"
import ChatPanel from "@/components/ChatPanel"
import { createSupabaseClient } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { LoadingTimeout, LoadingErrorDisplay } from "@/components/LoadingTimeout"
import { CustomLoader } from "@/components/ui/custom-loader"

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

export default function StudentDashboard() {
  const { user, signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const [name, setName] = useState('')
  const [activeRequests, setActiveRequests] = useState<string[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [issueDescription, setIssueDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [refreshingRequests, setRefreshingRequests] = useState(false)
  const [isFixingProfile, setIsFixingProfile] = useState(false)
  const [mood, setMood] = useState('neutral')
  const [requestsCount, setRequestsCount] = useState(0)
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

  // Fetch existing requests when component mounts
  useEffect(() => {
    if (user?.id) {
      fetchUserRequests()
      fetchUserStats()
    }
  }, [user?.id])

  const fetchUserStats = async () => {
    if (!user?.id) return
    
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from('requests')
        .select('id')
        .eq('created_by', user.id)
      
      if (!error && data) {
        setRequestsCount(data.length)
      }
    } catch (error) {
      console.error("Failed to fetch user stats:", error)
    }
  }

  const fetchUserRequests = async () => {
    if (!user?.id) return
    
    try {
      setRefreshingRequests(true)
      setLoadingError(false)
      setConnectionError(false)
      
      const supabase = createSupabaseClient()
      
      // Find requests created by this user
      const { data, error } = await supabase
        .from('requests')
        .select('id')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error("Supabase error fetching requests:", error, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // Check if it's a connection error
        if (error.message?.includes('Failed to fetch') || 
            error.message?.includes('NetworkError') ||
            error.message?.includes('network') ||
            error.code === 'PGRST') {
          setConnectionError(true)
        }
        
        throw error
      }
      
      const requests = data.map(r => r.id)
      setActiveRequests(requests)
      
      // Set the first request as selected if there is one and nothing is currently selected
      if (requests.length > 0 && !selectedChat) {
        setSelectedChat(requests[0])
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
  }

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueDescription.trim() || isSubmitting) return
    
    try {
      setIsSubmitting(true)
      
      const supabase = createSupabaseClient()
      
      // Create a new request
      const { data, error } = await supabase
        .from('requests')
        .insert({
          summary: issueDescription.substring(0, 100),
          channel: 'web',
          status: 'open',
          created_by: user?.id,
          risk: 0.3, // Default risk until AI analyzes
          external_id: `web_${Date.now()}`
        })
        .select('id')
        .single()
      
      if (error) throw error
      
      // Add initial message from user
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          request_id: data.id,
          sender: 'caller',
          content: issueDescription
        })
      
      if (messageError) throw messageError
      
      // Analyze with AI (this would ideally happen server-side)
      try {
        const analysisResponse = await fetch(`/api/chat/${data.id}/analyze`, {
          method: 'POST'
        })
        
        if (!analysisResponse.ok) {
          console.warn('AI analysis failed but request was created')
        }
      } catch (aiError) {
        console.error('AI analysis error:', aiError)
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
              className={`w-full justify-start ${currentTab === 'request' ? 'bg-indigo-800 text-indigo-300' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('request')}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>New Request</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'active' ? 'bg-indigo-800 text-indigo-300' : 'text-white hover:text-white hover:bg-indigo-800'}`}
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
              className={`w-full justify-start ${currentTab === 'resources' ? 'bg-indigo-800 text-indigo-300' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('resources')}
            >
              <Book className="mr-2 h-4 w-4" />
              <span>Resources</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'schedule' ? 'bg-indigo-800 text-indigo-300' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('schedule')}
            >
              <Calendar className="mr-2 h-4 w-4" />
              <span>Appointments</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'settings' ? 'bg-indigo-800 text-indigo-300' : 'text-white hover:text-white hover:bg-indigo-800'}`}
              onClick={() => handleTabChange('settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
          </div>
          
          <div className="absolute bottom-4 left-4 right-4">
            <Button variant="ghost" className="w-full justify-start text-white hover:text-white hover:bg-indigo-800" onClick={signOut}>
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
              <h1 className="text-2xl font-bold text-white">Student Dashboard</h1>
            </div>

            {/* Stats cards - moved outside TabsContent to appear on all tabs */}
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

            <TabsList className="bg-indigo-900 border-indigo-800 hidden">
              <TabsTrigger value="request" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                Request Help
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-indigo-500 data-[state=active]:text-white">
                Active Chats
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
                <Card className="bg-indigo-900 border-indigo-800">
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
                          rows={6}
                          className="bg-indigo-950 border-indigo-700 text-white placeholder:text-indigo-400 resize-none"
                        />
                      </div>
                      
                      <div className="flex justify-between items-center pt-2">
                        <div className="text-sm text-indigo-300">
                          A helper will respond as soon as possible
                        </div>
                        <LoadingTimeout 
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
                        </LoadingTimeout>
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
                      <LoadingTimeout 
                        isLoading={refreshingRequests} 
                        onTimeout={() => {
                          setRefreshingRequests(false)
                          setLoadingError(true)
                          console.warn("Request loading timed out after 10 seconds")
                        }}
                        timeoutMs={10000}
                      >
                        {refreshingRequests ? (
                          <div className="flex justify-center p-4">
                            <CustomLoader size="lg" color="indigo" label="Loading your conversations..." />
                          </div>
                        ) : loadingError ? (
                          <LoadingErrorDisplay 
                            title="Failed to Load Conversations"
                            description="There was a problem loading your conversations."
                            onRetry={fetchUserRequests}
                            icon={AlertTriangle}
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
                            {activeRequests.map((requestId) => (
                              <div 
                                key={requestId}
                                className={`p-3 rounded-md cursor-pointer hover:bg-indigo-800 transition-colors ${selectedChat === requestId ? 'bg-indigo-800 border-l-4 border-l-indigo-500' : 'bg-indigo-850'}`}
                                onClick={() => setSelectedChat(requestId)}
                              >
                                <div className="flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                  <p className="text-sm font-medium text-white truncate">Chat #{requestId.substring(0, 8)}</p>
                                </div>
                                <p className="text-xs text-indigo-300 mt-1">Active conversation</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </LoadingTimeout>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="lg:col-span-2">
                  {selectedChat ? (
                    <ChatPanel
                      requestId={selectedChat}
                      isHelper={false}
                    />
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
                        <LoadingTimeout 
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
                        </LoadingTimeout>
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