"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { logger } from "@/lib/logger"
import { toast } from "sonner"

export type UserRole = "admin" | "staff"

export interface User {
  id: string
  username: string
  displayName: string
  role: UserRole
  permissions: {
    canDelete: boolean
    canBackup?: boolean
    canViewAccessHistory?: boolean
  }
}

export interface AccessLog {
  id: string
  userId: string
  username: string
  displayName: string
  action: string
  module: string
  details: string
  ipAddress: string
  timestamp: Date
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  addAccessLog: (action: string, module: string, details: string) => void
  accessLogs: AccessLog[]
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Predefined users have been removed for security. All users are now managed via Database and verified on the server-side.

// Get client IP via server route
const getClientIP = async () => {
  try {
    const res = await fetch("/api/client-ip", { cache: "no-store" })
    if (!res.ok) return "Unknown"
    const data = await res.json()
    return typeof data?.ip === "string" && data.ip ? data.ip : "Unknown"
  } catch {
    return "Unknown"
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])

  useEffect(() => {
    // Intercept window.alert to show beautiful custom sonner toasts
    if (typeof window !== "undefined") {
      window.alert = (message: string) => {
        if (!message) return
        
        let cleanMessage = message.replace(/^[⚠️❌✓ℹ️🔔]\s*/g, "")
        const lines = cleanMessage.split("\n")
        const title = lines[0]
        // Filter out empty lines from description
        const description = lines.slice(1).filter(l => l.trim() !== "").join("\n")
        
        const isWarning = message.includes("⚠️") || message.toLowerCase().includes("cảnh báo") || message.toLowerCase().includes("vui lòng") || message.toLowerCase().includes("chưa") || message.toLowerCase().includes("yêu cầu")
        const isError = message.includes("❌") || message.toLowerCase().includes("lỗi") || message.toLowerCase().includes("thất bại") || message.toLowerCase().includes("không thể") || message.toLowerCase().includes("sự cố")
        const isSuccess = message.includes("✓") || message.toLowerCase().includes("thành công") || message.toLowerCase().includes("hoàn thành") || message.toLowerCase().includes("thực hiện xong") || message.toLowerCase().includes("đã được lưu")
        
        const options = {
          description: description || undefined,
          duration: isError ? 6000 : isWarning ? 5000 : 4000,
        }

        if (isError) {
          toast.error(title, options)
        } else if (isWarning) {
          toast.warning(title, options)
        } else if (isSuccess) {
          toast.success(title, options)
        } else {
          toast.info(title, options)
        }
      }
    }

    const init = async () => {
      try {
        const res = await fetch("/api/auth/me")
        if (res.ok) {
          const data = await res.json()
          if (data.authenticated) {
            setUser(data.user)
            localStorage.setItem("3l_moto_user", JSON.stringify(data.user))
          } else {
            setUser(null)
            localStorage.removeItem("3l_moto_user")
          }
        } else {
          setUser(null)
          localStorage.removeItem("3l_moto_user")
        }
        
        const savedLogs = localStorage.getItem("3l_moto_access_logs")
        if (savedLogs) {
          try {
            const parsedLogs = JSON.parse(savedLogs)
            setAccessLogs(parsedLogs.map((log: AccessLog) => ({
              ...log,
              timestamp: new Date(log.timestamp)
            })))
          } catch {
            localStorage.removeItem("3l_moto_access_logs")
          }
        }
      } catch (error) {
        console.error("❌ Error in init:", error)
        setUser(null)
        localStorage.removeItem("3l_moto_user")
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const addAccessLog = async (action: string, module: string, details: string) => {
    if (!user) return
    
    const ipAddress = await getClientIP()
    const newLog = {
      username: user.username,
      displayname: user.displayName,
      action,
      module,
      details,
      ip_address: ipAddress,
      timestamp: new Date().toISOString(),
    }
    
    try {
      // Save to Supabase
      const { error } = await (await import("@/lib/supabase")).supabase
        .from("access_logs")
        .insert([newLog])
      
      if (error) {
        console.error("❌ Error logging to Supabase:", error)
      } else {
        console.log("✅ Logged to Supabase:", newLog)
      }
    } catch (error) {
      console.error("Exception logging:", error)
    }
    
    // Also update local state
    const localLog: AccessLog = {
      id: Date.now().toString(),
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      action,
      module,
      details,
      ipAddress,
      timestamp: new Date(),
    }
    
    setAccessLogs(prev => {
      const updated = [localLog, ...prev]
      localStorage.setItem("3l_moto_access_logs", JSON.stringify(updated))
      return updated
    })
  }

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setUser(data.user)
        localStorage.setItem("3l_moto_user", JSON.stringify(data.user))
        return { success: true }
      } else {
        return { success: false, error: data.error || "Đăng nhập thất bại" }
      }
    } catch (error) {
      console.error("Login error:", error)
      return { success: false, error: "Lỗi kết nối máy chủ" }
    }
  }

  const logout = async () => {
    if (user) {
      try {
        await logger.logout(user.username, user.displayName)
        await fetch("/api/auth/logout", { method: "POST" })
      } catch (err) {
        console.error("Logout API error:", err)
      }
    }
    setUser(null)
    localStorage.removeItem("3l_moto_user")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, addAccessLog, accessLogs }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
