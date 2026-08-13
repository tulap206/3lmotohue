"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Shield, User, Lock } from "lucide-react"
import { ModuleMobileCard, ModulePageShell, ModuleResponsiveTable, ModuleSubpageHeader } from "@/components/dashboard/module-shell"

interface UserAccount {
  id: string
  username: string
  displayName: string
  role: "admin" | "staff"
  permissions: {
    canDelete: boolean
  }
  createdAt?: string
}

const DEFAULT_USERS: UserAccount[] = [
  {
    id: "1",
    username: "admin",
    displayName: "Admin",
    role: "admin",
    permissions: { canDelete: true },
  },
  {
    id: "2",
    username: "loca",
    displayName: "Lộc A",
    role: "staff",
    permissions: { canDelete: false },
  },
  {
    id: "3",
    username: "locb",
    displayName: "Lộc B",
    role: "staff",
    permissions: { canDelete: false },
  },
  {
    id: "4",
    username: "sang",
    displayName: "Sang",
    role: "staff",
    permissions: { canDelete: false },
  },
  {
    id: "5",
    username: "huy",
    displayName: "Huy",
    role: "staff",
    permissions: { canDelete: false },
  },
]

export default function UsersPage() {
  const router = useRouter()
  const { user, addAccessLog } = useAuth()
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_USERS)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    role: "staff" as "admin" | "staff",
    canDelete: false,
  })
  const [showAccessDenied, setShowAccessDenied] = useState(false)

  useEffect(() => {
    // Check if user is admin
    if (!user || user.role !== "admin") {
      setShowAccessDenied(true)
      const timer = setTimeout(() => {
        router.push("/dashboard")
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [user, router])

  if (!user) return null

  if (user.role !== "admin") {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto">
          <Card className="border-rose-200 bg-rose-50">
            <CardHeader>
              <CardTitle className="text-rose-600 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Không Có Quyền Truy Cập
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-rose-700 mb-4">
                Bạn không có quyền truy cập mục này. Chỉ Admin mới có thể quản lý tài khoản người dùng.
              </p>
              <p className="text-sm text-rose-600">
                Bạn sẽ được chuyển hướng về Dashboard trong 3 giây...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username || !formData.displayName) {
      alert("Vui lòng điền đầy đủ thông tin")
      return
    }

    try {
      if (editingUser) {
        // Check if trying to remove admin role from last admin
        if (editingUser.role === "admin" && formData.role === "staff") {
          const adminCount = users.filter((u) => u.role === "admin").length
          if (adminCount === 1) {
            alert("Không thể xóa quyền admin khỏi tài khoản admin duy nhất!")
            return
          }
        }

        const updatedUsers = users.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                displayName: formData.displayName,
                role: formData.role,
                permissions: { canDelete: formData.canDelete },
              }
            : u
        )
        setUsers(updatedUsers)
        addAccessLog(
          "Chỉnh sửa",
          "Quản lý người dùng",
          `Sửa tài khoản: ${formData.username} - Role: ${formData.role}`
        )
      } else {
        // Check if username already exists
        if (users.some((u) => u.username === formData.username)) {
          alert("Tên đăng nhập đã tồn tại!")
          return
        }

        const newUser: UserAccount = {
          id: Date.now().toString(),
          username: formData.username,
          displayName: formData.displayName,
          role: formData.role,
          permissions: { canDelete: formData.canDelete },
          createdAt: new Date().toISOString(),
        }
        setUsers([...users, newUser])
        addAccessLog(
          "Thêm mới",
          "Quản lý người dùng",
          `Tạo tài khoản: ${formData.username} - Role: ${formData.role}`
        )
      }
      resetForm()
    } catch (error) {
      console.error("Error saving user:", error)
      alert("Lỗi khi lưu tài khoản")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const userToDelete = users.find((u) => u.id === id)
      
      if (!userToDelete) return

      // Check if trying to delete last admin
      if (userToDelete.role === "admin") {
        const adminCount = users.filter((u) => u.role === "admin").length
        if (adminCount === 1) {
          alert("Không thể xóa tài khoản admin duy nhất!")
          return
        }
      }

      // Check if trying to delete own account
      if (userToDelete.id === user.id) {
        alert("Không thể xóa tài khoản của chính mình!")
        return
      }

      const updatedUsers = users.filter((u) => u.id !== id)
      setUsers(updatedUsers)
      addAccessLog(
        "Xóa",
        "Quản lý người dùng",
        `Xóa tài khoản: ${userToDelete.username}`
      )
    } catch (error) {
      console.error("Error deleting user:", error)
      alert("Lỗi khi xóa tài khoản")
    }
  }

  const resetForm = () => {
    setFormData({
      username: "",
      displayName: "",
      role: "staff",
      canDelete: false,
    })
    setEditingUser(null)
    setIsDialogOpen(false)
  }

  const handleEdit = (userAccount: UserAccount) => {
    setEditingUser(userAccount)
    setFormData({
      username: userAccount.username,
      displayName: userAccount.displayName,
      role: userAccount.role,
      canDelete: userAccount.permissions.canDelete,
    })
    setIsDialogOpen(true)
  }

  return (
    <ModulePageShell module="rental">
      <ModuleSubpageHeader
        module="rental"
        title="Quản lý người dùng"
        subtitle="Tài khoản và phân quyền nhân viên"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Người dùng" },
        ]}
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => resetForm()}
                className="h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-[var(--radius-control)] w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Thêm người dùng
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Chỉnh Sửa Tài Khoản" : "Tạo Tài Khoản Mới"}</DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Cập nhật thông tin tài khoản người dùng"
                  : "Tạo một tài khoản người dùng mới trong hệ thống"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Tên Đăng Nhập</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="admin, loca, locb..."
                  disabled={!!editingUser}
                  required
                />
              </div>

              <div>
                <Label htmlFor="displayName">Tên Hiển Thị</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="Admin, Lộc A, Lộc B..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="role">Vai Trò</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as "admin" | "staff",
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin (Quyền Đầy Đủ)</option>
                  <option value="staff">Staff (Quyền Hạn Chế)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="canDelete"
                  type="checkbox"
                  checked={formData.canDelete}
                  onChange={(e) => setFormData({ ...formData, canDelete: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="canDelete">Cho phép xóa dữ liệu</Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Hủy
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  {editingUser ? "Cập Nhật" : "Tạo Tài Khoản"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        }
      />

      <Card>
        <CardContent className="p-0">
          <ModuleResponsiveTable
            desktop={
            <table className="w-full">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                    Tên Đăng Nhập
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                    Tên Hiển Thị
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                    Vai Trò
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-600">
                    Quyền Xóa
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-slate-600">
                    Hành Động
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((userAccount) => (
                  <tr key={userAccount.id} className="border-b hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {userAccount.role === "admin" ? (
                          <Shield className="w-4 h-4 text-blue-600" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="font-medium text-slate-900">
                          {userAccount.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{userAccount.displayName}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                          userAccount.role === "admin"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {userAccount.role === "admin" ? "Admin" : "Staff"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                          userAccount.permissions.canDelete
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {userAccount.permissions.canDelete ? "Có" : "Không"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button
                        onClick={() => handleEdit(userAccount)}
                        variant="outline"
                        size="sm"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa Tài Khoản?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bạn có chắc muốn xóa tài khoản "{userAccount.username}"? Hành động này
                              không thể hoàn tác.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(userAccount.id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              Xóa
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            }
            mobile={
              <>
                {users.map((userAccount) => (
                  <ModuleMobileCard key={userAccount.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body font-semibold text-slate-800 flex items-center gap-2">
                          {userAccount.role === "admin" ? (
                            <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          {userAccount.displayName}
                        </p>
                        <p className="text-meta font-mono mt-0.5">@{userAccount.username}</p>
                      </div>
                      <span className="text-label font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] bg-slate-100 text-slate-700">
                        {userAccount.role === "admin" ? "Admin" : "Nhân viên"}
                      </span>
                    </div>
                    <p className="text-meta">Xóa dữ liệu: {userAccount.permissions.canDelete ? "Có" : "Không"}</p>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={() => handleEdit(userAccount)} variant="outline" className="h-11 flex-1 rounded-[var(--radius-control)]">
                        <Pencil className="w-4 h-4 mr-1.5" />
                        Sửa
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" className="h-11 flex-1 rounded-[var(--radius-control)] text-rose-600 border-rose-200">
                            <Trash2 className="w-4 h-4 mr-1.5" />
                            Xóa
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xóa tài khoản?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Xóa tài khoản {userAccount.username}? Không hoàn tác được.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="h-11">Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(userAccount.id)}
                              className="h-11 bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              Xóa
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </ModuleMobileCard>
                ))}
              </>
            }
          />
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-title text-blue-900">Thông tin quan trọng</CardTitle>
        </CardHeader>
        <CardContent className="text-body text-blue-800 space-y-2">
          <p>Admin: quyền đầy đủ, quản lý người dùng.</p>
          <p>Nhân viên: quyền hạn chế, không xóa dữ liệu trừ khi được cấp.</p>
          <p>Không xóa admin duy nhất hoặc tài khoản đang đăng nhập.</p>
        </CardContent>
      </Card>
    </ModulePageShell>
  )
}
