"use client"

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import type { Database } from "@/types/supabase"

type Profile = Database['public']['Tables']['profiles']['Row']

interface ProfileContextType {
  profile: Profile | null
  isLoading: boolean
  error: Error | null
  updateProfile: (updates: Partial<Omit<Profile, 'id'>>) => Promise<Profile>
  refreshProfile: () => Promise<void>
  clearProfile: () => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createSupabaseClient()
  const isFetchingRef = useRef(false)
  const lastFetchTimeRef = useRef(0)
  
  const fetchProfile = async () => {
    if (!user) {
      setProfile(null)
      setIsLoading(false)
      return
    }

    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('Skipping duplicate profile fetch, already in progress')
      return
    }
    
    // Rate limit to max once per second
    const now = Date.now()
    if (now - lastFetchTimeRef.current < 1000) {
      console.log('Rate limiting profile fetch')
      return
    }
    
    lastFetchTimeRef.current = now
    isFetchingRef.current = true
    
    // Log the fetch attempt
    console.log('Starting profile fetch with Supabase for user:', user.id)

    // Set up a timeout to ensure we don't get stuck loading
    const timeoutId = setTimeout(() => {
      if (isFetchingRef.current) {
        console.error('Profile fetch timed out after 10 seconds')
        isFetchingRef.current = false
        setIsLoading(false)
        setError(new Error("Profile fetch timed out"))
      }
    }, 10000)

    try {
      setIsLoading(true)
      
      // First try to get any local cached profile
      let cachedProfile = null
      try {
        const cachedData = localStorage.getItem(`profile_cache_${user.id}`)
        if (cachedData) {
          cachedProfile = JSON.parse(cachedData)
          console.log('Found cached profile:', cachedProfile.id)
          
          // Use cached profile temporarily while fetching fresh data
          setProfile(cachedProfile)
        }
      } catch (cacheError) {
        console.warn('Error reading cached profile:', cacheError)
      }
      
      console.log('Fetching fresh profile for user:', user.id)
      
      // Try up to 3 times to fetch the profile
      let attempts = 0
      let lastError = null
      
      while (attempts < 3) {
        attempts++
        try {
          const { data, error: fetchError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          
          // Profile found successfully
          if (data) {
            console.log('Profile found:', data.id, `(attempt ${attempts})`)
            setProfile(data)
            setError(null)
            
            // Cache the profile
            try {
              localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(data))
            } catch (e) {
              console.warn('Failed to cache profile:', e)
            }
            
            clearTimeout(timeoutId)
            isFetchingRef.current = false
            setIsLoading(false)
            return
          }
          
          // If no profile found, break to handle creation
          if (fetchError && (fetchError.code === 'PGRST116' || fetchError.message.includes('not found'))) {
            console.log('Profile not found, will attempt creation', `(attempt ${attempts})`)
            lastError = fetchError
            break
          }
          
          // Other errors, retry
          console.error(`Fetch error on attempt ${attempts}:`, fetchError)
          lastError = fetchError
          
          // Wait between retries
          if (attempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        } catch (attemptError) {
          console.error(`Error on fetch attempt ${attempts}:`, attemptError)
          lastError = attemptError
          
          // Wait between retries
          if (attempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }
      
      // After 3 failed attempts, try to create profile if appropriate
      if (lastError && (lastError.code === 'PGRST116' || 
          (lastError.message && lastError.message.includes('not found')))) {
        
        console.log('Profile not found after retries, creating a new one for user:', user.id)
        
        // Extract name from metadata or email
        const userName = user.user_metadata?.name || user.email?.split('@')[0] || 'New User'
        
        // Check if role is specified in metadata
        const isHelper = user.user_metadata?.role === 'helper' || false
        
        const profileData = {
          id: user.id,
          name: userName,
          is_helper: isHelper,
          helper_score: 0 // Always insert 0, column is NOT NULL
        }
        
        // Add debounce to avoid race conditions with multiple simultaneous inserts
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Check one more time before inserting (to avoid race conditions)
        const { data: doubleCheck } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
          
        if (doubleCheck) {
          console.log('Profile found on double-check:', doubleCheck.id)
          setProfile(doubleCheck)
          setError(null)
          
          // Cache the profile
          try {
            localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(doubleCheck))
          } catch (e) {
            console.warn('Failed to cache profile:', e)
          }
          
          clearTimeout(timeoutId)
          isFetchingRef.current = false
          setIsLoading(false)
          return
        }
        
        // Try to create the profile
        try {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert(profileData)
            .select()
            .single()
            
          if (insertError) {
            console.error('Error creating profile:', insertError)
            
            // Final check in case profile was created despite error
            const { data: finalCheck } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', user.id)
              .single()
              
            if (finalCheck) {
              console.log('Profile found after insert error:', finalCheck.id)
              setProfile(finalCheck)
              setError(null)
              
              // Cache the profile
              try {
                localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(finalCheck))
              } catch (e) {
                console.warn('Failed to cache profile:', e)
              }
              
              clearTimeout(timeoutId)
              isFetchingRef.current = false
              setIsLoading(false)
              return
            }
            
            setError(insertError instanceof Error ? insertError : new Error(insertError.message))
            clearTimeout(timeoutId)
            isFetchingRef.current = false
            setIsLoading(false)
            return
          }
          
          if (newProfile) {
            console.log('New profile created:', newProfile.id, 'isHelper:', isHelper)
            setProfile(newProfile)
            setError(null)
            
            // Cache the profile
            try {
              localStorage.setItem(`profile_cache_${user.id}`, JSON.stringify(newProfile))
            } catch (e) {
              console.warn('Failed to cache profile:', e)
            }
            
            clearTimeout(timeoutId)
            isFetchingRef.current = false
            setIsLoading(false)
            return
          } else {
            console.error('No profile data returned after insert')
            setError(new Error('No profile data returned after insert'))
            clearTimeout(timeoutId)
            isFetchingRef.current = false
            setIsLoading(false)
            return
          }
        } catch (createError) {
          console.error('Error during profile creation:', createError)
          setError(createError instanceof Error ? createError : new Error(String(createError)))
          clearTimeout(timeoutId)
          isFetchingRef.current = false
          setIsLoading(false)
          return
        }
      } else {
        // Handle other types of errors
        console.error('Error fetching profile after retries:', lastError)
        setError(lastError instanceof Error ? lastError : new Error(String(lastError)))
        clearTimeout(timeoutId)
        isFetchingRef.current = false
        setIsLoading(false)
        return
      }
      
    } catch (err) {
      console.error('Profile context error:', err)
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          code: (err as any).code,
          details: (err as any).details,
          hint: (err as any).hint
        })
      }
      setError(err instanceof Error ? err : new Error('Failed to fetch profile'))
      setIsLoading(false)
      isFetchingRef.current = false
      clearTimeout(timeoutId)
    }
  }

  // Clear the profile data
  const clearProfile = () => {
    setProfile(null)
    setError(null)
  }

  // Initial profile fetch
  useEffect(() => {
    let isMounted = true;
    
    // Log more detailed information about the current state
    console.log('ProfileProvider useEffect triggered with user:', 
      user ? { id: user.id, email: user.email } : 'null'
    );
    
    if (user?.id) {
      console.log('Attempting to fetch profile for user:', user.id);
      
      // Store fetch start time
      const fetchStartTime = Date.now();
      
      fetchProfile().catch(error => {
        console.error('Profile fetch error:', error);
        if (isMounted) {
          setIsLoading(false);
          setError(error instanceof Error ? error : new Error(String(error)));
        }
      });
    } else {
      // If user is null, clear the profile
      console.log('No user, clearing profile');
      clearProfile();
      setIsLoading(false);
    }
    
    // Safety timeout to prevent infinite loading state
    const safetyTimeout = setTimeout(() => {
      if (isMounted && isLoading) {
        console.error('Safety timeout triggered for profile loading', {
          userId: user?.id,
          hasProfile: !!profile,
          hasError: !!error,
          loadingDuration: `${(Date.now() - (user ? Date.now() : 0)) / 1000}s`,
          isFetchingRef: isFetchingRef.current
        });
        
        // Force reset loading state
        setIsLoading(false);
        isFetchingRef.current = false;
        
        // If no profile and no error, set a timeout error
        if (!profile && !error) {
          setError(new Error('Profile loading timed out'));
        }
        
        // Try one last profile recovery attempt if we have a user but no profile
        if (user && !profile) {
          console.log('Attempting emergency profile recovery after timeout');
          setTimeout(() => {
            if (isMounted) {
              fetchProfile().catch(e => 
                console.error('Emergency profile recovery failed:', e)
              );
            }
          }, 500);
        }
      }
    }, 25000); // Increase timeout to 25 seconds
    
    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [user?.id]);

  // Subscribe to profile changes
  useEffect(() => {
    if (!user?.id) return
    
    const channel = supabase
      .channel(`profile:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('Profile updated:', payload)
          if (payload.eventType === 'DELETE') {
            setProfile(null)
          } else {
            setProfile(payload.new as Profile)
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, supabase])

  const updateProfile = async (updates: Partial<Omit<Profile, 'id'>>) => {
    if (!user) {
      throw new Error('User not authenticated')
    }

    try {
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating profile:', updateError)
        throw updateError
      }

      setProfile(data)
      return data
    } catch (err) {
      console.error('Error updating profile:', err)
      if (err instanceof Error) {
        console.error('Update error details:', {
          message: err.message,
          code: (err as any).code,
          details: (err as any).details,
          hint: (err as any).hint
        })
      }
      throw err instanceof Error ? err : new Error('Failed to update profile')
    }
  }

  const refreshProfile = async () => {
    return fetchProfile()
  }

  return (
    <ProfileContext.Provider value={{ profile, isLoading, error, updateProfile, refreshProfile, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)

  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider")
  }

  return context
} 