"use client"

import { useState, useEffect, useCallback } from "react"
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
  Car,
  Users,
  ClipboardList,
  Filter,
  Settings,
  RefreshCw,
  Activity,
  Database
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface AccessLog {
  id: string
  username: string
  displayName: string
  action: string
  module: string
  details: string
  timestamp: string
  ipAddress?: string
}

const actionIconMap: Record<string, { icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  "Đăng nhập": { icon: LogIn, color: "text-emerald-600", bgColor: "bg-emerald-50/50", borderColor: "border-emerald-200" },
  "Đăng xuất": { icon: LogOut, color: "text-slate-600", bgColor: "bg-slate-50/50", borderColor: "border-slate-200" },
  "Thêm mới": { icon: Plus, color: "text-blue-600", bgColor: "bg-blue-50/50", borderColor: "border-blue-200" },
  "Chỉnh sửa": { icon: Pencil, color: "text-amber-600", bgColor: "bg-amber-50/50", borderColor: "border-amber-200" },
  "Xóa": { icon: Trash2, color: "text-blue-600", bgColor: "bg-blue-50/50", borderColor: "border-blue-200" },
  "Sao lưu": { icon: Database, color: "text-indigo-600", bgColor: "bg-indigo-50/50", borderColor: "border-indigo-200" },
  "Khôi phục": { icon: RefreshCw, color: "text-purple-600", bgColor: "bg-purple-50/50", borderColor: "border-purple-200" },
  "Xem": { icon: Eye, color: "text-slate-600", bgColor: "bg-slate-50/50", borderColor: "border-slate-200" },
}

const moduleIconMap: Record<string, { icon: React.ElementType; color: string }> = {
  "Hệ thống": { icon: Settings, color: "text-gray-600" },
  "Quản lý xe": { icon: Car, color: "text-blue-600" },
  "Quản lý khách hàng": { icon: Users, color: "text-emerald-600" },
  "Đơn thuê": { icon: ClipboardList, color: "text-amber-600" },
  "Báo cáo": { icon: FileText, color: "text-violet-600" },
  "Lịch sử truy cập": { icon: History, color: "text-purple-600" },
  "Quản lý người dùng": { icon: Users, color: "text-cyan-600" },
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

  const loadAccessLogs = useCallback(async (showLoading = true) => {
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
  }, [])

  // Load logs from Supabase
  useEffect(() => {
    loadAccessLogs(true)

    // Subscribe to real-time events for access_logs
    const channel = supabase
      .channel('access-logs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_logs' }, () => {
        loadAccessLogs(false)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadAccessLogs])

  // Get unique values for filters (filter out empty strings to prevent Select.Item crash)
  const accounts = Array.from(new Set(accessLogs.map(log => log.username))).filter(Boolean) as string[]
  const modules = Array.from(new Set(accessLogs.map(log => log.module))).filter(Boolean) as string[]
  const actions = Array.from(new Set(accessLogs.map(log => log.action))).filter(Boolean) as string[]

  // Filter logs
  const filteredLogs = accessLogs
    .filter(log => {
      const matchSearch = 
        (log.details || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.username || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.displayName || "").toLowerCase().includes(searchQuery.toLowerCase())
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

  const formatLogDetails = (text: string) => {
    if (!text) return ""
    
    // Split by | if present to handle the device info part separately
    const partsByPipe = text.split("|")
    const mainText = partsByPipe[0]
    const deviceInfo = partsByPipe.slice(1).join("|")
    
    const regex = /(\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b\d+\s*(?:khách|xe|đơn|ngày|giờ|phút|giây|cccd|đồng|đ|năm|tháng|km)\b|\b\d+\b)/gi
    const parts = mainText.split(regex)
    const formattedMainText = parts.map((part, index) => {
      if (regex.test(part)) {
        return <span key={index} className="font-semibold text-slate-800 bg-slate-100/70 px-1 py-0.5 rounded">{part}</span>
      }
      return part
    })
    
    if (deviceInfo) {
      return (
        <span className="flex flex-wrap items-center gap-1">
          <span>{formattedMainText}</span>
          <span className="text-slate-300 mx-1">|</span>
          <span className="font-medium text-slate-700 bg-slate-100/50 px-1.5 py-0.5 rounded border border-slate-200/50 text-[10px]">{deviceInfo.trim()}</span>
        </span>
      )
    }
    
    return formattedMainText
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Lịch Sử Truy Cập</h1>
          <p className="text-slate-500 text-xs mt-1">Theo dõi tất cả hoạt động trong hệ thống</p>
        </div>
        <Button
          onClick={() => loadAccessLogs()}
          variant="outline"
          size="icon"
          disabled={loading}
          className="w-9 h-9 border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl flex items-center justify-center shadow-sm"
          title="Làm mới"
        >
          <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white border-0 card-shadow rounded-2xl overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center w-full">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo tên, username, hoặc chi tiết..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 bg-gray-50 border-gray-200 rounded-xl"
              />
            </div>
            
            {/* Tài Khoản filter */}
            <div className="w-full lg:w-48">
              <Select value={filterAccount} onValueChange={(value) => {
                setFilterAccount(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Tài khoản" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
                  <SelectItem value="all">Tất Cả Tài Khoản</SelectItem>
                  {accounts.map(account => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mục filter */}
            <div className="w-full lg:w-48">
              <Select value={filterModule} onValueChange={(value) => {
                setFilterModule(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Mục" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
                  <SelectItem value="all">Tất Cả Mục</SelectItem>
                  {modules.map(module => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hành Động filter */}
            <div className="w-full lg:w-48">
              <Select value={filterAction} onValueChange={(value) => {
                setFilterAction(value)
                setCurrentPage(1)
              }}>
                <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                  <SelectValue placeholder="Hành động" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 rounded-xl">
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
      <Card className="bg-white border-0 card-shadow rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 pt-6 pb-4 px-6">
          <CardTitle className="text-slate-800 font-bold tracking-tight text-lg">Chi Tiết Hoạt Động</CardTitle>
          <CardDescription className="text-xs md:text-sm text-slate-500">
            Hiển thị {paginatedLogs.length} trên {filteredLogs.length} kết quả
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Không có dữ liệu lịch sử</p>
            </div>
          ) : (<>
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                    <TableHead className="w-48 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Thời gian</TableHead>
                    <TableHead className="w-56 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Người thực hiện</TableHead>
                    <TableHead className="w-64 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Hành động & Vị trí</TableHead>
                    <TableHead className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Chi tiết nội dung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => {
                    const actionConfig = actionIconMap[log.action] || {
                      icon: Activity,
                      color: "text-slate-600",
                      bgColor: "bg-slate-50/50",
                      borderColor: "border-slate-200"
                    }
                    const moduleConfig = moduleIconMap[log.module] || {
                      icon: Settings,
                      color: "text-slate-600"
                    }
                    // Dynamic action badge colors fallback based on action content
                    let actionBadgeColor = actionConfig.color
                    let actionBadgeBgColor = actionConfig.bgColor
                    let actionBadgeBorderColor = actionConfig.borderColor

                    if (log.action.includes("Xóa") || log.action.includes("Xoá")) {
                      actionBadgeColor = "text-red-700"
                      actionBadgeBgColor = "bg-red-50"
                      actionBadgeBorderColor = "border-red-100"
                    } else if (log.action.includes("Chỉnh sửa") || log.action.includes("Sửa")) {
                      actionBadgeColor = "text-amber-700"
                      actionBadgeBgColor = "bg-amber-50"
                      actionBadgeBorderColor = "border-amber-100"
                    } else if (log.action === "Đăng nhập" || log.action === "Thêm mới") {
                      actionBadgeColor = "text-emerald-700"
                      actionBadgeBgColor = "bg-emerald-50"
                      actionBadgeBorderColor = "border-emerald-100"
                    }

                    const ActionIcon = actionConfig.icon
                    const ModuleIcon = moduleConfig.icon

                    return (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Cột 1: Thời gian */}
                        <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </TableCell>
                        
                        {/* Cột 2: Người thực hiện */}
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 text-xs">{log.displayName || log.username}</span>
                            <span className="text-[10px] text-slate-400 font-mono">@{log.username}</span>
                          </div>
                        </TableCell>

                        {/* Cột 3: Hành động & Vị trí */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Action badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${actionBadgeBgColor} ${actionBadgeColor} ${actionBadgeBorderColor}`}>
                              <ActionIcon className="w-3 h-3" />
                              {log.action}
                            </span>
                            {/* Module badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-100">
                              <ModuleIcon className={`w-3 h-3 ${moduleConfig.color}`} />
                              {log.module}
                            </span>
                          </div>
                        </TableCell>

                        {/* Cột 4: Chi tiết nội dung */}
                        <TableCell className="text-xs text-slate-600 max-w-md">
                          <div className="space-y-1">
                            <div className="break-words leading-relaxed">{formatLogDetails(log.details)}</div>
                            {log.ipAddress && (
                              <p className="text-[10px] text-slate-400 font-mono">IP: {log.ipAddress}</p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card-based List View */}
            <div className="md:hidden space-y-4 p-4">
              {paginatedLogs.map((log) => {
                const actionConfig = actionIconMap[log.action] || {
                  icon: Activity,
                  color: "text-slate-600",
                  bgColor: "bg-slate-50/50",
                  borderColor: "border-slate-200"
                }
                const moduleConfig = moduleIconMap[log.module] || {
                  icon: Settings,
                  color: "text-slate-600"
                }
                // Dynamic action badge colors fallback based on action content
                let actionBadgeColor = actionConfig.color
                let actionBadgeBgColor = actionConfig.bgColor
                let actionBadgeBorderColor = actionConfig.borderColor

                if (log.action.includes("Xóa") || log.action.includes("Xoá")) {
                  actionBadgeColor = "text-red-700"
                  actionBadgeBgColor = "bg-red-50"
                  actionBadgeBorderColor = "border-red-100"
                } else if (log.action.includes("Chỉnh sửa") || log.action.includes("Sửa")) {
                  actionBadgeColor = "text-amber-700"
                  actionBadgeBgColor = "bg-amber-50"
                  actionBadgeBorderColor = "border-amber-100"
                } else if (log.action === "Đăng nhập" || log.action === "Thêm mới") {
                  actionBadgeColor = "text-emerald-700"
                  actionBadgeBgColor = "bg-emerald-50"
                  actionBadgeBorderColor = "border-emerald-100"
                }

                const ActionIcon = actionConfig.icon
                const ModuleIcon = moduleConfig.icon

                return (
                  <div 
                    key={log.id} 
                    className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl space-y-3 shadow-sm"
                  >
                    {/* Header: Action badges and timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100/50 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${actionBadgeBgColor} ${actionBadgeColor} ${actionBadgeBorderColor}`}>
                          <ActionIcon className="w-3 h-3" />
                          {log.action}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-100">
                          <ModuleIcon className={`w-3 h-3 ${moduleConfig.color}`} />
                          {log.module}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{formatDate(log.timestamp)}</span>
                    </div>

                    {/* Performer info */}
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs flex items-center justify-center uppercase">
                        {(log.displayName || log.username).charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{log.displayName || log.username}</span>
                        <span className="text-[9px] text-slate-400 font-mono">@{log.username}</span>
                      </div>
                    </div>

                    {/* Details content */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100/50 text-xs text-slate-600">
                      <div className="break-all leading-relaxed whitespace-pre-wrap">{formatLogDetails(log.details)}</div>
                      {log.ipAddress && (
                        <p className="text-[10px] text-slate-400 font-mono pt-1">IP: {log.ipAddress}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>)}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 p-4 gap-2 sm:gap-0">
              <div className="text-[11px] text-slate-500">
                <span>{(currentPage - 1) * itemsPerPage + 1}</span> - <span>{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</span> / <span>{filteredLogs.length}</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  ←
                </button>
                <div className="px-2 py-0.5 border border-slate-200 rounded-lg bg-slate-50">
                  <span className="text-[11px] font-bold text-slate-700">{currentPage}/{totalPages}</span>
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  →
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
