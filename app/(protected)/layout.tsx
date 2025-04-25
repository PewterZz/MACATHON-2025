"use client"

import type React from "react"

import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "@/components/Navbar"

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      if (!user && !isNavigating) {
        console.log('No user found, redirecting to signin')
        setIsNavigating(true)
        router.push("/signin")
      } else if (user) {
        setIsNavigating(false)
      }
    }
  }, [user, isLoading, router, isNavigating])

  useEffect(() => {
    return () => {
      if (!user && typeof window !== 'undefined') {
        localStorage.removeItem('supabase.auth.token')
      }
    }
  }, [user])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3ECF8E]"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3ECF8E]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Navbar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
