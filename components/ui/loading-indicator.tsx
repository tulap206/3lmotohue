import React from "react"
import { Loader2 } from "lucide-react"

interface LoadingIndicatorProps {
  message?: string
  size?: "sm" | "md" | "lg"
  fullScreen?: boolean
}

export function LoadingIndicator({
  message = "Đang tải...",
  size = "md",
  fullScreen = false,
}: LoadingIndicatorProps) {
  const iconSize =
    size === "sm" ? "w-6 h-6" : size === "lg" ? "w-12 h-12" : "w-8 h-8"

  const textSize =
    size === "sm" ? "text-sm" : size === "lg" ? "text-lg" : "text-base"

  const container = fullScreen
    ? "fixed inset-0 flex items-center justify-center bg-black/10 z-50"
    : "flex items-center justify-center py-12"

  return (
    <div className={container}>
      <div className="flex flex-col items-center gap-4">
        <Loader2 className={`${iconSize} text-red-500 spinner`} />
        {message && (
          <p className={`${textSize} text-slate-600 font-medium`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 modal-overlay">
      <div className="bg-white rounded-lg p-8 modal-content">
        <LoadingIndicator />
      </div>
    </div>
  )
}

export function InlineLoader({ message = "Đang tải..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 className="w-4 h-4 text-red-500 spinner" />
      <span className="text-sm text-slate-600">{message}</span>
    </div>
  )
}
