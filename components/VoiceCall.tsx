"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react"
import { useVoiceCall } from "@/hooks/useVoiceCall"

interface VoiceCallProps {
  requestId: string
  onEndCall: () => void
  isHelper?: boolean
}

export default function VoiceCall({ requestId, onEndCall, isHelper = true }: VoiceCallProps) {
  const [isMuted, setIsMuted] = useState(false)
  const isTestMode = requestId.startsWith('00000000-0000-0000-0000-')
  
  const {
    isConnected,
    isConnecting,
    startCall,
    endCall,
    toggleMute,
    error
  } = useVoiceCall(requestId, isHelper)

  const handleStartCall = () => {
    if (isTestMode) {
      // Simulate connecting state for test mode
      return
    }
    startCall()
  }

  const handleEndCall = () => {
    if (!isTestMode) {
      endCall()
    }
    onEndCall()
  }

  const handleToggleMute = () => {
    setIsMuted(!isMuted)
    if (!isTestMode) {
      toggleMute()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 p-8">
      <div className="w-32 h-32 rounded-full bg-slate-700 flex items-center justify-center relative">
        <Phone className={`w-16 h-16 ${isConnected ? "text-[#3ECF8E]" : "text-slate-400"}`} />
        {isConnecting && (
          <div className="absolute inset-0 border-4 border-t-[#3ECF8E] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin" />
        )}
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium text-slate-100">
          {isConnected ? "Voice Call Connected" : isConnecting ? "Connecting..." : "Start Voice Call"}
        </h3>
        <p className="text-sm text-slate-400">
          {isHelper 
            ? "Connect with the student via voice call" 
            : "Connect with a peer helper via voice call"}
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="flex gap-4">
        {!isConnected ? (
          <Button
            onClick={handleStartCall}
            className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900 rounded-full w-12 h-12 p-0"
            disabled={isConnecting}
          >
            <Phone className="h-6 w-6" />
          </Button>
        ) : (
          <>
            <Button
              onClick={handleToggleMute}
              variant="outline"
              className={`rounded-full w-12 h-12 p-0 border-slate-700 ${
                isMuted ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "hover:bg-slate-700"
              }`}
            >
              {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </Button>
            <Button
              onClick={handleEndCall}
              className="bg-red-500 hover:bg-red-600 rounded-full w-12 h-12 p-0"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
          </>
        )}
      </div>

      {isTestMode && (
        <p className="text-sm text-slate-400 text-center mt-4">
          Voice calls are simulated in test mode.
          <br />
          Click the phone button to see the interface.
        </p>
      )}
    </div>
  )
} 