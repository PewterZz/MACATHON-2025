"use client"

import { useState, useCallback, useEffect } from "react"
// Import Device dynamically to avoid SSR issues
// import { Device } from "twilio-client"

interface UseVoiceCallReturn {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  startCall: () => Promise<void>
  endCall: () => void
  toggleMute: () => void
}

export function useVoiceCall(requestId: string): UseVoiceCallReturn {
  const [device, setDevice] = useState<any | null>(null)
  const [connection, setConnection] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClientLoaded, setIsClientLoaded] = useState(false)
  const [Device, setDevice_] = useState<any>(null)

  // Dynamically load the Twilio Device on the client side
  useEffect(() => {
    let isMounted = true
    
    const loadTwilioClient = async () => {
      try {
        // Dynamically import twilio-client
        const twilioModule = await import('twilio-client')
        if (isMounted) {
          setDevice_(twilioModule.Device)
          setIsClientLoaded(true)
        }
      } catch (err) {
        console.error('Error loading Twilio client:', err)
        if (isMounted) {
          setError('Failed to load voice call system. Please try again later.')
        }
      }
    }
    
    loadTwilioClient()
    
    return () => {
      isMounted = false
    }
  }, [])

  const setupDevice = useCallback(async () => {
    if (!isClientLoaded || !Device) {
      setError('Voice call system not ready yet. Please try again.')
      return null
    }
    
    try {
      // Get Twilio token from your API
      const response = await fetch("/api/twilio/token")
      const data = await response.json()
      
      if (!data.token) {
        throw new Error("Failed to get Twilio token")
      }

      // Initialize Twilio Device
      const newDevice = new Device(data.token, {
        // Optional Device parameters
        codecPreferences: ["opus", "pcmu"],
        fakeLocalDTMF: true,
        enableRingingState: true,
      })

      // Setup device event handlers
      newDevice.on("ready", () => {
        console.log("Twilio device is ready")
      })

      newDevice.on("error", (error: any) => {
        console.error("Twilio device error:", error)
        setError(error.message || "An error occurred with the voice call")
        setIsConnecting(false)
        setIsConnected(false)
      })

      newDevice.on("connect", (conn: any) => {
        setConnection(conn)
        setIsConnected(true)
        setIsConnecting(false)
        setError(null)
      })

      newDevice.on("disconnect", () => {
        setConnection(null)
        setIsConnected(false)
        setIsConnecting(false)
      })

      setDevice(newDevice)
      return newDevice
    } catch (err: any) {
      console.error("Error setting up Twilio device:", err)
      setError(err.message || "Failed to setup voice call")
      setIsConnecting(false)
      return null
    }
  }, [Device, isClientLoaded])

  const startCall = useCallback(async () => {
    if (!isClientLoaded) {
      setError('Voice call system not ready yet. Please try again.')
      return
    }
    
    try {
      setError(null)
      setIsConnecting(true)

      let currentDevice = device
      if (!currentDevice) {
        currentDevice = await setupDevice()
        if (!currentDevice) {
          throw new Error("Failed to initialize voice call")
        }
      }

      // Connect to Twilio with the request ID
      await currentDevice.connect({
        params: {
          requestId: requestId,
        },
      })
    } catch (err: any) {
      console.error("Error starting call:", err)
      setError(err.message || "Failed to start voice call")
      setIsConnecting(false)
    }
  }, [device, requestId, setupDevice, isClientLoaded])

  const endCall = useCallback(() => {
    try {
      if (connection) {
        connection.disconnect()
      }
      if (device) {
        device.destroy()
        setDevice(null)
      }
      setConnection(null)
      setIsConnected(false)
      setIsConnecting(false)
      setError(null)
    } catch (err: any) {
      console.error("Error ending call:", err)
      setError(err.message || "Failed to end voice call")
    }
  }, [connection, device])

  const toggleMute = useCallback(() => {
    try {
      if (connection) {
        if (connection.isMuted()) {
          connection.mute(false)
        } else {
          connection.mute(true)
        }
      }
    } catch (err: any) {
      console.error("Error toggling mute:", err)
      setError(err.message || "Failed to toggle mute")
    }
  }, [connection])

  return {
    isConnected,
    isConnecting,
    error,
    startCall,
    endCall,
    toggleMute,
  }
} 