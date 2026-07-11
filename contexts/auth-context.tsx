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

// Predefined users
export const USERS: { username: string; password: string; user: User }[] = [
  {
    username: "admin",
    password: "admin",
    user: {
      id: "1",
      username: "admin",
      displayName: "Admin",
      role: "admin",
      permissions: {
        canDelete: true,
        canBackup: true,
      },
    },
  },
  {
    username: "loca",
    password: "admin",
    user: {
      id: "2",
      username: "loca",
      displayName: "Lộc A",
      role: "staff",
      permissions: {
        canDelete: false,
      },
    },
  },
  {
    username: "locb",
    password: "admin",
    user: {
      id: "3",
      username: "locb",
      displayName: "Lộc B",
      role: "staff",
      permissions: {
        canDelete: false,
      },
    },
  },
  {
    username: "sang",
    password: "admin123",
    user: {
      id: "4",
      username: "sang",
      displayName: "Sang",
      role: "staff",
      permissions: {
        canDelete: false,
      },
    },
  },
]

// Get client IP (simplified for demo)
const getClientIP = () => {
  return "192.168.1." + Math.floor(Math.random() * 255)
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
        // Check for saved session
        const savedUser = localStorage.getItem("3l_moto_user")
        const savedLogs = localStorage.getItem("3l_moto_access_logs")
        
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser))
          } catch {
            localStorage.removeItem("3l_moto_user")
          }
        }
        
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
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const addAccessLog = async (action: string, module: string, details: string) => {
    if (!user) return
    
    const newLog = {
      username: user.username,
      displayname: user.displayName,
      action,
      module,
      details,
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
      ipAddress: getClientIP(),
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
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Try Supabase first
      const { supabase } = await import("@/lib/supabase")
      const { data, error } = await supabase
        .from("auth_users")
        .select("*")
        .eq("username", username)
        .eq("password", password)
        .single()

      if (data) {
        const userData: User = {
          id: data.id,
          username: data.username,
          displayName: data.displayname,
          role: data.role as UserRole,
          permissions: {
            canDelete: data.can_delete || false,
            canBackup: data.role === 'admin',
          },
        }
        setUser(userData)
        localStorage.setItem("3l_moto_user", JSON.stringify(userData))
        logger.login(userData.username, userData.displayName)
        console.log("✅ Logged in from Supabase")
        return { success: true }
      }

      // Fallback to hardcoded users if not found in Supabase
      console.log("⚠️ User not found in Supabase, trying hardcoded users...")
      const foundUser = USERS.find(u => u.username === username && u.password === password)
      
      if (foundUser) {
        setUser(foundUser.user)
        localStorage.setItem("3l_moto_user", JSON.stringify(foundUser.user))
        logger.login(foundUser.user.username, foundUser.user.displayName)
        console.log("✅ Logged in from hardcoded users")
        return { success: true }
      }

      return { success: false, error: "Tên đăng nhập hoặc mật khẩu không đúng" }
    } catch (error) {
      console.error("Login error:", error)
      // Fallback to hardcoded users on error
      const foundUser = USERS.find(u => u.username === username && u.password === password)
      if (foundUser) {
        setUser(foundUser.user)
        localStorage.setItem("3l_moto_user", JSON.stringify(foundUser.user))
        logger.login(foundUser.user.username, foundUser.user.displayName)
        return { success: true }
      }
      return { success: false, error: "Lỗi đăng nhập" }
    }
  }

  const logout = () => {
    if (user) {
      // Log to Supabase
      logger.logout(user.username, user.displayName)
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
