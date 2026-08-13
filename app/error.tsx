'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('🔴 Error:', error.message)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Oops!</h1>
        <p className="text-gray-600">{error.message}</p>
        <div className="space-x-4">
          <Button onClick={() => reset()} className="bg-blue-600 hover:bg-blue-700 text-white">
            Thử lại
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            Về trang chủ
          </Button>
        </div>
      </div>
    </div>
  )
}
