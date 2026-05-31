"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase, fetchVehicles, fetchRentals, fetchCustomers, insertCustomer, insertRental } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Bike, Calendar, User, Phone, MapPin, Facebook, 
  Shield, Clock, Star, CheckCircle, ArrowRight, 
  Menu, X, HelpCircle, PhoneCall, Check, Loader2, MessageCircle 
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"

export default function LandingPage() {
  const router = useRouter()
  
  // Form booking states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    facebook: "",
    address: "",
    startDate: "",
    endDate: "",
  })
  
  // Search & loading states
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [totalDays, setTotalDays] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [isOpenContact, setIsOpenContact] = useState(false)
  
  // Calculate total rental days
  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      if (start <= end) {
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        setTotalDays(days === 0 ? 1 : days) // Minimum 1 day
      } else {
        setTotalDays(0)
      }
    } else {
      setTotalDays(0)
    }
  }, [formData.startDate, formData.endDate])

  // Fetch available vehicles that don't conflict with current rentals
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !formData.startDate || !formData.endDate) {
      alert("Vui lòng nhập đầy đủ họ tên, số điện thoại và thời gian thuê xe!")
      return
    }

    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    if (start > end) {
      alert("Ngày nhận xe phải trước hoặc trùng ngày trả xe!")
      return
    }

    setIsLoading(true)
    try {
      const [vehicles, rentals] = await Promise.all([
        fetchVehicles(),
        fetchRentals()
      ])

      // Find conflicting vehicles in selected date range
      const conflictingVehicleIds = new Set(
        rentals
          .filter((rental: any) => {
            if (rental.status === "cancelled") return false
            
            // Convert dd/mm/yyyy from Supabase to Date objects
            const parseDate = (dStr: string) => {
              const parts = dStr.split('/')
              return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            }
            
            const rStart = parseDate(rental.startDate)
            const rEnd = parseDate(rental.endDate)
            
            return !(end < rStart || start > rEnd)
          })
          .map((rental: any) => rental.vehicleId)
      )

      // Filter vehicles that are available and have no conflicts
      const available = vehicles.filter((vehicle: any) => {
        return vehicle.status === "available" && !conflictingVehicleIds.has(vehicle.id)
      })

      setAvailableVehicles(available)
      setIsModalOpen(true)
    } catch (error) {
      console.error("Lỗi khi tìm xe máy:", error)
      alert("Đã xảy ra lỗi khi tìm kiếm xe máy trống. Vui lòng thử lại!")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle final booking submission
  const handleConfirmBooking = async (vehicle: any) => {
    setSelectedVehicle(vehicle)
    setIsSubmitting(true)
    try {
      // 1. Fetch current customers to see if customer already exists (by phone)
      const customersList = await fetchCustomers()
      let customer = customersList.find((c: any) => c.phone === formData.phone)
      let customerId = ""

      if (customer) {
        customerId = customer.id
      } else {
        // Create new customer
        const newCustomer = await insertCustomer({
          name: formData.name,
          phone: formData.phone,
          facebook: formData.facebook || "",
          address: formData.address || "",
          idcard: "",
          totalrentals: 0,
          status: "active",
          customerphoto: [],
          cccdfront: [],
          cccdback: [],
          licensefront: [],
          licenseback: []
        })
        customerId = newCustomer.id
      }

      // 2. Format dates to dd/mm/yyyy
      const formatDateStr = (dateInput: string) => {
        const d = new Date(dateInput)
        const day = String(d.getDate()).padStart(2, '0')
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
      }

      const formattedStart = formatDateStr(formData.startDate)
      const formattedEnd = formatDateStr(formData.endDate)
      const totalPrice = totalDays * vehicle.pricePerDay

      // 3. Insert new rental
      await insertRental({
        customerId,
        customerName: formData.name,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        licensePlate: vehicle.licensePlate,
        startDate: formattedStart,
        endDate: formattedEnd,
        totalDays,
        pricePerDay: vehicle.pricePerDay,
        totalPrice,
        deposit: 0, // Admin will set deposit on approval
        extraFees: 0,
        notes: "Khách đặt trực tuyến từ website",
        revenue: 0,
        status: "pending"
      })

      setBookingSuccess(true)
    } catch (error) {
      console.error("Lỗi khi đặt xe:", error)
      alert("Đã xảy ra lỗi khi gửi yêu cầu đặt xe máy. Vui lòng liên hệ hotline!")
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeBookingModal = () => {
    setIsModalOpen(false)
    setBookingSuccess(false)
    setSelectedVehicle(null)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-blue-100/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 relative bg-blue-900 rounded-xl overflow-hidden flex items-center justify-center border border-blue-500 shadow-md">
              <Image 
                src="/logo.jpg"
                alt="3LMoto Rental Logo" 
                fill
                className="object-contain"
                onError={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.display = 'none';
                }}
              />
            </div>
            <div>
              <span className="text-2xl font-black bg-gradient-to-r from-blue-800 to-cyan-600 bg-clip-text text-transparent tracking-wider font-serif">3LMOTO</span>
              <span className="block text-[10px] text-blue-600 font-semibold tracking-widest uppercase">Cho thuê xe máy tại Huế</span>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#booking" className="hover:text-blue-800 transition-colors">Đặt Xe Máy</a>
            <a href="#about" className="hover:text-blue-800 transition-colors">Về Chúng Tôi</a>
            <a href="#fleet" className="hover:text-blue-800 transition-colors">Bảng Giá</a>
            <a href="#process" className="hover:text-blue-800 transition-colors">Quy Trình</a>
            <a href="#contact" className="hover:text-blue-800 transition-colors">Liên Hệ</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              href="/login"
              className="px-5 py-2.5 rounded-xl border border-blue-200 hover:border-blue-600 hover:text-blue-800 transition-all font-semibold text-sm flex items-center gap-2 hover:shadow-sm"
            >
              <User className="w-4 h-4" />
              <span>Đăng nhập</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section & Booking Form */}
      <section className="relative z-10 min-h-[85vh] flex items-center justify-center py-12 sm:py-20 overflow-hidden text-white bg-no-repeat">
        <Image 
          src="/hue-motorbike-bg-v3.jpg"
          alt="Huế Motorbike Background"
          fill
          priority
          className="object-cover z-0"
        />
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-950/50 via-slate-950/40 to-cyan-950/50 z-10" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl" />

        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Hero text */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left p-6 sm:p-8 rounded-3xl bg-slate-950/45 backdrop-blur-md border border-white/10 shadow-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-800/60 border border-blue-500/30 text-cyan-300 text-xs font-semibold uppercase tracking-wider">
              <Star className="w-3.5 h-3.5 fill-cyan-300 text-cyan-300" />
              3L MOTO - CHO THUÊ XE MÁY TẠI HUẾ
            </span>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-serif leading-tight text-white uppercase">
              <span className="block">CỐ ĐÔ HUẾ</span>
              <span className="block bg-gradient-to-r from-cyan-400 via-blue-300 to-cyan-300 bg-clip-text text-transparent">TẬN HƯỞNG NHỮNG CHUYẾN ĐI</span>
            </h1>
            <div className="text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-light space-y-2">
              <p className="font-semibold text-white">Cho thuê xe máy đời mới tại TP Huế:</p>
              <ul className="list-none space-y-1 text-sm text-slate-300 text-left max-w-xs mx-auto lg:mx-0">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-cyan-400" />
                  Thủ tục đơn giản
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-cyan-400" />
                  Giao xe tận nơi Miễn Phí (nội thành)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-cyan-400" />
                  Giá cả cạnh tranh
                </li>
              </ul>
              <p className="text-sm text-slate-400 pt-2">
                3LMOTO chuyên cung cấp dịch vụ thuê xe máy chất lượng cao giúp du khách tự do khám phá cố đô Huế mộng mơ. Xe được trang bị sẵn 2 nón bảo hiểm cao cấp và áo mưa.
              </p>
            </div>
            
            <div className="hidden lg:flex items-center gap-6 pt-4 text-sm text-blue-300">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-400" />
                <span>2 Mũ bảo hiểm & Áo mưa</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <span>Giao nhận xe miễn phí</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-cyan-400" />
                <span>Thủ tục đơn giản nhanh chóng</span>
              </div>
            </div>
          </div>

          {/* Booking Form */}
          <div id="booking" className="lg:col-span-5 bg-white text-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-blue-100 hover:shadow-blue-900/10 transition-all duration-300">
            <h2 className="text-2xl font-bold text-blue-950 font-serif text-center mb-6">
              Đặt xe máy trực tuyến
            </h2>
            
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-500 uppercase">Họ và tên *</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-blue-500/60" />
                  <Input 
                    id="name"
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-blue-600/20 rounded-xl transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs font-semibold text-slate-500 uppercase">Số điện thoại *</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-blue-500/60" />
                  <Input 
                    id="phone"
                    type="tel"
                    required
                    placeholder="VD: 0363077775"
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-blue-600/20 rounded-xl transition-all"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="startDate" className="text-xs font-semibold text-slate-500 uppercase">Ngày nhận *</Label>
                  <Input 
                    id="startDate"
                    type="date"
                    required
                    className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-blue-600/20 rounded-xl text-sm"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate" className="text-xs font-semibold text-slate-500 uppercase">Ngày trả *</Label>
                  <Input 
                    id="endDate"
                    type="date"
                    required
                    className="h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-blue-600/20 rounded-xl text-sm"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="facebook" className="text-xs font-semibold text-slate-500 uppercase">Link Facebook hoặc Zalo</Label>
                <div className="relative">
                  <Facebook className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-blue-500/60" />
                  <Input 
                    id="facebook"
                    type="text"
                    placeholder="facebook.com/nguyenvana"
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-blue-600/20 rounded-xl transition-all"
                    value={formData.facebook}
                    onChange={(e) => setFormData({...formData, facebook: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs font-semibold text-slate-500 uppercase">Nơi nhận xe (Ga Huế, Khách sạn...)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-blue-500/60" />
                  <Input 
                    id="address"
                    type="text"
                    placeholder="Ga Huế hoặc tên khách sạn của bạn"
                    className="pl-11 h-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-blue-600/20 rounded-xl transition-all"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-blue-900 hover:bg-blue-950 text-white rounded-xl shadow-lg shadow-blue-900/20 font-semibold transition-all mt-4 hover-lift cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang tìm kiếm...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Tìm Xe Trống & Báo Giá
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-blue-700 font-bold uppercase tracking-wider text-sm block">Đặc Quyền Của Bạn</span>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif text-blue-950">
              Tại sao nên thuê xe máy tại 3LMoto Huế?
            </h2>
            <div className="w-20 h-1 bg-cyan-500 mx-auto rounded-full mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-3xl bg-blue-50/50 border border-blue-100 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-14 h-14 bg-blue-950 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Bike className="w-7 h-7 text-cyan-300" />
              </div>
              <h3 className="text-xl font-bold text-blue-950 font-serif">Giá Cả Hợp Lý</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Chúng tôi cam kết mức giá thuê xe máy cạnh tranh và công khai nhất tại Huế. Thuê nhiều ngày hoặc thuê theo tuần/tháng sẽ nhận thêm nhiều ưu đãi.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-blue-50/50 border border-blue-100 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-14 h-14 bg-blue-950 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7 text-cyan-300" />
              </div>
              <h3 className="text-xl font-bold text-blue-950 font-serif">Đa Dạng Các Loại Xe</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Đội xe phong phú từ xe số tiết kiệm xăng, xe tay ga đô thị thời trang đến các dòng xe ga cao cấp đời mới. Đảm bảo bảo dưỡng định kỳ và vận hành êm ái.
              </p>
            </div>

            <div className="p-8 rounded-3xl bg-blue-50/50 border border-blue-100 hover:shadow-xl transition-all duration-300 space-y-4 group">
              <div className="w-14 h-14 bg-blue-950 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                <MapPin className="w-7 h-7 text-cyan-300" />
              </div>
              <h3 className="text-xl font-bold text-blue-950 font-serif">Giao Xe Tận Nơi Hỗ Trợ 24/7</h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                Miễn phí giao nhận xe tận nơi tại trung tâm thành phố Huế, khách sạn, ga tàu. Đội kỹ thuật luôn sẵn sàng hỗ trợ sự cố trên đường 24/7.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fleet Showcase & Price table */}
      <section id="fleet" className="py-20 bg-blue-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-blue-700 font-bold uppercase tracking-wider text-sm block">Đội Xe Đa Dạng</span>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif text-blue-950">Bảng Giá Thuê Tham Khảo</h2>
            <p className="text-slate-600">Đã bao gồm 2 mũ bảo hiểm cao cấp, áo mưa và hỗ trợ cứu hộ sự cố dọc đường</p>
            <div className="w-20 h-1 bg-cyan-500 mx-auto rounded-full mt-4" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Airblade Đời Mới */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-md border border-slate-100 hover:shadow-xl transition-shadow group flex flex-col justify-between">
              <div>
                <div className="h-40 relative overflow-hidden flex items-center justify-center text-white">
                  <Image 
                    src="/airblade.jpg"
                    alt="Honda Airblade đời mới tại Huế" 
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                  <span className="absolute bottom-3 left-4 bg-blue-950/70 backdrop-blur-sm border border-white/10 text-cyan-200 text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider z-10">
                    Xe Ga Đời Mới
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-bold text-slate-800">Airblade Đời Mới</h3>
                  <p className="text-xs text-slate-500">Honda Airblade 125/150cc mạnh mẽ, thích hợp mọi cung đường.</p>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-center gap-2">✓ Khóa Smartkey thông minh, an toàn</li>
                    <li className="flex items-center gap-2">✓ Cốp xe siêu rộng đựng nhiều hành lý</li>
                    <li className="flex items-center gap-2">✓ Động cơ êm ái, bốc và tiết kiệm xăng</li>
                  </ul>
                </div>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Giá thuê:</span>
                  <span className="text-blue-800 font-extrabold text-lg">130.000đ / ngày</span>
                </div>
                <a href="#booking" className="block w-full text-center py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-xs transition-colors">
                  Đặt xe ngay
                </a>
              </div>
            </div>

            {/* Honda Vision */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-md border border-slate-100 hover:shadow-xl transition-shadow group flex flex-col justify-between">
              <div>
                <div className="h-40 relative overflow-hidden flex items-center justify-center text-white">
                  <Image 
                    src="/vision.jpg"
                    alt="Honda Vision thanh lịch tại Huế" 
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                  <span className="absolute bottom-3 left-4 bg-blue-950/70 backdrop-blur-sm border border-white/10 text-cyan-200 text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider z-10">
                    Xe Ga Đô Thị
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-bold text-slate-800">Vision</h3>
                  <p className="text-xs text-slate-500">Honda Vision thanh lịch, lựa chọn hàng đầu cho phố phường.</p>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-center gap-2">✓ Khóa Smartkey, kiểu dáng thời trang</li>
                    <li className="flex items-center gap-2">✓ Thiết kế nhỏ gọn, di chuyển linh hoạt</li>
                    <li className="flex items-center gap-2">✓ Siêu tiết kiệm nhiên liệu, dễ lái</li>
                  </ul>
                </div>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Giá thuê:</span>
                  <span className="text-blue-800 font-extrabold text-lg">120.000đ / ngày</span>
                </div>
                <a href="#booking" className="block w-full text-center py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-xs transition-colors">
                  Đặt xe ngay
                </a>
              </div>
            </div>

            {/* Yamaha Janus */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-md border border-slate-100 hover:shadow-xl transition-shadow group flex flex-col justify-between">
              <div>
                <div className="h-40 relative overflow-hidden flex items-center justify-center text-white">
                  <Image 
                    src="/janus.jpg"
                    alt="Yamaha Janus trẻ trung tại Huế" 
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                  <span className="absolute bottom-3 left-4 bg-blue-950/70 backdrop-blur-sm border border-white/10 text-cyan-200 text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider z-10">
                    Xe Ga Trẻ Trung
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-bold text-slate-800">Janus</h3>
                  <p className="text-xs text-slate-500">Yamaha Janus trẻ trung, phong cách châu Âu năng động.</p>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-center gap-2">✓ Động cơ Blue Core 125cc êm ái, bốc</li>
                    <li className="flex items-center gap-2">✓ Trọng lượng siêu nhẹ, dễ dàng điều khiển</li>
                    <li className="flex items-center gap-2">✓ Hệ thống ngắt động cơ tạm thời tiết kiệm</li>
                  </ul>
                </div>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Giá thuê:</span>
                  <span className="text-blue-800 font-extrabold text-lg">120.000đ / ngày</span>
                </div>
                <a href="#booking" className="block w-full text-center py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-xs transition-colors">
                  Đặt xe ngay
                </a>
              </div>
            </div>

            {/* Scoopter */}
            <div className="bg-white rounded-3xl overflow-hidden shadow-md border border-slate-100 hover:shadow-xl transition-shadow group flex flex-col justify-between">
              <div>
                <div className="h-40 relative overflow-hidden flex items-center justify-center text-white">
                  <Image 
                    src="/scoopter.jpg"
                    alt="Scoopter vintage sang chảnh tại Huế" 
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                  />
                  <span className="absolute bottom-3 left-4 bg-blue-950/70 backdrop-blur-sm border border-white/10 text-cyan-200 text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider z-10">
                    Xe Ga Cổ Điển
                  </span>
                </div>
                <div className="p-6 space-y-4">
                  <h3 className="text-lg font-bold text-slate-800">Scoopter</h3>
                  <p className="text-xs text-slate-500">Dòng xe tay ga cổ điển độc đáo, thích hợp vi vu sống ảo.</p>
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex items-center gap-2">✓ Kiểu dáng vintage độc lạ bắt mắt</li>
                    <li className="flex items-center gap-2">✓ Tư thế ngồi thoải mái, di chuyển êm</li>
                    <li className="flex items-center gap-2">✓ Phù hợp cho những bức ảnh checkin cực đẹp</li>
                  </ul>
                </div>
              </div>
              <div className="p-6 pt-0 space-y-4">
                <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Giá thuê:</span>
                  <span className="text-blue-800 font-extrabold text-lg">130.000đ / ngày</span>
                </div>
                <a href="#booking" className="block w-full text-center py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-semibold text-xs transition-colors">
                  Đặt xe ngay
                </a>
              </div>
            </div>
          </div>

          {/* Core Benefits Features Bar */}
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-blue-100/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                <Bike className="w-6 h-6 text-blue-850" />
              </div>
              <div>
                <h4 className="font-bold text-slate-850 text-sm">Xe Máy Chất Lượng</h4>
                <p className="text-xs text-slate-500">Bảo dưỡng định kỳ</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-blue-100/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                <Shield className="w-6 h-6 text-blue-850" />
              </div>
              <div>
                <h4 className="font-bold text-slate-850 text-sm">An Toàn & Tiện Lợi</h4>
                <p className="text-xs text-slate-500">Trang bị nón & áo mưa</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-blue-100/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                <MapPin className="w-6 h-6 text-blue-850" />
              </div>
              <div>
                <h4 className="font-bold text-slate-850 text-sm">Giao Xe Tận Nơi</h4>
                <p className="text-xs text-slate-500">Miễn phí nội thành Huế</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-blue-100/50 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-900 flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-blue-850" />
              </div>
              <div>
                <h4 className="font-bold text-slate-850 text-sm">Giá Tốt Hợp Lý</h4>
                <p className="text-xs text-slate-500">Không phí ẩn phát sinh</p>
              </div>
            </div>
          </div>

          {/* Flyer Notes Banner */}
          <div className="mt-10 bg-gradient-to-r from-blue-900 to-indigo-950 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Notes list */}
              <div className="lg:col-span-6 space-y-4 text-center md:text-left">
                <h4 className="text-lg font-bold font-serif text-cyan-300">Lưu Ý & Ưu Đãi Khi Thuê Xe</h4>
                <ul className="space-y-3 text-xs md:text-sm text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0"></span>
                    <span>Giá trên áp dụng cho thuê từ 1 ngày.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0"></span>
                    <span>Giao xe miễn phí trong nội thành Huế.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-2 shrink-0"></span>
                    <span>Vui lòng liên hệ để được hỗ trợ và tư vấn chi tiết.</span>
                  </li>
                </ul>
                <div className="pt-2">
                  <a 
                    href="#booking" 
                    className="inline-flex px-6 py-3 bg-cyan-400 hover:bg-cyan-500 text-blue-950 font-bold rounded-xl transition-all shadow-md hover:shadow-cyan-400/20 items-center gap-2 cursor-pointer"
                  >
                    <span>Đặt xe ngay</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Accessories Showcase Card */}
              <div className="lg:col-span-6 flex flex-col sm:flex-row items-center gap-6 bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
                <div className="w-32 h-32 relative flex-shrink-0 bg-white/10 rounded-xl overflow-hidden shadow-inner">
                  <Image 
                    src="/accessories.png"
                    alt="02 Mũ bảo hiểm & 01 Áo mưa miễn phí"
                    fill
                    className="object-contain p-1"
                  />
                </div>
                <div className="space-y-2 text-center sm:text-left">
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                    Quà Tặng Kèm
                  </span>
                  <h5 className="font-bold text-white text-base">02 Mũ Bảo Hiểm & 01 Áo Mưa</h5>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Nhận ngay bộ phụ kiện chính hãng 3L MOTO (gồm 02 mũ bảo hiểm cao cấp và 01 áo mưa tiện lợi) hoàn toàn miễn phí đi kèm, nhận kèm khi thuê xe máy.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-blue-700 font-bold uppercase tracking-wider text-sm block">Đơn Giản & Nhanh Chóng</span>
            <h2 className="text-3xl sm:text-4xl font-bold font-serif text-blue-950">Quy Trình 3 Bước Thuê Xe</h2>
            <div className="w-20 h-1 bg-cyan-500 mx-auto rounded-full mt-4" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="text-center space-y-4 relative">
              <div className="w-16 h-16 bg-blue-900 text-cyan-300 rounded-full flex items-center justify-center font-bold text-xl mx-auto shadow-md">
                1
              </div>
              <h3 className="text-lg font-bold text-blue-950">Chọn Xe & Đặt Online</h3>
              <p className="text-slate-600 text-sm max-w-xs mx-auto">
                Điền thông tin và thời gian thuê xe máy ở form phía trên để kiểm tra danh sách xe trống còn lại.
              </p>
            </div>

            <div className="text-center space-y-4 relative">
              <div className="w-16 h-16 bg-blue-900 text-cyan-300 rounded-full flex items-center justify-center font-bold text-xl mx-auto shadow-md">
                2
              </div>
              <h3 className="text-lg font-bold text-blue-950">Xác Nhận & Nhận Xe Tận Nơi</h3>
              <p className="text-slate-600 text-sm max-w-xs mx-auto">
                Nhân viên 3LMoto sẽ gọi điện xác nhận và giao xe tận nơi cho bạn chỉ sau 10-15 phút.
              </p>
            </div>

            <div className="text-center space-y-4 relative">
              <div className="w-16 h-16 bg-blue-900 text-cyan-300 rounded-full flex items-center justify-center font-bold text-xl mx-auto shadow-md">
                3
              </div>
              <h3 className="text-lg font-bold text-blue-950">Vi Vu Khám Phá Huế</h3>
              <p className="text-slate-600 text-sm max-w-xs mx-auto">
                Bắt đầu hành trình dạo quanh Đại Nội, các lăng tẩm hay phóng xe ngắm hoàng hôn phá Tam Giang thơ mộng.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Contact Details */}
      <footer id="contact" className="bg-blue-950 text-slate-300 pt-16 pb-8 border-t border-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-12 pb-12 border-b border-blue-900/60">
          <div className="space-y-4">
            <span className="text-xl font-bold font-serif text-white tracking-wider">3LMOTO HUẾ</span>
            <p className="text-sm text-slate-400 font-light leading-relaxed">
              Dịch vụ cho thuê xe máy tự lái uy tín chất lượng hàng đầu tại cố đô Huế. Mang lại sự tự do và trải nghiệm dịch vụ trọn vẹn nhất cho hành trình của bạn.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-white font-bold font-serif">Thông Tin Liên Hệ</h3>
            <ul className="space-y-3 text-sm font-light">
              <li className="flex items-start gap-2">
                <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <span>L25 Đường Số 8, KQH Đông Nam Thủy An, phường Thanh Thuỷ, TP Huế</span>
              </li>
              <li className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-cyan-400" />
                <span>Hotline: 0363.077.775 - 0934.924.195 (Zalo)</span>
              </li>
              <li className="flex items-center gap-2">
                <Facebook className="w-5 h-5 text-cyan-400" />
                <a href="https://www.facebook.com/profile.php?id=61569870030659" target="_blank" rel="noopener noreferrer" className="hover:underline">Facebook Page</a>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-white font-bold font-serif">Chính Sách & Quy Định</h3>
            <ul className="space-y-2 text-sm font-light">
              <li>• Yêu cầu CCCD / Hộ chiếu / Giấy phép lái xe</li>
              <li>• Giao xe miễn phí trong trung tâm Huế</li>
              <li>• Cung cấp sẵn 2 mũ bảo hiểm cao cấp</li>
              <li>• Hỗ trợ cứu hộ 24/7 khi gặp sự cố</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <p>© 2026 3LMoto Huế - Phan Lê Tự Lập.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:underline">Điều khoản dịch vụ</a>
            <a href="#" className="hover:underline">Chính sách bảo mật</a>
          </div>
        </div>
      </footer>

      {/* Available Vehicles Modal */}
      {isModalOpen && (
         <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white text-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
             {/* Modal Header */}
             <div className="p-6 bg-blue-950 text-white flex items-center justify-between">
               <div>
                 <h3 className="text-xl font-bold font-serif">Danh Sách Xe Máy Trống</h3>
                 <p className="text-xs text-blue-300 mt-1">
                   Từ ngày: <span className="font-semibold text-white">{new Date(formData.startDate).toLocaleDateString('vi-VN')}</span> đến ngày: <span className="font-semibold text-white">{new Date(formData.endDate).toLocaleDateString('vi-VN')}</span> ({totalDays} ngày)
                 </p>
               </div>
               <button 
                 onClick={closeBookingModal}
                 className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
               >
                 <X className="w-5 h-5" />
               </button>
             </div>

             {/* Modal Body */}
             <div className="p-6 overflow-y-auto flex-1 space-y-6">
               {bookingSuccess ? (
                 <div className="py-12 text-center space-y-4 max-w-md mx-auto">
                   <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                     <Check className="w-8 h-8 text-emerald-600" />
                   </div>
                   <h4 className="text-2xl font-bold text-blue-950 font-serif">Đặt xe thành công!</h4>
                   <p className="text-slate-600 text-sm leading-relaxed">
                     Chào mừng bạn <span className="font-semibold text-blue-950">{formData.name}</span>! Chúng tôi đã nhận được yêu cầu thuê xe máy <span className="font-semibold text-blue-950">{selectedVehicle?.name}</span> ({selectedVehicle?.licensePlate}) của bạn.
                   </p>
                   <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-3 rounded-xl border border-amber-200">
                     Bộ phận hỗ trợ 3LMoto sẽ liên hệ trực tiếp với bạn qua số điện thoại <strong>{formData.phone}</strong> trong vòng 10-15 phút để hoàn tất thủ tục và giao xe!
                   </p>
                   <Button 
                     onClick={closeBookingModal}
                     className="bg-blue-900 hover:bg-blue-950 text-white px-8 rounded-xl cursor-pointer"
                   >
                     Đóng cửa sổ
                   </Button>
                 </div>
               ) : (
                 <>
                   {availableVehicles.length === 0 ? (
                     <div className="py-16 text-center text-slate-400 space-y-3">
                       <Bike className="w-16 h-16 mx-auto opacity-30 animate-bounce" />
                       <p className="text-lg font-medium">Rất tiếc, hiện tại tất cả các xe đều bận trong thời gian này!</p>
                       <p className="text-xs text-slate-500 max-w-sm mx-auto">Vui lòng thay đổi khoảng thời gian nhận/trả xe hoặc liên hệ hotline để được hỗ trợ sắp xếp xe trực tiếp.</p>
                     </div>
                   ) : (
                     <div className="divide-y divide-slate-100">
                       {availableVehicles.map((vehicle) => {
                         const priceTotal = totalDays * vehicle.pricePerDay
                         return (
                           <div key={vehicle.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                             <div className="flex items-center gap-4">
                               <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-950 shadow-sm border border-blue-100">
                                 <Bike className="w-8 h-8" />
                               </div>
                               <div>
                                 <h4 className="font-bold text-slate-800 text-base">{vehicle.name}</h4>
                                 <div className="flex gap-3 text-xs text-slate-500 mt-1">
                                   <span>Biển số: <strong className="font-mono text-slate-700">{vehicle.licensePlate}</strong></span>
                                   <span>•</span>
                                   <span>Màu: <strong>{vehicle.color || "Nhiều màu"}</strong></span>
                                 </div>
                               </div>
                             </div>

                             <div className="flex flex-col sm:items-end justify-between gap-2 sm:gap-1">
                               <div className="text-left sm:text-right">
                                 <span className="block text-xs text-slate-500">Đơn giá: {vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày</span>
                                 <span className="block text-base font-extrabold text-blue-950">Tổng thanh toán: {priceTotal.toLocaleString("vi-VN")} VNĐ</span>
                               </div>
                               <Button
                                 onClick={() => handleConfirmBooking(vehicle)}
                                 disabled={isSubmitting}
                                 className="bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs px-4 h-9 font-semibold cursor-pointer"
                               >
                                 {isSubmitting && selectedVehicle?.id === vehicle.id ? (
                                   <Loader2 className="w-4 h-4 animate-spin" />
                                 ) : (
                                   "Xác Nhận Đặt Xe"
                                 )}
                               </Button>
                             </div>
                           </div>
                         )
                       })}
                     </div>
                   )}
                 </>
               )}
             </div>
           </div>
         </div>
       )}

      {/* Floating Contact Buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {isOpenContact && (
          <div className="flex flex-col items-end gap-3 mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
            {/* Zalo Hotline 1 */}
            <a 
              href="https://zalo.me/0363077775" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-full shadow-lg transition-all transform hover:scale-105"
            >
              <span className="text-xs font-semibold">Zalo: 0363.077.775</span>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
            </a>

            {/* Zalo Hotline 2 */}
            <a 
              href="https://zalo.me/0775272222" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-full shadow-lg transition-all transform hover:scale-105"
            >
              <span className="text-xs font-semibold">Zalo: 0775.27.2222</span>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
            </a>

            {/* Facebook Button */}
            <a 
              href="https://www.facebook.com/profile.php?id=61569870030659" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-900 hover:bg-blue-950 text-white px-4 py-2.5 rounded-full shadow-lg transition-all transform hover:scale-105"
            >
              <span className="text-xs font-semibold">Facebook Page</span>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Facebook className="w-4 h-4 text-white" />
              </div>
            </a>

            {/* Hotline 1 */}
            <a 
              href="tel:0363077775" 
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-full shadow-lg transition-all transform hover:scale-105"
            >
              <span className="text-xs font-semibold">Hotline: 0363.077.775</span>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-white" />
              </div>
            </a>

            {/* Hotline 2 */}
            <a 
              href="tel:0775272222" 
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-full shadow-lg transition-all transform hover:scale-105"
            >
              <span className="text-xs font-semibold">Hotline: 0775.27.2222</span>
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-white" />
              </div>
            </a>
          </div>
        )}

        {/* Main Floating Toggle Button */}
        <button
          onClick={() => setIsOpenContact(!isOpenContact)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 cursor-pointer ${
            isOpenContact ? 'bg-red-500 hover:bg-red-600 rotate-90' : 'bg-blue-950 hover:bg-blue-900 animate-bounce'
          }`}
          style={{ animationDuration: '3s' }}
        >
          {isOpenContact ? (
            <X className="w-6 h-6" />
          ) : (
            <PhoneCall className="w-6 h-6 text-cyan-300 animate-pulse" />
          )}
        </button>
      </div>
    </div>
  )
}
