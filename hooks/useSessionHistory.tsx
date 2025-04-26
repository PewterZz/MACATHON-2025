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
  role: 'helper' | 'user';
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
      const { data: claimedRequests, error: claimedRequestsError } = await supabase
        .from('requests')
        .select('*, messages(id, ts, sender)')
        .eq('claimed_by', user.id)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })

      if (claimedRequestsError) {
        throw claimedRequestsError
      }
      
      // Get all requests created by this user that are now closed
      const { data: userRequests, error: userRequestsError } = await supabase
        .from('requests')
        .select('*, messages(id, ts, sender)')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })
        
      if (userRequestsError) {
        throw userRequestsError
      }
      
      const allRequests = [
        ...(claimedRequests || []).map(req => ({ ...req, role: 'helper' as const })),
        ...(userRequests || []).map(req => ({ ...req, role: 'user' as const }))
      ]

      if (allRequests.length === 0) {
        setHistory([])
        return
      }

      // Transform the data for display
      const sessionsHistory = allRequests.map((request) => {
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
        
        // Define outcome
        const outcome = 'Resolved';
        
        return {
          id: request.id,
          issue: request.summary,
          outcome,
          timeSpent,
          role: request.role
        };
      });

      // Sort by most recent first
      sessionsHistory.sort((a, b) => {
        // This assumes the ID has some timestamp component or is sequential
        return b.id.localeCompare(a.id);
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

  // Subscribe to closed requests - both claimed and created
  useEffect(() => {
    if (!user?.id) return

    // Listen for changes in requests claimed by the user
    const helperChannel = supabase
      .channel('helper-history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `claimed_by=eq.${user.id}`
        },
        () => {
          fetchHistory()
        }
      )
      .subscribe()

    // Listen for changes in requests created by the user
    const userChannel = supabase
      .channel('user-history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(helperChannel)
      supabase.removeChannel(userChannel)
    }
  }, [user?.id, supabase, fetchHistory])

  return {
    history,
    isLoading,
    error,
    refreshHistory: fetchHistory
  };
} 