import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface RiskBadgeProps {
  risk: "low" | "medium" | "high" | "critical"
  className?: string
}

export default function RiskBadge({ risk, className }: RiskBadgeProps) {
  let icon

  switch (risk) {
    case "low":
      icon = "●"
      break
    case "medium":
      icon = "●"
      break
    case "high":
      icon = "▲"
      break
    case "critical":
      icon = "▲"
      break
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-2 font-medium text-xs px-2 py-0.5 gap-1",
        risk === "low" && "bg-green-900/30 text-green-400",
        risk === "medium" && "bg-amber-900/30 text-amber-400",
        risk === "high" && "bg-red-900/30 text-red-400",
        risk === "critical" && "bg-purple-900/30 text-purple-400 animate-pulse",
        className
      )}
    >
      <span className="text-[0.6rem]">{icon}</span>
      <span className="ml-1 capitalize">{risk} risk</span>
    </Badge>
  )
}
