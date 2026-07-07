"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabase"
import { logger } from "@/lib/logger"
import { BackupRestorePanel } from "@/components/dashboard/backup-restore-panel"
import { ModulePageShell, ModuleSubpageHeader } from "@/components/dashboard/module-shell"
import { formatDisplayDateTime } from "@/lib/format-date"

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

      // Lấy dữ liệu
      const { data: customers } = await supabase.from("customers").select("*")
      const { data: vehicles } = await supabase.from("vehicles").select("*")
      const { data: rentals } = await supabase.from("rentals").select("*")

      const backupData: BackupData = {
        timestamp: now.toISOString(),
        customers: customers || [],
        vehicles: vehicles || [],
        rentals: rentals || [],
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
        details: `Hệ thống tự động sao lưu lúc 17h: ${customers?.length || 0} khách, ${vehicles?.length || 0} xe, ${rentals?.length || 0} đơn`,
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
        .filter(
          (f: any) =>
            f.name.endsWith(".json") &&
            (f.name.startsWith("backup-") || f.name.startsWith("auto-backup-")) &&
            !f.name.startsWith("sales-") &&
            !f.name.startsWith("pawn-") &&
            !f.name.startsWith("loan-")
        )
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

      // Fetch tất cả dữ liệu
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("*")

      const { data: vehicles, error: vehiclesError } = await supabase
        .from("vehicles")
        .select("*")

      const { data: rentals, error: rentalsError } = await supabase
        .from("rentals")
        .select("*")

      if (customersError || vehiclesError || rentalsError) {
        throw new Error("Lỗi khi lấy dữ liệu từ Supabase")
      }

      // Tạo backup object
      const backupData: BackupData = {
        timestamp: new Date().toISOString(),
        customers: customers || [],
        vehicles: vehicles || [],
        rentals: rentals || [],
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
        logger.log(user.username, user.displayName, "Sao lưu dữ liệu", "settings", `Sao lưu ${customers?.length || 0} khách, ${vehicles?.length || 0} xe, ${rentals?.length || 0} đơn thuê`)
      }

      setMessage({ 
        type: 'success', 
        text: `✅ Sao lưu thành công!\n- ${customers?.length || 0} khách\n- ${vehicles?.length || 0} xe\n- ${rentals?.length || 0} đơn thuê\n\nFile: ${fileName}` 
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
        `- Ngày sao lưu: ${formatDisplayDateTime(backupData.timestamp)}\n` +
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
    <ModulePageShell module="rental">
      <ModuleSubpageHeader
        module="rental"
        title="Sao lưu & khôi phục"
        subtitle="Quản lý backup dữ liệu phân hệ cho thuê xe"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Sao lưu khôi phục" },
        ]}
      />
      <BackupRestorePanel
        accent="blue"
        moduleName="Phân hệ cho thuê xe"
        scopeLabel="Khách · Xe · Đơn thuê"
        fileHint="Tiền tố backup-, auto-backup-"
        files={backupFiles}
        filesLoading={filesLoading}
        loading={loading}
        message={message}
        canBackup={!!user?.permissions.canBackup}
        canRestore={user?.role === "admin"}
        canDelete={!!user?.permissions.canBackup}
        onBackup={handleBackup}
        onRestoreUpload={handleRestoreFromUpload}
        onRestoreFile={handleRestoreFromFile}
        onDeleteFile={handleDeleteBackup}
        onRefresh={loadBackupFiles}
      />
    </ModulePageShell>
  )
}
