"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, MessageSquare, Phone, AlertCircle, RefreshCw } from "lucide-react"
import VoiceCall from "./VoiceCall"
import AICoachPanel from "./AICoachPanel"
import { useChat } from "@/hooks/useChat"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/context/auth-context"
import { useProfile } from "@/context/profile-context"
import { CustomLoader } from "@/components/ui/custom-loader"
import { motion, AnimatePresence } from "framer-motion"

interface ChatPanelProps {
  chatId?: string;
}

export default function ChatPanel({ chatId }: ChatPanelProps) {
  const { messages, isLoading, error, sendMessage, refreshMessages, requestId } = useChat(chatId)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState("text")
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const [lastSeenMessageId, setLastSeenMessageId] = useState<number | string | null>(null)
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const { profile } = useProfile()
  
  // Check if user is a helper
  const isHelper = profile?.is_helper || false

  // Debug current authentication state
  useEffect(() => {
    console.log('ChatPanel auth state:', { 
      isAuthenticated: Boolean(user), 
      userId: user?.id,
      requestId,
      isHelper
    })
  }, [user, requestId, isHelper])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      
      // If we're already at the bottom, scroll to bottom
      if (hasScrolledToBottom) {
        scrollToBottom()
      } else {
        // Otherwise, increment unread count
        if (lastSeenMessageId !== null && lastMessage.id !== lastSeenMessageId) {
          setNewMessageCount(prev => prev + 1)
        }
      }
      
      // Update last seen message
      if (hasScrolledToBottom) {
        setLastSeenMessageId(lastMessage.id)
        setNewMessageCount(0)
      }
    }
  }, [messages, hasScrolledToBottom, lastSeenMessageId])

  // Show error toast when chat error occurs
  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Chat Error",
        description: error.message
      })
    }
  }, [error, toast])

  // Handle scroll events to determine if user is at bottom
  useEffect(() => {
    const handleScroll = () => {
      if (!chatContainerRef.current) return
      
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 30
      
      setHasScrolledToBottom(isAtBottom)
      
      if (isAtBottom && newMessageCount > 0) {
        setNewMessageCount(0)
        if (messages.length > 0) {
          setLastSeenMessageId(messages[messages.length - 1].id)
        }
      }
    }
    
    const chatContainer = chatContainerRef.current
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll)
    }
    
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScroll)
      }
    }
  }, [newMessageCount, messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleManualRefresh = async () => {
    if (isRefreshing) return
    
    try {
      setIsRefreshing(true)
      await refreshMessages()
      toast({
        title: "Chat refreshed",
        description: "The conversation has been updated with the latest messages.",
        variant: "default"
      })
    } catch (err) {
      console.error("Error refreshing messages:", err)
      toast({
        title: "Refresh failed",
        description: "Could not refresh messages. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending) return

    try {
      setIsSending(true)
      const trimmedMessage = newMessage.trim()
      setNewMessage("")
      
      await sendMessage(trimmedMessage, isHelper ? 'helper' : 'caller')
      scrollToBottom()
    } catch (err) {
      setNewMessage(newMessage) // Restore message on error
      console.error("Detailed send error:", err)
      toast({
        variant: "destructive",
        title: "Error sending message",
        description: err instanceof Error ? err.message : "Failed to send message"
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e)
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
        <div className="border-b border-slate-700 px-4 sticky top-0 bg-slate-900 z-10 flex justify-between items-center">
          <TabsList className="bg-transparent">
            <TabsTrigger
              value="text"
              className="data-[state=active]:bg-slate-800"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Text Chat
            </TabsTrigger>
            <TabsTrigger
              value="voice"
              className="data-[state=active]:bg-slate-800"
            >
              <Phone className="h-4 w-4 mr-2" />
              Voice Call
            </TabsTrigger>
          </TabsList>
          
          {activeTab === "text" && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoading}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh chat</span>
            </Button>
          )}
        </div>

        <TabsContent value="text" className="flex-1 flex flex-col h-full">
          {isHelper ? (
            <ResizablePanelGroup direction="horizontal" className="flex-1 h-full">
              <ResizablePanel defaultSize={70} minSize={50}>
                {renderChatArea()}
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              <ResizablePanel defaultSize={30} minSize={25}>
                <div className="h-full p-4">
                  <AICoachPanel requestId={requestId} messages={messages} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            renderChatArea()
          )}
        </TabsContent>

        <TabsContent value="voice" className="flex-1 h-full">
          {activeTab === "voice" && (
            <VoiceCall
              requestId={requestId}
              onEndCall={() => setIsVoiceCallActive(false)}
              isHelper={isHelper}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* New message notification */}
      {newMessageCount > 0 && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg cursor-pointer"
            onClick={scrollToBottom}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{newMessageCount} new message{newMessageCount > 1 ? 's' : ''}</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )

  function renderChatArea() {
    return (
      <div className="flex flex-col h-full p-4">
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-4 pr-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent h-[calc(100%-60px)]"
        >
          {isLoading ? (
            <div className="flex justify-center p-8">
              <CustomLoader size="md" color="default" />
            </div>
          ) : messages.length > 0 ? (
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${
                    isHelper 
                      ? message.sender === "helper" ? "justify-end" : "justify-start"
                      : message.sender === "caller" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      isHelper
                        ? message.sender === "helper"
                          ? "bg-[#3ECF8E] text-slate-900"
                          : message.sender === "ai"
                          ? "bg-slate-700 text-slate-100"
                          : "bg-slate-800 text-slate-100"
                        : message.sender === "caller"
                        ? "bg-[#3ECF8E] text-slate-900"
                        : message.sender === "ai"
                        ? "bg-slate-700 text-slate-100"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {message.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-400">No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 items-center bg-slate-800 rounded-lg p-2 mt-4 h-[50px]">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type your message..."
            className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={isSending}
          />
          <Button
            onClick={handleSendMessage}
            size="icon"
            className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900 shrink-0"
            disabled={isSending || !newMessage.trim()}
          >
            {isSending ? (
              <CustomLoader size="sm" color="default" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    )
  }
}
