"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Heart, LayoutDashboard, History, Settings, Menu, X, MessageSquare, LogOut, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { useProfile } from "@/context/profile-context"
import { toast } from "@/components/ui/use-toast"

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { profile, isLoading: profileLoading } = useProfile()
  const [isFixingProfile, setIsFixingProfile] = useState(false)

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/signin')
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

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Active Chats",
      href: "/dashboard?tab=active",
      icon: MessageSquare,
    },
    {
      name: "History",
      href: "/dashboard?tab=history",
      icon: History,
    },
    {
      name: "Settings",
      href: "/dashboard?tab=settings",
      icon: Settings,
    },
  ]

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden text-slate-100"
        onClick={toggleSidebar}
      >
        {isOpen ? <X /> : <Menu />}
      </Button>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-slate-800 border-r border-slate-700 transition-transform duration-300 ease-in-out transform md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-700">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-16 w-16">
                <img src="/logo.png" alt="Meld logo" className="h-full w-full object-contain" />
              </div>
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">Meld</h1>
            </Link>
          </div>

          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                {profileLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent border-slate-100"></div>
                ) : (
                  <span className="text-slate-100 font-medium">
                    {profile?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                  </span>
                )}
              </div>
              <div className="overflow-hidden">
                {profileLoading ? (
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-700 mb-1"></div>
                ) : (
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {profile?.name || user?.email?.split('@')[0] || "User"}
                  </p>
                )}
                <p className="text-xs text-slate-400">{profile?.is_helper ? "Helper" : "User"}</p>
              </div>
            </div>
            
            {!profile && !profileLoading && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 border-red-500 text-red-400 hover:bg-red-500/20 justify-center"
                onClick={handleFixProfile}
                disabled={isFixingProfile}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                {isFixingProfile ? "Fixing Profile..." : "Fix Profile"}
              </Button>
            )}
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href || (pathname === "/dashboard" && item.href === "/dashboard")
                    ? "bg-[#3ECF8E]/10 text-[#3ECF8E]"
                    : "text-slate-300 hover:bg-slate-700 hover:text-slate-100",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            ))}
            
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-red-400 hover:bg-red-500/20 hover:text-red-300"
            >
              <LogOut className="h-5 w-5" />
              Log Out
            </button>
          </nav>

          <div className="p-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} <span className="font-medium">Meld</span></p>
          </div>
        </div>
      </div>
    </>
  )
}
