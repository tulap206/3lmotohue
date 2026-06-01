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
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "AutoRental",
      "name": "3L Moto - Cho thuê xe máy tại Huế",
      "image": "https://3lmotohue.com/hue-motorbike-bg-v3.jpg",
      "@id": "https://3lmotohue.com/#rental",
      "url": "https://3lmotohue.com",
      "telephone": "+84363077775",
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
        "https://www.facebook.com/profile.php?id=61569870030659"
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Thủ tục thuê xe máy tại 3L Moto Huế gồm những gì?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Thủ tục thuê xe máy tại 3L Moto cực kỳ đơn giản. Bạn chỉ cần cung cấp Căn cước công dân (CCCD), Hộ chiếu hoặc Giấy phép lái xe hợp lệ. Chúng tôi không yêu cầu đặt cọc phức tạp đối với đa số khách du lịch."
          }
        },
        {
          "@type": "Question",
          "name": "3L Moto có giao nhận xe máy tận nơi miễn phí tại Huế không?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Có, 3L Moto hỗ trợ giao nhận xe máy miễn phí tận nơi tại khu vực nội thành Huế, bao gồm Ga Huế, các khách sạn trung tâm, và các điểm lân cận. Đối với các khu vực xa hơn như Sân bay Phú Bài, vui lòng liên hệ hotline để được tư vấn chi tiết."
          }
        },
        {
          "@type": "Question",
          "name": "Khi thuê xe máy tại 3L Moto có được trang bị sẵn mũ bảo hiểm không?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Khi thuê xe máy tại 3L Moto, bạn sẽ được nhận kèm miễn phí 02 mũ bảo hiểm nửa đầu chất lượng cao, sạch sẽ và 01 áo mưa tiện lợi để phục vụ chuyến đi an toàn và thuận lợi nhất."
          }
        },
        {
          "@type": "Question",
          "name": "Nếu xe máy gặp sự cố trên đường đi thì có được cứu hộ không?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Tất cả xe máy của 3L Moto đều được bảo dưỡng định kỳ cực kỳ kỹ lưỡng. Tuy nhiên, nếu có bất kỳ sự cố phát sinh nào trên đường đi, đội ngũ kỹ thuật của chúng tôi luôn sẵn sàng hỗ trợ cứu hộ sự cố 24/7 trong suốt thời gian thuê xe."
          }
        },
        {
          "@type": "Question",
          "name": "Giá thuê xe máy tại 3L Moto Huế là bao nhiêu?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Mức giá thuê xe máy dao động từ 120.000đ đến 130.000đ/ngày tùy theo dòng xe bạn chọn (xe tay ga như Vision, Janus hoặc Airblade đời mới). Mức giá này cam kết công khai, minh bạch và không phát sinh chi phí ẩn."
          }
        }
      ]
    }
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
      />
      <LandingPageClient />
    </>
  )
}
