import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram-notify'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      customerName = 'Khách đặt từ Web',
      phone = '',
      vehicleName = 'Xe máy',
      licensePlate = '',
      startDate = '',
      endDate = '',
      totalDays = 1,
      totalPrice = 0,
      notes = '',
    } = body

    // Format currency
    const formatMoney = (val: number) => {
      return new Intl.NumberFormat('vi-VN').format(val) + ' đ'
    }

    // 1. Log to access_logs
    try {
      await supabase.from('access_logs').insert([{
        username: 'web_visitor',
        displayname: customerName,
        action: 'ĐẶT ĐƠN MỚI TỪ WEB',
        module: 'Website Landing',
        details: `Khách: ${customerName} | SĐT: ${phone} | Xe: ${vehicleName} (${licensePlate || 'Chờ gán'}) | Thuê: ${startDate} -> ${endDate} (${totalDays} ngày) | Tổng: ${formatMoney(totalPrice)}`,
        timestamp: new Date().toISOString()
      }])
    } catch (dbErr) {
      console.warn('Could not log web booking to access_logs:', dbErr)
    }

    // 2. Send Telegram notification
    try {
      const telegramDetails = `
👤 <b>Khách hàng:</b> ${customerName}
📞 <b>Số điện thoại:</b> ${phone}
🏍️ <b>Xe đặt:</b> ${vehicleName} ${licensePlate ? `(${licensePlate})` : ''}
📅 <b>Thời gian thuê:</b> ${startDate} ➔ ${endDate} (${totalDays} ngày)
💰 <b>Tổng tiền tạm tính:</b> ${formatMoney(totalPrice)}
📝 <b>Ghi chú:</b> ${notes || 'Đặt qua landing page 3L Moto'}
`.trim()

      await sendTelegramNotification('ĐƠN ĐẶT XE MỚI TỪ WEBSITE', telegramDetails)
    } catch (teleErr) {
      console.warn('Could not send Telegram notification for web booking:', teleErr)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Booking notify error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
