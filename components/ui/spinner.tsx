import { cn } from "@/lib/utils"

interface SpinnerProps {
  size?: "sm" | "md" | "lg"
  color?: "default" | "indigo" | "slate" | "green"
  label?: string
  className?: string
}

/**
 * A consistent spinner component for loading states throughout the application
 */
export function Spinner({
  size = "md",
  color = "default",
  label,
  className
}: SpinnerProps) {
  const sizeClasses = {
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-2"
  }
  
  const colorClasses = {
    default: "border-t-[#3ECF8E] border-b-[#3ECF8E]",
    indigo: "border-t-indigo-500 border-b-indigo-500", 
    slate: "border-t-slate-400 border-b-slate-400",
    green: "border-t-green-500 border-b-green-500"
  }
  
  const labelColorClasses = {
    default: "text-slate-300",
    indigo: "text-indigo-300",
    slate: "text-slate-300",
    green: "text-green-500"
  }
  
  return (
    <div className="flex flex-col items-center justify-center">
      <div 
        className={cn(
          "animate-spin rounded-full", 
          sizeClasses[size], 
          colorClasses[color],
          className
        )} 
      />
      {label && (
        <p className={`mt-3 text-sm ${labelColorClasses[color]}`}>{label}</p>
      )}
    </div>
  )
} 