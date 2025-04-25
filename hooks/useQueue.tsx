"use client"

import { useState, useEffect, useCallback } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import type { Database } from "@/types/supabase"

type RequestWithTags = {
  id: string
  risk: number
  summary: string
  tags: string[]
  timestamp: string
  channel: string
}

export function useQueue() {
  const [queue, setQueue] = useState<RequestWithTags[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createSupabaseClient()

  // Extract fetch logic into a callback for reuse
  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'open')
        .order('risk', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error

      // Convert to expected format and add tags based on summary
      const formattedData = data.map(request => {
        // Generate tags based on summary keywords
        const summary = request.summary.toLowerCase()
        const tags: string[] = []
        
        if (summary.includes('anxiety') || summary.includes('stress') || summary.includes('panic')) {
          tags.push('anxiety')
        }
        if (summary.includes('depress') || summary.includes('sad') || summary.includes('low')) {
          tags.push('depression')
        }
        if (summary.includes('academic') || summary.includes('study') || summary.includes('exam')) {
          tags.push('academic')
        }
        if (summary.includes('relationship') || summary.includes('friend') || summary.includes('partner')) {
          tags.push('relationships')
        }
        if (summary.includes('work') || summary.includes('job') || summary.includes('career')) {
          tags.push('work-life')
        }
        
        // Add a default tag if none were added
        if (tags.length === 0) {
          tags.push('general')
        }
        
        // Format timestamp for display
        const timestamp = new Date(request.created_at)
        const now = new Date()
        const diffMs = now.getTime() - timestamp.getTime()
        const diffMins = Math.round(diffMs / 60000)
        
        let timeDisplay = `${diffMins} min ago`
        if (diffMins > 60) {
          const diffHours = Math.floor(diffMins / 60)
          timeDisplay = `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`
        }

        return {
          id: request.id,
          risk: request.risk,
          summary: request.summary,
          tags,
          timestamp: timeDisplay,
          channel: request.channel
        }
      })

      setQueue(formattedData)
      setError(null)
    } catch (err) {
      console.error('Error fetching queue:', err)
      setError(err instanceof Error ? err : new Error("Failed to fetch queue"))
    } finally {
      setIsLoading(false)
    }
  }, [supabase]);

  // Initial fetch
  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('queue-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: 'status=eq.open'
        },
        () => {
          fetchQueue()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchQueue])

  const claimRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ 
          status: 'claimed',
          claimed_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId)
        .eq('status', 'open')

      if (error) {
        throw new Error(`Failed to claim request: ${error.message}`)
      }
      
      // Remove the claimed request from local state
      setQueue(current => current.filter(req => req.id !== requestId))
      
      return requestId
    } catch (err) {
      console.error('Error claiming request:', err)
      throw err
    }
  }

  return { 
    queue, 
    isLoading, 
    error, 
    claimRequest,
    refreshQueue: fetchQueue // Expose refresh function
  }
}
