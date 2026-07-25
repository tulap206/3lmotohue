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
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { BlurFade } from "@/components/ui/blur-fade"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text"
import { BorderBeam } from "@/components/ui/border-beam"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Marquee } from "@/components/ui/marquee"
import { cn } from "@/lib/utils"

const FLEET = [
  {
    name: "Airblade Đời Mới",
    image: "/airblade.jpg",
    alt: "Cho thuê xe máy Honda Airblade đời mới tại Huế - 3L Moto",
    tag: "Xe ga đời mới",
    blurb: "Honda Airblade 125/150cc — mạnh, cốp rộng, Smartkey.",
    price: 130000,
    featured: true,
  },
  {
    name: "Vision",
    image: "/vision.jpg",
    alt: "Cho thuê xe máy Honda Vision giá rẻ tại Huế - 3L Moto",
    tag: "Xe ga đô thị",
    blurb: "Nhỏ gọn, tiết kiệm xăng — lý tưởng cho phố cổ Huế.",
    price: 120000,
    featured: false,
  },
  {
    name: "Janus",
    image: "/janus.jpg",
    alt: "Cho thuê xe máy Yamaha Janus uy tín tại Huế - 3L Moto",
    tag: "Xe ga trẻ trung",
    blurb: "Yamaha Blue Core 125cc — nhẹ, êm, dễ điều khiển.",
    price: 120000,
    featured: false,
  },
  {
    name: "Scoopy",
    image: "/scoopy.jpg",
    alt: "Cho thuê xe máy tay ga Scoopy cổ điển tại Huế - 3L Moto",
    tag: "Xe ga cổ điển",
    blurb: "Dáng vintage bắt mắt — hợp check-in quanh cố đô.",
    price: 130000,
    featured: false,
  },
] as const

const MARQUEE_ITEMS = [
  "Giao xe miễn phí nội thành",
  "2 mũ bảo hiểm + áo mưa",
  "Hỗ trợ cứu hộ 24/7",
  "Thủ tục nhanh 10–15 phút",
  "Ga Huế · Sân bay · Khách sạn",
  "Xe bảo dưỡng định kỳ",
]

const PROCESS_STEPS = [
  {
    step: "01",
    title: "Chọn ngày & đặt online",
    body: "Điền form — hệ thống lọc xe trống đúng khoảng thời gian bạn cần.",
  },
  {
    step: "02",
    title: "Xác nhận & nhận xe",
    body: "Nhân viên gọi xác nhận, giao tận nơi trong 10–15 phút.",
  },
  {
    step: "03",
    title: "Vi vu khám phá Huế",
    body: "Đại Nội, lăng tẩm, phá Tam Giang — tự do theo nhịp của bạn.",
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
    <div className="min-h-screen bg-[#f4f7fb] text-slate-800 selection:bg-blue-600 selection:text-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-[4.25rem] sm:px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <div className="relative size-11 overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm sm:size-12">
              <Image
                src="/logo.jpg"
                alt="Logo 3L Moto Huế"
                fill
                className="object-contain"
                onError={(e) => {
                  ;(e.target as HTMLElement).style.display = "none"
                }}
              />
            </div>
            <div className="leading-tight">
              <span className="block text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                3L Moto
              </span>
              <span className="block text-[11px] font-medium text-slate-500">Thuê xe máy tại Huế</span>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#booking" className="transition-colors hover:text-blue-700">
              Đặt xe
            </a>
            <a href="#why" className="transition-colors hover:text-blue-700">
              Vì sao chọn chúng tôi
            </a>
            <a href="#fleet" className="transition-colors hover:text-blue-700">
              Bảng giá
            </a>
            <a href="#process" className="transition-colors hover:text-blue-700">
              Quy trình
            </a>
            <a href="#contact" className="transition-colors hover:text-blue-700">
              Liên hệ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-800 sm:inline-flex"
            >
              <User className="size-4" />
              Đăng nhập
            </Link>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 md:hidden"
              aria-label={mobileNavOpen ? "Đóng menu" : "Mở menu"}
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              {[
                ["#booking", "Đặt xe"],
                ["#why", "Vì sao chọn chúng tôi"],
                ["#fleet", "Bảng giá"],
                ["#process", "Quy trình"],
                ["#contact", "Liên hệ"],
                ["/login", "Đăng nhập"],
              ].map(([href, label]) =>
                href.startsWith("/") ? (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-lg px-3 py-2.5 hover:bg-slate-50"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {label}
                  </Link>
                ) : (
                  <a
                    key={href}
                    href={href}
                    className="rounded-lg px-3 py-2.5 hover:bg-slate-50"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    {label}
                  </a>
                )
              )}
            </div>
          </div>
        )}
      </header>

      <main id="top">
        {/* Hero — full-bleed, brand-first, booking as interaction */}
        <section className="relative isolate min-h-[100dvh] overflow-hidden text-white">
          <Image
            src="/hue-motorbike-bg-v3.jpg"
            alt="Cho thuê xe máy Huế — 3L Moto"
            fill
            priority
            className="object-cover object-[center_35%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(15,23,42,0.82)_0%,rgba(30,58,138,0.55)_48%,rgba(15,23,42,0.72)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.25),transparent_55%)]" />

          <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-8 lg:py-20">
            <div className="lg:col-span-6 space-y-7">
              <BlurFade delay={0.05} direction="up" offset={12}>
                <p className="text-sm font-semibold tracking-[0.18em] text-blue-200/90 uppercase">
                  3L Moto Huế
                </p>
              </BlurFade>

              <BlurFade delay={0.12} direction="up" offset={16}>
                <h1 className="max-w-[14ch] text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
                  Vi vu cố đô với{" "}
                  <AnimatedGradientText
                    colorFrom="#93c5fd"
                    colorTo="#67e8f9"
                    speed={0.9}
                    className="font-bold"
                  >
                    xe máy sẵn sàng
                  </AnimatedGradientText>
                </h1>
              </BlurFade>

              <BlurFade delay={0.2} direction="up" offset={14}>
                <p className="max-w-[42ch] text-base leading-relaxed text-slate-200 sm:text-lg">
                  Thuê xe đời mới, giao miễn phí nội thành — kèm 2 mũ bảo hiểm và áo mưa. Đặt online,
                  nhận xe trong 10–15 phút.
                </p>
              </BlurFade>

              <BlurFade delay={0.28} direction="up" offset={12}>
                <div className="flex flex-wrap items-center gap-3">
                  <ShimmerButton
                    type="button"
                    background="rgb(29 78 216)"
                    shimmerColor="#e0f2fe"
                    borderRadius="14px"
                    className="h-12 px-7 text-sm font-semibold shadow-lg shadow-blue-950/30"
                    onClick={() => {
                      document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })
                    }}
                  >
                    Đặt xe ngay
                    <ArrowRight className="ml-2 size-4" />
                  </ShimmerButton>
                  <a
                    href="tel:0363077775"
                    className="inline-flex h-12 items-center gap-2 rounded-[14px] border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
                  >
                    <PhoneCall className="size-4" />
                    0363.077.775
                  </a>
                </div>
              </BlurFade>

              <BlurFade delay={0.36} direction="up" offset={10}>
                <div className="flex flex-wrap gap-x-8 gap-y-4 border-t border-white/15 pt-6">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <NumberTicker value={120} className="text-2xl font-bold text-white" />
                      <span className="text-sm text-slate-300">k+</span>
                    </div>
                    <p className="text-xs text-slate-400">đồng/ngày từ</p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <NumberTicker value={15} className="text-2xl font-bold text-white" />
                      <span className="text-sm text-slate-300">phút</span>
                    </div>
                    <p className="text-xs text-slate-400">giao xe trung bình</p>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <NumberTicker value={24} className="text-2xl font-bold text-white" />
                      <span className="text-sm text-slate-300">/7</span>
                    </div>
                    <p className="text-xs text-slate-400">hỗ trợ sự cố</p>
                  </div>
                </div>
              </BlurFade>
            </div>

            {/* Booking form — interactive surface */}
            <BlurFade delay={0.22} direction="up" offset={20} className="lg:col-span-6">
              <div
                id="booking"
                className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-white/20 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-950/25 sm:p-8"
              >
                <BorderBeam
                  size={120}
                  duration={9}
                  borderWidth={1.5}
                  colorFrom="#2563eb"
                  colorTo="#22d3ee"
                />

                <div className="mb-6">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    Đặt xe máy trực tuyến
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Kiểm tra xe trống theo ngày — xác nhận sau vài phút.
                  </p>
                </div>

                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                      Họ và tên *
                    </Label>
                    <div className="relative">
                      <User className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="name"
                        type="text"
                        required
                        placeholder="Nguyễn Văn A"
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 text-base focus:bg-white"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm font-medium text-slate-700">
                      Số điện thoại *
                    </Label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="phone"
                        type="tel"
                        required
                        placeholder="0363077775"
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 text-base focus:bg-white"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="startDate" className="text-sm font-medium text-slate-700">
                        Ngày nhận *
                      </Label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="startDate"
                          type="date"
                          required
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 text-sm focus:bg-white"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="endDate" className="text-sm font-medium text-slate-700">
                        Ngày trả *
                      </Label>
                      <div className="relative">
                        <Calendar className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="endDate"
                          type="date"
                          required
                          className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 text-sm focus:bg-white"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-sm font-medium text-slate-700">
                      Nơi nhận xe
                    </Label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="address"
                        type="text"
                        placeholder="Ga Huế, khách sạn, sân bay…"
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-11 text-base focus:bg-white"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      />
                    </div>
                  </div>

                  {formError ? (
                    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {formError}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="mt-1 h-12 w-full rounded-xl bg-blue-700 text-base font-semibold text-white shadow-md shadow-blue-700/20 hover:bg-blue-800"
                  >
                    {isLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-5 animate-spin" />
                        Đang tìm xe trống…
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        Tìm xe trống & báo giá
                        <ArrowRight className="size-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Trust marquee */}
        <section className="border-y border-slate-200/80 bg-white py-3" aria-label="Cam kết dịch vụ">
          <Marquee pauseOnHover className="[--duration:35s] [--gap:2.5rem]">
            {MARQUEE_ITEMS.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
              >
                <CheckCircle className="size-4 text-blue-600" />
                {item}
              </span>
            ))}
          </Marquee>
        </section>

        {/* Why — asymmetric, one job */}
        <section id="why" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <BlurFade inView direction="up" offset={14}>
              <div className="max-w-2xl">
                <p className="text-sm font-semibold tracking-wide text-blue-700">Vì sao 3L Moto</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 text-balance sm:text-4xl">
                  Thuê xe rõ ràng, nhận xe đúng giờ, đi Huế nhẹ đầu
                </h2>
                <p className="mt-3 max-w-[55ch] text-base leading-relaxed text-slate-600">
                  Không phí ẩn. Xe được bảo dưỡng định kỳ. Giao nhận linh hoạt tại ga, sân bay và
                  khách sạn nội thành.
                </p>
              </div>
            </BlurFade>

            <div className="mt-12 grid gap-5 lg:grid-cols-12 lg:grid-rows-2">
              <BlurFade inView delay={0.05} direction="up" className="lg:col-span-7 lg:row-span-2">
                <div className="relative flex h-full min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl bg-slate-900 p-8 text-white sm:p-10">
                  <div className="absolute -right-16 -bottom-20 size-64 rounded-full bg-blue-500/20 blur-3xl" />
                  <div className="relative">
                    <Shield className="size-8 text-blue-300" />
                    <h3 className="mt-5 text-2xl font-bold tracking-tight">An toàn & tiện lợi sẵn</h3>
                    <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-slate-300">
                      Mỗi lần thuê kèm 2 mũ bảo hiểm cao cấp và 1 áo mưa. Cứu hộ sự cố dọc đường
                      24/7.
                    </p>
                  </div>
                  <div className="relative mt-8 flex items-center gap-4">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-white/10">
                      <Image
                        src="/accessories.png"
                        alt="Mũ bảo hiểm và áo mưa đi kèm"
                        fill
                        className="object-contain p-1"
                      />
                    </div>
                    <p className="text-sm text-slate-300">
                      Phụ kiện chính hãng 3L Moto — miễn phí kèm theo.
                    </p>
                  </div>
                </div>
              </BlurFade>

              <BlurFade inView delay={0.1} direction="up" className="lg:col-span-5">
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-[var(--shadow-card)]">
                  <Bike className="size-7 text-blue-700" />
                  <h3 className="mt-4 text-lg font-bold text-slate-900">Đội xe đa dạng</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Airblade, Vision, Janus, Scoopy — chọn theo phong cách và cung đường.
                  </p>
                </div>
              </BlurFade>

              <BlurFade inView delay={0.15} direction="up" className="lg:col-span-5">
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-7 shadow-[var(--shadow-card)]">
                  <MapPin className="size-7 text-blue-700" />
                  <h3 className="mt-4 text-lg font-bold text-slate-900">Giao tận nơi miễn phí</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    Nội thành Huế: ga tàu, khách sạn, điểm đón bạn chỉ định.
                  </p>
                </div>
              </BlurFade>
            </div>
          </div>
        </section>

        {/* Fleet */}
        <section id="fleet" className="scroll-mt-24 bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <BlurFade inView direction="up" offset={12}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-xl">
                  <p className="text-sm font-semibold tracking-wide text-blue-700">Bảng giá tham khảo</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    Xe sẵn sàng cho hành trình của bạn
                  </h2>
                  <p className="mt-3 text-base text-slate-600">
                    Đã gồm mũ bảo hiểm, áo mưa và hỗ trợ sự cố. Thuê dài ngày có ưu đãi — gọi để tư
                    vấn.
                  </p>
                </div>
                <a
                  href="#booking"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  Kiểm tra xe trống
                  <ArrowRight className="size-4" />
                </a>
              </div>
            </BlurFade>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FLEET.map((bike, i) => (
                <BlurFade key={bike.name} inView delay={0.05 * i} direction="up">
                  <article
                    className={cn(
                      "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white",
                      bike.featured
                        ? "border-blue-200 shadow-md shadow-blue-900/5"
                        : "border-slate-200 shadow-[var(--shadow-card)]"
                    )}
                  >
                    {bike.featured ? (
                      <BorderBeam
                        size={80}
                        duration={8}
                        borderWidth={1.5}
                        colorFrom="#2563eb"
                        colorTo="#38bdf8"
                      />
                    ) : null}

                    <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                      <Image
                        src={bike.image}
                        alt={bike.alt}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-xs font-medium tracking-wide text-blue-700">{bike.tag}</p>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">{bike.name}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{bike.blurb}</p>
                      <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-xs text-slate-500">Giá thuê</p>
                          <p className="money text-lg font-bold text-slate-900">
                            {bike.price.toLocaleString("vi-VN")}đ
                            <span className="text-sm font-medium text-slate-500"> / ngày</span>
                          </p>
                        </div>
                        <a
                          href="#booking"
                          className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                        >
                          Đặt xe
                        </a>
                      </div>
                    </div>
                  </article>
                </BlurFade>
              ))}
            </div>

            <BlurFade inView delay={0.1} direction="up">
              <div className="mt-10 grid gap-3 rounded-2xl border border-slate-200 bg-[#f4f7fb] p-5 sm:grid-cols-3 sm:gap-6 sm:p-6">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-blue-700" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Giá từ 1 ngày</p>
                    <p className="text-xs text-slate-500">Tuần / tháng liên hệ để giảm thêm</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-blue-700" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Giao miễn phí nội thành</p>
                    <p className="text-xs text-slate-500">Ga Huế, khách sạn, điểm đón</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 size-5 shrink-0 text-blue-700" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Cần tư vấn nhanh?</p>
                    <a href="tel:0363077775" className="text-xs font-medium text-blue-700 hover:underline">
                      Gọi 0363.077.775
                    </a>
                  </div>
                </div>
              </div>
            </BlurFade>
          </div>
        </section>

        {/* Process */}
        <section id="process" className="scroll-mt-24 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <BlurFade inView direction="up">
              <div className="max-w-xl">
                <p className="text-sm font-semibold tracking-wide text-blue-700">Quy trình</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Ba bước — từ form đến tay lái
                </h2>
              </div>
            </BlurFade>

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {PROCESS_STEPS.map((item, i) => (
                <BlurFade key={item.step} inView delay={0.08 * i} direction="up">
                  <li className="relative rounded-2xl border border-slate-200 bg-white p-6">
                    <span className="font-mono text-3xl font-bold tracking-tighter text-blue-100">
                      {item.step}
                    </span>
                    <h3 className="mt-3 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                  </li>
                </BlurFade>
              ))}
            </ol>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contact" className="scroll-mt-24 border-t border-slate-800 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="space-y-3">
            <p className="text-xl font-bold tracking-tight text-white">3L Moto Huế</p>
            <p className="max-w-[36ch] text-sm leading-relaxed text-slate-400">
              Cho thuê xe máy tự lái tại cố đô — rõ giá, giao nhanh, hỗ trợ suốt hành trình.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide text-white">Liên hệ</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-blue-400" />
                <span>L25 Đường Số 8, KQH Đông Nam Thủy An, phường Thanh Thuỷ, TP Huế</span>
              </li>
              <li className="flex items-center gap-2.5">
                <PhoneCall className="size-4 shrink-0 text-blue-400" />
                <span>0363.077.775 · 0934.924.195 (Zalo)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Facebook className="size-4 shrink-0 text-blue-400" />
                <a
                  href="https://www.facebook.com/profile.php?id=61569870030659"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline"
                >
                  Facebook 3L Moto
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-wide text-white">Khi thuê xe</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>CCCD / Hộ chiếu / GPLX</li>
              <li>Giao miễn phí trung tâm Huế</li>
              <li>2 mũ bảo hiểm kèm theo</li>
              <li>Cứu hộ 24/7 khi sự cố</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800/80">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
            <p>© 2026 3L Moto Huế — Phan Lê Tự Lập</p>
            <p className="text-slate-600">Giá công khai · Không phí ẩn</p>
          </div>
        </div>
      </footer>

      {/* Available vehicles modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-6 py-5 text-white">
              <div>
                <h3 className="text-lg font-bold">Xe máy trống</h3>
                <p className="mt-1 text-xs text-slate-300">
                  {new Date(formData.startDate).toLocaleDateString("vi-VN")} →{" "}
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

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {bookingSuccess ? (
                <div className="mx-auto max-w-md space-y-4 py-10 text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
                    <Check className="size-8 text-emerald-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-slate-900">Đặt xe thành công</h4>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Chào <span className="font-semibold text-slate-900">{formData.name}</span>. Chúng
                    tôi đã nhận yêu cầu thuê{" "}
                    <span className="font-semibold text-slate-900">{selectedVehicle?.name}</span>.
                  </p>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                    Bộ phận hỗ trợ sẽ gọi{" "}
                    <strong>{formData.phone}</strong> trong 10–15 phút để hoàn tất và giao xe.
                  </p>
                  <Button
                    onClick={closeBookingModal}
                    className="rounded-xl bg-blue-700 px-8 text-white hover:bg-blue-800"
                  >
                    Đóng
                  </Button>
                </div>
              ) : availableVehicles.length === 0 ? (
                <div className="space-y-3 py-14 text-center text-slate-500">
                  <Bike className="mx-auto size-14 opacity-30" />
                  <p className="text-lg font-medium text-slate-700">
                    Hiện chưa có xe trống trong khoảng này
                  </p>
                  <p className="mx-auto max-w-sm text-sm">
                    Đổi ngày nhận/trả hoặc gọi hotline để được sắp xếp trực tiếp.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {availableVehicles.map((vehicle) => {
                    const priceTotal = totalDays * vehicle.pricePerDay
                    return (
                      <div
                        key={vehicle.id}
                        className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-blue-700">
                            <Bike className="size-7" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{vehicle.name}</h4>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Màu: <strong>{vehicle.color || "Nhiều màu"}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:items-end">
                          <div className="text-left sm:text-right">
                            <span className="block text-xs text-slate-500">
                              {vehicle.pricePerDay.toLocaleString("vi-VN")}đ/ngày
                            </span>
                            <span className="money block text-base font-bold text-slate-900">
                              Tổng {priceTotal.toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                          <Button
                            onClick={() => handleConfirmBooking(vehicle)}
                            disabled={isSubmitting}
                            className="h-9 rounded-xl bg-blue-700 px-4 text-xs font-semibold text-white hover:bg-blue-800"
                          >
                            {isSubmitting && selectedVehicle?.id === vehicle.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              "Xác nhận đặt xe"
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating contact */}
      <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3">
        {isOpenContact && (
          <div className="mb-1 flex flex-col items-end gap-2.5">
            <a
              href="https://zalo.me/0363077775"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-[#0068ff] px-4 py-2.5 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span className="text-xs font-semibold">Zalo: 0363.077.775</span>
              <MessageCircle className="size-4" />
            </a>
            <a
              href="https://zalo.me/0934924195"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-[#0068ff] px-4 py-2.5 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span className="text-xs font-semibold">Zalo: 0934.924.195</span>
              <MessageCircle className="size-4" />
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61569870030659"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span className="text-xs font-semibold">Facebook</span>
              <Facebook className="size-4" />
            </a>
            <a
              href="tel:0363077775"
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span className="text-xs font-semibold">0363.077.775</span>
              <PhoneCall className="size-4" />
            </a>
            <a
              href="tel:0934924195"
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-white shadow-lg transition-transform hover:scale-[1.02]"
            >
              <span className="text-xs font-semibold">0934.924.195</span>
              <PhoneCall className="size-4" />
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsOpenContact(!isOpenContact)}
          aria-label="Liên hệ hotline và mạng xã hội"
          className={cn(
            "flex size-14 items-center justify-center rounded-full text-white shadow-2xl transition-transform hover:scale-105 active:scale-95",
            isOpenContact ? "bg-rose-500" : "bg-blue-700"
          )}
        >
          {isOpenContact ? <X className="size-6" /> : <PhoneCall className="size-6" />}
        </button>
      </div>
    </div>
  )
}
