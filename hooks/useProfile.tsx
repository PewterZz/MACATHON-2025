"use client"

// DEPRECATED: Use the profile context (useProfile from '@/context/profile-context') instead
// This hook will be removed in a future version

import { useState, useEffect } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import type { Database } from "@/types/supabase"
import { useProfile as useProfileContext } from "@/context/profile-context"

type Profile = Database['public']['Tables']['profiles']['Row']

export function useProfile() {
  console.warn(
    "The useProfile hook is deprecated. Please use the ProfileContext instead: import { useProfile } from '@/context/profile-context'"
  )
  
  return useProfileContext()
} 