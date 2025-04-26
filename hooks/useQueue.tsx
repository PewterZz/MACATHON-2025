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
  status: string
  claimed_by: string | null
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
      
      // Get the requests from the database
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'open')
        .order('risk', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      
      if (!data || data.length === 0) {
        setQueue([])
        return
      }

      // Find any requests that might need triage (no summary or risk score)
      const requestsNeedingTriage = data.filter(request => 
        !request.summary || 
        request.summary.length < 10 || // Very short summary
        request.risk === null || 
        request.risk === undefined
      );
      
      // If we have requests needing triage, process them
      if (requestsNeedingTriage.length > 0) {
        try {
          // Import the triage function dynamically
          const { triage } = await import('@/lib/ai');
          
          // Process each request that needs triage
          for (const request of requestsNeedingTriage) {
            try {
              // Get the first message from this request
              const { data: messageData } = await supabase
                .from('messages')
                .select('content')
                .eq('request_id', request.id)
                .eq('sender', 'caller')
                .order('ts', { ascending: true })
                .limit(1);
              
              if (messageData && messageData.length > 0) {
                const content = messageData[0].content;
                
                if (content && content.trim().length > 0) {
                  console.log(`Processing triage for request ${request.id} with content: ${content.substring(0, 50)}...`);
                  
                  // Perform AI triage
                  const triageResult = await triage(content);
                  console.log(`Triage result for ${request.id}:`, triageResult);
                  
                  // Update the request with the triage results
                  await supabase
                    .from('requests')
                    .update({
                      summary: triageResult.summary,
                      risk: triageResult.risk,
                      // Mark high-risk cases as urgent
                      status: triageResult.risk >= 0.6 ? 'urgent' : 'open'
                    })
                    .eq('id', request.id);
                  
                  // Update the request in our local data
                  const index = data.findIndex(r => r.id === request.id);
                  if (index !== -1) {
                    data[index].summary = triageResult.summary;
                    data[index].risk = triageResult.risk;
                    data[index].status = triageResult.risk >= 0.6 ? 'urgent' : 'open';
                  }
                } else {
                  console.log(`Request ${request.id} has an empty message content`);
                }
              } else {
                console.log(`No message found for request ${request.id}`);
              }
            } catch (triageError) {
              console.error(`Failed to triage request ${request.id}:`, triageError);
              // Continue with other requests even if one fails
            }
          }
        } catch (importError) {
          console.error("Failed to import triage function:", importError);
          // Continue with processing without triage
        }
      }

      // Convert to expected format and add tags based on summary
      const formattedData = data.map(request => {
        // Generate tags based on summary keywords
        const summary = (request.summary || '').toLowerCase();
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
        if (summary.includes('suicid') || summary.includes('kill') || summary.includes('die') || summary.includes('harm')) {
          tags.push('urgent');
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
          risk: request.risk || 0, // Default to 0 if risk is null
          summary: request.summary || 'No summary available', // Default text if missing
          tags,
          timestamp: timeDisplay,
          channel: request.channel || 'web',
          status: request.status,
          claimed_by: request.claimed_by
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
