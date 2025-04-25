"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, MessageSquare, Phone } from "lucide-react"
import VoiceCall from "./VoiceCall"
import AICoachPanel from "./AICoachPanel"
import { useChat } from "@/hooks/useChat"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/context/auth-context"
import { useProfile } from "@/context/profile-context"
import { CustomLoader } from "@/components/ui/custom-loader"

interface ChatPanelProps {
  chatId?: string;
}

export default function ChatPanel({ chatId }: ChatPanelProps) {
  const { messages, isLoading, error, sendMessage, requestId } = useChat(chatId)
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState("text")
  const [isVoiceCallActive, setIsVoiceCallActive] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending) return

    try {
      setIsSending(true)
      const trimmedMessage = newMessage.trim()
      setNewMessage("")
      
      await sendMessage(trimmedMessage, isHelper ? 'helper' : 'caller')
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
        <div className="border-b border-slate-700 px-4 sticky top-0 bg-slate-900 z-10">
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
    </div>
  )

  function renderChatArea() {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 overflow-y-auto space-y-4 pr-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <CustomLoader size="md" color="default" />
            </div>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <div
                key={message.id}
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
              </div>
            ))
          ) : (
            <div className="text-center p-8">
              <p className="text-slate-400">No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex gap-2 items-center bg-slate-800 rounded-lg p-2 mt-4">
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
