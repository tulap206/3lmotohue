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
  X,
  Trash2,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SidebarProps {
  children: React.ReactNode
}

const menuItems = [
  {
    title: "Tổng quan",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Quản lý xe",
    href: "/dashboard/vehicles",
    icon: Bike,
  },
  {
    title: "Khách thuê",
    href: "/dashboard/customers",
    icon: Users,
  },
  {
    title: "Đơn thuê",
    href: "/dashboard/orders",
    icon: ClipboardList,
  },
  {
    title: "Báo cáo",
    href: "/dashboard/reports",
    icon: FileText,
  },
  {
    title: "Lịch sử truy cập",
    href: "/dashboard/access-history",
    icon: History,
  },
]

export function DashboardSidebar({ children }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, allUsers } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  
  // Password change state
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [changingPassword, setChangingPassword] = useState(false)

  // User creation state
  const [newUsername, setNewUsername] = useState("")
  const [newDisplayName, setNewDisplayName] = useState("")
  const [newPassword2, setNewPassword2] = useState("")
  const [newRole, setNewRole] = useState<"admin" | "staff">("staff")
  const [creatingUser, setCreatingUser] = useState(false)
  const [userMessage, setUserMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleCreateUser = async () => {
    try {
      setUserMessage(null)
      setCreatingUser(true)

      // Validate
      if (!newUsername || !newDisplayName || !newPassword2) {
        setUserMessage({ type: 'error', text: '❌ Vui lòng điền đầy đủ thông tin' })
        return
      }

      if (newPassword2.length < 6) {
        setUserMessage({ type: 'error', text: '❌ Mật khẩu phải ít nhất 6 ký tự' })
        return
      }

      // Check if user already exists
      if (allUsers.some(u => u.username === newUsername)) {
        setUserMessage({ type: 'error', text: '❌ Username đã tồn tại' })
        return
      }

      // Create user in Supabase
      const { supabase } = await import("@/lib/supabase")
      const { error } = await supabase
        .from("auth_users")
        .insert([{
          username: newUsername,
          password: newPassword2,
          displayname: newDisplayName,
          role: newRole,
          can_delete: newRole === "admin",
        }])

      if (error) throw error

      setUserMessage({ type: 'success', text: `✅ Tạo user "${newDisplayName}" thành công!` })
      
      // Reset form
      setTimeout(() => {
        setNewUsername("")
        setNewDisplayName("")
        setNewPassword2("")
        setNewRole("staff")
        setUserMessage(null)
        // Reload users
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error("Create user error:", error)
      setUserMessage({ type: 'error', text: `❌ Lỗi: ${(error as any).message}` })
    } finally {
      setCreatingUser(false)
    }
  }

  const handleDeleteUser = async (username: string) => {
    try {
      if (!window.confirm(`Xóa user "${username}"?`)) return

      const { supabase } = await import("@/lib/supabase")
      const { error } = await supabase
        .from("auth_users")
        .delete()
        .eq("username", username)

      if (error) throw error

      setUserMessage({ type: 'success', text: `✅ Xóa user thành công!` })
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      setUserMessage({ type: 'error', text: `❌ Lỗi xóa: ${(error as any).message}` })
    }
  }

  return (
    <div className="flex min-h-screen gradient-bg">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-20 bg-white border-r border-gray-100 transition-transform duration-300 flex flex-col shadow-sm",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-24 border-b border-gray-100">
          <div className="relative w-[86px] h-[86px]">
            <Image
              src="/logo.jpg"
              alt="3L Moto Logo"
              fill
              className="object-contain rounded-xl"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 mx-auto",
                  isActive
                    ? "sidebar-active"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                )}
                title={item.title}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 space-y-2 border-t border-gray-100">
          {/* User Avatar - Clickable */}
          {user && (
            <button
              onClick={() => setIsProfileOpen(true)}
              className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mx-auto cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
              title={`${user.displayName} (${user.username})`}
            >
              <span className="text-white text-sm font-semibold uppercase">
                {user.displayName.charAt(0)}
              </span>
            </button>
          )}
          
          {/* Settings Link */}
          <Link
            href="/dashboard/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 mx-auto",
              pathname === "/dashboard/settings"
                ? "sidebar-active"
                : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            )}
            title="Cài đặt"
          >
            <Settings className="w-5 h-5" />
          </Link>
          
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-14 h-14 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200 mx-auto"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-20">
        {/* Mobile menu button */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center h-14 px-4 bg-transparent">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-white/50"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </Button>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8 lg:pt-8">{children}</main>
      </div>

      {/* User Profile Modal */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="bg-white rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Quản lý tài khoản</DialogTitle>
            <DialogDescription className="text-gray-500">Thông tin cá nhân và quản lý người dùng</DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="profile">Tài khoản của tôi</TabsTrigger>
              {user?.role === "admin" && (
                <TabsTrigger value="users">Quản lý người dùng</TabsTrigger>
              )}
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              {/* User Info */}
              <div className="text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mx-auto mb-3">
                  <span className="text-white text-2xl font-semibold uppercase">
                    {user?.displayName.charAt(0)}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900">{user?.displayName}</h3>
                <p className="text-sm text-gray-600">Username: {user?.username}</p>
                <p className="text-sm text-gray-600">Quyền: {user?.role === 'admin' ? 'Admin' : 'Staff'}</p>
              </div>

              {/* Change Password Section */}
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <h4 className="font-semibold text-gray-900">Đổi mật khẩu</h4>

                {passwordMessage && (
                  <div className={`p-3 rounded-lg text-sm ${passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-gray-600">Mật khẩu cũ</Label>
                    <Input
                      type="password"
                      placeholder="Nhập mật khẩu cũ"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Mật khẩu mới</Label>
                    <Input
                      type="password"
                      placeholder="Nhập mật khẩu mới"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-sm text-gray-600">Xác nhận mật khẩu</Label>
                    <Input
                      type="password"
                      placeholder="Xác nhận mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  {changingPassword ? "Đang xử lý..." : "Đổi mật khẩu"}
                </Button>
              </div>

              {/* Logout Button */}
              <Button
                onClick={() => {
                  setIsProfileOpen(false)
                  handleLogout()
                }}
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50 rounded-lg"
              >
                Đăng xuất
              </Button>
            </TabsContent>

            {/* User Management Tab (Admin Only) */}
            {user?.role === "admin" && (
              <TabsContent value="users" className="space-y-4">
                {/* Create New User */}
                <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Tạo người dùng mới
                  </h4>

                  {userMessage && (
                    <div className={`p-3 rounded-lg text-sm ${userMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {userMessage.text}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-gray-600">Username</Label>
                      <Input
                        placeholder="Nhập username"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm text-gray-600">Tên hiển thị</Label>
                      <Input
                        placeholder="Nhập tên hiển thị"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm text-gray-600">Mật khẩu</Label>
                      <Input
                        type="password"
                        placeholder="Nhập mật khẩu"
                        value={newPassword2}
                        onChange={(e) => setNewPassword2(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-sm text-gray-600">Quyền</Label>
                      <Select value={newRole} onValueChange={(value: any) => setNewRole(value)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleCreateUser}
                    disabled={creatingUser}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg"
                  >
                    {creatingUser ? "Đang tạo..." : "Tạo người dùng"}
                  </Button>
                </div>

                {/* Users List */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900">Danh sách người dùng ({allUsers.length})</h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {allUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{u.displayName}</p>
                          <p className="text-sm text-gray-600">{u.username} • {u.role === 'admin' ? '👑 Admin' : '👤 Staff'}</p>
                        </div>
                        {u.username !== user?.username && (
                          <Button
                            onClick={() => handleDeleteUser(u.username)}
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
