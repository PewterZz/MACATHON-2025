"use client"

import { useEffect, useRef } from 'react'

interface LoadingTimeoutProps {
  isLoading: boolean
  onTimeout: () => void
  timeoutMs?: number // Default timeout duration in milliseconds
}

/**
 * Component to handle timeouts for loading states
 * Automatically calls onTimeout when loading takes longer than timeoutMs
 */
export function LoadingTimeout({ 
  isLoading, 
  onTimeout, 
  timeoutMs = 8000 
}: LoadingTimeoutProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Clear any existing timeouts when loading state changes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Set new timeout when loading starts
    if (isLoading) {
      timeoutRef.current = setTimeout(() => {
        onTimeout()
      }, timeoutMs)
    }

    // Clean up on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isLoading, onTimeout, timeoutMs])

  // This component doesn't render anything
  return null
}

// Generic loading error component for reuse
export function LoadingErrorDisplay({
  title = "Failed to Load",
  description = "There was a problem loading the data.",
  onRetry,
  icon: Icon = null,
  theme = "indigo" // 'indigo' for student dashboard, 'slate' for helper dashboard
}) {
  const themeClasses = {
    indigo: {
      text: "text-white",
      subtext: "text-indigo-300",
      button: "border-indigo-700 hover:bg-indigo-800 text-white"
    },
    slate: {
      text: "text-slate-100",
      subtext: "text-slate-300",
      button: "border-slate-700 hover:bg-slate-700 text-slate-100"
    }
  }
  
  const classes = themeClasses[theme]
  
  return (
    <div className="text-center py-8">
      {Icon && <Icon className="h-12 w-12 text-amber-500 mx-auto mb-4" />}
      <h3 className={`text-lg font-medium ${classes.text}`}>{title}</h3>
      <p className={`${classes.subtext} mt-2 mb-4`}>{description}</p>
      {onRetry && (
        <button 
          className={`inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 border ${classes.button}`}
          onClick={onRetry}
        >
          Try Again
        </button>
      )}
    </div>
  )
} 