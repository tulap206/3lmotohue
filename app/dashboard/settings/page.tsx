"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Upload, AlertCircle, CheckCircle } from "lucide-react"

interface BackupData {
  timestamp: string
  customers: any[]
  vehicles: any[]
  rentals: any[]
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

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

      // Download JSON file
      const jsonString = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `3lmoto-backup-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)

      setMessage({ type: 'success', text: `✅ Sao lưu thành công! (${customers?.length || 0} khách, ${vehicles?.length || 0} xe, ${rentals?.length || 0} đơn thuê)` })
    } catch (error) {
      console.error("Backup error:", error)
      setMessage({ type: 'error', text: `❌ Lỗi sao lưu: ${(error as any).message}` })
    } finally {
      setLoading(false)
    }
  }

  // Restore - Import dữ liệu
  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
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
        `⚠️ BẠN SẼ RESTORE DỮ LIỆU TỪ: ${new Date(backupData.timestamp).toLocaleString('vi-VN')}\n\n` +
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-gray-600">Quản lý sao lưu và khôi phục dữ liệu</p>
      </div>

      {/* Backup & Restore Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            💾 Sao lưu & Khôi phục dữ liệu
          </CardTitle>
          <CardDescription>
            Sao lưu dữ liệu của bạn hoặc khôi phục từ file backup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className={`p-3 rounded-lg flex gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm whitespace-pre-line">{message.text}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backup Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Download className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900 mb-2">Sao lưu dữ liệu</h3>
              <p className="text-sm text-gray-600 mb-4">
                Xuất tất cả khách hàng, xe, và đơn thuê ra file JSON
              </p>
              <Button
                onClick={handleBackup}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white w-full"
              >
                {loading ? "Đang xử lý..." : "📥 Sao lưu ngay"}
              </Button>
            </div>

            {/* Restore Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h3 className="font-semibold text-gray-900 mb-2">Khôi phục dữ liệu</h3>
              <p className="text-sm text-gray-600 mb-4">
                Nhập dữ liệu từ file backup (sẽ xóa dữ liệu hiện tại)
              </p>
              <Button
                onClick={() => {
                  const input = document.createElement("input")
                  input.type = "file"
                  input.accept = ".json"
                  input.onchange = (e) => handleRestore(e as any)
                  input.click()
                }}
                disabled={loading}
                className="bg-emerald-500 hover:bg-emerald-600 text-white w-full"
              >
                {loading ? "Đang xử lý..." : "📤 Khôi phục từ file"}
              </Button>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              ⚠️ <strong>Lưu ý:</strong> Khi khôi phục, tất cả dữ liệu hiện tại sẽ bị xóa và thay thế bằng dữ liệu từ file backup. Hãy sao lưu dữ liệu hiện tại trước khi khôi phục.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
