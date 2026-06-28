"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getVehiclesDueMaintenance, markVehicleAsMaintained, MaintenanceVehicle } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Check, AlertTriangle, RefreshCw, Search, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

export default function MaintenancePage() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState<MaintenanceVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [maintaining, setMaintaining] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("desc")
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const itemsPerPage = 15

  useEffect(() => {
    loadVehicles()
  }, [])

  const loadVehicles = async () => {
    try {
      setLoading(true)

      // Check if user is demo account (demo)
      const isDemoAccount = user?.username === "demo"

      if (isDemoAccount) {
        setVehicles([])
        setLoading(false)
        return
      }

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

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortOrder, vehicles])

  const filteredVehicles = vehicles
    .filter(vehicle => {
      const matchQuery = 
        vehicle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vehicle.licensePlate.toLowerCase().includes(searchQuery.toLowerCase())
      return matchQuery
    })
    .sort((a, b) => {
      const aMnt = Math.floor(a.current_km / 1000) * 1000
      const aOver = a.current_km - aMnt
      const bMnt = Math.floor(b.current_km / 1000) * 1000
      const bOver = b.current_km - bMnt
      return sortOrder === "desc" ? bOver - aOver : aOver - bOver
    })

  const totalPages = Math.ceil(filteredVehicles.length / itemsPerPage)
  const paginatedVehicles = filteredVehicles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">🔧 Bảo trì xe</h1>
          <p className="text-slate-500 text-xs mt-1">
            Danh sách xe đến hạn bảo trì (cứ 1000 KM bảo trì 1 lần)
          </p>
        </div>
        <Button
          onClick={loadVehicles}
          variant="outline"
          size="sm"
          disabled={loading}
          className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {loading ? "Đang tải..." : "Tải lại"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm kiếm xe theo biển số hoặc tên xe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-slate-200 rounded-xl"
          />
        </div>
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-full sm:w-64 bg-white border-slate-200 rounded-xl">
            <SelectValue placeholder="Sắp xếp" />
          </SelectTrigger>
          <SelectContent className="bg-white border-slate-200 rounded-xl">
            <SelectItem value="desc">KM quá hạn: Cao đến thấp</SelectItem>
            <SelectItem value="asc">KM quá hạn: Thấp đến cao</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Main Content Card */}
      <Card className="bg-white border-0 card-shadow rounded-2xl overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 pt-6 pb-4 px-6">
          <CardTitle className="text-slate-800 font-bold tracking-tight text-lg">Xe cần bảo trì</CardTitle>
          <CardDescription className="text-xs md:text-sm text-slate-500">
            Hiển thị {filteredVehicles.length} xe cần bảo trì ngay
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filteredVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Tuyệt vời! 🎉</h3>
              <p className="text-muted-foreground">
                Không có xe nào cần bảo trì phù hợp bộ lọc tìm kiếm
              </p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100">
                  <TableHead className="w-16 text-center font-semibold text-slate-500 text-[11px] uppercase tracking-wider">STT</TableHead>
                  <TableHead className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Tên xe</TableHead>
                  <TableHead className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Biển số</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-[11px] uppercase tracking-wider">KM hiện tại</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-[11px] uppercase tracking-wider">KM cần bảo trì</TableHead>
                  <TableHead className="text-right font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Quá hạn</TableHead>
                  <TableHead className="text-center font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedVehicles.map((vehicle, index) => {
                  const mntKm = Math.floor(vehicle.current_km / 1000) * 1000
                  const overKm = vehicle.current_km - mntKm
                  return (
                    <TableRow key={vehicle.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="text-center text-slate-500 font-medium w-16">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{vehicle.name}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-600">{vehicle.licensePlate}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-700">{vehicle.current_km.toLocaleString()} km</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-900 font-semibold">
                        {mntKm.toLocaleString()} km
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 font-mono text-xs">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-orange-600 font-bold">
                            +{overKm.toLocaleString()} km
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-semibold text-xs h-8 rounded-lg"
                              disabled={maintaining === vehicle.id}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              {maintaining === vehicle.id ? "Đang lưu..." : "Đã bảo trì"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-white rounded-2xl border-0 card-shadow">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-slate-800 font-bold text-lg">Xác nhận bảo trì?</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm text-slate-500">
                                Bạn chắc chắn {vehicle.name} ({vehicle.licensePlate}) đã bảo trì xong ở {vehicle.current_km.toLocaleString()} km? Mốc bảo trì tiếp theo sẽ được tính từ mốc này.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl border-slate-200">Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleMaintained(vehicle.id, vehicle.name, vehicle.current_km)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                              >
                                Xác nhận
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100">
                <span className="text-xs text-slate-500 mr-2">
                  Trang {currentPage} / {totalPages}
                </span>
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-200 rounded-xl"
                >
                  Trước
                </Button>
                <Button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-slate-200 rounded-xl"
                >
                  Tiếp
                </Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Collapsible Guidelines Section */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl overflow-hidden">
        <button 
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left font-semibold text-blue-900 hover:bg-blue-50/80 transition-colors"
        >
          <span className="flex items-center gap-2">ℹ️ Hướng dẫn bảo trì</span>
          {isGuideOpen ? <ChevronUp className="w-4 h-4 text-blue-700" /> : <ChevronDown className="w-4 h-4 text-blue-700" />}
        </button>
        {isGuideOpen && (
          <div className="px-5 pb-5 pt-1 border-t border-blue-100/50">
            <ul className="text-xs md:text-sm text-blue-800/90 space-y-2">
              <li>• Xe được đánh dấu cần bảo trì khi ODO đạt bội số của 1000 KM</li>
              <li>• Ví dụ: Xe mới chưa bảo trì (0 KM) → cần bảo trì lần đầu ở 1000 KM</li>
              <li>• Sau khi bảo trì 1000 KM → lần tiếp theo ở 2000 KM, 3000 KM, v.v...</li>
              <li>• Bấm "Đã bảo trì" để reset bộ đếm sau khi hoàn tất bảo trì</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
