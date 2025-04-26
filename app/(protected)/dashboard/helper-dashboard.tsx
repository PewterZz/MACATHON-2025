"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQueue } from "@/hooks/useQueue"
import { DataTable } from "@/components/DataTable"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-context"
import { useProfile } from "@/context/profile-context"
import { useSessionHistory } from "@/hooks/useSessionHistory"
import { LogOut, AlertTriangle, RefreshCw, UserPlus, CheckCircle, Clock, FileText, PieChart, MessageCircle, Coffee, ArrowUpRight, BellRing, Settings } from "lucide-react"
import { createSupabaseClient } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { motion } from "framer-motion"
import { LoadingTimeout, LoadingErrorDisplay } from "@/components/LoadingTimeout"
import { CustomLoader } from "@/components/ui/custom-loader"
import { Database } from "@/types/supabase"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { ForwardRefExoticComponent, RefAttributes } from 'react'
import { cn } from "@/lib/utils"
import ChatPanel from "@/components/ChatPanel"

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

// Update the Profile interface to match the context
interface Profile {
  id: string;
  name: string | null;
  is_helper: boolean;
  helper_score: number;
  contact_email: string | null;
}

// Update the Request interface to include all needed fields
interface Request {
  id: string;
  status: string;
  claimed_by: string | null;
  tags?: string[];
  summary: string;
  risk: number;
  channel: string;
  timestamp: string;
}

interface RequestWithTags {
  id: string;
  title: string;
  description: string;
  status: string;
  claimed_by: string | null;
  tags: string[];
  created_at: string;
}

// Update the RequestCard props interface
interface RequestCardProps {
  request: Request;
  onClaim: (requestId: string) => Promise<void>;
  className?: string;
}

// Update the Supabase types
type Tables = Database['public']['Tables']
type RequestRow = Tables['requests']['Row']

// Update the TabItemProps interface
interface TabItemProps {
  label: string;
  value: string;
  icon?: LucideIcon;
}

// Update the profile context type
interface ProfileContextType {
  profile: Profile | null;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
}

// Update the useProfile hook to use the correct types
declare module '@/context/profile-context' {
  export function useProfile(): ProfileContextType;
}

const TabItem = ({ label, value, icon: Icon }: TabItemProps) => {
  return (
    <TabsTrigger value={value} className="flex items-center gap-2">
      {Icon && <Icon size={16} />}
      {label}
    </TabsTrigger>
  );
};

export const RequestCard = ({ request, onClaim, className }: RequestCardProps) => {
  // Determine risk color classes for the badge (text, border, background)
  const getRiskBadgeColorClasses = (risk: number) => {
    if (risk >= 0.8) return 'text-red-600 border-red-500/60 bg-red-500/10';
    if (risk >= 0.5) return 'text-yellow-600 border-yellow-500/60 bg-yellow-500/10';
    if (risk >= 0.2) return 'text-blue-600 border-blue-500/60 bg-blue-500/10'; // Medium risk
    return 'text-green-600 border-green-500/60 bg-green-500/10'; // Low risk
  };

  // Determine background color class for the risk indicator circle
  const getRiskCircleBgClass = (risk: number) => {
    if (risk >= 0.8) return 'bg-red-500';
    if (risk >= 0.5) return 'bg-yellow-500';
    if (risk >= 0.2) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Determine risk label
  const getRiskLabel = (risk: number) => {
    if (risk >= 0.8) return 'Critical';
    if (risk >= 0.5) return 'High';
    if (risk >= 0.2) return 'Medium';
    return 'Low';
  };

  return (
    <motion.div 
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between", 
        className
      )}
      variants={cardVariants} // Apply animation variant
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-1">
          <CardTitle className="text-lg font-semibold leading-none tracking-tight pt-1">Request {request.id.substring(0, 6)}</CardTitle>
          <div className="flex items-center gap-2">
            {/* Risk Label Badge with colored circle and thicker border */}
            <Badge variant="outline" className={`border-2 capitalize font-medium text-xs px-2 py-1 flex items-center ${getRiskBadgeColorClasses(request.risk)}`}>
              <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${getRiskCircleBgClass(request.risk)}`}></span>
              {getRiskLabel(request.risk)}
            </Badge>
            {/* Risk Percentage Badge */}
            <Badge variant="secondary" className="font-medium text-xs px-2 py-1 text-slate-100 bg-slate-600 hover:bg-slate-500">
              {(request.risk * 100).toFixed(0)}% Risk
            </Badge>
          </div>
        </div>
        <CardDescription className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
          <Clock size={12} /> {request.timestamp}
          <span className="capitalize">| <MessageCircle size={12} className="inline-block mr-1"/>{request.channel}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="py-3 flex-grow">
        <p className="text-sm text-slate-200 mb-3 line-clamp-3" title={request.summary}>
          {request.summary}
        </p>
        <div className="flex flex-wrap gap-1">
          {request.tags?.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs capitalize">{tag}</Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-3">
        <Button 
          onClick={() => onClaim(request.id)} // Pass request ID to onClaim
          className="w-full"
          size="sm"
        >
          <UserPlus className="mr-2 h-4 w-4" /> Claim Request
        </Button>
      </CardFooter>
    </motion.div>
  );
};

export default function HelperDashboard() {
  const { queue: liveQueue, isLoading, claimRequest, refreshQueue } = useQueue()
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [claimedRequests, setClaimedRequests] = useState<string[]>([])
  const { user, signOut } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { history, isLoading: isHistoryLoading, refreshHistory } = useSessionHistory()
  const [autoAssign, setAutoAssign] = useState(false)
  const [refreshingClaimed, setRefreshingClaimed] = useState(false)
  const [name, setName] = useState('')
  const [isFixingProfile, setIsFixingProfile] = useState(false)
  const [availability, setAvailability] = useState('available')
  const [helpedCount, setHelpedCount] = useState(0)
  const [email, setEmail] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [queueLoadingError, setQueueLoadingError] = useState(false)
  const [claimedLoadingError, setClaimedLoadingError] = useState(false)
  const [historyLoadingError, setHistoryLoadingError] = useState(false)
  
  // Get current tab from URL or default to 'queue'
  const currentTab = searchParams?.get('tab') || 'queue'

  // Debug current tab state - more verbose logging
  useEffect(() => {
    console.log('Current tab from URL params:', searchParams?.get('tab'));
    console.log('Computed currentTab value:', currentTab);
    console.log('Full URL search params:', searchParams?.toString());
  }, [searchParams, currentTab]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    router.push(`/dashboard?tab=${value}`, { scroll: false })
  }
  
  // Use only live queue data from Supabase
  const queue = isLoading ? [] : liveQueue

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

  // Update fetchStats function
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.id) return
      
      try {
        const supabase = createClientComponentClient<Database>()
        const { data } = await supabase
          .from('requests')
          .select('*')
          .eq('claimed_by', user.id)
          .eq('status', 'closed')
        
        if (data) {
          setHelpedCount(data.length)
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      }
    }
    
    fetchStats()
  }, [user?.id])

  // Update fetchClaimedRequests function
  useEffect(() => {
    const fetchClaimedRequests = async () => {
      try {
        setRefreshingClaimed(true)
        const supabase = createClientComponentClient<Database>()
        const { data } = await supabase
          .from('requests')
          .select('*')
          .eq('status', 'claimed')
          .eq('claimed_by', user?.id)
        
        if (data) {
          setClaimedRequests(data.map((request: RequestRow) => request.id))
          
          // If there are claimed requests but no active chat, set the first one as active
          if (data.length > 0 && !activeChat) {
            setActiveChat(data[0].id)
          }
        }
      } catch (error) {
        console.error("Failed to fetch claimed requests:", error)
      } finally {
        setRefreshingClaimed(false)
      }
    }
    
    if (user?.id) {
      fetchClaimedRequests()
    }
  }, [user?.id, activeChat])

  const handleClaimRequest = async (requestId: string) => {
    try {
      await claimRequest(requestId)
      setClaimedRequests(prev => [...prev, requestId])
      setActiveChat(requestId)
      
      toast({
        title: "Request claimed",
        description: "You have successfully claimed this request.",
        variant: "default"
      })
    } catch (error) {
      console.error("Failed to claim request:", error)
      toast({
        title: "Error",
        description: "Failed to claim request. Please try again.",
        variant: "destructive"
      })
    }
  }
  
  // Update refreshClaimedRequests function
  const refreshClaimedRequests = async () => {
    try {
      setRefreshingClaimed(true)
      setClaimedLoadingError(false)
      
      const supabase = createClientComponentClient<Database>()
      const { data } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'claimed')
        .eq('claimed_by', user?.id)
      
      if (data) {
        setClaimedRequests(data.map((request: RequestRow) => request.id))
      }
    } catch (error) {
      console.error("Failed to refresh claimed requests:", error)
      setClaimedLoadingError(true)
      toast({
        title: "Error",
        description: "Failed to load your active chats. Please try again.",
        variant: "destructive"
      })
    } finally {
      setRefreshingClaimed(false)
    }
  }

  const handleCloseChat = (requestId: string) => {
    setClaimedRequests(prev => prev.filter(id => id !== requestId))
    if (activeChat === requestId) {
      const remainingChats = claimedRequests.filter(id => id !== requestId)
      setActiveChat(remainingChats.length > 0 ? remainingChats[0] : null)
    }
  }

  const handleSaveName = async () => {
    if (name.trim() && profile) {
      try {
        await updateProfile({ name: name.trim() })
      } catch (error) {
        console.error("Failed to update profile:", error)
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

  const handleChangeAvailability = (newStatus: string) => {
    setAvailability(newStatus)
    toast({
      title: "Status Updated",
      description: `You are now ${newStatus}`,
      variant: "default"
    })
  }

  // Update handleSaveProfile function
  const handleSaveProfile = async () => {
    if (profile) {
      try {
        setIsSavingProfile(true)
        await updateProfile({ 
          name: name.trim(),
          contact_email: contactEmail.trim() 
        } as Partial<Profile>)
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

  // Add wrapper for refreshHistory that handles errors
  const handleRefreshHistory = () => {
    setHistoryLoadingError(false)
    refreshHistory()
  }

  const handleSignOut = async () => {
    try {
      setRefreshingClaimed(true);
      await router.push('/signin');
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
      setRefreshingClaimed(false);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    }
  }

  const historyColumns = [
    { accessorKey: "issue", header: "Issue" },
    { accessorKey: "outcome", header: "Outcome" },
    { accessorKey: "timeSpent", header: "Time Spent" },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: () => (
        <Button variant="outline" size="sm" className="border-slate-700 text-slate-100 hover:bg-slate-700">
          View
        </Button>
      ),
    },
  ]

  // Handler for sending native notifications
  const handleSendNotification = async () => {
    if (!('Notification' in window)) {
      toast({
        title: "Notifications Not Supported",
        description: "This browser does not support desktop notifications.",
        variant: "destructive",
      });
      return;
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      // Send the notification
      try {
        // You can customize the title, body, icon, etc.
        const notification = new Notification("✨ Meld Notification", {
          body: "This is a test notification!",
          icon: "/logo.png", // Optional: Use your app's logo
          // requireInteraction: true, // Optional: Keeps the notification visible until interacted with
        });
        
        // Optional: Handle click on notification
        notification.onclick = () => {
          console.log('Notification clicked!');
          // Example: Focus the window or navigate somewhere
          window.focus(); 
          // router.push('/dashboard?tab=queue'); // Example navigation
        };
        
        console.log("Notification sent successfully.");

      } catch (error) {
        console.error("Error sending notification:", error);
        toast({
          title: "Notification Error",
          description: "Could not send the notification.",
          variant: "destructive",
        });
      }
    } else if (permission === 'denied') {
      toast({
        title: "Notifications Blocked",
        description: "Please enable notifications for this site in your browser settings.",
        variant: "destructive",
      });
    } else {
       console.log('Notification permission request dismissed or failed.');
        toast({
          title: "Permission Required",
          description: "Notification permission was not granted.",
          variant: "destructive",
        });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 fixed h-full left-0 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-center mb-8 mt-4">
            <div className="h-24 w-24">
              <img src="/logo.png" alt="Meld logo" className="h-full w-full object-contain" />
            </div>
            <h1 className="text-xl font-bold text-slate-100 ml-3 tracking-tight">Meld</h1>
          </div>
          
          <div className="mb-6 pb-6 border-b border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#3ECF8E] flex items-center justify-center font-bold text-slate-900">
                {name ? name.charAt(0).toUpperCase() : 'H'}
              </div>
              <div>
                <p className="font-medium text-slate-100">{name || 'Helper'}</p>
                <Badge className="bg-green-600 text-slate-100 hover:bg-green-500">Helper</Badge>
              </div>
            </div>
            
            <div className="mt-4">
              <p className="text-xs text-slate-400 mb-1">Availability</p>
              <div className="grid grid-cols-3 gap-1 text-center text-xs">
                <Button 
                  variant={availability === 'available' ? 'default' : 'outline'} 
                  className={availability === 'available' ? 'bg-green-600 text-white hover:bg-green-500' : 'border-slate-700 hover:bg-slate-700'} 
                  size="sm"
                  onClick={() => handleChangeAvailability('available')}
                >
                  Available
                </Button>
                <Button 
                  variant={availability === 'busy' ? 'default' : 'outline'} 
                  className={availability === 'busy' ? 'bg-yellow-600 text-white hover:bg-yellow-500' : 'border-slate-700 hover:bg-slate-700'} 
                  size="sm"
                  onClick={() => handleChangeAvailability('busy')}
                >
                  Busy
                </Button>
                <Button 
                  variant={availability === 'away' ? 'default' : 'outline'} 
                  className={availability === 'away' ? 'bg-red-600 text-white hover:bg-red-500' : 'border-slate-700 hover:bg-slate-700'} 
                  size="sm"
                  onClick={() => handleChangeAvailability('away')}
                >
                  Away
                </Button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'queue' ? 'bg-slate-700 text-[#3ECF8E] border-l-4 border-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)]' : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700'}`}
              onClick={() => handleTabChange('queue')}
            >
              <Clock className="mr-2 h-4 w-4" />
              <span>Request Queue</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'active' ? 'bg-slate-700 text-[#3ECF8E] border-l-4 border-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)]' : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700'}`}
              onClick={() => handleTabChange('active')}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              <span>Active Chats</span>
              {claimedRequests.length > 0 && (
                <Badge className="ml-auto bg-[#3ECF8E] text-slate-900">{claimedRequests.length}</Badge>
              )}
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'history' ? 'bg-slate-700 text-[#3ECF8E] border-l-4 border-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)]' : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700'}`}
              onClick={() => handleTabChange('history')}
            >
              <FileText className="mr-2 h-4 w-4" />
              <span>Session History</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'analytics' ? 'bg-slate-700 text-[#3ECF8E] border-l-4 border-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)]' : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700'}`}
              onClick={() => handleTabChange('analytics')}
            >
              <PieChart className="mr-2 h-4 w-4" />
              <span>Analytics</span>
            </Button>
            <Button 
              variant="ghost" 
              className={`w-full justify-start ${currentTab === 'settings' ? 'bg-slate-700 text-[#3ECF8E] border-l-4 border-[#3ECF8E] shadow-[0_0_10px_rgba(62,207,142,0.3)]' : 'text-slate-300 hover:text-slate-100 hover:bg-slate-700'}`}
              onClick={() => handleTabChange('settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </Button>
          </div>
          
          <div className="absolute bottom-4 left-4 right-4">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-slate-300 hover:text-slate-100 hover:bg-slate-700" 
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
          <Tabs 
            defaultValue={currentTab} 
            value={currentTab} 
            onValueChange={handleTabChange} 
            className="w-full space-y-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-slate-100">Helper</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <Switch
                    id="auto-assign"
                    checked={autoAssign}
                    onCheckedChange={setAutoAssign}
                    className="data-[state=checked]:bg-[#3ECF8E]"
                  />
                  <label htmlFor="auto-assign" className="ml-2 text-sm text-slate-300">
                    Auto-assign requests
                  </label>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-slate-700 hover:bg-slate-700 flex items-center gap-1"
                  onClick={handleSendNotification}
                >
                  <BellRing className="h-4 w-4" />
                  <span>Notifications</span>
                </Button>
              </div>
            </div>

            {/* Stats cards - moved inside the "queue" TabsContent to appear only on main dashboard */}
            <TabsContent value="queue" className="mt-0">
              <motion.div
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Stats cards - only visible on main dashboard tab */}
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div variants={cardVariants}>
                    <Card className="bg-slate-800 border-slate-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-slate-100 text-sm font-medium">People Helped</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-slate-100">{helpedCount}</div>
                          <div className="p-2 bg-green-500/10 rounded-full">
                            <UserPlus className="h-4 w-4 text-[#3ECF8E]" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  <motion.div variants={cardVariants}>
                    <Card className="bg-slate-800 border-slate-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-slate-100 text-sm font-medium">Active Sessions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-slate-100">{claimedRequests.length}</div>
                          <div className="p-2 bg-blue-500/10 rounded-full">
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  
                  <motion.div variants={cardVariants}>
                    <Card className="bg-slate-800 border-slate-700">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-slate-100 text-sm font-medium">Waiting Requests</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="text-2xl font-bold text-slate-100">{queue.length}</div>
                          <div className="p-2 bg-yellow-500/10 rounded-full">
                            <Clock className="h-4 w-4 text-yellow-500" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>

                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-semibold text-slate-100">Support Queue</CardTitle>
                    <Button variant="outline" size="sm" onClick={refreshQueue} disabled={isLoading} className="border-slate-700 hover:bg-slate-700">
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <LoadingTimeout 
                      isLoading={isLoading} 
                      onTimeout={() => {
                        setQueueLoadingError(true)
                        console.warn("Queue loading timed out after 10 seconds")
                      }}
                      timeoutMs={10000}
                    />
                    {isLoading ? (
                      <div className="flex justify-center p-4">
                        <CustomLoader size="lg" color="default" label="Loading requests..." />
                      </div>
                    ) : queueLoadingError ? (
                      <LoadingErrorDisplay 
                        title="Failed to Load Queue"
                        description="There was a problem loading the request queue."
                        onRetry={refreshQueue}
                        theme="slate"
                      />
                    ) : queue.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Coffee className="h-12 w-12 text-slate-500 mb-4" />
                        <h3 className="text-lg font-medium text-slate-100">Queue Empty</h3>
                        <p className="text-slate-400 mt-2 max-w-md">There are currently no requests waiting for assistance. Take a moment to relax!</p>
                      </div>
                    ) : (
                      <motion.div 
                        className="space-y-4"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        {queue.map((request) => (
                          <motion.div key={request.id} variants={cardVariants}>
                            <RequestCard
                              request={request}
                              onClaim={handleClaimRequest}
                              className="bg-slate-700 border-slate-600 hover:border-[#3ECF8E]/50"
                            />
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
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
                <div className="lg:col-span-1 space-y-4">
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-lg font-semibold text-slate-100">Your Active Chats</CardTitle>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={refreshClaimedRequests} 
                        disabled={refreshingClaimed}
                        className="border-slate-700 hover:bg-slate-700"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshingClaimed ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <LoadingTimeout 
                        isLoading={refreshingClaimed} 
                        onTimeout={() => {
                          setRefreshingClaimed(false)
                          setClaimedLoadingError(true)
                          console.warn("Claimed requests loading timed out after 10 seconds")
                        }}
                        timeoutMs={10000}
                      />
                      {refreshingClaimed ? (
                        <div className="flex justify-center p-4">
                          <CustomLoader size="lg" color="default" label="Loading your active chats..." />
                        </div>
                      ) : claimedLoadingError ? (
                        <LoadingErrorDisplay 
                          title="Failed to Load Chats"
                          description="There was a problem loading your active chats."
                          onRetry={refreshClaimedRequests}
                          theme="slate"
                        />
                      ) : claimedRequests.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageCircle className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-slate-100">No Active Chats</h3>
                          <p className="text-slate-400 mt-2">You don't have any active support chats. Claim requests from the queue to start helping.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {claimedRequests.map((requestId) => (
                            <div 
                              key={requestId}
                              className={`p-3 rounded-md cursor-pointer hover:bg-slate-700 transition-colors ${activeChat === requestId ? 'bg-slate-700 border-l-4 border-l-[#3ECF8E]' : 'bg-slate-750'}`}
                              onClick={() => setActiveChat(requestId)}
                            >
                              <div className="flex items-center">
                                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                                <p className="text-sm font-medium text-slate-100 truncate">Chat #{requestId.substring(0, 8)}</p>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">Active conversation</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-slate-800 border-slate-700">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-slate-100">AI Coach</CardTitle>
                      <CardDescription className="text-slate-400">Get real-time guidance while chatting</CardDescription>
                    </CardHeader>
                    <CardContent className="text-slate-200">
                      {activeChat ? (
                        <div className="space-y-3">
                          <div className="flex items-start space-x-2">
                            <div className="p-1.5 bg-blue-500/10 rounded-full">
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            </div>
                            <div className="text-sm">
                              <p>Use open-ended questions to better understand the situation</p>
                            </div>
                          </div>
                          <div className="flex items-start space-x-2">
                            <div className="p-1.5 bg-amber-500/10 rounded-full">
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            </div>
                            <div className="text-sm">
                              <p>Be mindful of suggesting solutions too early</p>
                            </div>
                          </div>
                          <div className="mt-4">
                            <Button variant="outline" size="sm" className="w-full border-slate-700 hover:bg-slate-700">
                              <ArrowUpRight className="h-4 w-4 mr-2" />
                              View Full Coaching Analysis
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm">Select an active chat to receive coaching insights</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
                
                <div className="lg:col-span-2">
                  {activeChat ? (
                    <div className="relative h-full">
                      <div className="absolute top-2 right-2 z-10">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600"
                          onClick={() => handleCloseChat(activeChat)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </Button>
                      </div>
                      <ChatPanel
                        chatId={activeChat}
                      />
                    </div>
                  ) : (
                    <Card className="bg-slate-800 border-slate-700 h-full flex items-center justify-center">
                      <CardContent className="text-center p-8">
                        <MessageCircle className="h-16 w-16 text-slate-500 mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-slate-100">No Active Chat Selected</h3>
                        <p className="text-slate-400 mt-2 max-w-md mx-auto">
                          Select an active chat from the sidebar or claim a new request from the queue to start helping.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </motion.div>
            </TabsContent>
            
            {/* Rest of the tabs content */}
            <TabsContent value="history">
              <motion.div
                variants={tabContentVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-slate-100">Session History</CardTitle>
                      <CardDescription className="text-slate-300">View your past help sessions and outcomes</CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center gap-1.5 border-slate-700 text-slate-100 hover:bg-slate-700"
                      onClick={handleRefreshHistory}
                      disabled={isHistoryLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isHistoryLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <LoadingTimeout 
                      isLoading={isHistoryLoading} 
                      onTimeout={() => {
                        setHistoryLoadingError(true)
                        console.warn("History loading timed out after 10 seconds")
                      }}
                      timeoutMs={10000}
                    />
                    {isHistoryLoading ? (
                      <div className="flex justify-center p-8">
                        <CustomLoader size="lg" color="default" label="Loading session history..." />
                      </div>
                    ) : historyLoadingError ? (
                      <LoadingErrorDisplay 
                        title="Failed to Load History"
                        description="There was a problem loading your session history."
                        onRetry={handleRefreshHistory}
                        theme="slate"
                      />
                    ) : history.length > 0 ? (
                      <DataTable columns={historyColumns} data={history} />
                    ) : (
                      <div className="text-center p-4">
                        <p className="text-slate-300">No session history available yet.</p>
                      </div>
                    )}
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
                <Card className="bg-slate-800 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-100">Profile Settings</CardTitle>
                    <CardDescription className="text-slate-300">
                      Manage your helper profile information and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label htmlFor="name" className="text-sm font-medium text-slate-100">
                            Display Name
                          </label>
                          <Input
                            id="name"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-400"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium text-slate-100">
                            Email Address
                          </label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            disabled
                            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-400 opacity-70"
                          />
                          <p className="text-xs text-slate-400">This is your account email and cannot be changed</p>
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="contactEmail" className="text-sm font-medium text-slate-100">
                            Contact Email
                          </label>
                          <Input
                            id="contactEmail"
                            type="email"
                            placeholder="Contact email address"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-400"
                          />
                          <p className="text-xs text-slate-400">This email will be used for notifications</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 pt-4 border-t border-slate-700">
                        <h3 className="text-lg font-medium text-slate-100">Helper Preferences</h3>
                        
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-100">Auto-assign Requests</p>
                            <p className="text-xs text-slate-300">Automatically assign new requests when you're available</p>
                          </div>
                          <Switch
                            id="auto-assign-settings"
                            checked={autoAssign}
                            onCheckedChange={setAutoAssign}
                            className="data-[state=checked]:bg-[#3ECF8E]"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-100">Email Notifications</p>
                            <p className="text-xs text-slate-300">Receive email updates about your assigned requests</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="emailNotifications"
                              className="rounded-sm bg-slate-900 border-slate-700 text-[#3ECF8E]"
                              defaultChecked
                            />
                            <label htmlFor="emailNotifications" className="text-sm text-slate-100">Enabled</label>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-100">Browser Notifications</p>
                            <p className="text-xs text-slate-300">Receive browser notifications for new messages and requests</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="browserNotifications"
                              className="rounded-sm bg-slate-900 border-slate-700 text-[#3ECF8E]"
                              defaultChecked
                            />
                            <label htmlFor="browserNotifications" className="text-sm text-slate-100">Enabled</label>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <p className="text-sm font-medium text-slate-100">AI Assistance</p>
                            <p className="text-xs text-slate-300">Get AI-powered insights while helping students</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="aiAssistance"
                              className="rounded-sm bg-slate-900 border-slate-700 text-[#3ECF8E]"
                              defaultChecked
                            />
                            <label htmlFor="aiAssistance" className="text-sm text-slate-100">Enabled</label>
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
                        />
                        <Button 
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900 ml-auto"
                        >
                          {isSavingProfile ? (
                            <>
                              <CustomLoader size="sm" color="default" className="mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              Save Changes
                            </>
                          )}
                        </Button>
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