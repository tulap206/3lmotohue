import type { Metadata } from 'next'
// import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/auth-context'
import './globals.css'

// const inter = Inter({ 
//   subsets: ["latin", "vietnamese"],
//   display: 'swap',
//   variable: '--font-inter',
//});

export const metadata: Metadata = {
  title: '3L Moto - Quản lý cho thuê xe máy',
  description: 'Hệ thống quản lý cho thuê xe máy 3L Moto',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className="">
      <body className="font-sans antialiased bg-background min-h-screen">
        <AuthProvider>
          {children}
        </AuthProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
