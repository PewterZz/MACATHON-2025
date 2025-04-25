"use client"

import { useState, useEffect, useCallback } from "react"
import { createSupabaseClient } from "@/lib/supabase"
import type { Database } from "@/types/supabase"
import { useAuth } from "@/context/auth-context"
import { useProfile } from "@/context/profile-context"

type Message = {
  id: number | string;
  sender: "caller" | "helper" | "ai";
  content: string;
  timestamp: Date;
}

export function useChat(requestId?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string>(requestId || '')
  const supabase = createSupabaseClient()
  const { user } = useAuth()
  const { profile } = useProfile()
  const isHelper = profile?.is_helper || false

  useEffect(() => {
    console.log('useChat state:', { 
      isAuthenticated: Boolean(user),
      userId: user?.id,
      requestId: currentRequestId,
      isHelper
    });
  }, [user, currentRequestId, isHelper])

  // Validate UUID format
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  // Create or get request ID
  useEffect(() => {
    const initializeRequest = async () => {
      try {
        if (!requestId) {
          // Create new request if no ID provided
          const { data: newRequest, error: createError } = await supabase
            .from('requests')
            .insert({
              channel: 'web',
              status: 'open',
              summary: 'Web chat session',
              created_by: user?.id
            })
            .select()
            .single()

          if (createError) {
            throw new Error(`Failed to create request: ${createError.message}`)
          }

          if (!newRequest) {
            throw new Error("Failed to create request - no data returned")
          }

          setCurrentRequestId(newRequest.id)
        } else if (!isValidUUID(requestId)) {
          throw new Error("Invalid request ID format")
        } else {
          setCurrentRequestId(requestId)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize request"
        setError(new Error(errorMessage))
        console.error("Error initializing request:", err)
      }
    }

    initializeRequest()
  }, [requestId])

  // Load messages when we have a valid request ID
  useEffect(() => {
    if (!currentRequestId || !user) return

    const fetchMessages = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Check permissions based on user type
        if (isHelper) {
          // For helpers, check if they have claimed this request
          const { data: requestData, error: requestError } = await supabase
            .from('requests')
            .select('claimed_by, status')
            .eq('id', currentRequestId)
            .single()

          if (requestError) {
            console.error('Error checking request claim:', requestError)
            throw new Error(`Failed to check request status: ${requestError.message}`)
          } 
          
          if (!requestData) {
            throw new Error('Request not found')
          }
          
          console.log('Helper request access check:', {
            requestId: currentRequestId,
            claimedBy: requestData.claimed_by,
            currentUserId: user.id,
            status: requestData.status
          })
          
          if (requestData.claimed_by !== user.id) {
            // If the request is not claimed by this helper, they need to claim it first
            throw new Error("You don't have permission to access this chat. Please claim the request first.")
          }
        } else {
          // For students, check if they created this request
          const { data: requestData, error: requestError } = await supabase
            .from('requests')
            .select('created_by')
            .eq('id', currentRequestId)
            .single()

          if (requestError) {
            console.error('Error checking request ownership:', requestError)
            throw new Error(`Failed to check request ownership: ${requestError.message}`)
          }
          
          if (!requestData) {
            throw new Error('Request not found')
          }
          
          console.log('Student request access check:', {
            requestId: currentRequestId,
            createdBy: requestData.created_by,
            currentUserId: user.id
          })
          
          if (requestData.created_by !== user.id) {
            throw new Error("You don't have permission to access this chat.")
          }
        }

        // Fetch messages
        const { data, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('request_id', currentRequestId)
          .order('ts', { ascending: true })

        if (messagesError) {
          throw new Error(`Failed to fetch messages: ${messagesError.message}`)
        }

        if (!data) {
          throw new Error("No data received from server")
        }

        const formattedMessages = data.map(msg => ({
          id: msg.id,
          sender: msg.sender as "caller" | "helper" | "ai",
          content: msg.content,
          timestamp: new Date(msg.ts)
        }))

        setMessages(formattedMessages)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch messages"
        setError(new Error(errorMessage))
        console.error("Error fetching messages:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [currentRequestId, user, isHelper])

  // Set up realtime subscription
  useEffect(() => {
    if (!currentRequestId) return

    const channel = supabase
      .channel(`messages:${currentRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `request_id=eq.${currentRequestId}`
        },
        (payload) => {
          const newMessage = payload.new as Database['public']['Tables']['messages']['Row']
          
          setMessages(current => [
            ...current,
            {
              id: newMessage.id,
              sender: newMessage.sender as "caller" | "helper" | "ai",
              content: newMessage.content,
              timestamp: new Date(newMessage.ts)
            }
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentRequestId])

  // Send a message
  const sendMessage = useCallback(async (content: string, sender: "helper" | "caller" | "ai" = "helper") => {
    if (!content?.trim()) {
      throw new Error("Message content cannot be empty")
    }

    if (!currentRequestId) {
      throw new Error("No active request")
    }

    if (!supabase) {
      throw new Error("Supabase client not initialized")
    }

    console.log('Attempting to send message:', {
      requestId: currentRequestId,
      sender,
      content: content.trim()
    })

    const { data, error } = await supabase
      .from('messages')
      .insert({
        request_id: currentRequestId,
        sender,
        content: content.trim()
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error sending message:', error)
      throw new Error(`Failed to send message: ${error.message}`)
    }

    if (!data) {
      throw new Error("No data returned from message insert")
    }

    return data.id
  }, [currentRequestId, supabase])

  return { messages, isLoading, error, sendMessage, requestId: currentRequestId }
}
