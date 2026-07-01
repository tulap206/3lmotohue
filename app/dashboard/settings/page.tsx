"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Upload, AlertCircle, CheckCircle, Trash2, RefreshCw, FileJson } from "lucide-react"

interface BackupData {
  timestamp: string
  customers: any[]
  vehicles: any[]
  rentals: any[]
}

interface BackupFile {
  name: string
  created_at: string
  size: number
  url: string
}

const BACKUP_PAGE_SIZE = 1000

const fetchAllBackupRows = async (table: string) => {
  const rows: any[] = []

  for (let from = 0; ; from += BACKUP_PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + BACKUP_PAGE_SIZE - 1)

    if (error) throw error

    rows.push(...(data || []))

    if (!data || data.length < BACKUP_PAGE_SIZE) {
      break
    }
  }

  return rows
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [backupFiles, setBackupFiles] = useState<BackupFile[]>([])
  const [filesLoading, setFilesLoading] = useState(true)

  // Load backup files on mount
  useEffect(() => {
    loadBackupFiles()
    checkAndRunAutoBackup()
  }, [])

  // Tự động sao lưu lúc 17h hàng ngày và tự xóa file quá 30 ngày
  const checkAndRunAutoBackup = async () => {
    try {
      const now = new Date()
      // Chỉ chạy tự động nếu giờ hiện tại từ 17h trở lên
      if (now.getHours() < 17) {
        console.log("⏰ Chưa đến 17h, bỏ qua tự động sao lưu.")
        return
      }

      const dateStr = now.toISOString().split("T")[0] // YYYY-MM-DD
      const autoFileName = `auto-backup-${dateStr}.json`

      console.log("⏰ Đang kiểm tra sao lưu tự động cho ngày hôm nay...")

      // Lấy danh sách file trong bucket backups
      const { data: existingFiles, error: listError } = await supabase.storage
        .from("backups")
        .list("", { limit: 100 })

      if (listError) throw listError

      // Lọc các file quá 30 ngày để tự động xóa
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const filesToDelete: string[] = []
      const alreadyHasTodayBackup = (existingFiles || []).some(f => {
        if (f.created_at) {
          const fileDate = new Date(f.created_at)
          if (fileDate < thirtyDaysAgo && f.name.endsWith('.json')) {
            filesToDelete.push(f.name)
          }
        }
        return f.name === autoFileName
      })

      // Xóa file cũ
      if (filesToDelete.length > 0) {
        console.log("🗑️ Tự động xóa các file sao lưu quá 30 ngày:", filesToDelete)
        await supabase.storage.from("backups").remove(filesToDelete)
      }

      // Nếu đã có file backup tự động của ngày hôm nay thì dừng
      if (alreadyHasTodayBackup) {
        console.log(`✅ Hôm nay (${dateStr}) đã được sao lưu tự động.`)
        return
      }

      console.log(`⏰ Đang tiến hành tự động sao lưu ngày ${dateStr}...`)

      // Lấy toàn bộ dữ liệu theo trang để tránh giới hạn mặc định của Supabase.
      const [customers, vehicles, rentals] = await Promise.all([
        fetchAllBackupRows("customers"),
        fetchAllBackupRows("vehicles"),
        fetchAllBackupRows("rentals"),
      ])

      const backupData: BackupData = {
        timestamp: now.toISOString(),
        customers,
        vehicles,
        rentals,
      }

      const jsonString = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })

      const { error: uploadError } = await supabase.storage
        .from("backups")
        .upload(autoFileName, blob, { upsert: false })

      if (uploadError) throw uploadError

      console.log("✅ Sao lưu tự động thành công:", autoFileName)

      // Ghi log hệ thống
      await supabase.from("access_logs").insert({
        username: "system",
        displayName: "Hệ thống tự động",
        action: "Sao lưu tự động",
        module: "Hệ thống",
        details: `Hệ thống tự động sao lưu lúc 17h: ${customers.length} khách, ${vehicles.length} xe, ${rentals.length} đơn`,
        timestamp: now.toISOString()
      })

      // Reload danh sách
      loadBackupFiles()
    } catch (err) {
      console.error("Lỗi sao lưu tự động:", err)
    }
  }

  // Load danh sách backup files từ Supabase Storage
  const loadBackupFiles = async () => {
    try {
      setFilesLoading(true)
      console.log("📂 Loading backup files...")

      const { data, error } = await supabase.storage
        .from("backups")
        .list("", {
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" },
        })

      if (error) throw error

      const files: BackupFile[] = (data || [])
        .filter((f: any) => f.name.endsWith('.json'))
        .map((f: any) => ({
          name: f.name,
          created_at: f.created_at,
          size: f.metadata?.size || 0,
          url: supabase.storage.from("backups").getPublicUrl(f.name).data.publicUrl,
        }))

      console.log(`✅ Loaded ${files.length} backup files`)
      setBackupFiles(files)
    } catch (error) {
      console.error("Error loading backup files:", error)
      setBackupFiles([])
    } finally {
      setFilesLoading(false)
    }
  }

  // Backup - Export dữ liệu
  const handleBackup = async () => {
    try {
      setLoading(true)
      setMessage(null)

      console.log("📦 Starting backup...")

      // Fetch tất cả dữ liệu theo trang để file backup không bị cắt ở 1000 dòng.
      const [customers, vehicles, rentals] = await Promise.all([
        fetchAllBackupRows("customers"),
        fetchAllBackupRows("vehicles"),
        fetchAllBackupRows("rentals"),
      ])

      // Tạo backup object
      const backupData: BackupData = {
        timestamp: new Date().toISOString(),
        customers,
        vehicles,
        rentals,
      }

      console.log("✅ Backup data created:", backupData)

      // Upload to Supabase Storage
      const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      const jsonString = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })

      const { error: uploadError } = await supabase.storage
        .from("backups")
        .upload(fileName, blob, { upsert: false })

      if (uploadError) throw uploadError

      console.log("✅ Uploaded to Storage:", fileName)

      // Log to access_logs
      if (user) {
        logger.log(user.username, user.displayName, "Sao lưu dữ liệu", "settings", `Sao lưu ${customers.length} khách, ${vehicles.length} xe, ${rentals.length} đơn thuê`)
      }

      setMessage({ 
        type: 'success', 
        text: `✅ Sao lưu thành công!\n- ${customers.length} khách\n- ${vehicles.length} xe\n- ${rentals.length} đơn thuê\n\nFile: ${fileName}` 
      })

      // Reload backup files
      setTimeout(() => loadBackupFiles(), 1000)
    } catch (error) {
      console.error("Backup error:", error)
      setMessage({ type: 'error', text: `❌ Lỗi sao lưu: ${(error as any).message}` })
    } finally {
      setLoading(false)
    }
  }

  // Restore từ backup file
  const handleRestoreFromFile = async (fileUrl: string, fileName: string) => {
    try {
      // Check admin permission
      if (user?.role !== 'admin') {
        setMessage({ type: 'error', text: '❌ Bạn không có quyền khôi phục dữ liệu' })
        return
      }

      setLoading(true)
      setMessage(null)

      console.log("📥 Starting restore from:", fileName)

      // Fetch file từ URL
      const response = await fetch(fileUrl)
      if (!response.ok) throw new Error("Lỗi tải file")

      const backupData: BackupData = await response.json()

      if (!backupData.customers || !backupData.vehicles || !backupData.rentals) {
        throw new Error("File backup không hợp lệ")
      }

      // Confirm restore
      const confirmed = window.confirm(
        `⚠️ CẢNH BÁO KHÔI PHỤC DỮ LIỆU:\n` +
        `Bạn có chắc chắn muốn khôi phục dữ liệu từ file này? Dữ liệu hiện tại trên hệ thống sẽ bị ghi đè hoàn toàn.\n\n` +
        `Thông tin file:\n` +
        `- Tên file: ${fileName}\n` +
        `- Ngày sao lưu: ${new Date(backupData.timestamp).toLocaleString('vi-VN')}\n` +
        `- Khách hàng: ${backupData.customers.length}\n` +
        `- Xe: ${backupData.vehicles.length}\n` +
        `- Đơn thuê: ${backupData.rentals.length}\n\n` +
        `Hành động này không thể hoàn tác. Bạn có đồng ý tiếp tục?`
      )

      if (!confirmed) {
        setMessage({ type: 'error', text: '❌ Khôi phục bị hủy' })
        return
      }

      // Xóa dữ liệu cũ
      console.log("🗑️ Deleting old data...")
      await supabase.from("rentals").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      await supabase.from("vehicles").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000")

      // Insert dữ liệu mới
      console.log("📥 Inserting new data...")
      
      if (backupData.customers.length > 0) {
        const { error: customersError } = await supabase
          .from("customers")
          .insert(backupData.customers.map(({ created_at, ...rest }) => rest))
        if (customersError) throw customersError
      }

      if (backupData.vehicles.length > 0) {
        const { error: vehiclesError } = await supabase
          .from("vehicles")
          .insert(backupData.vehicles.map(({ created_at, updated_at, ...rest }) => rest))
        if (vehiclesError) throw vehiclesError
      }

      if (backupData.rentals.length > 0) {
        const { error: rentalsError } = await supabase
          .from("rentals")
          .insert(backupData.rentals.map(({ created_at, updated_at, ...rest }) => rest))
        if (rentalsError) throw rentalsError
      }

      // Log to access_logs
      if (user) {
        logger.log(user.username, user.displayName, "Khôi phục dữ liệu", "settings", `Khôi phục ${backupData.customers.length} khách, ${backupData.vehicles.length} xe, ${backupData.rentals.length} đơn thuê từ file: ${fileName}`)
      }

      setMessage({ 
        type: 'success', 
        text: `✅ Khôi phục thành công!\n- ${backupData.customers.length} khách\n- ${backupData.vehicles.length} xe\n- ${backupData.rentals.length} đơn thuê` 
      })

      // Reload page
      setTimeout(() => window.location.reload(), 1500)
    } catch (error) {
      console.error("Restore error:", error)
      setMessage({ type: 'error', text: `❌ Lỗi khôi phục: ${(error as any).message}` })
    } finally {
      setLoading(false)
    }
  }

  // Restore từ file upload
  const handleRestoreFromUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      // Check admin permission
      if (user?.role !== 'admin') {
        setMessage({ type: 'error', text: '❌ Bạn không có quyền khôi phục dữ liệu' })
        event.target.value = ""
        return
      }

      setLoading(true)
      setMessage(null)

      const file = event.target.files?.[0]
      if (!file) return

      console.log("📥 Starting restore from file:", file.name)

      // Read file
      const text = await file.text()
      const backupData: BackupData = JSON.parse(text)

      if (!backupData.customers || !backupData.vehicles || !backupData.rentals) {
        throw new Error("File backup không hợp lệ")
      }

      // Confirm restore
      const confirmed = window.confirm(
        `⚠️ BẠN SẼ RESTORE DỮ LIỆU TỪ FILE:\n${file.name}\n\n` +
        `📊 Dữ liệu sẽ được nhập:\n` +
        `- ${backupData.customers.length} khách hàng\n` +
        `- ${backupData.vehicles.length} xe\n` +
        `- ${backupData.rentals.length} đơn thuê\n\n` +
        `⚠️ Dữ liệu hiện tại sẽ bị XÓA!\n\nBạn có chắc chắn không?`
      )

      if (!confirmed) {
        setMessage({ type: 'error', text: '❌ Khôi phục bị hủy' })
        return
      }

      // Xóa dữ liệu cũ
      console.log("🗑️ Deleting old data...")
      await supabase.from("rentals").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      await supabase.from("vehicles").delete().neq("id", "00000000-0000-0000-0000-000000000000")
      await supabase.from("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000")

      // Insert dữ liệu mới
      console.log("📥 Inserting new data...")
      
      if (backupData.customers.length > 0) {
        const { error: customersError } = await supabase
          .from("customers")
          .insert(backupData.customers.map(({ created_at, ...rest }) => rest))
        if (customersError) throw customersError
      }

      if (backupData.vehicles.length > 0) {
        const { error: vehiclesError } = await supabase
          .from("vehicles")
          .insert(backupData.vehicles.map(({ created_at, updated_at, ...rest }) => rest))
        if (vehiclesError) throw vehiclesError
      }

      if (backupData.rentals.length > 0) {
        const { error: rentalsError } = await supabase
          .from("rentals")
          .insert(backupData.rentals.map(({ created_at, updated_at, ...rest }) => rest))
        if (rentalsError) throw rentalsError
      }

      // Log to access_logs
      if (user) {
        logger.log(user.username, user.displayName, "Khôi phục dữ liệu", "settings", `Khôi phục ${backupData.customers.length} khách, ${backupData.vehicles.length} xe, ${backupData.rentals.length} đơn thuê từ file tải lên`)
      }

      setMessage({ 
        type: 'success', 
        text: `✅ Khôi phục thành công!\n- ${backupData.customers.length} khách\n- ${backupData.vehicles.length} xe\n- ${backupData.rentals.length} đơn thuê` 
      })

      // Reload page
      setTimeout(() => window.location.reload(), 1500)
    } catch (error) {
      console.error("Restore error:", error)
      setMessage({ type: 'error', text: `❌ Lỗi khôi phục: ${(error as any).message}` })
    } finally {
      setLoading(false)
      event.target.value = ""
    }
  }

  // Delete backup file
  const handleDeleteBackup = async (fileName: string) => {
    try {
      if (!window.confirm(`Xóa file backup "${fileName}"?`)) return

      const { error } = await supabase.storage
        .from("backups")
        .remove([fileName])

      if (error) throw error

      setMessage({ type: 'success', text: `✅ Xóa file thành công` })
      loadBackupFiles()
    } catch (error) {
      console.error("Delete error:", error)
      setMessage({ type: 'error', text: `❌ Lỗi xóa: ${(error as any).message}` })
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 w-full">
      <div>
        <h1 className="text-lg md:text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-xs md:text-sm text-gray-600">Quản lý sao lưu và khôi phục dữ liệu</p>
      </div>

      {/* Backup & Restore Card */}
      <Card>
        <CardHeader className="pb-3 md:pb-4 p-3 md:p-4">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            💾 Sao lưu & Khôi phục dữ liệu
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Sao lưu dữ liệu của bạn hoặc khôi phục từ file backup
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
          {message && (
            <div className={`p-2 md:p-3 rounded-lg flex gap-2 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-xs md:text-sm whitespace-pre-line">{message.text}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {/* Backup Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-6 text-center">
              <Download className="w-6 md:w-8 h-6 md:h-8 text-blue-600 mx-auto mb-2" />
              <h3 className="font-semibold text-sm md:text-base text-gray-900 mb-1 md:mb-2">Sao lưu dữ liệu</h3>
              <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
                Xuất tất cả khách hàng, xe, và đơn thuê
              </p>
              {user?.role === 'admin' || user?.permissions?.canBackup ? (
                <Button
                  onClick={handleBackup}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full text-sm h-10 rounded-full font-semibold transition-all duration-200"
                >
                  {loading ? "Đang xử lý..." : "📥 Sao lưu ngay"}
                </Button>
              ) : (
                <Button disabled className="bg-gray-100 text-gray-400 w-full text-sm h-10 rounded-full cursor-not-allowed border border-gray-200 font-semibold">
                  🔒 Không có quyền
                </Button>
              )}
            </div>

            {/* Restore Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-6 text-center">
              <Upload className="w-6 md:w-8 h-6 md:h-8 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-semibold text-sm md:text-base text-gray-900 mb-1 md:mb-2">Khôi phục từ file</h3>
              <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
                Nhập dữ liệu từ file backup cá nhân
              </p>
              {user?.role !== 'admin' ? (
                <Button
                  disabled={true}
                  className="bg-gray-100 text-gray-400 w-full text-sm h-10 rounded-full cursor-not-allowed border border-gray-200 font-semibold"
                >
                  🔒 Chỉ Admin
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const input = document.createElement("input")
                    input.type = "file"
                    input.accept = ".json"
                    input.onchange = (e) => handleRestoreFromUpload(e as any)
                    input.click()
                  }}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-full text-sm h-10 rounded-full font-semibold transition-all duration-200"
                >
                  {loading ? "Đang xử lý..." : "📤 Chọn file"}
                </Button>
              )}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 md:p-4">
            <p className="text-xs md:text-sm text-amber-800">
              ⚠️ <strong>Lưu ý:</strong> Khi khôi phục, dữ liệu hiện tại sẽ bị xóa.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backup Files List */}
      <Card>
        <CardHeader className="pb-3 md:pb-4 p-3 md:p-4">
          <CardTitle className="text-base md:text-lg flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              📂 Danh sách file sao lưu
            </span>
            <Button
              onClick={loadBackupFiles}
              size="sm"
              variant="outline"
              disabled={filesLoading}
              className="text-xs"
            >
              <RefreshCw className={`w-3 h-3 ${filesLoading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Những file sao lưu đã tạo trên hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          {filesLoading ? (
            <div className="text-center py-6 md:py-8 text-gray-500 text-sm">Đang tải danh sách...</div>
          ) : backupFiles.length === 0 ? (
            <div className="text-center py-6 md:py-8 text-gray-500 text-sm">Chưa có file sao lưu nào</div>
          ) : (
            <div className="space-y-2 md:space-y-3 max-h-[70vh] overflow-y-auto">
              {backupFiles.map((file) => (
                <div key={file.name} className="bg-gray-50 p-3 md:p-4 rounded-xl border border-gray-100 hover:border-slate-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left Side: Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0 mt-0.5">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-800 break-all">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(file.created_at).toLocaleString('vi-VN')} | {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  
                  {/* Right Side: Action buttons group */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
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
                        } catch (err) {
                          console.error("Lỗi tải file:", err)
                          window.open(file.url, "_blank")
                        }
                      }}
                      disabled={loading}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs px-3 h-8 rounded-lg font-medium flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải về
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestoreFromFile(file.url, file.name)}
                      disabled={loading || user?.role !== 'admin'}
                      className={`text-xs px-3 h-8 rounded-lg font-semibold border-red-500 text-red-600 hover:bg-red-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed transition-all duration-200`}
                      title={user?.role !== 'admin' ? 'Chỉ Admin có quyền khôi phục' : ''}
                    >
                      {user?.role !== 'admin' ? '🔒 Chỉ Admin' : 'Khôi phục'}
                    </Button>

                    {user?.role === 'admin' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteBackup(file.name)}
                        disabled={loading}
                        className="border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 h-8 w-8 rounded-lg flex items-center justify-center p-0 transition-all duration-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
