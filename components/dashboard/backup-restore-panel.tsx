"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CloudUpload,
  Download,
  FileJson,
  Lock,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  Bike,
  ClipboardList,
  Copy,
  Check,
  DollarSign,
  ShieldCheck,
  FileCode,
  Layers,
} from "lucide-react"
import { showSuccess } from "@/lib/toast-utils"
import { cn } from "@/lib/utils"
import { formatDisplayDateTime } from "@/lib/format-date"
import {
  ACCENT_BADGE_CLASS,
  ACCENT_BTN_CLASS,
  ACCENT_BTN_OUTLINE_CLASS,
  type ModuleAccent,
} from "@/lib/module-theme"
import {
  ModuleEmptyState,
  ModuleMobileCard,
  ModulePagination,
  ModuleResponsiveTable,
  ModuleSectionCard,
  moduleDestructiveBtnClass,
  moduleDialogContentClass,
} from "@/components/dashboard/module-shell"
import { rentalTableHeadClass } from "@/components/dashboard/rental-ui"

export type BackupAccent = ModuleAccent

export interface BackupFileItem {
  name: string
  created_at: string
  size: number
  url: string
}

type BackupPreviewData = {
  timestamp?: string
  customers?: unknown[]
  vehicles?: unknown[]
  rentals?: unknown[]
  transactions?: unknown[]
  [key: string]: unknown
}

type BackupCounts = {
  customers: number
  vehicles: number
  rentals: number
  transactions?: number
  timestamp?: string
}

type PendingRestore =
  | { kind: "cloud"; url: string; name: string }
  | { kind: "upload"; file: File; name: string }

const FILES_PER_PAGE = 5

function formatFileDate(iso: string) {
  return formatDisplayDateTime(iso)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function isAutoBackup(name: string) {
  return name.startsWith("auto-backup-")
}

function asRecord(item: unknown): Record<string, unknown> | null {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return item as Record<string, unknown>
  }
  return null
}

function pickLabel(item: unknown, keys: string[], fallback: string) {
  const row = asRecord(item)
  if (!row) return fallback
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value
    if (typeof value === "number") return String(value)
  }
  return fallback
}

function extractCustomerInfo(item: unknown, index: number) {
  const row = asRecord(item)
  if (!row) return { name: `Khách #${index + 1}`, phone: "", cccd: "" }
  const name = pickLabel(item, ["name", "fullName", "full_name", "customerName", "customer_name"], `Khách #${index + 1}`)
  const phone = pickLabel(item, ["phone", "phoneNumber", "phone_number", "sdt", "tel"], "")
  const cccd = pickLabel(item, ["idCard", "id_number", "idNumber", "cccd", "cmnd", "passport"], "")
  return { name, phone, cccd }
}

function extractVehicleInfo(item: unknown, index: number) {
  const row = asRecord(item)
  if (!row) return { name: `Xe #${index + 1}`, plate: "", priceDaily: 0 }
  const name = pickLabel(item, ["name", "model", "vehicleName", "vehicle_name"], `Xe #${index + 1}`)
  const plate = pickLabel(item, ["licensePlate", "license_plate", "bienso", "plate"], "")
  const rawPrice = row.priceDaily ?? row.price_daily ?? row.dailyRate ?? row.price
  const priceDaily = typeof rawPrice === "number" ? rawPrice : typeof rawPrice === "string" ? parseInt(rawPrice, 10) || 0 : 0
  return { name, plate, priceDaily }
}

function extractRentalInfo(item: unknown, index: number) {
  const row = asRecord(item)
  if (!row) return { customer: `Khách hàng`, vehicle: `Xe máy`, plate: "", price: 0, status: "" }
  
  const customer = pickLabel(item, ["customerName", "customer_name", "customer", "fullName", "name"], `Khách #${index + 1}`)
  const vehicle = pickLabel(item, ["vehicleName", "vehicle_name", "vehicle", "bikeName", "model"], "Xe máy")
  const plate = pickLabel(item, ["licensePlate", "license_plate", "vehiclePlate", "plate"], "")
  const rawPrice = row.totalPrice ?? row.total_price ?? row.revenue ?? row.price ?? row.amount
  const price = typeof rawPrice === "number" ? rawPrice : typeof rawPrice === "string" ? parseInt(rawPrice, 10) || 0 : 0
  const status = pickLabel(item, ["status", "trang_thai"], "")

  return { customer, vehicle, plate, price, status }
}

function getRentalStatusBadge(status: string) {
  const s = (status || "").toLowerCase()
  if (s === "active" || s === "dang_thue" || s === "đang thuê") {
    return { label: "Đang thuê", className: "bg-blue-50 text-blue-700 border-blue-200" }
  }
  if (s === "completed" || s === "hoan_thanh" || s === "hoàn thành" || s === "xong") {
    return { label: "Hoàn thành", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  }
  if (s === "cancelled" || s === "da_huy" || s === "huỷ" || s === "hủy") {
    return { label: "Đã huỷ", className: "bg-rose-50 text-rose-700 border-rose-200" }
  }
  if (s === "pending" || s === "cho_giao" || s === "chờ") {
    return { label: "Chờ giao", className: "bg-amber-50 text-amber-700 border-amber-200" }
  }
  return { label: status || "Đơn thuê", className: "bg-slate-50 text-slate-600 border-slate-200" }
}

function countsFromPreview(data: BackupPreviewData): BackupCounts {
  return {
    customers: Array.isArray(data.customers) ? data.customers.length : 0,
    vehicles: Array.isArray(data.vehicles) ? data.vehicles.length : 0,
    rentals: Array.isArray(data.rentals) ? data.rentals.length : 0,
    transactions: Array.isArray(data.transactions) ? data.transactions.length : 0,
    timestamp: typeof data.timestamp === "string" ? data.timestamp : undefined,
  }
}

async function downloadBackupFile(file: BackupFileItem) {
  try {
    const response = await fetch(file.url)
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = blobUrl
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(blobUrl)
  } catch {
    window.open(file.url, "_blank")
  }
}

export function BackupAccessDenied() {
  return (
    <div className="rounded-[var(--radius-container)] border border-slate-200 bg-white px-6 py-12 text-center">
      <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-rose-500" />
      <h3 className="text-title text-slate-800">Truy cập bị hạn chế</h3>
      <p className="text-body text-slate-500 mt-2 max-w-sm mx-auto">
        Bạn không có quyền sao lưu và khôi phục dữ liệu.
      </p>
    </div>
  )
}

export function BackupRestorePanel({
  accent,
  moduleName,
  scopeLabel,
  fileHint,
  files,
  filesLoading,
  loading,
  message,
  canBackup,
  canRestore,
  canDelete = false,
  onBackup,
  onRestoreUpload,
  onRestoreFile,
  onDeleteFile,
  onRefresh,
  headerExtra,
}: {
  accent: BackupAccent
  moduleName: string
  scopeLabel: string
  fileHint?: string
  files: BackupFileItem[]
  filesLoading: boolean
  loading: boolean
  message: { type: "success" | "error"; text: string } | null
  canBackup: boolean
  canRestore: boolean
  canDelete?: boolean
  onBackup: () => void
  onRestoreUpload: (file: File) => void
  onRestoreFile: (url: string, name: string) => void
  onDeleteFile?: (name: string) => void
  onRefresh: () => void
  headerExtra?: ReactNode
}) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailFile, setDetailFile] = useState<BackupFileItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<BackupPreviewData | null>(null)
  const [detailRaw, setDetailRaw] = useState("")
  const [activeDetailTab, setActiveDetailTab] = useState<"summary" | "json">("summary")
  const [copiedJson, setCopiedJson] = useState(false)

  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null)
  const [restorePreview, setRestorePreview] = useState<BackupCounts | null>(null)
  const [restorePreviewLoading, setRestorePreviewLoading] = useState(false)
  const [restorePreviewError, setRestorePreviewError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(files.length / FILES_PER_PAGE))

  useEffect(() => {
    setPage(1)
  }, [files.length])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedFiles = useMemo(
    () => files.slice((page - 1) * FILES_PER_PAGE, page * FILES_PER_PAGE),
    [files, page]
  )

  const latestFile = files[0]
  const autoCount = files.filter((f) => isAutoBackup(f.name)).length

  const openBackupDetail = async (file: BackupFileItem) => {
    setDetailFile(file)
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailData(null)
    setDetailRaw("")
    setActiveDetailTab("summary")
    setCopiedJson(false)

    try {
      const response = await fetch(file.url)
      if (!response.ok) {
        throw new Error(`Không tải được tệp (${response.status})`)
      }
      const text = await response.text()
      const parsed = JSON.parse(text) as BackupPreviewData
      setDetailData(parsed)
      const formatted = JSON.stringify(parsed, null, 2)
      setDetailRaw(formatted.length > 150_000 ? `${formatted.slice(0, 150_000)}\n\n… (đã rút gọn vì tệp quá lớn)` : formatted)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Không đọc được nội dung tệp sao lưu")
    } finally {
      setDetailLoading(false)
    }
  }

  const beginCloudRestore = async (url: string, name: string) => {
    if (!canRestore) return
    setPendingRestore({ kind: "cloud", url, name })
    setRestorePreview(null)
    setRestorePreviewError(null)
    setRestorePreviewLoading(true)
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error("Không tải được tệp sao lưu")
      const parsed = (await response.json()) as BackupPreviewData
      if (!parsed.customers || !parsed.vehicles || !parsed.rentals) {
        throw new Error("File backup không hợp lệ")
      }
      setRestorePreview(countsFromPreview(parsed))
    } catch (err) {
      setRestorePreviewError(err instanceof Error ? err.message : "Không đọc được tệp")
    } finally {
      setRestorePreviewLoading(false)
    }
  }

  const beginUploadRestore = async (file: File) => {
    if (!canRestore) return
    setPendingRestore({ kind: "upload", file, name: file.name })
    setRestorePreview(null)
    setRestorePreviewError(null)
    setRestorePreviewLoading(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as BackupPreviewData
      if (!parsed.customers || !parsed.vehicles || !parsed.rentals) {
        throw new Error("File backup không hợp lệ")
      }
      setRestorePreview(countsFromPreview(parsed))
    } catch (err) {
      setRestorePreviewError(err instanceof Error ? err.message : "File backup không hợp lệ")
    } finally {
      setRestorePreviewLoading(false)
    }
  }

  const confirmRestore = () => {
    if (!pendingRestore || restorePreviewError) return
    if (pendingRestore.kind === "cloud") {
      onRestoreFile(pendingRestore.url, pendingRestore.name)
    } else {
      onRestoreUpload(pendingRestore.file)
    }
    setPendingRestore(null)
    setRestorePreview(null)
    setDetailOpen(false)
  }

  const customers = Array.isArray(detailData?.customers) ? detailData.customers : []
  const vehicles = Array.isArray(detailData?.vehicles) ? detailData.vehicles : []
  const rentals = Array.isArray(detailData?.rentals) ? detailData.rentals : []
  const transactions = Array.isArray(detailData?.transactions) ? detailData.transactions : []
  const backupTimestamp =
    typeof detailData?.timestamp === "string" ? detailData.timestamp : detailFile?.created_at

  return (
    <>
      <div className="space-y-6">
        {message && (
          <div
            role="status"
            className={cn(
              "flex items-start gap-3 rounded-[var(--radius-control)] border px-4 py-3",
              message.type === "success"
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : "border-rose-100 bg-rose-50 text-rose-800"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="text-body font-medium leading-relaxed whitespace-pre-line">{message.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-8 rounded-[var(--radius-container)] border border-slate-200/80 bg-white overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50/40 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-title">Thao tác</p>
                <p className="text-meta mt-0.5">
                  {moduleName} · {scopeLabel}
                </p>
              </div>
              {headerExtra}
            </div>
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={onBackup}
                disabled={loading || !canBackup}
                className={cn(
                  "h-11 flex-1 rounded-[var(--radius-control)] text-body font-semibold",
                  ACCENT_BTN_CLASS[accent],
                  !canBackup && "opacity-60"
                )}
              >
                <CloudUpload className="h-4 w-4 mr-2" />
                {loading ? "Đang xử lý…" : "Sao lưu lên đám mây"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => canRestore && uploadRef.current?.click()}
                disabled={loading || !canRestore}
                className={cn(
                  "h-11 flex-1 rounded-[var(--radius-control)] text-body font-semibold border-slate-200",
                  canRestore ? "text-slate-700 hover:bg-slate-50" : "opacity-60"
                )}
              >
                {canRestore ? (
                  <Upload className="h-4 w-4 mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                {canRestore ? "Khôi phục từ file JSON" : "Khôi phục — chỉ admin"}
              </Button>
              <input
                ref={uploadRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (file) void beginUploadRestore(file)
                }}
                disabled={loading || !canRestore}
              />
            </div>
          </div>

          <div className="lg:col-span-4 rounded-[var(--radius-container)] border border-slate-200/80 bg-white px-4 sm:px-5 py-4 flex flex-col justify-center gap-3">
            <div>
              <p className="text-label">Bản sao lưu</p>
              <p className="text-title money tabular-nums text-slate-800 mt-0.5">
                {filesLoading ? "…" : files.length}
                <span className="text-meta font-normal ml-1.5">{autoCount} tự động</span>
              </p>
            </div>
            <div>
              <p className="text-label">Mới nhất</p>
              <p className="text-body text-slate-700 mt-0.5">
                {latestFile ? formatFileDate(latestFile.created_at) : "Chưa có"}
              </p>
            </div>
            <p className="text-meta leading-relaxed">
              Tự động lúc 17h mỗi ngày. File quá 30 ngày được dọn. Khôi phục ghi đè toàn bộ dữ liệu hiện tại.
            </p>
          </div>
        </div>

        <ModuleSectionCard
          title="Bản sao lưu trên đám mây"
          description={fileHint || "Nhấn tên file để xem nội dung. Khôi phục sẽ ghi đè dữ liệu hiện tại."}
          badge={
            <span className={cn("border text-label px-2 py-0.5 rounded-[var(--radius-badge)]", ACCENT_BADGE_CLASS[accent])}>
              {files.length} file
            </span>
          }
          filters={
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={filesLoading}
              className="h-11 w-11 p-0 flex items-center justify-center shrink-0 rounded-[var(--radius-control)] border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm ui-transition hover:border-slate-400"
              title="Làm mới danh sách bản sao lưu"
              aria-label="Làm mới danh sách bản sao lưu"
            >
              <RefreshCw className={cn("h-4 w-4 text-slate-600", filesLoading && "animate-spin")} />
            </Button>
          }
        >
          <CardContent className="p-0">
            {filesLoading ? (
              <div className="divide-y divide-slate-100 px-4 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 my-1 rounded-[var(--radius-badge)] bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : files.length === 0 ? (
              <ModuleEmptyState
                title="Chưa có bản sao lưu"
                description="Bấm Sao lưu lên đám mây để tạo bản đầu tiên, hoặc đợi bản tự động lúc 17h."
              />
            ) : (
              <>
                <ModuleResponsiveTable
                  desktop={
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                          <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                          <th className={rentalTableHeadClass}>Loại</th>
                          <th className={rentalTableHeadClass}>Tên file</th>
                          <th className={rentalTableHeadClass}>Thời gian</th>
                          <th className={cn(rentalTableHeadClass, "text-right")}>Dung lượng</th>
                          <th className={cn(rentalTableHeadClass, "text-right")}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pagedFiles.map((file, idx) => (
                          <tr
                            key={file.name}
                            className="hover:bg-slate-50/60 ui-transition"
                          >
                            <td className="px-4 py-3 text-center text-meta tabular-nums">
                              {(page - 1) * FILES_PER_PAGE + idx + 1}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex text-label font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border",
                                  isAutoBackup(file.name)
                                    ? "bg-slate-50 text-slate-600 border-slate-100"
                                    : "bg-blue-50 text-blue-700 border-blue-100"
                                )}
                              >
                                {isAutoBackup(file.name) ? "Tự động" : "Thủ công"}
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[280px]">
                              <button
                                type="button"
                                onClick={() => openBackupDetail(file)}
                                className="text-body font-medium text-slate-800 hover:text-blue-700 text-left truncate max-w-full ui-transition"
                                title="Xem chi tiết"
                              >
                                {file.name}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-body text-slate-500 whitespace-nowrap tabular-nums">
                              {formatFileDate(file.created_at)}
                            </td>
                            <td className="px-4 py-3 text-right text-body text-slate-500 tabular-nums whitespace-nowrap">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => downloadBackupFile(file)}
                                  disabled={loading}
                                  className="h-10 w-10 p-0 rounded-[var(--radius-control)] text-slate-500 hover:text-blue-700"
                                  title="Tải về"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void beginCloudRestore(file.url, file.name)}
                                  disabled={loading || !canRestore}
                                  className={cn(
                                    "h-10 rounded-[var(--radius-control)] text-label font-semibold",
                                    ACCENT_BTN_OUTLINE_CLASS[accent],
                                    !canRestore && "opacity-50"
                                  )}
                                >
                                  {canRestore ? "Khôi phục" : <Lock className="h-3.5 w-3.5" />}
                                </Button>
                                {canDelete && onDeleteFile && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setPendingDelete(file.name)}
                                    disabled={loading}
                                    className="h-10 w-10 p-0 rounded-[var(--radius-control)] text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                    title="Xóa file"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                  mobile={
                    <>
                      {pagedFiles.map((file, idx) => (
                        <ModuleMobileCard key={file.name}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-meta tabular-nums mb-1">
                                #{(page - 1) * FILES_PER_PAGE + idx + 1}
                              </p>
                              <button
                                type="button"
                                onClick={() => openBackupDetail(file)}
                                className="text-body font-semibold text-slate-800 text-left break-all"
                              >
                                {file.name}
                              </button>
                              <p className="text-meta mt-1">{formatFileDate(file.created_at)}</p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-label font-semibold px-2 py-0.5 rounded-[var(--radius-badge)] border",
                                isAutoBackup(file.name)
                                  ? "bg-slate-50 text-slate-600 border-slate-100"
                                  : "bg-blue-50 text-blue-700 border-blue-100"
                              )}
                            >
                              {isAutoBackup(file.name) ? "Tự động" : "Thủ công"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1">
                            <span className="text-meta tabular-nums">{formatFileSize(file.size)}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadBackupFile(file)}
                                className="h-10 w-10 p-0 rounded-[var(--radius-control)]"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void beginCloudRestore(file.url, file.name)}
                                disabled={loading || !canRestore}
                                className="h-10 rounded-[var(--radius-control)] text-label font-semibold"
                              >
                                {canRestore ? "Khôi phục" : <Lock className="h-3.5 w-3.5" />}
                              </Button>
                              {canDelete && onDeleteFile && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPendingDelete(file.name)}
                                  className="h-10 w-10 p-0 rounded-[var(--radius-control)] text-rose-500"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </ModuleMobileCard>
                      ))}
                    </>
                  }
                />
                <ModulePagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={files.length}
                  itemLabel="file"
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </ModuleSectionCard>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setDetailFile(null)
            setDetailData(null)
            setDetailError(null)
            setDetailRaw("")
          }
        }}
      >
        <DialogContent className={cn(moduleDialogContentClass, "max-w-4xl max-h-[88vh] overflow-hidden flex flex-col gap-0 p-0 rounded-[var(--radius-container)] shadow-2xl border-slate-200")}>
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0 bg-slate-50/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100/80 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 shadow-2xs">
                  <FileJson className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Chi tiết tệp sao lưu
                  </DialogTitle>
                  <p className="text-xs font-mono text-slate-500 mt-0.5 break-all font-medium">
                    {detailFile?.name}
                  </p>
                </div>
              </div>

              {detailFile && (
                <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                  <span
                    className={cn(
                      "inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                      isAutoBackup(detailFile.name)
                        ? "bg-slate-100 text-slate-700 border-slate-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    )}
                  >
                    {isAutoBackup(detailFile.name) ? "Tự động (17:00)" : "Thủ công"}
                  </span>
                  <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    Dung lượng {formatFileSize(detailFile.size)}
                  </span>
                  <span className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {formatFileDate(detailFile.created_at)}
                  </span>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {detailLoading ? (
              <div className="space-y-4 py-8">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
                <div className="h-48 rounded-xl bg-slate-100 animate-pulse" />
              </div>
            ) : detailError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-body text-rose-800 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm">Không thể đọc dữ liệu tệp sao lưu</p>
                  <p className="text-xs text-rose-700 mt-1">{detailError}</p>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Four KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Users className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-blue-800 font-semibold">Khách hàng</p>
                      <p className="text-lg font-black text-slate-900 tabular-nums leading-tight mt-0.5">{customers.length}</p>
                      <p className="text-[10px] text-slate-400 truncate">Hồ sơ khách thuê</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Bike className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-emerald-800 font-semibold">Đội xe</p>
                      <p className="text-lg font-black text-slate-900 tabular-nums leading-tight mt-0.5">{vehicles.length}</p>
                      <p className="text-[10px] text-slate-400 truncate">Phương tiện quản lý</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-amber-800 font-semibold">Đơn thuê</p>
                      <p className="text-lg font-black text-slate-900 tabular-nums leading-tight mt-0.5">{rentals.length}</p>
                      <p className="text-[10px] text-slate-400 truncate">Hợp đồng & lịch sử</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <DollarSign className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-purple-800 font-semibold">Thu chi / Quỹ</p>
                      <p className="text-lg font-black text-slate-900 tabular-nums leading-tight mt-0.5">
                        {transactions.length > 0 ? transactions.length : "Toàn vẹn"}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">Giao dịch đồng bộ</p>
                    </div>
                  </div>
                </div>

                {/* 2. Tabs Switcher */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("summary")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-semibold ui-transition flex items-center gap-1.5",
                        activeDetailTab === "summary"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Tóm tắt dữ liệu thực thể
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab("json")}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-xs font-semibold ui-transition flex items-center gap-1.5",
                        activeDetailTab === "json"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      Mã nguồn JSON ({formatFileSize(detailFile?.size || 0)})
                    </button>
                  </div>

                  {activeDetailTab === "json" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (detailRaw) {
                          navigator.clipboard.writeText(detailRaw)
                          setCopiedJson(true)
                          showSuccess("Đã sao chép nội dung JSON vào bộ nhớ tạm")
                          setTimeout(() => setCopiedJson(false), 2000)
                        }
                      }}
                      className="h-7 px-2.5 text-xs text-slate-700 font-medium border-slate-200 hover:bg-slate-50"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Đã sao chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1 text-slate-500" />
                          Sao chép JSON
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* 3. Tab Content */}
                {activeDetailTab === "summary" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
                    <CustomerPreviewList customers={customers} />
                    <VehiclePreviewList vehicles={vehicles} />
                    <RentalPreviewList rentals={rentals} />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <pre className="max-h-[360px] overflow-auto rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-xs leading-relaxed p-4 font-mono whitespace-pre-wrap break-all shadow-inner">
                      {detailRaw || "—"}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 shrink-0 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Khôi phục tệp sẽ đồng bộ lại toàn bộ dữ liệu khách hàng, xe và đơn thuê.</span>
            </div>

            {detailFile && (
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 px-4 rounded-[var(--radius-control)] border-slate-200 text-slate-700 hover:bg-white text-xs font-semibold"
                  onClick={() => downloadBackupFile(detailFile)}
                  disabled={loading}
                >
                  <Download className="h-4 w-4 mr-1.5 text-slate-500" />
                  Tải về file
                </Button>
                <Button
                  type="button"
                  className={cn(
                    "h-10 px-4 rounded-[var(--radius-control)] text-white text-xs font-semibold shadow-sm",
                    ACCENT_BTN_CLASS[accent]
                  )}
                  disabled={loading || !canRestore || detailLoading || !!detailError}
                  onClick={() => void beginCloudRestore(detailFile.url, detailFile.name)}
                >
                  Khôi phục từ tệp này
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingRestore}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRestore(null)
            setRestorePreview(null)
            setRestorePreviewError(null)
          }
        }}
      >
        <DialogContent className={cn(moduleDialogContentClass, "max-w-md")}>
          <DialogHeader>
            <DialogTitle className="text-title text-rose-700">Xác nhận khôi phục</DialogTitle>
            <DialogDescription className="text-body text-slate-600 mt-2">
              Dữ liệu {scopeLabel.toLowerCase()} hiện tại sẽ bị ghi đè hoàn toàn. Không hoàn tác được.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 space-y-2">
            <p className="text-body text-slate-700 break-all">
              <span className="text-label">File: </span>
              {pendingRestore?.name}
            </p>
            {restorePreviewLoading ? (
              <p className="text-meta">Đang đọc nội dung tệp…</p>
            ) : restorePreviewError ? (
              <p className="text-body text-rose-700">{restorePreviewError}</p>
            ) : restorePreview ? (
              <ul className="text-body text-slate-700 space-y-1">
                <li>Khách hàng: {restorePreview.customers}</li>
                <li>Xe: {restorePreview.vehicles}</li>
                <li>Đơn thuê: {restorePreview.rentals}</li>
                {restorePreview.timestamp && (
                  <li>Ngày sao lưu: {formatFileDate(restorePreview.timestamp)}</li>
                )}
              </ul>
            ) : null}
          </div>
          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[var(--radius-control)] border-slate-200"
              onClick={() => {
                setPendingRestore(null)
                setRestorePreview(null)
                setRestorePreviewError(null)
              }}
            >
              Hủy
            </Button>
            <Button
              type="button"
              className={cn("h-11", moduleDestructiveBtnClass)}
              disabled={loading || restorePreviewLoading || !!restorePreviewError}
              onClick={confirmRestore}
            >
              Khôi phục
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className={cn(moduleDialogContentClass, "max-w-sm")}>
          <DialogHeader>
            <DialogTitle className="text-title text-rose-700">Xóa bản sao lưu</DialogTitle>
            <DialogDescription className="text-body text-slate-600 mt-2 break-all">
              Xóa file {pendingDelete}? Hành động này không hoàn tác được.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-[var(--radius-control)] border-slate-200"
              onClick={() => setPendingDelete(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              className={cn("h-11", moduleDestructiveBtnClass)}
              onClick={() => {
                if (pendingDelete && onDeleteFile) onDeleteFile(pendingDelete)
                setPendingDelete(null)
              }}
            >
              Xóa file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CustomerPreviewList({
  customers,
}: {
  customers: unknown[]
}) {
  const top5 = customers.slice(0, 5).map((c, i) => extractCustomerInfo(c, i))
  const more = Math.max(0, customers.length - 5)

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col h-full">
      <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
          <Users className="w-3.5 h-3.5 text-blue-600" />
          <span>Khách hàng</span>
        </div>
        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
          {customers.length}
        </span>
      </div>

      <div className="p-3 flex-1 divide-y divide-slate-100 space-y-2.5">
        {top5.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Không có dữ liệu khách</p>
        ) : (
          top5.map((c, idx) => (
            <div key={idx} className="pt-2.5 first:pt-0 flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate" title={c.name}>
                  {c.name}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                  {c.phone && <span className="font-mono text-slate-600 font-medium">{c.phone}</span>}
                  {c.cccd && <span className="font-mono text-slate-400">CCCD: {c.cccd}</span>}
                  {!c.phone && !c.cccd && <span className="text-slate-400 italic">Chưa có SĐT</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {more > 0 && (
        <div className="bg-slate-50/70 border-t border-slate-100 px-3 py-1.5 text-center text-[11px] font-medium text-slate-500">
          +{more} khách hàng khác trong tệp
        </div>
      )}
    </div>
  )
}

function VehiclePreviewList({
  vehicles,
}: {
  vehicles: unknown[]
}) {
  const top5 = vehicles.slice(0, 5).map((v, i) => extractVehicleInfo(v, i))
  const more = Math.max(0, vehicles.length - 5)

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col h-full">
      <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
          <Bike className="w-3.5 h-3.5 text-emerald-600" />
          <span>Đội xe</span>
        </div>
        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
          {vehicles.length}
        </span>
      </div>

      <div className="p-3 flex-1 divide-y divide-slate-100 space-y-2.5">
        {top5.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Không có dữ liệu xe</p>
        ) : (
          top5.map((v, idx) => (
            <div key={idx} className="pt-2.5 first:pt-0 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate" title={v.name}>
                  {v.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {v.plate ? (
                    <span className="text-[10px] font-mono font-bold bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                      {v.plate}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Chưa có biển</span>
                  )}
                </div>
              </div>
              {v.priceDaily > 0 && (
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-bold text-emerald-700 font-mono">
                    {v.priceDaily.toLocaleString("vi-VN")} đ
                  </span>
                  <p className="text-[9px] text-slate-400">/ngày</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {more > 0 && (
        <div className="bg-slate-50/70 border-t border-slate-100 px-3 py-1.5 text-center text-[11px] font-medium text-slate-500">
          +{more} phương tiện khác trong tệp
        </div>
      )}
    </div>
  )
}

function RentalPreviewList({
  rentals,
}: {
  rentals: unknown[]
}) {
  const top5 = rentals.slice(0, 5).map((r, i) => extractRentalInfo(r, i))
  const more = Math.max(0, rentals.length - 5)

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col h-full">
      <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
          <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
          <span>Đơn thuê</span>
        </div>
        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
          {rentals.length}
        </span>
      </div>

      <div className="p-3 flex-1 divide-y divide-slate-100 space-y-2.5">
        {top5.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-4 text-center">Không có dữ liệu đơn</p>
        ) : (
          top5.map((r, idx) => {
            const badge = getRentalStatusBadge(r.status)
            return (
              <div key={idx} className="pt-2.5 first:pt-0 space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-xs font-bold text-slate-800 truncate flex-1" title={r.customer}>
                    {r.customer}
                  </p>
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border shrink-0", badge.className)}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate max-w-[130px] text-slate-600">
                    {r.vehicle} {r.plate ? `• ${r.plate}` : ""}
                  </span>
                  {r.price > 0 && (
                    <span className="font-bold text-slate-900 font-mono">
                      {r.price.toLocaleString("vi-VN")} đ
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {more > 0 && (
        <div className="bg-slate-50/70 border-t border-slate-100 px-3 py-1.5 text-center text-[11px] font-medium text-slate-500">
          +{more} hợp đồng khác trong tệp
        </div>
      )}
    </div>
  )
}
