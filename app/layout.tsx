import type { Metadata } from 'next'
// import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from 'sonner'
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
        <Toaster 
          richColors 
          position="top-right" 
          closeButton 
          theme="light" 
          toastOptions={{
            style: {
              borderRadius: '16px',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
              padding: '12px 16px',
            },
          }}
        />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
