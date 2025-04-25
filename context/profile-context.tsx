"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
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
  
  const fetchProfile = async () => {
    if (!user) {
      setProfile(null)
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      console.log('Fetching profile for user:', user.id)
      
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // Profile found successfully
      if (data) {
        console.log('Profile found:', data.id)
        setProfile(data)
        setError(null)
        return
      }

      // If no profile was found (404 error) and we have a user, create one
      if (fetchError && (fetchError.code === 'PGRST116' || fetchError.message.includes('not found'))) {
        console.log('Profile not found, creating a new one for user:', user.id)
        
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
          return
        }
        
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
            return
          }
          
          throw insertError
        }

        console.log('New profile created:', newProfile.id, 'isHelper:', isHelper)
        setProfile(newProfile)
        setError(null)
      } else if (fetchError) {
        // Handle other errors
        console.error('Error fetching profile:', fetchError)
        throw fetchError
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
    } finally {
      setIsLoading(false)
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
    
    if (user?.id) {
      fetchProfile().catch(error => {
        console.error('Profile fetch error:', error);
      });
    } else {
      // If user is null, clear the profile
      clearProfile();
      setIsLoading(false);
    }
    
    return () => {
      isMounted = false;
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