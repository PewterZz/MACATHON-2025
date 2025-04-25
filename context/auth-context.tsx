"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, metadata?: { name: string; role: string }) => Promise<void>
  signOut: () => Promise<void>
  ensureProfileExists: (user: User) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createSupabaseClient()
  const router = useRouter()

  // Function to ensure a profile exists for the user
  const ensureProfileExists = async (user: User) => {
    try {
      // Check if profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()

      // If no profile found (404 error), create one
      if (profileError && profileError.code === 'PGRST116') {
        console.log('Creating new profile for user', user.id)
        
        // Extract name from metadata or email
        const userName = user.user_metadata?.name || 
                         user.email?.split('@')[0] || 
                         'New User'
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: userName,
            is_helper: true,
            helper_score: 0
          })
        
        if (insertError) {
          console.error('Error creating profile:', insertError)
          // Don't throw here to prevent auth flow disruption
        }
      } else if (profileError) {
        console.error('Error checking profile:', profileError)
      }
    } catch (err) {
      console.error('Error in ensureProfileExists:', err)
    }
  }

  useEffect(() => {
    let isMounted = true;
    const client = createSupabaseClient();
    
    const checkAuth = async () => {
      try {
        const { data } = await client.auth.getSession()
        const currentUser = data.session?.user ?? null
        
        if (isMounted) {
          setUser(currentUser)
          
          // If user is logged in, ensure they have a profile
          if (currentUser) {
            await ensureProfileExists(currentUser)
          }
        }
        
        const { data: authListener } = client.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.id)
            if (!isMounted) return;
            
            const newUser = session?.user ?? null
            setUser(newUser)
            
            // If new user just logged in, ensure they have a profile
            if (newUser) {
              await ensureProfileExists(newUser)
            }
          }
        )

        return () => {
          authListener.subscription.unsubscribe()
        }
      } catch (error) {
        console.error("Auth check failed:", error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    checkAuth()
    
    return () => {
      isMounted = false;
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }
    } catch (error) {
      console.error("Sign in failed:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (email: string, password: string, metadata?: { name: string; role: string }) => {
    setIsLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        throw error
      }
      
      // Don't wait for email confirmation to complete signUp function
      return data
    } catch (error) {
      console.error("Sign up failed:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      // Set loading state to prevent re-renders during signout
      setIsLoading(true)
      
      // First manually clear the user state to prevent re-renders
      setUser(null)
      
      // Clear any auth-related state or local storage
      if (typeof window !== 'undefined') {
        // Clear any auth-related local storage items
        localStorage.removeItem('supabase.auth.token')
        // Remove any custom cached data
        localStorage.removeItem('cached_profile')
        localStorage.removeItem('cached_user_session')
      }
      
      // Finally call Supabase signOut
      await supabase.auth.signOut()
      
      // Redirect to signin page after successful signout
      router.push('/signin')
    } catch (error) {
      console.error("Sign out failed:", error)
      setIsLoading(false)
    }
  }

  return <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, ensureProfileExists }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
