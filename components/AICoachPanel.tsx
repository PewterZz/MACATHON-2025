"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bot, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react"
import { CoachingResponse } from "@/lib/ai"
import { CustomLoader } from "@/components/ui/custom-loader"

interface AICoachPanelProps {
  requestId: string
  messages: { sender: string; content: string }[]
}

export default function AICoachPanel({ requestId, messages }: AICoachPanelProps) {
  const [coaching, setCoaching] = useState<CoachingResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [streamingAdvice, setStreamingAdvice] = useState("")

  useEffect(() => {
    const socket = new WebSocket(
      `${process.env.NEXT_PUBLIC_APP_URL?.replace('http', 'ws') || ''}/api/chat/${requestId}/coach`
    )

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'chunk') {
        setStreamingAdvice(prev => prev + data.content)
      } else if (data.type === 'complete') {
        setStreamingAdvice("")
      }
    }

    return () => {
      socket.close()
    }
  }, [requestId])

  useEffect(() => {
    const analyzeChat = async () => {
      if (messages.length < 2) return // Need at least 2 messages for analysis
      
      try {
        setIsLoading(true)
        const response = await fetch(`/api/chat/${requestId}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages })
        })
        
        if (!response.ok) throw new Error('Failed to analyze chat')
        
        const data = await response.json()
        setCoaching(data)
      } catch (error) {
        console.error('Error analyzing chat:', error)
      } finally {
        setIsLoading(false)
      }
    }

    analyzeChat()
  }, [messages, requestId])

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#3ECF8E]" />
            AI Coach
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-4">
              <CustomLoader size="md" color="default" />
            </div>
          ) : coaching ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Suggested Approach</h4>
                <p className="text-slate-100">{coaching.suggestion}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Recommended Tone</h4>
                <Badge 
                  variant="outline" 
                  className={`
                    ${coaching.tone === 'urgent' ? 'border-red-500 text-red-400' :
                      coaching.tone === 'cautious' ? 'border-yellow-500 text-yellow-400' :
                      'border-green-500 text-green-400'}
                  `}
                >
                  {coaching.tone === 'urgent' ? (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  ) : coaching.tone === 'supportive' ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : null}
                  {coaching.tone.charAt(0).toUpperCase() + coaching.tone.slice(1)}
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Next Steps</h4>
                <ul className="space-y-2">
                  {coaching.nextSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2 text-slate-100">
                      <ArrowRight className="h-4 w-4 mt-1 flex-shrink-0 text-[#3ECF8E]" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {streamingAdvice && (
            <div className="mt-4 p-3 bg-slate-700/50 rounded-md">
              <p className="text-slate-100">{streamingAdvice}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 