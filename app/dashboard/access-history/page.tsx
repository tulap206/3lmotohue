"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { 
  Search, 
  History, 
  LogIn, 
  LogOut, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  FileText,
  Bike,
  Users,
  ClipboardList,
  Filter,
  Settings,
  RefreshCw,
  Globe
} from "lucide-react"

interface AccessLog {
  id: string
  username: string
  displayname: string
  action: string
  module: string
  details: string
  timestamp: string
}

const actionIconMap: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  "Đăng nhập": { icon: LogIn, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  "Đăng xuất": { icon: LogOut, color: "text-gray-500", bgColor: "bg-gray-100" },
  "Thêm mới": { icon: Plus, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  "Chỉnh sửa": { icon: Pencil, color: "text-amber-600", bgColor: "bg-amber-50" },
  "Xóa": { icon: Trash2, color: "text-red-600", bgColor: "bg-red-50" },
  "Xem": { icon: Eye, color: "text-blue-600", bgColor: "bg-blue-50" },
  "Truy cập": { icon: Globe, color: "text-indigo-600", bgColor: "bg-indigo-50" },
}

const moduleIconMap: Record<string, { icon: React.ElementType; color: string }> = {
  "Hệ thống": { icon: Settings, color: "text-gray-600" },
  "Quản lý xe": { icon: Bike, color: "text-blue-600" },
  "Quản lý khách hàng": { icon: Users, color: "text-emerald-600" },
  "Đơn thuê": { icon: ClipboardList, color: "text-amber-600" },
  "Báo cáo": { icon: FileText, color: "text-violet-600" },
  "Lịch sử truy cập": { icon: History, color: "text-purple-600" },
  "Quản lý người dùng": { icon: Users, color: "text-cyan-600" },
  "Trang chủ": { icon: Globe, color: "text-indigo-600" },
}

export default function AccessHistoryPage() {
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAccount, setFilterAccount] = useState<string>("all")
  const [filterModule, setFilterModule] = useState<string>("all")
  const [filterAction, setFilterAction] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  const loadAccessLogs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      console.log("📋 Loading access logs from Supabase...")

      const { data, error } = await supabase
        .from("access_logs")
        .select("*")
        .order("timestamp", { ascending: false })

      if (error) {
        console.error("Error fetching logs:", error)
        setAccessLogs([])
      } else {
        console.log("📋 Logs loaded:", data?.length || 0, "records")
        setAccessLogs(data || [])
      }
    } catch (error) {
      console.error("Failed to load access logs:", error)
      setAccessLogs([])
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Load logs from Supabase
  useEffect(() => {
    loadAccessLogs(true)

    // Subscribe to real-time events for access_logs
    const logsChannel = supabase
      .channel('access-logs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_logs' }, () => {
        loadAccessLogs(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(logsChannel)
    }
  }, [])

  // Get unique values for filters
  const accounts = Array.from(new Set(accessLogs.map(log => log.username)))
  const modules = Array.from(new Set(accessLogs.map(log => log.module)))
  const actions = Array.from(new Set(accessLogs.map(log => log.action)))

  // Filter logs
  const filteredLogs = accessLogs
    .filter(log => {
      const matchSearch = 
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.displayname.toLowerCase().includes(searchQuery.toLowerCase())
      const matchAccount = filterAccount === "all" || log.username === filterAccount
      const matchModule = filterModule === "all" || log.module === filterModule
      const matchAction = filterAction === "all" || log.action === filterAction
      return matchSearch && matchAccount && matchModule && matchAction
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lịch Sử Truy Cập</h1>
          <p className="text-gray-600 mt-1">Theo dõi tất cả hoạt động trong hệ thống</p>
        </div>
        <Button
          onClick={loadAccessLogs}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lọc Lịch Sử</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center">
            <Search className="w-4 h-4 text-gray-400" />
            <Input
              placeholder="Tìm kiếm theo tên, username, hoặc chi tiết..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="flex-1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Tài Khoản</label>
              <Select value={filterAccount} onValueChange={(value) => {
                setFilterAccount(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất Cả Tài Khoản</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Mục</label>
              <Select value={filterModule} onValueChange={(value) => {
                setFilterModule(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất Cả Mục</SelectItem>
                  {modules.map(module => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Hành Động</label>
              <Select value={filterAction} onValueChange={(value) => {
                setFilterAction(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất Cả Hành Động</SelectItem>
                  {actions.map(action => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chi Tiết Hoạt Động</CardTitle>
          <CardDescription>
            Hiển thị {paginatedLogs.length} trên {filteredLogs.length} kết quả
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Không có dữ liệu lịch sử</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-x-auto">
              {paginatedLogs.map((log) => {
                const actionConfig = actionIconMap[log.action]
                const moduleConfig = moduleIconMap[log.module]
                const ActionIcon = actionConfig?.icon || Eye
                const ModuleIcon = moduleConfig?.icon || Settings

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border ${actionConfig?.bgColor || "bg-gray-50"}`}
                  >
                    <div className={`flex-shrink-0 p-2 rounded-lg ${actionConfig?.bgColor}`}>
                      <ActionIcon className={`w-5 h-5 ${actionConfig?.color || "text-gray-600"}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{log.displayname}</span>
                        <span className="text-sm text-gray-600">({log.username})</span>
                        <span className="font-medium text-gray-700">{log.action}</span>
                        <div className="flex items-center gap-1">
                          <ModuleIcon className={`w-4 h-4 ${moduleConfig?.color || "text-gray-600"}`} />
                          <span className="text-sm text-gray-600">{log.module}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{log.details}</p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                        <span>{formatDate(log.timestamp)}</span>
                        {log.ipAddress && <span>• IP: {log.ipAddress}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Trang {currentPage} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                >
                  Trước
                </Button>
                <Button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                >
                  Tiếp
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
