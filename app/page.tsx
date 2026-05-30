import type { Metadata } from 'next'
import LandingPageClient from './page-client'

export const metadata: Metadata = {
  title: '3L Moto - Cho thuê xe máy tại Huế',
  description: 'Dịch vụ cho thuê xe máy tự lái uy tín, chất lượng tại Huế. Giao xe tận nơi miễn phí, trang bị sẵn mũ bảo hiểm và áo mưa.',
}

export default function LandingPage() {
  return <LandingPageClient />
}
