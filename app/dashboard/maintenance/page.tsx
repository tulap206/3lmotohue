"use client"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRentalData } from "@/contexts/rental-data-context"
import { markVehicleAsMaintained, calculateMaintenanceStatus, MaintenanceVehicle } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog } from "@/components/ui/dialog"
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
import {
  EntityFormDialogContent,
  EntityFormHeader,
} from "@/components/dashboard/entity-form-dialog"
import { Check, AlertTriangle, RefreshCw, Search, ChevronDown, ChevronUp, ImageIcon, Eye } from "lucide-react"
import { toast } from "sonner"
import {
  ModulePageShell,
  ModuleSubpageHeader,
  ModuleSectionCard,
  ModuleResponsiveTable,
  ModuleMobileCard,
  ModulePagination,
} from "@/components/dashboard/module-shell"
import {
  RentalKpiCard,
  rentalTableHeadClass,
  rentalFilterInputClass,
  getRentalVehicleStatusLabel,
  rentalVehicleStatusBadgeClass,
} from "@/components/dashboard/rental-ui"
import { cn } from "@/lib/utils"
import { formatDisplayDate } from "@/lib/format-date"

export default function MaintenancePage() {
  const { user } = useAuth()
  const { vehicles: allVehicles, orders, isLoading: loading, refresh } = useRentalData()
  const [maintaining, setMaintaining] = useState<string | null>(null)
  const [viewingVehicle, setViewingVehicle] = useState<MaintenanceVehicle | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("desc")
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const itemsPerPage = 15

  // Derive maintenance vehicles list from shared context
  const vehicles: MaintenanceVehicle[] = useMemo(() => {
    return allVehicles
      .map(v => calculateMaintenanceStatus(v))
      .filter(v => v.km_until_maintenance <= 0)
  }, [allVehicles])

  const openDetailDialog = (vehicle: MaintenanceVehicle) => {
    setViewingVehicle(vehicle)
  }

  const formatPrice = (n: number) => `${(n || 0).toLocaleString("vi-VN")}đ`

  const handleMaintained = async (vehicleId: string, vehicleName: string, currentKm: number) => {
    try {
      setMaintaining(vehicleId)
      await markVehicleAsMaintained(vehicleId, currentKm)
      toast.success(`✓ ${vehicleName} đã bảo trì xong`)
      await refresh()
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

  const filteredVehicles = useMemo(() => {
    return vehicles
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
  }, [vehicles, searchQuery, sortOrder])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredVehicles.length / itemsPerPage)
  }, [filteredVehicles])

  const paginatedVehicles = useMemo(() => {
    return filteredVehicles.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    )
  }, [filteredVehicles, currentPage])

  const getOverdueKm = (km: number) => km - Math.floor(km / 1000) * 1000

  const maintenanceStats = useMemo(() => {
    return {
      total: vehicles.length,
      filtered: filteredVehicles.length,
      urgent: vehicles.filter((v) => getOverdueKm(v.current_km) >= 300).length,
      avgOverdue:
        vehicles.length > 0
          ? Math.round(vehicles.reduce((sum, v) => sum + getOverdueKm(v.current_km), 0) / vehicles.length)
          : 0,
    }
  }, [vehicles, filteredVehicles])

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={refresh}
              variant="outline"
              size="sm"
              disabled={loading}
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm h-10 px-4 font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {loading ? "Đang tải..." : "Tải lại"}
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <RentalKpiCard variant="hero" label="Xe cần bảo trì" value={maintenanceStats.total} sublabel={`${maintenanceStats.filtered} đang lọc`} />
          <RentalKpiCard variant="hero" label="Cần gấp" value={maintenanceStats.urgent} sublabel="Quá hạn ≥ 300 km" valueClassName="text-rose-700" />
          <RentalKpiCard variant="hero" label="KM quá hạn TB" value={maintenanceStats.avgOverdue} sublabel="km trung bình" valueClassName="text-amber-700" />
          <RentalKpiCard variant="hero"
            label="Mốc bảo trì"
            value="1.000"
            sublabel="km / lần bảo trì"
            valueClassName="text-slate-700"
          />
        </div>

      <ModuleSectionCard
        title="Danh sách xe cần bảo trì"
        description={`Quản lý ${filteredVehicles.length} phương tiện quá hạn hoặc tới hạn bảo dưỡng`}
        filters={
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-48">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm biển số, tên xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(rentalFilterInputClass, "pl-9 h-10")}
              />
            </div>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-full lg:w-56 h-10 rounded-xl border-slate-200 text-sm bg-white">
                <SelectValue placeholder="Sắp xếp" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-100 rounded-xl">
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
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className={cn(rentalTableHeadClass, "w-12 text-center text-slate-600")}>STT</th>
                      <th className={cn(rentalTableHeadClass, "text-slate-600")}>Tên xe</th>
                      <th className={cn(rentalTableHeadClass, "text-slate-600")}>Biển số</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>KM hiện tại</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>KM cần bảo trì</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Quá hạn</th>
                      <th className={cn(rentalTableHeadClass, "text-right text-slate-600")}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm text-slate-700">
                    {paginatedVehicles.map((vehicle, index) => {
                      const mntKm = Math.floor(vehicle.current_km / 1000) * 1000
                      const overKm = vehicle.current_km - mntKm
                      return (
                        <tr key={vehicle.id} className="module-table-row hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 text-center text-sm text-slate-400 font-semibold">
                            {(currentPage - 1) * itemsPerPage + index + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              className="font-bold text-slate-800 text-[15px] hover:text-slate-700 hover:underline text-left"
                              onClick={() => openDetailDialog(vehicle)}
                            >
                              {vehicle.name}
                            </button>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block bg-white text-slate-800 border border-slate-350 font-mono font-bold px-2.5 py-1 rounded text-sm shadow-sm tracking-wider uppercase">
                              {vehicle.licensePlate}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-sm font-medium text-slate-800 tabular-nums">{vehicle.current_km.toLocaleString()} km</td>
                          <td className="py-3.5 px-4 text-right font-mono text-sm font-semibold text-slate-800 tabular-nums">{mntKm.toLocaleString()} km</td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="inline-flex items-center gap-1 font-mono text-sm text-orange-600 font-bold">
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
                        <button
                          type="button"
                          className="font-semibold text-slate-800 hover:text-slate-700 hover:underline text-left"
                          onClick={() => openDetailDialog(vehicle)}
                        >
                          {vehicle.name}
                        </button>
                        <p className="text-sm text-slate-500 font-mono">{vehicle.licensePlate}</p>
                      </div>
                      <span className="text-sm font-bold px-2 py-0.5 rounded-full border bg-orange-50 text-orange-700 border-orange-100 shrink-0">
                        +{overKm.toLocaleString()} km
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-slate-500">
                      <span className="tabular-nums">{vehicle.current_km.toLocaleString()} km</span>
                      <span className="tabular-nums">Mốc: {mntKm.toLocaleString()} km</span>
                    </div>
                    
                    {/* Mobile action bar */}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-500"
                        onClick={() => openDetailDialog(vehicle)}
                        title="Chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => {
                          if (window.confirm(`Bạn chắc chắn ${vehicle.name} (${vehicle.licensePlate}) đã bảo trì xong ở ${vehicle.current_km.toLocaleString()} km?`)) {
                            handleMaintained(vehicle.id, vehicle.name, vehicle.current_km)
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-7 px-3.5 font-semibold"
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
        <ModulePagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={filteredVehicles.length}
          itemLabel="xe"
          onPageChange={setCurrentPage}
        />
      </ModuleSectionCard>
      </div>

      {/* Vehicle Detail Dialog */}
      <Dialog open={!!viewingVehicle} onOpenChange={(open) => !open && setViewingVehicle(null)}>
        <EntityFormDialogContent accent="blue" maxWidth="lg">
          {viewingVehicle && (() => {
            const v = viewingVehicle
            const mntKm = Math.floor(v.current_km / 1000) * 1000
            const overKm = v.current_km - mntKm
            const vOrders = orders.filter((o) => o.vehicleId === v.id)
            const recentOrders = [...vOrders]
              .sort((a, b) => new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime())
              .slice(0, 4)

            return (
              <>
                <EntityFormHeader
                  title={v.name}
                  description={`${v.licensePlate || "Chưa biển"}${v.color ? ` · ${v.color}` : ""}`}
                />
                <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "inline-flex items-center text-sm font-bold px-2 py-1 rounded-full border",
                      rentalVehicleStatusBadgeClass(v.status)
                    )}>
                      {getRentalVehicleStatusLabel(v.status)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold px-2 py-1 rounded-full border bg-orange-50 text-orange-700 border-orange-100">
                      <AlertTriangle className="w-3 h-3" />
                      Quá hạn +{overKm.toLocaleString("vi-VN")} km
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-orange-600 uppercase">KM hiện tại</p>
                      <p className="text-sm font-extrabold text-orange-700 tabular-nums">{v.current_km.toLocaleString("vi-VN")} km</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-amber-600 uppercase">Mốc bảo trì</p>
                      <p className="text-sm font-extrabold text-amber-700 tabular-nums">{mntKm.toLocaleString("vi-VN")} km</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-blue-600 uppercase">Giá thuê/ngày</p>
                      <p className="text-sm font-extrabold text-blue-700 tabular-nums">{formatPrice(v.pricePerDay)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase">Tổng đơn</p>
                      <p className="text-sm font-extrabold text-slate-800">{vOrders.length} đơn</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Giá mua</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{formatPrice(v.purchasePrice)}</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-0.5">Lần BT gần nhất</p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">
                        {(v.last_maintenance_km ?? 0).toLocaleString("vi-VN")} km
                      </p>
                    </div>
                  </div>

                  {v.notes && v.notes.trim() && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-1">Ghi chú</p>
                      <p className="text-sm text-slate-700 whitespace-pre-line">{v.notes}</p>
                    </div>
                  )}

                  {recentOrders.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Đơn thuê gần đây</p>
                      <div className="space-y-1.5">
                        {recentOrders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-sm bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 gap-2">
                            <span className="font-bold text-slate-700 truncate">{o.customerName}</span>
                            <span className="text-slate-400 shrink-0">{formatDisplayDate(o.startDate)}</span>
                            <span className="font-bold tabular-nums text-blue-600 shrink-0">
                              {(o.totalPrice || 0).toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(v.vehicleImages?.length > 0 || v.documentImages?.length > 0) ? (
                    <div className="space-y-3">
                      {v.vehicleImages?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Ảnh xe</p>
                          <div className="grid grid-cols-3 gap-2">
                            {v.vehicleImages.map((img, index) => (
                              <div key={index} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                                <img src={img} alt={`Xe ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {v.documentImages?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-500 uppercase mb-2">Ảnh giấy tờ</p>
                          <div className="grid grid-cols-3 gap-2">
                            {v.documentImages.map((img, index) => (
                              <div key={index} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                                <img src={img} alt={`Giấy tờ ${index + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-sm">Chưa có ảnh xe / giấy tờ</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-sm"
                      onClick={() => setViewingVehicle(null)}
                    >
                      Đóng
                    </Button>
                    <Button
                      className="flex-1 h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={maintaining === v.id}
                      onClick={async () => {
                        await handleMaintained(v.id, v.name, v.current_km)
                        setViewingVehicle(null)
                      }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1.5" />
                      Đã bảo trì
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </EntityFormDialogContent>
      </Dialog>

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
            <ul className="text-sm text-blue-800/90 space-y-2">
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
