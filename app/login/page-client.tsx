"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, ArrowRight, Loader2, Sparkles, ShieldAlert } from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6 relative bg-slate-950 overflow-hidden font-sans"
    >
      {/* Unified Background from Landing Page */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hue-motorbike-bg-v3.jpg"
          alt="3L Moto Background"
          fill
          priority
          className="object-cover opacity-35 filter brightness-[0.6] scale-102"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950" />
        
        {/* Ambient decorative glowing blobs */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
      </div>
      
      <div className="relative w-full max-w-sm z-10">
        {/* Logo and Brand Redesign */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="relative w-22 h-22 mb-4 group">
            <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all duration-300" />
            <Image
              src="/logo.jpg"
              alt="3L Moto Logo"
              fill
              className="object-contain rounded-full bg-white p-1 shadow-2xl relative z-10 transition-transform group-hover:scale-105 duration-300"
              priority
            />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">3L MOTO</h1>
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-400 mt-1">Hệ thống quản lý xe máy</p>
        </motion.div>

        {/* Login Card (Upgraded Glassmorphism matching Booking Form) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/90 rounded-2xl p-8 shadow-2xl border border-white/40 backdrop-blur-2xl travel-glow"
        >
          <div className="text-center mb-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5">
              Quản Trị Hệ Thống <Sparkles className="size-4.5 text-blue-600 animate-pulse" />
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Đăng nhập tài khoản điều phối viên</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Tên đăng nhập
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="admin"
                className="h-12 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 font-semibold shadow-xs focus:border-blue-500 focus:ring-0 rounded-xl transition-all duration-200"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">Mật khẩu</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-12 pr-12 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 font-semibold shadow-xs focus:border-blue-500 focus:ring-0 rounded-xl transition-all duration-200"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2"
              >
                <ShieldAlert className="size-4.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="flex items-center justify-between text-xs font-bold">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" className="peer sr-only" />
                  <div className="w-4.5 h-4.5 rounded-lg border border-slate-300 bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all duration-200" />
                  <svg className="absolute top-1 left-1 w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-slate-500 group-hover:text-slate-700 transition-colors">Ghi nhớ đăng nhập</span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-70 transition-all duration-200 group cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  <span>Đang đăng nhập...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1.5">
                  <span>Đăng nhập hệ thống</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              )}
            </Button>
          </form>
        </motion.div>

        {/* Footer Copyright Synchronization */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center text-[11px] font-semibold text-slate-400 drop-shadow-md mt-8"
        >
          © 2026 3L Moto Huế. Bản quyền sở hữu thuộc về 3L Moto Huế.
        </motion.p>
      </div>
    </div>
  )
}
