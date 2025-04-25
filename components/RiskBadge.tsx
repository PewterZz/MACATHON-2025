import { cn } from "@/lib/utils"
import { AlertTriangle, AlertCircle, Info } from "lucide-react"

interface RiskBadgeProps {
  risk: "low" | "medium" | "high"
  className?: string
}

export default function RiskBadge({ risk, className }: RiskBadgeProps) {
  const getIcon = () => {
    switch (risk) {
      case "low":
        return <Info className="h-4 w-4" />
      case "medium":
        return <AlertCircle className="h-4 w-4" />
      case "high":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  return (
    <div
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
        risk === "low" && "bg-green-900/30 text-green-400",
        risk === "medium" && "bg-amber-900/30 text-amber-400",
        risk === "high" && "bg-red-900/30 text-red-400",
        className,
      )}
    >
      {getIcon()}
      <span className="ml-1 capitalize">{risk} risk</span>
    </div>
  )
}
