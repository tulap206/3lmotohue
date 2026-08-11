import type { Metadata } from 'next'
import LandingPageClient from './page-client'

export const metadata: Metadata = {
  title: '3L Moto - Cho thuê xe máy tại Huế',
  description: 'Dịch vụ cho thuê xe máy tự lái uy tín, chất lượng tại Huế. Giao xe miễn phí tận nơi ga tàu, sân bay, khách sạn nội thành Huế. Trang bị sẵn 02 nón bảo hiểm và áo mưa tiện lợi.',
  keywords: [
    'thuê xe máy huế',
    'cho thuê xe máy huế',
    'thue xe may hue',
    'thuê xe máy ở huế',
    'thuê xe máy tự lái huế',
    'thuê xe máy giá rẻ huế',
    'thuê xe máy giao tận nơi huế',
    'thuê xe máy tại huế',
    '3l moto huế',
    'thuê xe máy huế uy tín'
  ],
  alternates: {
    canonical: 'https://3lmotohue.com',
  },
  openGraph: {
    title: '3L Moto - Cho thuê xe máy tại Huế',
    description: 'Dịch vụ cho thuê xe máy tự lái uy tín, chất lượng tại Huế. Giao xe miễn phí tận nơi ga tàu, sân bay, khách sạn nội thành Huế. Trang bị sẵn 02 nón bảo hiểm và áo mưa tiện lợi.',
    url: 'https://3lmotohue.com',
    siteName: '3L Moto Huế',
    images: [
      {
        url: 'https://3lmotohue.com/hue-motorbike-bg-v3.jpg',
        width: 1200,
        height: 630,
        alt: '3L Moto - Cho thuê xe máy tại Huế',
      },
    ],
    locale: 'vi_VN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '3L Moto - Cho thuê xe máy tại Huế',
    description: 'Dịch vụ cho thuê xe máy tự lái uy tín, chất lượng tại Huế. Giao xe miễn phí tận nơi ga tàu, sân bay, khách sạn nội thành Huế. Trang bị sẵn 02 nón bảo hiểm và áo mưa tiện lợi.',
    images: ['https://3lmotohue.com/hue-motorbike-bg-v3.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
}

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    "name": "3L Moto - Cho thuê xe máy tại Huế",
    "image": "https://3lmotohue.com/hue-motorbike-bg-v3.jpg",
    "@id": "https://3lmotohue.com/#rental",
    "url": "https://3lmotohue.com",
    "telephone": "+84934924195",
    "priceRange": "120.000đ - 130.000đ",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "L25 Đường Số 8, KQH Đông Nam Thủy An",
      "addressLocality": "Thành phố Huế",
      "addressRegion": "Thừa Thiên Huế",
      "postalCode": "530000",
      "addressCountry": "VN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 16.4497,
      "longitude": 107.6074
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
      ],
      "opens": "00:00",
      "closes": "23:59"
    },
    "sameAs": [
      "https://www.facebook.com/3l.moto.hue"
    ]
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPageClient />
    </>
  )
}
