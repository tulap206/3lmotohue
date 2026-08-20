"use client"

import { useEffect, Suspense } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { RentalDataProvider } from "@/contexts/rental-data-context"
import { NewOrderRealtimeNotifier } from "@/components/dashboard/NewOrderRealtimeNotifier"
import { Loader2 } from "lucide-react"

const RENTAL_PATHS = [
  "/dashboard/vehicles",
  "/dashboard/customers",
  "/dashboard/orders",
  "/dashboard/maintenance",
]

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center gradient-bg">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  const isRentalPath = RENTAL_PATHS.some((p) => pathname.startsWith(p))

  return (
    <DashboardSidebar>
      <NewOrderRealtimeNotifier />
      {isRentalPath ? (
        <RentalDataProvider>{children}</RentalDataProvider>
      ) : (
        children
      )}
    </DashboardSidebar>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center gradient-bg">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      }
    >
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  )
}
