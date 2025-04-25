"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function DashboardLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const router = useRouter()
  
  // Check for potential auth issues on mount
  useEffect(() => {
    const checkAuthState = () => {
      try {
        // If multiple Supabase project tokens exist, redirect to the emergency reset page
        const mvhToken = document.cookie.includes('sb-mvhgizltbvswhntrwjzt-auth-token')
        const uofToken = document.cookie.includes('sb-uofmouuathyuapthudyp-auth-token')
        
        // If we have both tokens, there's likely an auth conflict
        if (mvhToken && uofToken) {
          console.error('Multiple Supabase auth tokens detected, redirecting to emergency reset')
          router.push('/emergency-reset')
          return
        }
        
        // If last render was over 30 seconds ago, and page is reloading, we may be in a loop
        const lastRender = localStorage.getItem('_dashboard_last_render')
        if (lastRender) {
          const timeSinceRender = Date.now() - parseInt(lastRender)
          if (timeSinceRender > 30000) { // 30 seconds
            localStorage.setItem('_dashboard_loop_count', 
              (parseInt(localStorage.getItem('_dashboard_loop_count') || '0') + 1).toString()
            )
            
            // If we've looped more than 3 times, redirect to emergency reset
            if (parseInt(localStorage.getItem('_dashboard_loop_count') || '0') > 3) {
              console.error('Potential infinite loading loop detected, redirecting to emergency reset')
              router.push('/emergency-reset')
              return
            }
          } else {
            // Reset loop counter on normal page load
            localStorage.setItem('_dashboard_loop_count', '0')
          }
        }
      } catch (e) {
        console.error('Error checking auth state:', e)
      }
    }
    
    checkAuthState()
  }, [router])
  
  return <>{children}</>
} 