"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import {
  Bike,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users as UsersIcon,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface SidebarProps {
  children: React.ReactNode
}

const menuItems = [
  {
    title: "Tổng quan",
    href: "/dashboard",
    icon: LayoutDashboard,
    color: "text-blue-500",
  },
  {
    title: "Quản lý xe",
    href: "/dashboard/vehicles",
    icon: Bike,
    color: "text-purple-500",
  },
  {
    title: "Khách thuê",
    href: "/dashboard/customers",
    icon: Users,
    color: "text-green-500",
  },
  {
    title: "Đơn thuê",
    href: "/dashboard/orders",
    icon: ClipboardList,
    color: "text-orange-500",
  },
  {
    title: "Báo cáo",
    href: "/dashboard/reports",
    icon: FileText,
    color: "text-pink-500",
  },
  {
    title: "Lịch sử truy cập",
    href: "/dashboard/access-history",
    icon: History,
    color: "text-indigo-500",
  },
  {
    title: "Người dùng",
    href: "/dashboard/users",
    icon: UsersIcon,
    color: "text-cyan-500",
  },
]

export function DashboardSidebar({ children }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <div className="flex min-h-screen gradient-bg">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-20 bg-white border-r border-gray-100 transition-transform duration-300 flex flex-col shadow-sm",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-center h-24 border-b border-gray-100">
          <div className="relative w-[86px] h-[86px]">
            <Image
              src="/logo.jpg"
              alt="3L Moto Logo"
              fill
              className="object-contain rounded-xl"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 mx-auto",
                  isActive
                    ? "sidebar-active"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                )}
                title={item.title}
              >
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 space-y-2 border-t border-gray-100">
          {/* User Avatar */}
          {user && (
            <div 
              className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mx-auto cursor-default"
              title={`${user.displayName} (${user.username})`}
            >
              <span className="text-white text-sm font-semibold uppercase">
                {user.displayName.charAt(0)}
              </span>
            </div>
          )}
          <button
            className="flex items-center justify-center w-14 h-14 rounded-2xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all duration-200 mx-auto"
            title="Cài đặt"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-14 h-14 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-200 mx-auto"
            title="Đăng xuất"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-20">
        {/* Mobile menu button */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center h-14 px-4 bg-transparent">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-white/50"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </Button>
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8 lg:pt-8">{children}</main>
      </div>
    </div>
  )
}
