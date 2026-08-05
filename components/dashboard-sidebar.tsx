"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { USERS } from "@/contexts/auth-context"
import {
  Bike,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  Wrench,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SidebarProps {
  children: React.ReactNode
}

const menuItems = [
  { title: "Tổng quan", href: "/dashboard", icon: LayoutDashboard },
  { title: "Quản lý xe", href: "/dashboard/vehicles", icon: Bike },
  { title: "Khách thuê", href: "/dashboard/customers", icon: Users },
  { title: "Đơn thuê", href: "/dashboard/orders", icon: ClipboardList },
  { title: "Bảo trì", href: "/dashboard/maintenance", icon: Wrench },
  { title: "Báo cáo", href: "/dashboard/reports", icon: FileText },
  { title: "Lịch sử truy cập", href: "/dashboard/access-history", icon: History, adminOnly: true },
]

function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function DashboardSidebar({ children }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleChangePassword = async () => {
    try {
      setPasswordMessage(null)
      setChangingPassword(true)

      if (!oldPassword || !newPassword || !confirmPassword) {
        setPasswordMessage({ type: "error", text: "Vui lòng điền đầy đủ thông tin" })
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordMessage({ type: "error", text: "Mật khẩu mới không khớp" })
        return
      }
      if (newPassword.length < 6) {
        setPasswordMessage({ type: "error", text: "Mật khẩu phải ít nhất 6 ký tự" })
        return
      }

      const foundUser = USERS.find((u) => u.username === user?.username && u.password === oldPassword)
      if (!foundUser) {
        setPasswordMessage({ type: "error", text: "Mật khẩu cũ không đúng" })
        return
      }

      const { supabase } = await import("@/lib/supabase")
      const { error } = await supabase
        .from("auth_users")
        .update({ password: newPassword })
        .eq("username", user?.username)

      if (error) throw error

      setPasswordMessage({ type: "success", text: "Đổi mật khẩu thành công" })
      setTimeout(() => {
        setOldPassword("")
        setNewPassword("")
        setConfirmPassword("")
        setPasswordMessage(null)
        setIsProfileOpen(false)
      }, 1500)
    } catch (error) {
      console.error("Change password error:", error)
      setPasswordMessage({ type: "error", text: `Lỗi: ${(error as Error).message}` })
    } finally {
      setChangingPassword(false)
    }
  }

  const visibleItems = menuItems.filter((item) => {
    if (item.href === "/dashboard/access-history") {
      return user?.role === "admin" || user?.permissions?.canViewAccessHistory
    }
    return !("adminOnly" in item && item.adminOnly) || user?.role === "admin"
  })

  const nav = (
    <>
      <div className="flex items-center gap-3 h-[4.5rem] px-5 border-b border-slate-800/60 shrink-0">
        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-800 shrink-0">
          <Image src="/logo.jpg" alt="3L Moto" fill className="object-contain bg-white" />
        </div>
        <div className="min-w-0">
          <p className="text-body font-semibold text-slate-100 truncate leading-tight">3L Moto</p>
          <p className="text-xs text-slate-400 truncate">Cho thuê xe</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden ml-auto p-2 rounded-[var(--radius-control)] hover:bg-slate-800 text-slate-400 hover:text-white ui-transition touch-target"
          aria-label="Đóng menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {visibleItems.map((item) => {
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 h-11 px-3 rounded-[var(--radius-control)] ui-transition touch-target text-body font-medium group/item",
                active
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.22)]"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0 transition-transform duration-200 group-hover/item:scale-110", active ? "text-white" : "text-slate-400 group-hover/item:text-slate-300")} />
              <span className="truncate transition-transform duration-200 group-hover/item:translate-x-0.5">{item.title}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-slate-800/60 p-3 space-y-1 shrink-0">
        {user?.role === "admin" && (
          <Link
            href="/dashboard/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 h-11 px-3 rounded-[var(--radius-control)] ui-transition text-body font-medium group/item",
              isNavActive(pathname, "/dashboard/settings")
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.22)]"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
            )}
          >
            <Settings className="w-5 h-5 shrink-0 opacity-70 transition-transform duration-200 group-hover/item:rotate-45" />
            <span className="transition-transform duration-200 group-hover/item:translate-x-0.5">Cài đặt</span>
          </Link>
        )}

        {user && (
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="w-full flex items-center gap-3 h-12 px-3 rounded-[var(--radius-control)] hover:bg-slate-800/50 ui-transition text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-label font-semibold uppercase shrink-0">
              {user.displayName.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-slate-200 truncate">{user.displayName}</span>
              <span className="block text-xs text-slate-400 truncate">{user.role === "admin" ? "Admin" : "Nhân viên"}</span>
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 h-11 px-3 rounded-[var(--radius-control)] text-body font-medium text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 ui-transition"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen dashboard-bg bg-slate-50/50">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[16.5rem] bg-[#0A0D14] border-r border-slate-800/60 flex flex-col ui-transition",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {nav}
      </aside>

      <div className="flex-1 min-w-0 lg:ml-[16.5rem]">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2 h-14 px-4 bg-white/90 backdrop-blur-md border-b border-slate-100">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-[var(--radius-control)] hover:bg-slate-50 touch-target"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </Button>
          <div className="min-w-0">
            <p className="text-body font-semibold text-slate-800 leading-tight">3L Moto</p>
            <p className="text-meta leading-tight truncate">
              {visibleItems.find((i) => isNavActive(pathname, i.href))?.title || "Quản trị"}
            </p>
          </div>
        </div>

        <main className="p-4 sm:p-5 lg:p-8">{children}</main>
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="bg-white rounded-[var(--radius-container)] max-w-md border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-title">Thông tin cá nhân</DialogTitle>
            <DialogDescription className="text-meta">Quản lý tài khoản của bạn</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 mx-auto mb-3">
                <span className="text-white text-xl font-semibold uppercase">
                  {user?.displayName.charAt(0)}
                </span>
              </div>
              <h3 className="text-title">{user?.displayName}</h3>
              <p className="text-meta mt-1">{user?.username}</p>
              <p className="text-meta">{user?.role === "admin" ? "Quyền: Admin" : "Quyền: Nhân viên"}</p>
            </div>

            <div className="border-t border-slate-100 pt-5 space-y-4">
              <h4 className="text-body font-semibold text-slate-800">Đổi mật khẩu</h4>

              {passwordMessage && (
                <div
                  className={cn(
                    "p-3 rounded-[var(--radius-control)] text-body",
                    passwordMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  )}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label className="text-label">Mật khẩu cũ</Label>
                  <Input
                    type="password"
                    placeholder="Nhập mật khẩu cũ"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="mt-1.5 h-11 rounded-[var(--radius-control)]"
                  />
                </div>
                <div>
                  <Label className="text-label">Mật khẩu mới</Label>
                  <Input
                    type="password"
                    placeholder="Nhập mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1.5 h-11 rounded-[var(--radius-control)]"
                  />
                </div>
                <div>
                  <Label className="text-label">Xác nhận mật khẩu</Label>
                  <Input
                    type="password"
                    placeholder="Xác nhận mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1.5 h-11 rounded-[var(--radius-control)]"
                  />
                </div>
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-[var(--radius-control)] font-semibold"
              >
                {changingPassword ? "Đang xử lý..." : "Đổi mật khẩu"}
              </Button>
            </div>

            <Button
              onClick={() => {
                setIsProfileOpen(false)
                handleLogout()
              }}
              variant="outline"
              className="w-full h-11 text-rose-600 border-rose-200 hover:bg-rose-50 rounded-[var(--radius-control)]"
            >
              Đăng xuất
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
