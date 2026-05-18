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
    role: "staff" as const,
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
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Không Có Quyền Truy Cập
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-700 mb-4">
                Bạn không có quyền truy cập mục này. Chỉ Admin mới có thể quản lý tài khoản người dùng.
              </p>
              <p className="text-sm text-red-600">
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản Lý Người Dùng</h1>
          <p className="text-gray-600 mt-1">Quản lý tài khoản và phân quyền người dùng</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => resetForm()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Thêm Người Dùng
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingUser ? "Cập Nhật" : "Tạo Tài Khoản"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">
                    Tên Đăng Nhập
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">
                    Tên Hiển Thị
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">
                    Vai Trò
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600">
                    Quyền Xóa
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-600">
                    Hành Động
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((userAccount) => (
                  <tr key={userAccount.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {userAccount.role === "admin" ? (
                          <Shield className="w-4 h-4 text-blue-600" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900">
                          {userAccount.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{userAccount.displayName}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          userAccount.role === "admin"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {userAccount.role === "admin" ? "Admin" : "Staff"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          userAccount.permissions.canDelete
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
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
                          <Button variant="outline" size="sm" className="text-red-600">
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
                              className="bg-red-600"
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
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-900">Thông Tin Quan Trọng</CardTitle>
        </CardHeader>
        <CardContent className="text-blue-800 space-y-2">
          <p>• Admin: Quyền đầy đủ truy cập toàn bộ hệ thống và quản lý người dùng</p>
          <p>• Staff: Quyền hạn chế, không thể xóa dữ liệu (tùy thuộc vào cài đặt)</p>
          <p>• Không thể xóa tài khoản admin duy nhất</p>
          <p>• Không thể xóa tài khoản của chính mình</p>
        </CardContent>
      </Card>
    </div>
  )
}
