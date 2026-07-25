"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const { login, user, isLoading: authLoading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  })

  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard")
    }
  }, [user, authLoading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    
    const result = await login(formData.username, formData.password)
    
    if (result.success) {
      router.push("/dashboard")
    } else {
      setError(result.error || "Đăng nhập thất bại")
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative"
      style={{
        backgroundImage: 'url(/login-bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Blurred + Transparent Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
      
      <div className="relative w-full max-w-sm z-10">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative w-24 h-24 mb-6">
            <Image
              src="/logo.jpg"
              alt="3L Moto Logo"
              fill
              className="object-contain rounded-full bg-white card-shadow"
              priority
            />
          </div>
          <h1 className="text-display text-white drop-shadow-lg !text-white">3L Moto</h1>
          <p className="text-white/90 text-body mt-2 drop-shadow-md font-medium">Hệ thống quản lý cho thuê xe máy</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-[var(--radius-container)] p-8 shadow-[var(--shadow-card-hover)] border border-slate-100">
          <div className="text-center mb-8">
            <h2 className="text-title">Chào mừng trở lại</h2>
            <p className="text-meta mt-1">Đăng nhập để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-label">
                Tên đăng nhập
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                className="h-12 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-[var(--radius-control)] focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 ui-transition"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-label">Mật khẩu</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 pr-12 bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 rounded-[var(--radius-control)] focus:bg-white focus:border-blue-500 focus:ring-blue-500/20 ui-transition"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 ui-transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-body text-rose-600 bg-rose-50 p-3 rounded-[var(--radius-control)]">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-4 h-4 rounded border border-slate-300 bg-slate-50 peer-checked:bg-blue-600 peer-checked:border-blue-600 ui-transition" />
                  <svg className="absolute top-0.5 left-0.5 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-slate-500 group-hover:text-slate-700 ui-transition">Ghi nhớ</span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-[var(--radius-control)] ui-transition group"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang đăng nhập...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Đăng nhập</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm font-semibold text-white drop-shadow-lg mt-10">
          3L Moto Huế - By Phan Lê Tự Lập
        </p>
      </div>
    </div>
  )
}
