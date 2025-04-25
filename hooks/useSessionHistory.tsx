"use client"

import { useState, useEffect, useCallback } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import { useAuth } from "@/context/auth-context"
import type { Database } from "@/types/supabase"

type Request = Database['public']['Tables']['requests']['Row']

export interface SessionHistory {
  id: string;
  issue: string;
  outcome: string;
  timeSpent: string;
}

export function useSessionHistory() {
  const { user } = useAuth()
  const [history, setHistory] = useState<SessionHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createSupabaseClient()

  // Fetch history in a separate function to allow for manual refreshes
  const fetchHistory = useCallback(async () => {
    if (!user) {
      setHistory([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      
      // Get all requests claimed by this user that are now closed
      const { data: requests, error: requestsError } = await supabase
        .from('requests')
        .select('*, messages(id, ts, sender)')
        .eq('claimed_by', user.id)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })

      if (requestsError) {
        throw requestsError
      }
      
      if (!requests) {
        setHistory([])
        return
      }

      // Transform the data for display
      const sessionsHistory = requests.map((request) => {
        // Calculate time spent (difference between first and last message timestamp)
        let timeSpent = 'Unknown'
        
        if (request.messages && request.messages.length > 1) {
          const timestamps = request.messages
            .map((msg: any) => new Date(msg.ts).getTime())
            .sort((a: number, b: number) => a - b);
          
          const first = timestamps[0];
          const last = timestamps[timestamps.length - 1];
          
          const diffMinutes = Math.round((last - first) / 60000);
          timeSpent = diffMinutes < 60 
            ? `${diffMinutes} min` 
            : `${Math.floor(diffMinutes / 60)} hr ${diffMinutes % 60} min`;
        }
        
        // Define outcome (could be enhanced with more logic based on your app's requirements)
        const outcome = request.status === 'closed' ? 'Completed' : 'In progress';
        
        return {
          id: request.id,
          issue: request.summary,
          outcome,
          timeSpent,
        };
      });

      setHistory(sessionsHistory);
      setError(null);
    } catch (err) {
      console.error('Error fetching session history:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch session history'));
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  // Initial fetch
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Subscribe to closed requests
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `claimed_by=eq.${user.id}`
        },
        () => {
          // Refresh history when there are changes to requests
          fetchHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, supabase, fetchHistory])

  return {
    history,
    isLoading,
    error,
    refreshHistory: fetchHistory
  };
} 