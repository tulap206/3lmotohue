"use client"

import { useState, useEffect } from "react"
import { fetchVehicles, fetchRentals, fetchCustomers, insertCustomer, insertRental } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Bike,
  Calendar,
  User,
  Phone,
  MapPin,
  Facebook,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  PhoneCall,
  Check,
  Loader2,
  MessageCircle,
  Menu,
  X,
  Compass,
  ThumbsUp,
  Sparkles,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { BlurFade } from "@/components/ui/blur-fade"
import { Marquee } from "@/components/ui/marquee"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"

const FLEET = [
  {
    name: "Airblade Đời Mới",
    image: "/airblade.jpg",
    alt: "Cho thuê xe máy Honda Airblade đời mới tại Huế - 3L Moto",
    tag: "Xe ga đời mới",
    blurb: "Honda Airblade 125/150cc — mạnh mẽ, cốp rộng, Smartkey tiện lợi.",
    price: 130000,
    featured: true,
  },
  {
    name: "Vision",
    image: "/vision.jpg",
    alt: "Cho thuê xe máy Honda Vision giá rẻ tại Huế - 3L Moto",
    tag: "Xe ga đô thị",
    blurb: "Nhỏ gọn, tiết kiệm nhiên liệu — lý tưởng để dạo quanh phố cổ Huế.",
    price: 120000,
    featured: false,
  },
  {
    name: "Janus",
    image: "/janus.jpg",
    alt: "Cho thuê xe máy Yamaha Janus uy tín tại Huế - 3L Moto",
    tag: "Xe ga trẻ trung",
    blurb: "Yamaha Blue Core 125cc — trọng lượng nhẹ, vận hành êm ái.",
    price: 120000,
    featured: false,
  },
  {
    name: "Scoopy",
    image: "/scoopy.jpg",
    alt: "Cho thuê xe máy tay ga Scoopy cổ điển tại Huế - 3L Moto",
    tag: "Xe ga cổ điển",
    blurb: "Kiểu dáng vintage độc đáo — phù hợp check-in các địa điểm thơ mộng.",
    price: 130000,
    featured: false,
  },
] as const

const MARQUEE_ITEMS = [
  "Giao xe miễn phí nội thành",
  "Tặng kèm 2 mũ bảo hiểm + áo mưa",
  "Hỗ trợ cứu hộ sự cố 24/7",
  "Thủ tục nhanh chóng 10–15 phút",
  "Giao nhận tại Ga Huế · Sân bay · Khách sạn",
  "Đội xe đời mới bảo dưỡng định kỳ",
]

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Chọn ngày & đặt trực tuyến",
    body: "Lựa chọn thời gian và điền thông tin nhanh gọn qua form đăng ký.",
  },
  {
    step: "02",
    title: "Xác nhận & nhận bàn giao xe",
    body: "Đội ngũ liên hệ xác nhận và giao xe tận nơi chỉ trong 10-15 phút.",
  },
  {
    step: "03",
    title: "Tự do vi vu khám phá Huế",
    body: "Trải nghiệm trọn vẹn cố đô Huế, lăng tẩm và ẩm thực theo cách riêng của bạn.",
  },
]

export default function LandingPage() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    startDate: "",
    endDate: "",
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [availableVehicles, setAvailableVehicles] = useState<any[]>([])
  const [totalDays, setTotalDays] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null)
  const [isOpenContact, setIsOpenContact] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [formError, setFormError] = useState("")

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate)
      const end = new Date(formData.endDate)
      if (start <= end) {
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        setTotalDays(days === 0 ? 1 : days)
      } else {
        setTotalDays(0)
      }
    } else {
      setTotalDays(0)
    }
  }, [formData.startDate, formData.endDate])

  useEffect(() => {
    const hasLogged = sessionStorage.getItem("3l_visitor_logged")
    if (!hasLogged) {
      fetch("/api/visitor-log", { method: "POST" })
        .then((res) => {
          if (res.ok) {
            sessionStorage.setItem("3l_visitor_logged", "true")
          }
        })
        .catch((err) => {
          console.error("Error logging access:", err)
        })
    }
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    if (!formData.name || !formData.phone || !formData.startDate || !formData.endDate) {
      setFormError("Vui lòng nhập đầy đủ họ tên, số điện thoại và thời gian thuê xe.")
      return
    }

    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    if (start > end) {
      setFormError("Ngày nhận xe phải trước hoặc trùng ngày trả xe.")
      return
    }

    setIsLoading(true)
    try {
      const [vehicles, rentals] = await Promise.all([fetchVehicles(), fetchRentals()])

      const conflictingVehicleIds = new Set(
        rentals
          .filter((rental: any) => {
            if (rental.status === "cancelled" || rental.status === "completed") return false

            const parseDate = (dStr: string) => {
              const parts = dStr.split("/")
              return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            }

            const rStart = parseDate(rental.startDate)
            const rEnd = parseDate(rental.endDate)

            return !(end < rStart || start > rEnd)
          })
          .map((rental: any) => rental.vehicleId)
      )

      const available = vehicles.filter((vehicle: any) => {
        return vehicle.status === "available" && !conflictingVehicleIds.has(vehicle.id)
      })

      setAvailableVehicles(available)
      setIsModalOpen(true)
    } catch (error) {
      console.error("Lỗi khi tìm xe máy:", error)
      setFormError("Không thể tìm xe trống lúc này. Vui lòng thử lại hoặc gọi hotline.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmBooking = async (vehicle: any) => {
    setSelectedVehicle(vehicle)
    setIsSubmitting(true)
    try {
      const customersList = await fetchCustomers()
      let customer = customersList.find((c: any) => c.phone === formData.phone)
      let customerId = ""

      if (customer) {
        customerId = customer.id
      } else {
        const newCustomer = await insertCustomer({
          name: formData.name,
          phone: formData.phone,
          facebook: "",
          address: formData.address || "",
          idcard: "",
          totalrentals: 0,
          status: "active",
          customerphoto: [],
          cccdfront: [],
          cccdback: [],
          licensefront: [],
          licenseback: [],
        })
        customerId = newCustomer.id
      }

      const formatDateStr = (dateInput: string) => {
        const d = new Date(dateInput)
        const day = String(d.getDate()).padStart(2, "0")
        const month = String(d.getMonth() + 1).padStart(2, "0")
        const year = d.getFullYear()
        return `${day}/${month}/${year}`
      }

      const formattedStart = formatDateStr(formData.startDate)
      const formattedEnd = formatDateStr(formData.endDate)
      const totalPrice = totalDays * vehicle.pricePerDay

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
        deposit: 0,
        extraFees: 0,
        notes: "Khách đặt trực tuyến từ website",
        revenue: 0,
        status: "pending",
      })

      setBookingSuccess(true)
    } catch (error) {
      console.error("Lỗi khi đặt xe:", error)
      setFormError("Không gửi được yêu cầu đặt xe. Vui lòng liên hệ hotline.")
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
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-blue-600 selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-900/50 bg-slate-950/80 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-3 group">
            <div className="relative size-12 overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm transition-transform group-hover:scale-105 duration-300">
              <Image
                src="/logo.jpg"
                alt="Logo 3L Moto Huế"
                fill
                className="object-contain p-1"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = "none"
                }}
              />
            </div>
            <div className="leading-tight">
              <span className="block text-xl font-extrabold tracking-tight text-white group-hover:text-blue-400 transition-colors">
                3L MOTO
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                Cho thuê xe máy tại Huế
              </span>
            </div>
          </a>

          <nav className="hidden items-center gap-6 lg:gap-10 text-sm font-bold text-slate-300 md:flex">
            {[
              ["#booking-section", "Đặt xe"],
              ["#why", "Cam kết"],
              ["#fleet", "Bảng giá xe"],
              ["#process", "Quy trình"],
              ["#contact", "Liên hệ"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="relative py-2 transition-colors hover:text-white after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:bg-blue-500 after:transition-all hover:after:w-full"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-bold text-slate-200 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 sm:inline-flex active:scale-95"
            >
              <User className="size-4" />
              Đăng nhập
            </Link>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 md:hidden transition-all hover:bg-slate-800 active:scale-95"
              aria-label={mobileNavOpen ? "Đóng menu" : "Mở menu"}
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              {mobileNavOpen ? <X className="size-5.5" /> : <Menu className="size-5.5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="border-t border-slate-900 bg-slate-950 px-6 py-4 md:hidden shadow-lg overflow-hidden"
            >
              <div className="flex flex-col gap-2 text-sm font-semibold text-slate-300">
                {[
                  ["#booking-section", "Đặt xe trực tuyến"],
                  ["#why", "Cam kết dịch vụ"],
                  ["#fleet", "Bảng giá tham khảo"],
                  ["#process", "Quy trình"],
                  ["#contact", "Liên hệ & Địa chỉ"],
                  ["/login", "Đăng nhập"],
                ].map(([href, label]) =>
                  href.startsWith("/") ? (
                    <Link
                      key={href}
                      href={href}
                      className="rounded-xl px-4 py-3 hover:bg-slate-900 hover:text-blue-400 transition-colors"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {label}
                    </Link>
                  ) : (
                    <a
                      key={href}
                      href={href}
                      className="rounded-xl px-4 py-3 hover:bg-slate-900 hover:text-blue-400 transition-colors"
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {label}
                    </a>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="top">
        {/* Hero Section with Parallax Background */}
        <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden bg-slate-950 text-white py-16 sm:py-24">
          <div className="absolute inset-0 z-0">
            <Image
              src="/hue-motorbike-bg-v3.jpg"
              alt="Cho thuê xe máy Huế — 3L Moto"
              fill
              priority
              className="object-cover object-[center_35%] opacity-45 filter brightness-[0.75] scale-102 transition-transform duration-[10s] ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950" />
            {/* Ambient decorative glowing blobs */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] bg-teal-500/10 rounded-full blur-[150px] pointer-events-none" />
          </div>

          <div className="relative z-10 mx-auto max-w-6xl px-6 w-full grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-6 space-y-8 text-left">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/30 px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-300"
              >
                <Sparkles className="size-3.5 text-blue-400" /> Dịch vụ cho thuê xe máy du lịch uy tín hàng đầu
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="space-y-4"
              >
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl lg:leading-[1.15]">
                  Khám phá Cố Đô <br />
                  <span className="text-gradient-primary">Theo cách của bạn</span>
                </h1>
                <p className="max-w-[48ch] text-base leading-relaxed text-slate-300 sm:text-lg">
                  Thuê xe máy đời mới chất lượng cao, giao nhận hoàn toàn miễn phí tại Ga tàu, Khách sạn nội thành hoặc Sân bay. Tặng kèm 2 mũ bảo hiểm đạt chuẩn và áo mưa tiện dụng.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex flex-wrap items-center gap-4"
              >
                <a
                  href="#booking-section"
                  className="inline-flex h-14 items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all hover:bg-blue-700 hover:shadow-blue-600/40 active:scale-[0.98] duration-300"
                >
                  Đặt xe trực tuyến
                  <ArrowRight className="ml-2.5 size-4" />
                </a>
                <a
                  href="tel:0934924195"
                  className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30 active:scale-[0.98] duration-300"
                >
                  <PhoneCall className="size-4 text-blue-400" />
                  0934.924.195
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-8"
              >
                <div className="space-y-1">
                  <p className="text-3xl font-extrabold text-white">120k <span className="text-sm font-medium text-slate-400">đ/ngày</span></p>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Giá thuê tốt nhất</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-extrabold text-white">10-15 <span className="text-sm font-medium text-slate-400">phút</span></p>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Giao xe hỏa tốc</p>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-extrabold text-white">24/7</p>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Hỗ trợ sự cố</p>
                </div>
              </motion.div>
            </div>

            {/* Redesigned Booking Form Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 25 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="lg:col-span-6 w-full"
            >
              <div
                id="booking-section"
                className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-white/40 bg-white/90 p-6 text-slate-800 shadow-2xl backdrop-blur-2xl sm:p-8 travel-glow"
              >
                <div className="mb-6">
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                    Lên lịch thuê xe máy <Sparkles className="size-5 text-blue-600 animate-pulse" />
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 font-medium">
                    Hệ thống tự động lọc và báo giá các loại xe sẵn sàng.
                  </p>
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Họ và tên khách hàng *
                    </Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="name"
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-xs focus:border-blue-500 focus:ring-0 transition-all duration-200"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Số điện thoại liên hệ *
                    </Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="phone"
                        type="tel"
                        required
                        placeholder="0934.924.195 hoặc 0332.917.265"
                        className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-xs focus:border-blue-500 focus:ring-0 transition-all duration-200"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="startDate" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Ngày nhận xe *
                      </Label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="startDate"
                          type="date"
                          required
                          className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:ring-0 transition-all duration-200"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="endDate" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Ngày trả xe *
                      </Label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="endDate"
                          type="date"
                          required
                          className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm font-semibold text-slate-800 shadow-xs focus:border-blue-500 focus:ring-0 transition-all duration-200"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Địa điểm giao nhận xe *
                    </Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="address"
                        type="text"
                        required
                        placeholder="Ga Huế, tên khách sạn, hoặc Sân bay..."
                        className="h-12 rounded-xl border-slate-200 bg-white pl-11 text-sm font-semibold text-slate-800 placeholder-slate-400 shadow-xs focus:border-blue-500 focus:ring-0 transition-all duration-200"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </div>

                  {formError ? (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700"
                    >
                      {formError}
                    </motion.p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="mt-2 h-13 w-full rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-70 transition-all duration-200 cursor-pointer"
                  >
                    {isLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Đang tìm xe sẵn sàng...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Tìm xe khả dụng & Báo giá
                        <ArrowRight className="size-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Cam kết Trust Marquee */}
        <section className="border-y border-slate-200 bg-white py-4.5" aria-label="Cam kết dịch vụ">
          <Marquee pauseOnHover className="[--duration:30s] [--gap:4rem]">
            {MARQUEE_ITEMS.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider"
              >
                <CheckCircle className="size-4 text-teal-600" />
                {item}
              </span>
            ))}
          </Marquee>
        </section>

        {/* Why Choose Us Section */}
        <section id="why" className="scroll-mt-24 py-24 bg-gradient-to-b from-white to-slate-50 relative">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
          
          <div className="mx-auto max-w-6xl px-6 relative z-10">
            <BlurFade inView direction="up" offset={10}>
              <div className="text-center max-w-3xl mx-auto space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Cam kết chất lượng</p>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  Dịch vụ chuẩn chỉ — Trải nghiệm trọn vẹn
                </h2>
                <p className="text-base text-slate-500 max-w-2xl mx-auto">
                  Chúng tôi xây dựng uy tín dựa trên sự rõ ràng về giá cả, chất lượng xe vượt trội và dịch vụ chăm sóc chu đáo, luôn đồng hành cùng hành trình khám phá Huế của bạn.
                </p>
              </div>
            </BlurFade>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: <Shield className="size-6" />,
                  title: "Trang bị sẵn phụ kiện",
                  desc: "Trang bị sẵn 2 nón bảo hiểm chính hãng đạt chuẩn quốc gia kèm áo mưa cánh dơi tiện ích cho mỗi xe mà không tính thêm bất kỳ phụ phí nào."
                },
                {
                  icon: <Compass className="size-6" />,
                  title: "Hỗ trợ sự cố 24/7",
                  desc: "Yên tâm di chuyển trên mọi nẻo đường Huế. Bất kỳ sự cố kỹ thuật nào cũng sẽ được xử lý kịp thời bằng đội ngũ cứu hộ cơ động hoạt động liên tục."
                },
                {
                  icon: <ThumbsUp className="size-6" />,
                  title: "Không chi phí ẩn",
                  desc: "Báo giá rõ ràng, minh bạch ngay tại thời điểm đăng ký. Cam kết không phát sinh phụ phí ngoài hợp đồng, đem lại sự an tâm tuyệt đối."
                }
              ].map((item, idx) => (
                <BlurFade key={item.title} inView delay={0.05 * idx} direction="up" offset={12}>
                  <motion.div
                    whileHover={{ y: -6, boxShadow: "0 20px 40px -15px rgba(15, 23, 42, 0.08)", borderColor: "rgba(59, 130, 246, 0.2)" }}
                    className="h-full rounded-2xl border border-slate-100 bg-white p-8 transition-all duration-300"
                  >
                    <div className="inline-flex size-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-6">
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-slate-500">{item.desc}</p>
                  </motion.div>
                </BlurFade>
              ))}
            </div>
          </div>
        </section>

        {/* Fleet / Price Grid */}
        <section id="fleet" className="scroll-mt-24 bg-white py-24 relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-6">
            <BlurFade inView direction="up" offset={10}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-100 pb-8">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Đội xe chất lượng</p>
                  <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    Danh mục xe máy sẵn có
                  </h2>
                  <p className="text-sm text-slate-500 max-w-xl">
                    Các dòng xe tay ga hiện đại, thế hệ mới nhất, tiết kiệm nhiên liệu, được rửa sạch sẽ trước khi giao tới tay khách hàng.
                  </p>
                </div>
                <a
                  href="#booking-section"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors group"
                >
                  Kiểm tra tính khả dụng của xe
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </BlurFade>

            <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {FLEET.map((bike, i) => (
                <BlurFade key={bike.name} inView delay={0.05 * i} direction="up" offset={10}>
                  <motion.article
                    whileHover={{ y: -8, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.08)" }}
                    className={cn(
                      "group relative flex h-full flex-col overflow-hidden rounded-2xl border transition-all duration-300",
                      bike.featured
                        ? "border-blue-200 shadow-md shadow-blue-500/5 bg-blue-50/10"
                        : "border-slate-200 shadow-sm hover:shadow-md"
                    )}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
                      <Image
                        src={bike.image}
                        alt={bike.alt}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-108"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-blue-600">
                          {bike.tag}
                        </span>
                        {bike.featured && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-blue-700">
                            Yêu thích nhất
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {bike.name}
                      </h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                        {bike.blurb}
                      </p>
                      
                      <div className="mt-6 flex items-end justify-between border-t border-slate-100/80 pt-5">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Giá thuê chỉ từ</p>
                          <p className="text-lg font-black text-slate-900">
                            {bike.price.toLocaleString("vi-VN")}đ
                            <span className="text-xs font-semibold text-slate-400">/ngày</span>
                          </p>
                        </div>
                        <a
                          href="#booking-section"
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 px-4 text-xs font-bold text-white transition-all active:scale-95 duration-200"
                        >
                          Đặt xe
                        </a>
                      </div>
                    </div>
                  </motion.article>
                </BlurFade>
              ))}
            </div>

            <BlurFade inView delay={0.1} direction="up" offset={10}>
              <div className="mt-12 grid gap-6 rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-md p-6 sm:grid-cols-3 sm:p-8">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-blue-50 p-2 border border-blue-100/80 shadow-xs text-blue-600">
                    <Clock className="size-5 shrink-0" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Chính sách dài hạn</p>
                    <p className="text-xs text-slate-500 mt-0.5">Chiết khấu hấp dẫn khi thuê theo tuần hoặc tháng liên tục.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-blue-50 p-2 border border-blue-100/80 shadow-xs text-blue-600">
                    <MapPin className="size-5 shrink-0" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Giao xe tận nơi miễn phí</p>
                    <p className="text-xs text-slate-500 mt-0.5">Bàn giao tại tất cả địa điểm trong trung tâm TP Huế.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-blue-50 p-2 border border-blue-100/80 shadow-xs text-blue-600">
                    <Phone className="size-5 shrink-0" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Liên hệ trực tiếp</p>
                    <a href="tel:0934924195" className="text-xs font-extrabold text-blue-600 hover:underline mt-0.5 block">
                      Gọi ngay: 0934.924.195
                    </a>
                  </div>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Process Steps */}
        <section id="process" className="scroll-mt-24 py-24 bg-slate-50 border-t border-slate-200/80 relative">
          <div className="mx-auto max-w-6xl px-6">
            <BlurFade inView direction="up" offset={10}>
              <div className="max-w-xl">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Thủ tục đơn giản</p>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                  3 bước nhanh chóng để khởi hành
                </h2>
              </div>
            </BlurFade>

            <ol className="mt-16 grid gap-8 md:grid-cols-3">
              {PROCESS_STEPS.map((item, i) => (
                <BlurFade key={item.step} inView delay={0.08 * i} direction="up" offset={10}>
                  <motion.li
                    whileHover={{ y: -6, borderColor: "rgba(59, 130, 246, 0.2)" }}
                    className="relative rounded-2xl border border-slate-200 bg-white p-8 transition-all duration-300 shadow-sm"
                  >
                    <span className="font-mono text-5xl font-black tracking-tighter text-blue-100 block">
                      {item.step}
                    </span>
                    <h3 className="mt-4 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.body}</p>
                  </motion.li>
                </BlurFade>
              ))}
            </ol>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contact" className="scroll-mt-24 border-t border-slate-800 bg-slate-950 text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-3">
          <div className="space-y-4">
            <p className="text-2xl font-black tracking-tight text-white">3L MOTO</p>
            <p className="max-w-[36ch] text-sm leading-relaxed text-slate-400 font-medium">
              Dịch vụ cho thuê xe máy tự lái uy tín hàng đầu tại Cố đô Huế. Đồng hành tin cậy trên mọi cung đường khám phá văn hóa di sản.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Thông tin liên hệ</h3>
            <ul className="space-y-3.5 text-sm font-medium">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-blue-400" />
                <span>L25 Đường Số 8, KQH Đông Nam Thủy An, Thanh Thủy, TP Huế</span>
              </li>
              <li className="flex gap-3">
                <PhoneCall className="mt-0.5 size-4 shrink-0 text-blue-400" />
                <span>0934.924.195 · 0332.917.265 (Hỗ trợ Zalo)</span>
              </li>
              <li className="flex gap-3">
                <Facebook className="mt-0.5 size-4 shrink-0 text-blue-400" />
                <a
                  href="https://www.facebook.com/3l.moto.hue"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Facebook fanpage chính thức
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Quy chuẩn thủ tục</h3>
            <ul className="space-y-2.5 text-sm font-medium">
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-500" /> Giấy tờ cần thiết: CCCD / GPLX
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-500" /> Giao nhận xe tận nơi miễn phí
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-500" /> Miễn phí 02 mũ bảo hiểm đạt chuẩn
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-emerald-500" /> Hỗ trợ kỹ thuật sự cố 24/7
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-900 py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-slate-500 sm:flex-row">
            <p>© 2026 3L Moto Huế. Bản quyền sở hữu thuộc về 3L Moto Huế.</p>
            <p>Báo giá niêm yết công khai · Không phát sinh phụ phí</p>
          </div>
        </div>
      </footer>

      {/* Available vehicles modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between bg-slate-950 px-6 py-5 text-white">
                <div>
                  <h3 className="text-lg font-bold">Danh sách xe máy khả dụng</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Thời gian: {new Date(formData.startDate).toLocaleDateString("vi-VN")} →{" "}
                    {new Date(formData.endDate).toLocaleDateString("vi-VN")} ({totalDays} ngày)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeBookingModal}
                  className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                  aria-label="Đóng"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {bookingSuccess ? (
                  <div className="mx-auto max-w-md space-y-6 py-8 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
                      <Check className="size-8 text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-2xl font-extrabold text-slate-900">Đặt xe thành công!</h4>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        Cảm ơn anh/chị <span className="font-bold text-slate-900">{formData.name}</span>. Hệ thống đã tiếp nhận yêu cầu thuê xe <span className="font-bold text-blue-600">{selectedVehicle?.name}</span>.
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold leading-relaxed text-amber-800">
                      Nhân viên điều phối sẽ liên hệ qua số điện thoại <strong>{formData.phone}</strong> trong vòng 10–15 phút tới để hoàn tất thủ tục bàn giao.
                    </div>
                    <Button
                      onClick={closeBookingModal}
                      className="w-full h-11 rounded-xl bg-slate-900 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      Đóng cửa sổ
                    </Button>
                  </div>
                ) : availableVehicles.length === 0 ? (
                  <div className="space-y-4 py-16 text-center text-slate-500">
                    <Bike className="mx-auto size-16 opacity-20 text-slate-400" />
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-slate-800">Không tìm thấy xe máy khả dụng</p>
                      <p className="mx-auto max-w-sm text-xs text-slate-400 leading-relaxed">
                        Hiện tại toàn bộ xe đã được đặt kín trong khoảng thời gian này. Vui lòng chọn mốc thời gian khác hoặc liên hệ hotline để được hỗ trợ thủ công.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {availableVehicles.map((vehicle) => {
                      const priceTotal = totalDays * vehicle.pricePerDay
                      return (
                        <div
                          key={vehicle.id}
                          className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex size-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-blue-600 shrink-0">
                              <Bike className="size-6" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{vehicle.name}</h4>
                              <p className="mt-1 text-xs text-slate-500">
                                Màu xe: <span className="font-semibold text-slate-700">{vehicle.color || "Ngẫu nhiên"}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:items-end">
                            <div className="text-left sm:text-right">
                              <span className="block text-xs text-slate-400">
                                Đơn giá: {vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày
                              </span>
                              <span className="block text-base font-extrabold text-slate-900">
                                Tổng cộng: {priceTotal.toLocaleString("vi-VN")}đ
                              </span>
                            </div>
                            <Button
                              onClick={() => handleConfirmBooking(vehicle)}
                              disabled={isSubmitting}
                              className="h-10 rounded-lg bg-blue-600 px-5 text-xs font-bold text-white hover:bg-blue-700 transition-colors w-full sm:w-auto"
                            >
                              {isSubmitting && selectedVehicle?.id === vehicle.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Xác nhận dòng xe này"
                              )}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating contact widget */}
      <div className="fixed right-6 bottom-6 z-50 flex flex-col items-end gap-3.5">
        {isOpenContact && (
          <div className="flex flex-col items-end gap-2.5">
            <a
              href="https://zalo.me/0934924195"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#0068ff] px-4 py-3 text-white shadow-lg transition-transform hover:scale-102"
            >
              <span className="text-xs font-bold">Zalo: 0934.924.195</span>
              <MessageCircle className="size-4" />
            </a>
            <a
              href="https://zalo.me/0332917265"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#0068ff] px-4 py-3 text-white shadow-lg transition-transform hover:scale-102"
            >
              <span className="text-xs font-bold">Zalo: 0332.917.265</span>
              <MessageCircle className="size-4" />
            </a>
            <a
              href="https://www.facebook.com/3l.moto.hue"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg transition-transform hover:scale-102"
            >
              <span className="text-xs font-bold">Facebook Fanpage</span>
              <Facebook className="size-4" />
            </a>
            <a
              href="tel:0934924195"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-lg transition-transform hover:scale-102"
            >
              <span className="text-xs font-bold">Hotline 1: 0934.924.195</span>
              <PhoneCall className="size-4" />
            </a>
            <a
              href="tel:0332917265"
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-white shadow-lg transition-transform hover:scale-102"
            >
              <span className="text-xs font-bold">Hotline 2: 0332.917.265</span>
              <PhoneCall className="size-4" />
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpenContact(!isOpenContact)}
          aria-label="Liên hệ hotline và mạng xã hội"
          className={cn(
            "flex size-14 items-center justify-center rounded-full text-white shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer",
            isOpenContact ? "bg-rose-600" : "bg-blue-600 hover:bg-blue-700"
          )}
        >
          {isOpenContact ? <X className="size-6.5" /> : <PhoneCall className="size-6.5 animate-pulse" />}
        </button>
      </div>
    </div>
  )
}
