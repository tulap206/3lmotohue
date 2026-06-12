"use client"

import { useState, useEffect } from "react"
import { getVehiclesDueMaintenance, markVehicleAsMaintained, MaintenanceVehicle } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Check, AlertTriangle, RefreshCw } from "lucide-react"
import { toast } from "sonner"

export default function MaintenancePage() {
  const [vehicles, setVehicles] = useState<MaintenanceVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [maintaining, setMaintaining] = useState<string | null>(null)

  useEffect(() => {
    loadVehicles()
  }, [])

  const loadVehicles = async () => {
    try {
      setLoading(true)
      const data = await getVehiclesDueMaintenance()
      setVehicles(data)
    } catch (error) {
      toast.error("Lỗi tải dữ liệu xe")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleMaintained = async (vehicleId: string, vehicleName: string, currentKm: number) => {
    try {
      setMaintaining(vehicleId)
      await markVehicleAsMaintained(vehicleId, currentKm)
      toast.success(`✓ ${vehicleName} đã bảo trì xong`)
      await loadVehicles()
    } catch (error) {
      toast.error("Lỗi cập nhật bảo trì")
      console.error(error)
    } finally {
      setMaintaining(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🔧 Bảo trì xe</h1>
          <p className="text-muted-foreground mt-2">
            Danh sách xe đến hạn bảo trì (cứ 1000 KM bảo trì 1 lần)
          </p>
        </div>
        <Button
          onClick={loadVehicles}
          variant="outline"
          size="sm"
          disabled={loading}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {loading ? "Đang tải..." : "Tải lại"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Xe cần bảo trì</CardTitle>
          <CardDescription>
            Hiển thị {vehicles.length} xe cần bảo trì ngay
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Tuyệt vời! 🎉</h3>
              <p className="text-muted-foreground">
                Tất cả xe đều đã bảo trì đúng định kỳ
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên xe</TableHead>
                  <TableHead>Biển số</TableHead>
                  <TableHead className="text-right">KM hiện tại</TableHead>
                  <TableHead className="text-right">KM cần bảo trì</TableHead>
                  <TableHead className="text-right">Quá hạn</TableHead>
                  <TableHead className="text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map(vehicle => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.name}</TableCell>
                    <TableCell>{vehicle.licensePlate}</TableCell>
                    <TableCell className="text-right">{vehicle.current_km.toLocaleString()} km</TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-red-600">
                        {vehicle.next_maintenance_km.toLocaleString()} km
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        <span className="text-orange-600 font-semibold">
                          +{Math.abs(vehicle.km_until_maintenance).toLocaleString()} km
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            disabled={maintaining === vehicle.id}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            {maintaining === vehicle.id ? "Đang lưu..." : "Đã bảo trì"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xác nhận bảo trì?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Bạn chắc chắn {vehicle.name} ({vehicle.licensePlate}) đã bảo trì xong ở {vehicle.current_km.toLocaleString()} km?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleMaintained(vehicle.id, vehicle.name, vehicle.current_km)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Xác nhận
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ Hướng dẫn bảo trì</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Xe được đánh dấu cần bảo trì khi ODO đạt bội số của 1000 KM</li>
          <li>• Ví dụ: Xe mới chưa bảo trì (0 KM) → cần bảo trì lần đầu ở 1000 KM</li>
          <li>• Sau khi bảo trì 1000 KM → lần tiếp theo ở 2000 KM, 3000 KM, v.v...</li>
          <li>• Bấm "Đã bảo trì" để reset bộ đếm sau khi hoàn tất bảo trì</li>
        </ul>
      </div>
    </div>
  )
}
