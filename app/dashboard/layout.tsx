import type { Metadata } from 'next'
import DashboardLayoutClient from './layout-client'

export const metadata: Metadata = {
  title: '3L Moto - Quản trị hệ thống',
  description: 'Hệ thống quản lý cho thuê xe máy 3L Moto',
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
