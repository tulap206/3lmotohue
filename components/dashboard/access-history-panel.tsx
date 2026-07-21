"use client"

import { useState, useMemo } from "react"
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
  Settings,
  RefreshCw,
  Activity,
  Database,
  Wallet,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDisplayDateTime } from "@/lib/format-date"

export interface AccessLogRecord {
  id: string
  username: string
  displayName: string
  action: string
  module: string
  details: string
  timestamp: string
  ipAddress?: string
  created_at?: string
}

export type AccessHistoryModuleKey = "rental" | "sales" | "pawnshop" | "loan"
type AccessHistoryLayout = "page" | "embedded"
type AccessHistoryAccent = "red" | "blue" | "amber" | "emerald" | "violet"

const EMBEDDED_ROWS = 10
const PAGE_ROWS = 12

const MODULE_CONFIG: Record<
  AccessHistoryModuleKey,
  {
    accent: AccessHistoryAccent
    layout: AccessHistoryLayout
    title: string
    description: string
    scopeLabel: string
    hideModuleFilter: boolean
  }
> = {
  rental: {
    accent: "blue",
    layout: "page",
    title: "Lịch sử truy cập",
    description: "Theo dõi hoạt động phân hệ cho thuê",
    scopeLabel: "Cho thuê xe",
    hideModuleFilter: true,
  },
  sales: {
    accent: "blue",
    layout: "embedded",
    title: "Lịch sử truy cập",
    description: "Theo dõi hoạt động phân hệ mua bán xe",
    scopeLabel: "Mua bán xe",
    hideModuleFilter: true,
  },
  pawnshop: {
    accent: "amber",
    layout: "embedded",
    title: "Lịch sử truy cập",
    description: "Theo dõi hoạt động phân hệ cầm đồ",
    scopeLabel: "Cầm đồ",
    hideModuleFilter: true,
  },
  loan: {
    accent: "emerald",
    layout: "embedded",
    title: "Lịch sử truy cập",
    description: "Theo dõi hoạt động phân hệ cho vay",
    scopeLabel: "Cho vay",
    hideModuleFilter: true,
  },
}

const layoutHeight: Record<AccessHistoryLayout, string> = {
  page: "h-[calc(100dvh-7rem)] max-h-[calc(100dvh-7rem)]",
  embedded: "",
}

const accentStyles: Record<
  AccessHistoryAccent,
  { stripe: string; ring: string; badge: string; icon: string }
> = {
  red: {
    stripe: "from-red-400 to-red-600",
    ring: "ring-red-500/20",
    badge: "bg-red-50 text-red-700 border-red-100",
    icon: "text-red-600 bg-red-50",
  },
  blue: {
    stripe: "from-blue-400 to-blue-600",
    ring: "ring-blue-500/20",
    badge: "bg-blue-50 text-blue-700 border-blue-100",
    icon: "text-blue-600 bg-blue-50",
  },
  amber: {
    stripe: "from-amber-400 to-amber-500",
    ring: "ring-amber-500/20",
    badge: "bg-amber-50 text-amber-800 border-amber-100",
    icon: "text-amber-600 bg-amber-50",
  },
  emerald: {
    stripe: "from-emerald-400 to-emerald-600",
    ring: "ring-emerald-500/20",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
    icon: "text-emerald-600 bg-emerald-50",
  },
  violet: {
    stripe: "from-violet-400 to-violet-650 to-violet-600",
    ring: "ring-violet-500/20",
    badge: "bg-violet-50 text-violet-750 text-violet-700 border-violet-100",
    icon: "text-violet-600 bg-violet-50",
  },
}

const actionIconMap: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  "Đăng nhập": { icon: LogIn, color: "text-emerald-700", bg: "bg-emerald-50" },
  "Đăng xuất": { icon: LogOut, color: "text-slate-600", bg: "bg-slate-100" },
  "Thêm mới": { icon: Plus, color: "text-blue-700", bg: "bg-blue-50" },
  "Chỉnh sửa": { icon: Pencil, color: "text-amber-700", bg: "bg-amber-50" },
  "Xóa": { icon: Trash2, color: "text-red-700", bg: "bg-red-50" },
  "Xoá": { icon: Trash2, color: "text-red-700", bg: "bg-red-50" },
  "Sao lưu": { icon: Database, color: "text-indigo-700", bg: "bg-indigo-50" },
  "Sao lưu dữ liệu": { icon: Database, color: "text-indigo-700", bg: "bg-indigo-50" },
  "Sao lưu tự động": { icon: Database, color: "text-indigo-700", bg: "bg-indigo-50" },
  "Khôi phục": { icon: RefreshCw, color: "text-violet-700", bg: "bg-violet-50" },
  "Khôi phục dữ liệu": { icon: RefreshCw, color: "text-violet-700", bg: "bg-violet-50" },
  "Xem": { icon: Eye, color: "text-slate-600", bg: "bg-slate-100" },
}

const moduleIconMap: Record<string, { icon: React.ElementType; color: string }> = {
  "Hệ thống": { icon: Settings, color: "text-slate-500" },
  "Quản lý xe": { icon: Car, color: "text-red-600" },
  "Quản lý khách hàng": { icon: Users, color: "text-emerald-600" },
  "Đơn thuê": { icon: ClipboardList, color: "text-amber-600" },
  "Cho vay": { icon: Wallet, color: "text-emerald-600" },
  "Cầm đồ": { icon: Wallet, color: "text-amber-600" },
  "Mua bán xe": { icon: Car, color: "text-blue-600" },
  "Báo cáo": { icon: FileText, color: "text-violet-600" },
  "Lịch sử truy cập": { icon: History, color: "text-purple-600" },
  "Quản lý người dùng": { icon: Users, color: "text-cyan-600" },
}

function normalizeLog(log: AccessLogRecord): AccessLogRecord {
  return {
    ...log,
    timestamp: log.timestamp || log.created_at || "",
    username: log.username || "",
    displayName: log.displayName || log.username || "",
    details: log.details || "",
    module: log.module || "",
    action: log.action || "",
  }
}

function getModuleLabel(mod: string) {
  const lower = mod.toLowerCase()
  if (lower === "rental" || lower.includes("thuê xe") || lower.includes("đơn thuê") || lower.includes("khách thuê") || lower.includes("quản lý xe")) return "Cho thuê xe"
  if (lower === "sales" || lower.includes("mua bán") || lower.includes("xe máy") || lower.includes("khách hàng")) return "Mua bán xe"
  if (lower === "pawnshop" || lower.includes("cầm đồ") || lower.includes("đồ cầm") || lower.includes("khách cầm") || lower.includes("đơn cầm")) return "Cầm đồ"
  if (lower === "loan" || lower.includes("cho vay") || lower.includes("khách vay") || lower.includes("đơn vay")) return "Cho vay"
  if (lower === "system" || lower.includes("hệ thống") || lower.includes("tài khoản") || lower.includes("sao lưu") || lower.includes("cài đặt") || lower === "settings") return "Cài đặt hệ thống"
  return "Cài đặt hệ thống"
}

function getActionLabel(act: string) {
  const lower = act.toLowerCase()
  if (lower.includes("đăng nhập") || lower === "login") return "Đăng nhập"
  if (lower.includes("đăng xuất") || lower === "logout") return "Đăng xuất"
  if (lower.includes("thêm") || lower.includes("tạo") || lower === "insert" || lower === "create") return "Thêm mới"
  if (lower.includes("sửa") || lower.includes("cập nhật") || lower === "edit" || lower === "update") return "Chỉnh sửa"
  if (lower.includes("xóa") || lower.includes("xoá") || lower === "delete" || lower === "remove") return "Xóa"
  return act
}

function formatCompactDate(dateString: string) {
  return formatDisplayDateTime(dateString)
}

function panelShellClass(layout: AccessHistoryLayout) {
  if (layout === "embedded") return "access-history-panel flex flex-col"
  return cn("access-history-panel flex min-h-0 flex-col", layoutHeight[layout])
}

export function AccessHistoryDenied({
  layout = "embedded",
  message = "Bạn không có quyền xem lịch sử truy cập phân hệ này.",
}: {
  layout?: AccessHistoryLayout
  message?: string
}) {
  return (
    <div className={panelShellClass(layout)}>
      <div className="module-card flex flex-1 flex-col items-center justify-center rounded-xl border border-red-100 bg-red-50/30 px-6 py-10 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-red-500" />
        <h3 className="text-sm font-bold text-red-800">Truy cập bị hạn chế</h3>
        <p className="mt-1 text-sm text-red-600">{message}</p>
      </div>
    </div>
  )
}

export function AccessHistoryModuleSection({
  module,
  logs,
  loading,
  onRefresh,
  allowed,
  itemsPerPage,
  dbUsers = [],
}: {
  module: AccessHistoryModuleKey
  logs: AccessLogRecord[]
  loading: boolean
  onRefresh: () => void
  allowed: boolean
  itemsPerPage?: number
  dbUsers?: any[]
}) {
  const config = MODULE_CONFIG[module]

  if (!allowed) {
    return <AccessHistoryDenied layout={config.layout} />
  }

  return (
    <AccessHistoryPanel
      logs={logs}
      loading={loading}
      onRefresh={onRefresh}
      accent={config.accent}
      layout={config.layout}
      title={config.title}
      description={config.description}
      scopeLabel={config.scopeLabel}
      hideModuleFilter={config.hideModuleFilter}
      itemsPerPage={itemsPerPage}
      dbUsers={dbUsers}
    />
  )
}

export function AccessHistoryPanel({
  logs,
  loading,
  onRefresh,
  title = "Lịch sử truy cập",
  description = "Theo dõi hoạt động trong hệ thống",
  scopeLabel,
  hideModuleFilter = false,
  layout = "page",
  accent = "red",
  itemsPerPage: itemsPerPageProp,
  dbUsers = [],
}: {
  logs: AccessLogRecord[]
  loading: boolean
  onRefresh: () => void
  title?: string
  description?: string
  scopeLabel?: string
  hideModuleFilter?: boolean
  layout?: AccessHistoryLayout
  accent?: AccessHistoryAccent
  itemsPerPage?: number
  dbUsers?: any[]
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAccount, setFilterAccount] = useState("admin")
  const [filterModule, setFilterModule] = useState("all")
  const [filterAction, setFilterAction] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)

  const styles = accentStyles[accent]
  const itemsPerPage = itemsPerPageProp ?? (layout === "page" ? PAGE_ROWS : EMBEDDED_ROWS)
  
  // Normalize và tự động lọc log theo phân hệ nếu hideModuleFilter là true
  const normalizedLogs = useMemo(() => {
    const baseLogs = logs.map(normalizeLog)
    if (hideModuleFilter && scopeLabel) {
      return baseLogs.filter(log => getModuleLabel(log.module) === scopeLabel)
    }
    return baseLogs
  }, [logs, hideModuleFilter, scopeLabel])

  // Danh sách tài khoản hiện hành của dự án, lấy từ dbUsers (nếu có) kết hợp với log thực tế
  const accounts = useMemo(() => {
    const fromDb = dbUsers.map((u) => u.username).filter(Boolean);
    const fromLogs = normalizedLogs.map((log) => log.username).filter(Boolean);
    const combined = Array.from(new Set([...fromDb, ...fromLogs]))
      .filter((username) => username.toLowerCase() !== "system");
    
    // Đảm bảo admin luôn ở đầu
    const sorted = combined.sort((a, b) => {
      if (a.toLowerCase() === "admin") return -1;
      if (b.toLowerCase() === "admin") return 1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [normalizedLogs, dbUsers])

  // Danh sách các phân hệ chuẩn hóa tiếng Việt
  const modules = useMemo(() => {
    const defaultModules = ["Cho thuê xe", "Mua bán xe", "Cầm đồ", "Cho vay", "Cài đặt hệ thống"]
    const rawModules = Array.from(new Set(normalizedLogs.map((log) => getModuleLabel(log.module)))).filter(Boolean)
    return defaultModules.filter((m) => (rawModules as string[]).includes(m))
  }, [normalizedLogs])

  // Lọc hành động động khớp với phân hệ đang lọc
  const actions = useMemo(() => {
    let filteredForAction = normalizedLogs
    if (filterModule !== "all") {
      filteredForAction = normalizedLogs.filter((log) => getModuleLabel(log.module) === filterModule)
    }
    const rawActions = Array.from(new Set(filteredForAction.map((log) => getActionLabel(log.action)))).filter(Boolean)

    const priority = ["Đăng nhập", "Đăng xuất", "Thêm mới", "Chỉnh sửa", "Xóa"]
    return priority.filter((p) => rawActions.includes(p)).concat(rawActions.filter((a) => !priority.includes(a)))
  }, [normalizedLogs, filterModule])

  const filteredLogs = useMemo(
    () =>
      normalizedLogs
        .filter((log) => {
          const q = searchQuery.toLowerCase()
          const matchSearch =
            log.details.toLowerCase().includes(q) ||
            log.username.toLowerCase().includes(q) ||
            log.displayName.toLowerCase().includes(q) ||
            log.module.toLowerCase().includes(q) ||
            log.action.toLowerCase().includes(q)
          const matchAccount = filterAccount === "all" || log.username === filterAccount
          const matchModule = filterModule === "all" || getModuleLabel(log.module) === filterModule
          const matchAction = filterAction === "all" || getActionLabel(log.action) === filterAction
          return matchSearch && matchAccount && matchModule && matchAction
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [normalizedLogs, searchQuery, filterAccount, filterModule, filterAction]
  )

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedLogs = filteredLogs.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  )
  const emptySlots = Math.max(0, itemsPerPage - paginatedLogs.length)

  if (loading) {
    return (
      <div className={panelShellClass(layout)}>
        <div className="module-card relative flex flex-1 animate-pulse flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r", styles.stripe)} />
          <div className="h-12 border-b border-slate-100 bg-slate-50/80" />
          <div className="flex-1 bg-slate-50/40" />
          <div className="h-10 border-t border-slate-100" />
        </div>
      </div>
    )
  }

  return (
    <div className={panelShellClass(layout)}>
      <div
        className={cn(
          "module-card relative flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm ring-1",
          layout === "page" && "min-h-0 flex-1",
          styles.ring
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 z-10 h-0.5 bg-gradient-to-r", styles.stripe)} />

        {/* Toolbar */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-3 py-2.5 md:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex min-w-0 items-center gap-2">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
                <History className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-bold text-slate-800">{title}</h2>
                  {scopeLabel && (
                    <span className={cn("hidden rounded-full border px-2 py-0.5 text-sm font-semibold sm:inline", styles.badge)}>
                      {scopeLabel}
                    </span>
                  )}
                  <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-sm font-semibold tabular-nums text-slate-600">
                    {filteredLogs.length}
                  </span>
                </div>
                <p className="hidden truncate text-sm text-slate-500 sm:block">{description}</p>
              </div>
            </div>

            <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="h-8 rounded-lg border-slate-200 bg-white pl-8 text-sm"
              />
            </div>

            <Select
              value={filterAccount}
              onValueChange={(value) => {
                setFilterAccount(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[10rem] rounded-lg border-slate-200 bg-white text-sm text-slate-800 font-medium">
                <SelectValue placeholder="Tài khoản" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all">Tất cả tài khoản</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account} value={account}>
                    {account}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!hideModuleFilter && (
              <Select
                value={filterModule}
                onValueChange={(value) => {
                  setFilterModule(value)
                  setFilterAction("all") // Reset action filter when module changes
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[11rem] rounded-lg border-slate-200 bg-white text-sm text-slate-800 font-medium">
                  <SelectValue placeholder="Phân hệ" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all">Tất cả phân hệ</SelectItem>
                  {modules.map((moduleName) => (
                    <SelectItem key={moduleName} value={moduleName}>
                      {moduleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={filterAction}
              onValueChange={(value) => {
                setFilterAction(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[10rem] rounded-lg border-slate-200 bg-white text-sm text-slate-800 font-medium">
                <SelectValue placeholder="Hành động" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all">Tất cả hành động</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={onRefresh}
              variant="outline"
              size="icon"
              disabled={loading}
              className="h-8 w-8 shrink-0 rounded-lg border-slate-200"
              title="Làm mới"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-slate-500", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className={layout === "page" ? "min-h-0 flex-1 overflow-hidden" : ""}>
          {filteredLogs.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-slate-400">
              <History className="mb-2 h-8 w-8 text-slate-200" />
              <p className="text-sm font-medium">Không có dữ liệu lịch sử</p>
            </div>
          ) : (
            <div className={layout === "page" ? "h-full overflow-x-auto" : "overflow-x-auto"}>
              <table className="access-history-table w-full min-w-[720px] border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-100 text-sm font-bold uppercase tracking-wider text-slate-500">
                    <th className="w-10 px-3 py-2 text-center">STT</th>
                    <th className="w-[7.5rem] px-2 py-2">Thời gian</th>
                    <th className="w-[8.5rem] px-2 py-2">Người dùng</th>
                    <th className="w-[10.5rem] px-2 py-2">Hành động</th>
                    <th className="px-3 py-2">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                  {paginatedLogs.map((log, index) => {
                    const actionConfig = actionIconMap[log.action] || {
                      icon: Activity,
                      color: "text-slate-600",
                      bg: "bg-slate-100",
                    }
                    const moduleConfig = moduleIconMap[log.module] || {
                      icon: Settings,
                      color: "text-slate-500",
                    }
                    const ActionIcon = actionConfig.icon
                    const ModuleIcon = moduleConfig.icon

                    return (
                      <tr key={log.id} className="access-history-row hover:bg-slate-50/70">
                        <td className="px-3 py-0 text-center text-sm font-semibold text-slate-400">
                          {(safePage - 1) * itemsPerPage + index + 1}
                        </td>
                        <td className="whitespace-nowrap px-2 py-0 font-mono text-sm text-slate-500 font-medium">
                          {formatCompactDate(log.timestamp)}
                        </td>
                        <td className="px-2 py-0">
                          <div className="truncate font-bold text-slate-800 text-[13px]" title={log.displayName}>
                            {log.displayName}
                          </div>
                          <div className="truncate font-mono text-sm text-slate-400 mt-0.5">@{log.username}</div>
                        </td>
                        <td className="px-2 py-0">
                          <div className="flex items-center gap-1">
                            <span
                              className={cn(
                                "inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-sm font-bold",
                                actionConfig.bg,
                                actionConfig.color
                              )}
                            >
                              <ActionIcon className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{log.action}</span>
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 truncate text-sm text-slate-500 font-medium">
                            <ModuleIcon className={cn("h-2.5 w-2.5 shrink-0", moduleConfig.color)} />
                            <span className="truncate">{log.module}</span>
                          </div>
                        </td>
                        <td className="px-3 py-0">
                          <p className="truncate text-slate-600 font-medium text-[13px]" title={log.details}>
                            {log.details || "—"}
                          </p>
                          {log.ipAddress && (
                            <p className="mt-0.5 font-mono text-sm text-red-500">IP {log.ipAddress}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 md:px-4">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{paginatedLogs.length}</span>
            <span className="text-slate-400"> / {filteredLogs.length} kết quả</span>
            <span className="mx-1.5 text-slate-300">·</span>
            Trang {safePage}/{totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-md border-slate-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (totalPages <= 7) return true
                if (p === 1 || p === totalPages) return true
                if (Math.abs(p - safePage) <= 2) return true
                return false
              })
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push("...")
                }
                acc.push(p)
                return acc
              }, [])
              .map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-sm text-slate-400">…</span>
                ) : (
                  <Button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    variant={safePage === p ? "default" : "outline"}
                    size="icon"
                    className={cn(
                      "h-7 w-7 rounded-md text-sm font-semibold",
                      safePage === p
                        ? "bg-slate-800 text-white border-slate-800 hover:bg-slate-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-md border-slate-200"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
