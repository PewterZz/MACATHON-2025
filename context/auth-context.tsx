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
    if (!user || !user.id) {
      console.error('Cannot create profile: Missing user or user ID')
      throw new Error('User or user ID is missing')
    }
    
    try {
      console.log('Checking if profile exists for user', user.id)
      
      // Check if profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('Profile check result:', { existingProfile, error: profileError?.message })

      // If profile already exists, return it immediately
      if (existingProfile) {
        console.log('Profile already exists:', existingProfile)
        return existingProfile
      }

      // If no profile found (404 error), create one
      if (profileError && (profileError.code === 'PGRST116' || profileError.message.includes('not found'))) {
        console.log('No profile found, creating new profile for user', user.id)
        
        // Extract name from metadata or email
        const userName = user.user_metadata?.name || 
                         user.email?.split('@')[0] || 
                         'New User'
        
        // Extract role from metadata or default to user
        const isHelper = user.user_metadata?.role === 'helper' || false
        
        const profileData = {
          id: user.id,
          name: userName,
          is_helper: isHelper,
          helper_score: 0
        }
        
        console.log('Creating profile with data:', profileData)
        
        const { data: insertData, error: insertError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single()
        
        if (insertError) {
          console.error('Error creating profile:', insertError)
          
          // Check if profile was actually created despite error
          // (this can happen with race conditions)
          const { data: checkAgain } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
            
          if (checkAgain) {
            console.log('Profile exists after insert error (likely race condition):', checkAgain)
            return checkAgain
          }
          
          throw insertError
        } else if (insertData) {
          console.log('Profile created successfully:', insertData)
          return insertData
        } else {
          throw new Error('Profile creation returned no data')
        }
      } else if (profileError) {
        console.error('Error checking profile:', profileError)
        throw profileError
      } else {
        console.log('Profile exists but data is null, this is unexpected')
        throw new Error('Profile exists but data is null')
      }
    } catch (err) {
      console.error('Error in ensureProfileExists:', err)
      throw err
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
          // If user is logged in, ensure they have a profile before setting user state
          if (currentUser) {
            try {
              await ensureProfileExists(currentUser)
              setUser(currentUser)
            } catch (error) {
              console.error('Error ensuring profile exists during init:', error)
              // Still set the user even if profile creation fails to not block auth
              setUser(currentUser)
            }
          } else {
            setUser(null)
          }
        }
        
        const { data: authListener } = client.auth.onAuthStateChange(
          async (event, session) => {
            console.log('Auth state changed:', event, session?.user?.id)
            if (!isMounted) return;
            
            const newUser = session?.user ?? null
            
            // Handle specific auth events
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              if (newUser) {
                try {
                  await ensureProfileExists(newUser)
                  setUser(newUser)
                  // Only refresh router after successful profile creation, not on every token refresh
                  if (event === 'SIGNED_IN') {
                    router.push('/dashboard')
                  }
                } catch (error) {
                  console.error('Error ensuring profile exists during auth change:', error)
                  setUser(newUser)
                }
              }
            } else if (event === 'SIGNED_OUT') {
              setUser(null)
              router.push('/signin')
            } else {
              // For other events, just update the user state
              setUser(newUser)
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }
      
      // Explicitly ensure profile exists after sign in
      if (data.user) {
        console.log('Sign in successful, ensuring profile exists for', data.user.id)
        await ensureProfileExists(data.user)
        
        // Let the auth state change handler handle navigation
        // The router.push will happen in the auth state change event
      }
      
      return data
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
        // Clear Supabase auth tokens
        localStorage.removeItem('supabase.auth.token')
        localStorage.removeItem('sb-auth-token')
        
        // Clear signup data
        localStorage.removeItem('signupEmail')
        localStorage.removeItem('signupName')
        localStorage.removeItem('signupIsHelper')
        localStorage.removeItem('signupUserId')
        
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
