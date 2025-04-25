'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, SendIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { supabaseClient } from '@/lib/supabase-client'

interface Message {
  id: string
  content: string
  sender: string
  created_at: string
}

export default function AnonymousChatPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Get the code from the URL
        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        
        if (!code) {
          setError('Missing reference code')
          return
        }

        // Verify the reference code matches the request ID
        const { data, error } = await supabaseClient
          .from('requests')
          .select('id, reference_code, status')
          .eq('id', params.id)
          .eq('reference_code', code)
          .not('status', 'eq', 'closed')
          .maybeSingle()

        if (error || !data) {
          console.error('Access error:', error)
          setError('You do not have access to this conversation')
          return
        }

        setIsAuthorized(true)
        loadMessages()
        
        // Set up real-time subscription
        const channel = supabaseClient
          .channel(`request-${params.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `request_id=eq.${params.id}`
          }, (payload) => {
            const newMsg = payload.new as Message
            setMessages(prev => [...prev, newMsg])
          })
          .subscribe()

        return () => {
          supabaseClient.removeChannel(channel)
        }
      } catch (err) {
        console.error('Error checking access:', err)
        setError('Failed to authenticate')
      }
    }

    checkAccess()
  }, [params.id])

  const loadMessages = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('request_id', params.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
    } catch (err) {
      console.error('Error loading messages:', err)
      setError('Failed to load messages')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isAuthorized) return

    try {
      setIsLoading(true)
      const { error } = await supabaseClient
        .from('messages')
        .insert({
          request_id: params.id,
          content: newMessage,
          sender: 'caller'
        })

      if (error) throw error
      setNewMessage('')
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-800 p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 text-red-400">Access Error</h2>
          <p className="mb-4">{error}</p>
          <Button 
            onClick={() => router.push('/')}
            className="w-full bg-slate-700 hover:bg-slate-600"
          >
            Return to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="animate-pulse text-center">
          <div className="h-8 w-32 bg-slate-700 rounded mx-auto mb-4"></div>
          <div className="h-4 w-48 bg-slate-700 rounded mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="sticky top-0 bg-slate-800 p-4 border-b border-slate-700 z-10">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-medium">Anonymous Support Chat</h1>
          <div className="w-9"></div> {/* Spacer for centering */}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`max-w-[80%] p-3 rounded-lg ${
              message.sender === 'caller' 
                ? 'bg-[#3ECF8E]/20 ml-auto rounded-br-none' 
                : 'bg-slate-800 rounded-bl-none'
            }`}
          >
            <p className="text-sm">{message.content}</p>
            <span className="text-xs text-slate-400 mt-1 block">
              {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        ))}

        {messages.length === 0 && !isLoading && (
          <div className="text-center py-10 text-slate-400">
            <p>Start your conversation by sending a message.</p>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-slate-800 p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[44px] max-h-[180px] bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!newMessage.trim() || isLoading}
            className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900"
          >
            <SendIcon size={18} />
          </Button>
        </div>
      </div>
    </div>
  )
} 