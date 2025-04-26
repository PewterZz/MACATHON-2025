"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Tag, ExternalLink, AlertTriangle } from "lucide-react"
import { useQueue } from "@/hooks/useQueue"
import { CustomLoader } from "@/components/ui/custom-loader"

interface Request {
  id: string
  risk: number
  summary: string
  tags: string[]
  timestamp: string
  channel: string
}

interface RequestCardProps {
  request: Request
  profile?: any
  refreshQueue?: () => void
}

export default function RequestCard({ request, profile, refreshQueue }: RequestCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { claimRequest } = useQueue()
  
  const getRiskLevel = (risk: number): "low" | "medium" | "high" | "critical" => {
    if (risk < 0.3) return "low"
    if (risk < 0.6) return "medium"
    if (risk < 0.8) return "high"
    return "critical"
  }
  
  const riskLevel = getRiskLevel(request.risk)

  const handleClaim = async () => {
    try {
      setIsLoading(true)
      await claimRequest(request.id)
      if (refreshQueue) {
        refreshQueue()
      }
    } catch (error) {
      console.error("Failed to claim request:", error)
      alert("Failed to claim request. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="bg-slate-800 border-slate-700 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={`
            flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
            ${riskLevel === "low" ? "bg-green-900/30 text-green-400" : 
            riskLevel === "medium" ? "bg-yellow-900/30 text-yellow-400" : 
            riskLevel === "high" ? "bg-red-900/30 text-red-400" :
            "bg-purple-900/30 text-purple-400"}
          `}>
            {riskLevel === "high" && <AlertTriangle className="h-3 w-3" />}
            {riskLevel === "critical" && <AlertTriangle className="h-3 w-3 animate-pulse" />}
            {riskLevel === "low" ? "Low Risk" : riskLevel === "medium" ? "Medium Risk" : 
            riskLevel === "high" ? "High Risk" : "Critical Risk"}
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`
              rounded-full h-2 w-2
              ${request.channel === "phone" ? "bg-blue-400" : 
              request.channel === "whatsapp" ? "bg-green-400" : 
              "bg-purple-400"}
            `} />
            <span className="text-xs text-slate-400 capitalize">{request.channel}</span>
          </div>
        </div>
        
        <h3 className="text-lg font-medium text-slate-100 mb-2">{request.summary}</h3>
        
        <div className="text-xs text-slate-400 mb-4">{request.timestamp}</div>
        
        <div className="flex flex-wrap gap-2 mt-4">
          {request.tags.map((tag) => (
            <div key={tag} className="flex items-center bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="bg-slate-800 px-6 py-4 border-t border-slate-700">
        <Button 
          onClick={handleClaim} 
          className="w-full bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900 flex items-center gap-1.5"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <CustomLoader size="sm" color="default" className="mr-2" />
              Claiming...
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4" />
              Claim Request
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
