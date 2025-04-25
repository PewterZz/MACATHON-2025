import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface CustomLoaderProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  color?: "default" | "indigo" | "slate" | "green"; // Keep for backward compatibility
}

/**
 * A custom animated loader using sequential frames
 */
export function CustomLoader({
  size = "md",
  label,
  className,
  color = "default" // Accept but ignore the color prop
}: CustomLoaderProps) {
  const [currentFrame, setCurrentFrame] = useState(1);
  const [imageError, setImageError] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev % 4) + 1);
    }, 250); // Change frame every 250ms (4 frames per second)
    
    return () => clearInterval(interval);
  }, []);
  
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16"
  };
  
  const labelColorClasses = {
    default: "text-slate-300",
    indigo: "text-indigo-300",
    slate: "text-slate-300",
    green: "text-green-500"
  };

  // When image fails to load, use a fallback spinner
  const handleImageError = () => {
    console.error(`Failed to load loader image: /load_frame${currentFrame}.png`);
    setImageError(true);
  };
  
  return (
    <div className="flex flex-col items-center justify-center">
      <div className={cn(sizeClasses[size], className)}>
        {imageError ? (
          // Fallback spinner when images can't load
          <div className={`animate-spin rounded-full border-t-2 border-b-2 border-indigo-500 ${sizeClasses[size]}`}></div>
        ) : (
          <Image
            src={`/load_frame${currentFrame}.png`}
            alt="Loading"
            width={size === "sm" ? 32 : size === "md" ? 48 : 64}
            height={size === "sm" ? 32 : size === "md" ? 48 : 64}
            className="object-contain"
            onError={handleImageError}
            priority
            unoptimized
          />
        )}
      </div>
      {label && (
        <p className={`mt-3 text-sm ${labelColorClasses[color]}`}>{label}</p>
      )}
    </div>
  );
} 