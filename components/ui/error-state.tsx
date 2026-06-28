import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  details?: string
}

export function ErrorState({
  title = "Lỗi",
  message,
  onRetry,
  details,
}: ErrorStateProps) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
      <div className="flex items-start gap-4">
        <div className="text-blue-500 flex-shrink-0 mt-1">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="flex-1 space-y-2">
          <h3 className="font-semibold text-red-900">{title}</h3>
          <p className="text-sm text-blue-800">{message}</p>
          {details && (
            <details className="text-xs text-blue-700 mt-2">
              <summary className="cursor-pointer font-medium">
                Chi tiết
              </summary>
              <pre className="mt-2 bg-blue-100/50 p-2 rounded text-xs overflow-auto">
                {details}
              </pre>
            </details>
          )}
        </div>
      </div>
      {onRetry && (
        <div className="flex justify-end pt-2">
          <Button
            onClick={onRetry}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      )}
    </div>
  )
}

export function ErrorBoundary({
  children,
  fallback,
}: {
  children: React.ReactNode
  fallback?: (error: Error) => React.ReactNode
}) {
  const [error, setError] = React.useState<Error | null>(null)

  if (error) {
    return fallback ? (
      fallback(error)
    ) : (
      <ErrorState
        message={error.message}
        details={error.stack}
        onRetry={() => setError(null)}
      />
    )
  }

  return <>{children}</>
}
