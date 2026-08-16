"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  UserCheck,
  Pencil,
  Trash2,
  Lock,
  Search,
  CheckCircle2,
  XCircle,
  KeyRound,
  Database,
  History,
} from "lucide-react"

export interface UserAccount {
  id: string
  username: string
  displayName: string
  role: "admin" | "staff"
  permissions: {
    canDelete: boolean
    canBackup: boolean
    canViewAccessHistory: boolean
  }
  createdAt?: string
}

interface UserAccountsModalProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function UserAccountsModal({ open: externalOpen, onOpenChange: externalOnOpenChange, trigger }: UserAccountsModalProps) {
  const { user, addAccessLog } = useAuth()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = externalOpen !== undefined
  const isOpen = isControlled ? externalOpen : internalOpen

  const setIsOpen = (val: boolean) => {
    if (externalOnOpenChange) {
      externalOnOpenChange(val)
    } else {
      setInternalOpen(val)
    }
  }

  const [users, setUsers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null)
  const [formData, setFormData] = useState({
    username: "",
    displayName: "",
    role: "staff" as "admin" | "staff",
    canDelete: false,
    canBackup: false,
    canViewAccessHistory: true,
    password: "",
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/auth/users")
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const mappedUsers: UserAccount[] = data.users.map((u: any) => ({
            id: u.id,
            username: u.username,
            displayName: u.displayname,
            role: u.role,
            permissions: {
              canDelete: !!u.can_delete,
              canBackup: !!u.can_backup,
              canViewAccessHistory: u.can_view_access_history !== false,
            },
            createdAt: u.created_at,
          }))
          setUsers(mappedUsers)
        }
      }
    } catch (err) {
      console.error("Error loading users in modal:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormData({
      username: "",
      displayName: "",
      role: "staff",
      canDelete: false,
      canBackup: false,
      canViewAccessHistory: true,
      password: "",
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (userAccount: UserAccount) => {
    setEditingUser(userAccount)
    setFormData({
      username: userAccount.username,
      displayName: userAccount.displayName,
      role: userAccount.role,
      canDelete: userAccount.permissions.canDelete,
      canBackup: userAccount.permissions.canBackup,
      canViewAccessHistory: userAccount.permissions.canViewAccessHistory,
      password: "",
    })
    setFormError(null)
    setIsFormOpen(true)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!formData.username.trim() || !formData.displayName.trim()) {
      setFormError("Vui lòng điền đầy đủ tên đăng nhập và tên hiển thị")
      return
    }

    if (!editingUser && !formData.password) {
      setFormError("Mật khẩu không được để trống khi tạo tài khoản mới")
      return
    }

    if (formData.password && formData.password.length < 6) {
      setFormError("Mật khẩu phải chứa ít nhất 6 ký tự")
      return
    }

    try {
      setSubmitting(true)
      if (editingUser) {
        // Prevent removing admin from last admin
        if (editingUser.role === "admin" && formData.role === "staff") {
          const adminCount = users.filter((u) => u.role === "admin").length
          if (adminCount <= 1) {
            setFormError("Không thể xóa quyền admin của tài khoản quản trị duy nhất!")
            setSubmitting(false)
            return
          }
        }

        const res = await fetch(`/api/auth/users/${editingUser.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: formData.displayName,
            role: formData.role,
            canDelete: formData.canDelete,
            canBackup: formData.canBackup,
            canViewAccessHistory: formData.canViewAccessHistory,
            password: formData.password || undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Lỗi khi cập nhật tài khoản")

        addAccessLog(
          "Chỉnh sửa",
          "Cài đặt - Người dùng",
          `Cập nhật tài khoản: ${formData.username} (${formData.displayName})`
        )
      } else {
        const res = await fetch("/api/auth/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: formData.username,
            displayName: formData.displayName,
            role: formData.role,
            canDelete: formData.canDelete,
            canBackup: formData.canBackup,
            canViewAccessHistory: formData.canViewAccessHistory,
            password: formData.password,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Lỗi khi tạo tài khoản")

        addAccessLog(
          "Thêm mới",
          "Cài đặt - Người dùng",
          `Tạo tài khoản mới: ${formData.username} (${formData.displayName})`
        )
      }

      setIsFormOpen(false)
      await loadUsers()
    } catch (err: any) {
      console.error("Error submitting user form:", err)
      setFormError(err.message || "Đã xảy ra lỗi khi lưu thông tin")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async (userToDelete: UserAccount) => {
    // Validation
    if (userToDelete.role === "admin") {
      const adminCount = users.filter((u) => u.role === "admin").length
      if (adminCount <= 1) {
        alert("Không thể xóa tài khoản admin duy nhất trong hệ thống!")
        return
      }
    }

    if (user && userToDelete.id === user.id) {
      alert("Bạn không thể xóa tài khoản của chính mình!")
      return
    }

    try {
      const res = await fetch(`/api/auth/users/${userToDelete.id}`, {
        method: "DELETE",
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Lỗi khi xóa tài khoản")

      addAccessLog(
        "Xóa",
        "Cài đặt - Người dùng",
        `Xóa tài khoản: ${userToDelete.username}`
      )
      await loadUsers()
    } catch (err: any) {
      console.error("Error deleting user:", err)
      alert(err.message || "Không thể xóa tài khoản này")
    }
  }

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // KPIs
  const totalAccounts = users.length
  const adminCount = users.filter((u) => u.role === "admin").length
  const staffCount = users.filter((u) => u.role === "staff").length
  const canDeleteCount = users.filter((u) => u.permissions.canDelete).length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-[var(--radius-container)] gap-4">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Thống kê & Quản lý Tài khoản
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Danh sách tài khoản, vai trò và phân quyền quản trị trong hệ thống
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* KPI Cards Thống Kê */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-slate-50/80 border-slate-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">Tổng tài khoản</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 money mt-0.5">{totalAccounts}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100/70 text-blue-600 shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50/60 border-blue-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 truncate">Quản trị viên</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-900 money mt-0.5">{adminCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-200/80 text-blue-800 shrink-0">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50/60 border-emerald-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 truncate">Nhân viên</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-900 money mt-0.5">{staffCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-200/80 text-emerald-800 shrink-0">
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-50/60 border-amber-200">
            <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 truncate">Quyền xóa dữ liệu</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-900 money mt-0.5">{canDeleteCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-200/80 text-amber-800 shrink-0">
                <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc username..."
              className="pl-9 h-10 bg-white border-slate-200 text-sm rounded-[var(--radius-control)]"
            />
          </div>
          <Button
            onClick={handleOpenCreate}
            className="h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-[var(--radius-control)] font-medium text-sm gap-2 shrink-0 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            Thêm tài khoản mới
          </Button>
        </div>

        {/* Desktop & Tablet Table / Mobile List */}
        <div className="border border-slate-200 rounded-[var(--radius-container)] overflow-hidden bg-white">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Đang tải danh sách tài khoản...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {searchQuery ? "Không tìm thấy tài khoản phù hợp" : "Chưa có tài khoản nào"}
            </div>
          ) : (
            <>
              {/* Table view for desktop/tablet */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                      <th className="py-3 px-4 min-w-[150px]">Tên Đăng Nhập</th>
                      <th className="py-3 px-4 min-w-[140px]">Tên Hiển Thị</th>
                      <th className="py-3 px-4 min-w-[110px]">Vai Trò</th>
                      <th className="py-3 px-4 min-w-[250px]">Phân Quyền Bổ Sung</th>
                      <th className="py-3 px-4 text-right w-36 min-w-[130px]">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((account) => {
                      const isSelf = user?.id === account.id
                      return (
                        <tr key={account.id} className="hover:bg-slate-50/60 ui-transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {account.role === "admin" ? (
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                  <Shield className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  {account.displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-900 font-mono text-sm block truncate">@{account.username}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold inline-block">
                                    Bạn
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-800 font-medium whitespace-nowrap">
                            {account.displayName}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {account.role === "admin" ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                <Shield className="w-3 h-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                Nhân viên
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${
                                  account.permissions.canDelete
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                                }`}
                              >
                                {account.permissions.canDelete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                Xóa dữ liệu
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${
                                  account.permissions.canBackup
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                                }`}
                              >
                                {account.permissions.canBackup ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                Sao lưu
                              </span>

                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${
                                  account.permissions.canViewAccessHistory
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                                }`}
                              >
                                {account.permissions.canViewAccessHistory ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                Xem lịch sử
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                onClick={() => handleOpenEdit(account)}
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-100 rounded-[var(--radius-control)]"
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                Sửa & Quyền
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isSelf}
                                    className="h-8 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-[var(--radius-control)] disabled:opacity-40"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Xóa tài khoản người dùng?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Bạn có chắc muốn xóa tài khoản <strong>@{account.username}</strong> ({account.displayName})? Hành động này không thể hoàn tác.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="h-10">Hủy</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(account)}
                                      className="h-10 bg-rose-600 hover:bg-rose-700 text-white"
                                    >
                                      Xóa tài khoản
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Card view for mobile screens */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredUsers.map((account) => {
                  const isSelf = user?.id === account.id
                  return (
                    <div key={account.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {account.role === "admin" ? (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <Shield className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {account.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{account.displayName}</p>
                            <p className="text-xs font-mono text-slate-500">
                              @{account.username}
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-semibold">
                                  Bạn
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {account.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            Nhân viên
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                            account.permissions.canDelete
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                          }`}
                        >
                          {account.permissions.canDelete ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Xóa dữ liệu
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                            account.permissions.canBackup
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                          }`}
                        >
                          {account.permissions.canBackup ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Sao lưu
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${
                            account.permissions.canViewAccessHistory
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-slate-50 text-slate-400 border-slate-200 opacity-60"
                          }`}
                        >
                          {account.permissions.canViewAccessHistory ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          Xem lịch sử
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          onClick={() => handleOpenEdit(account)}
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 text-xs text-slate-700 border-slate-200 hover:bg-slate-100 rounded-[var(--radius-control)]"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          Sửa & Phân quyền
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSelf}
                              className="h-9 px-3 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-[var(--radius-control)] disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Xóa
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa tài khoản người dùng?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc muốn xóa tài khoản <strong>@{account.username}</strong> ({account.displayName})? Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="h-10">Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(account)}
                                className="h-10 bg-rose-600 hover:bg-rose-700 text-white"
                              >
                                Xóa tài khoản
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Dialog Form Thêm / Sửa Tài khoản & Phân quyền */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="w-[95vw] sm:max-w-lg p-5 sm:p-6 rounded-[var(--radius-container)] gap-4">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {editingUser ? <Pencil className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                {editingUser ? `Chỉnh sửa tài khoản @${editingUser.username}` : "Tạo tài khoản mới"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {editingUser
                  ? "Cập nhật thông tin tài khoản và điều chỉnh phân quyền hoạt động"
                  : "Thêm người dùng mới vào hệ thống và phân quyền truy cập"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitForm} className="space-y-4 pt-1">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal-username" className="text-xs font-semibold text-slate-700">Tên Đăng Nhập</Label>
                  <Input
                    id="modal-username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="ví dụ: nyan, quan..."
                    disabled={!!editingUser}
                    className="mt-1 h-10 text-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="modal-displayName" className="text-xs font-semibold text-slate-700">Tên Hiển Thị</Label>
                  <Input
                    id="modal-displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="ví dụ: Nguyễn Văn A..."
                    className="mt-1 h-10 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal-password" className="text-xs font-semibold text-slate-700">
                    {editingUser ? "Mật khẩu mới (Để trống giữ nguyên)" : "Mật khẩu"}
                  </Label>
                  <Input
                    id="modal-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="mt-1 h-10 text-sm"
                    required={!editingUser}
                  />
                </div>

                <div>
                  <Label htmlFor="modal-role" className="text-xs font-semibold text-slate-700">Vai Trò Hệ Thống</Label>
                  <select
                    id="modal-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as "admin" | "staff" })}
                    className="mt-1 w-full h-10 px-3 bg-white border border-slate-200 rounded-[var(--radius-control)] text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="staff">Nhân viên (Staff)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>
              </div>

              {/* Phân quyền nâng cao */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                  Cấu hình phân quyền bổ sung
                </Label>

                <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                  <input
                    type="checkbox"
                    checked={formData.canDelete}
                    onChange={(e) => setFormData({ ...formData, canDelete: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      Quyền xóa dữ liệu
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Cho phép thực hiện thao tác xóa đơn hàng, khách hàng, xe</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                  <input
                    type="checkbox"
                    checked={formData.canBackup}
                    onChange={(e) => setFormData({ ...formData, canBackup: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Quyền sao lưu dữ liệu
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Cho phép tạo và tải file sao lưu dữ liệu hệ thống</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer ui-transition">
                  <input
                    type="checkbox"
                    checked={formData.canViewAccessHistory}
                    onChange={(e) => setFormData({ ...formData, canViewAccessHistory: e.target.checked })}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      Quyền xem lịch sử hoạt động
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Cho phép truy cập nhật ký hoạt động hệ thống</p>
                  </div>
                </label>
              </div>

              <DialogFooter className="pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  className="h-10 text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
                >
                  {submitting ? "Đang lưu..." : editingUser ? "Cập Nhật Tài Khoản" : "Tạo Tài Khoản"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
