"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
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
  Camera,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
  const { user, logout, updateUser } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      setAvatarMessage(null)
      setUploadingAvatar(true)
      const body = new FormData()
      body.append("avatar", file)
      const res = await fetch("/api/auth/profile-avatar", { method: "POST", body })
      const data = await res.json()
      if (!res.ok) {
        setAvatarMessage({ type: "error", text: data.error || "Không đổi được ảnh đại diện" })
        return
      }
      if (data.user) updateUser(data.user)
      setAvatarMessage({ type: "success", text: "Đã cập nhật ảnh đại diện" })
    } catch (error) {
      console.error("Avatar upload error:", error)
      setAvatarMessage({ type: "error", text: "Không đổi được ảnh đại diện" })
    } finally {
      setUploadingAvatar(false)
    }
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

      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword })
      })

      const data = await res.json()

      if (!res.ok) {
        setPasswordMessage({ type: "error", text: data.error || "Đổi mật khẩu thất bại" })
        return
      }

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
    if (user?.role === "admin") return true
    const perms = (user?.permissions || {}) as any

    if (item.href === "/dashboard") return perms.canAccessDashboard !== false
    if (item.href === "/dashboard/vehicles") return perms.canAccessVehicles !== false
    if (item.href === "/dashboard/customers") return perms.canAccessCustomers !== false
    if (item.href === "/dashboard/orders") return perms.canAccessOrders !== false
    if (item.href === "/dashboard/maintenance") return perms.canAccessMaintenance !== false
    if (item.href === "/dashboard/reports") return perms.canAccessReports !== false
    if (item.href === "/dashboard/access-history") return !!perms.canViewAccessHistory

    return !("adminOnly" in item && item.adminOnly)
  })

  const nav = (
    <>
      <div className="flex items-center gap-3 h-[4.5rem] px-5 border-b border-slate-800/60 shrink-0">
        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-800 shrink-0">
          <Image src="/logo.jpg" alt="3L Moto" fill className="object-contain bg-white" />
        </div>
        <div className="min-w-0">
          <p className="text-body font-semibold text-slate-100 truncate leading-tight">3L Moto</p>
          <p className="text-meta text-slate-400 truncate">Cho thuê xe</p>
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
            <Avatar className="h-9 w-9 shrink-0">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.displayName} className="object-cover" />}
              <AvatarFallback className="bg-blue-600 text-white text-label font-semibold uppercase">
                {user.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-slate-200 truncate">{user.displayName}</span>
              <span className="block text-meta text-slate-400 truncate">{user.role === "admin" ? "Admin" : "Nhân viên"}</span>
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
    <div className="flex min-h-[100dvh] dashboard-bg bg-slate-50/50 overflow-x-clip">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-[100dvh] w-[min(16.5rem,100%)] bg-[#0A0D14] border-r border-slate-800/60 flex flex-col ui-transition pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {nav}
      </aside>

      <div className="flex-1 min-w-0 lg:ml-[16.5rem]">
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2 min-h-14 px-4 bg-white/90 backdrop-blur-md border-b border-slate-100 pt-[env(safe-area-inset-top)]">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-[var(--radius-control)] hover:bg-slate-50 touch-target shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </Button>
          <div className="min-w-0">
            <p className="text-body font-semibold text-slate-800 leading-tight">3L Moto</p>
            <p className="text-meta leading-tight truncate">
              {visibleItems.find((i) => isNavActive(pathname, i.href))?.title
                || (isNavActive(pathname, "/dashboard/settings") ? "Cài đặt" : "Quản trị")}
            </p>
          </div>
        </div>

        <main className="p-4 sm:p-5 lg:p-8 pb-[max(1rem,env(safe-area-inset-bottom))] min-w-0 overflow-x-clip">{children}</main>
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="flex flex-col gap-0 overflow-hidden bg-white p-0 rounded-[var(--radius-container)] border-slate-200 max-w-md max-h-[min(90dvh,calc(100dvh-1rem))]">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600" />
          <DialogHeader className="shrink-0 space-y-0 px-4 pt-5 pb-3 sm:px-5 text-left">
            <DialogTitle className="text-title">Thông tin cá nhân</DialogTitle>
            <DialogDescription className="text-meta mt-0.5">Tài khoản đang đăng nhập</DialogDescription>
          </DialogHeader>

          <div className="px-4 sm:px-5 pb-4 space-y-3">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={handleAvatarChange}
            />
            <div className="flex items-center gap-3 rounded-[var(--radius-container)] border border-slate-200/80 bg-slate-50/80 p-2.5">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
                title="Thay ảnh đại diện"
              >
                <Avatar className="h-14 w-14">
                  {user?.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={user.displayName} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-blue-600 text-white text-lg font-semibold uppercase">
                    {user?.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white">
                  <Camera className="h-3 w-3" />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-title truncate leading-tight">{user?.displayName}</p>
                <p className="text-meta truncate mt-0.5">{user?.username}</p>
                <p className="text-meta text-slate-500 mt-0.5">
                  {uploadingAvatar ? "Đang tải ảnh..." : "Chạm ảnh để đổi đại diện"}
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-[var(--radius-badge)] border border-slate-200 bg-white text-meta font-semibold text-slate-700">
                {user?.role === "admin" ? "Admin" : "Nhân viên"}
              </span>
            </div>

            {avatarMessage && (
              <p
                className={cn(
                  "text-meta",
                  avatarMessage.type === "success" ? "text-emerald-700" : "text-rose-700"
                )}
              >
                {avatarMessage.text}
              </p>
            )}

            <div className="space-y-2.5">
              <h4 className="text-label text-slate-800">Đổi mật khẩu</h4>

              {passwordMessage && (
                <div
                  className={cn(
                    "px-3 py-2 rounded-[var(--radius-control)] text-meta",
                    passwordMessage.type === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  )}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <Label className="text-label">Mật khẩu cũ</Label>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Mật khẩu hiện tại"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="mt-1 h-11 text-base rounded-[var(--radius-control)] border-slate-200"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-label">Mật khẩu mới</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mật khẩu mới"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 h-11 text-base rounded-[var(--radius-control)] border-slate-200"
                    />
                  </div>
                  <div>
                    <Label className="text-label">Xác nhận</Label>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nhập lại"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1 h-11 text-base rounded-[var(--radius-control)] border-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <Button
                onClick={() => {
                  setIsProfileOpen(false)
                  handleLogout()
                }}
                variant="outline"
                className="h-11 text-rose-600 border-rose-200 hover:bg-rose-50 rounded-[var(--radius-control)] font-semibold"
              >
                Đăng xuất
              </Button>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="h-11 bg-blue-600 hover:bg-blue-700 !text-white rounded-[var(--radius-control)] font-semibold [&_svg]:!text-white"
              >
                {changingPassword ? "Đang lưu..." : "Lưu mật khẩu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
