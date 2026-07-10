"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getVehiclesDueMaintenance, markVehicleAsMaintained, MaintenanceVehicle } from "@/lib/supabase"
import { CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import {
  ModulePageShell,
  ModuleSubpageHeader,
  ModuleSectionCard,
  ModuleResponsiveTable,
  ModuleMobileCard,
} from "@/components/dashboard/module-shell"
import { RentalKpiCard, rentalTableHeadClass, rentalFilterInputClass } from "@/components/dashboard/rental-ui"
import { cn } from "@/lib/utils"

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

      // Check if user is demo account (quy79)
      const isDemoAccount = user?.username === "quy79"

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

  const getOverdueKm = (km: number) => km - Math.floor(km / 1000) * 1000

  const maintenanceStats = {
    total: vehicles.length,
    filtered: filteredVehicles.length,
    urgent: vehicles.filter((v) => getOverdueKm(v.current_km) >= 300).length,
    avgOverdue:
      vehicles.length > 0
        ? Math.round(vehicles.reduce((sum, v) => sum + getOverdueKm(v.current_km), 0) / vehicles.length)
        : 0,
  }

  return (
    <ModulePageShell module="rental">
      <ModuleSubpageHeader
        module="rental"
        title="Bảo trì xe"
        subtitle="Danh sách xe đến hạn bảo trì (cứ 1000 KM bảo trì 1 lần)"
        breadcrumbs={[
          { label: "Cho thuê xe", href: "/dashboard" },
          { label: "Bảo trì xe" },
        ]}
        actions={
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
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RentalKpiCard label="Xe cần bảo trì" value={maintenanceStats.total} sublabel={`${maintenanceStats.filtered} đang lọc`} />
          <RentalKpiCard label="Cần gấp" value={maintenanceStats.urgent} sublabel="Quá hạn ≥ 300 km" valueClassName="text-blue-700" />
          <RentalKpiCard label="KM quá hạn TB" value={maintenanceStats.avgOverdue} sublabel="km trung bình" valueClassName="text-amber-700" />
          <RentalKpiCard
            label="Mốc bảo trì"
            value="1.000"
            sublabel="km / lần bảo trì"
            valueClassName="text-slate-700"
          />
        </div>

      <ModuleSectionCard
        title="Xe cần bảo trì"
        description={`Quản lý ${filteredVehicles.length} xe cần bảo trì`}
        filters={
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm biển số, tên xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(rentalFilterInputClass, "pl-9")}
              />
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full md:w-56 h-9 rounded-xl border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Sắp xếp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">KM quá hạn: Cao → thấp</SelectItem>
                <SelectItem value="asc">KM quá hạn: Thấp → cao</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <CardContent className="p-0">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-12">
              <Check className="w-12 h-12 text-emerald-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Không có xe nào cần bảo trì phù hợp bộ lọc</p>
            </div>
          ) : (
            <ModuleResponsiveTable
              desktop={
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="module-table-head border-b border-slate-100 bg-slate-50/50">
                      <th className={cn(rentalTableHeadClass, "w-12 text-center")}>STT</th>
                      <th className={rentalTableHeadClass}>Tên xe</th>
                      <th className={rentalTableHeadClass}>Biển số</th>
                      <th className={cn(rentalTableHeadClass, "text-right")}>KM hiện tại</th>
                      <th className={cn(rentalTableHeadClass, "text-right")}>KM cần bảo trì</th>
                      <th className={cn(rentalTableHeadClass, "text-right")}>Quá hạn</th>
                      <th className={cn(rentalTableHeadClass, "text-right")}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                    {paginatedVehicles.map((vehicle, index) => {
                      const mntKm = Math.floor(vehicle.current_km / 1000) * 1000
                      const overKm = vehicle.current_km - mntKm
                      return (
                        <tr key={vehicle.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-medium">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">{vehicle.name}</td>
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-600">{vehicle.licensePlate}</td>
                          <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums">{vehicle.current_km.toLocaleString()} km</td>
                          <td className="py-3.5 px-4 text-right font-mono text-xs font-semibold tabular-nums">{mntKm.toLocaleString()} km</td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex items-center gap-1 font-mono text-xs text-orange-600 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              +{overKm.toLocaleString()} km
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-end">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                                    disabled={maintaining === vehicle.id}
                                    title="Đã bảo trì"
                                  >
                                    <Check className="w-3.5 h-3.5" />
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
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              }
              mobile={paginatedVehicles.map((vehicle) => {
                const mntKm = Math.floor(vehicle.current_km / 1000) * 1000
                const overKm = vehicle.current_km - mntKm
                return (
                  <ModuleMobileCard key={vehicle.id}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{vehicle.licensePlate}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-100 shrink-0">
                        +{overKm.toLocaleString()} km
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span className="tabular-nums">{vehicle.current_km.toLocaleString()} km</span>
                      <span className="tabular-nums">Mốc: {mntKm.toLocaleString()} km</span>
                    </div>
                    
                    {/* Mobile action bar */}
                    <div className="flex justify-end items-center mt-2 pt-2 border-t border-slate-100/50">
                      <Button
                        onClick={() => {
                          if (window.confirm(`Bạn chắc chắn ${vehicle.name} (${vehicle.licensePlate}) đã bảo trì xong ở ${vehicle.current_km.toLocaleString()} km?`)) {
                            handleMaintained(vehicle.id, vehicle.name, vehicle.current_km)
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-semibold h-7 px-2.5"
                      >
                        Bảo trì xong
                      </Button>
                    </div>
                  </ModuleMobileCard>
                )
              })}
            />
          )}
        </CardContent>
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
      </ModuleSectionCard>
      </div>

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
    </ModulePageShell>
  )
}
