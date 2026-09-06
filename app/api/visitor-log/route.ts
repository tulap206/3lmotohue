import { NextResponse, NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Get IP address from headers
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
               request.headers.get('x-real-ip') || 
               'Unknown IP'
    
    // Get User-Agent
    const userAgent = request.headers.get('user-agent') || 'Unknown Device'
    
    // Parse user agent to make details more readable
    let deviceName = 'Thiết bị không rõ'
    if (userAgent !== 'Unknown Device') {
      const isMobile = /mobile/i.test(userAgent)
      const os = /windows/i.test(userAgent) ? 'Windows' :
                 /macintosh/i.test(userAgent) ? 'MacOS' :
                 /android/i.test(userAgent) ? 'Android' :
                 /iphone|ipad|ipod/i.test(userAgent) ? 'iOS' :
                 /linux/i.test(userAgent) ? 'Linux' : 'HĐH không rõ'
      
      const browser = /chrome|crios/i.test(userAgent) && !/edge|edg/i.test(userAgent) && !/opr/i.test(userAgent) ? 'Chrome' :
                      /safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent) ? 'Safari' :
                      /firefox/i.test(userAgent) ? 'Firefox' :
                      /edge|edg/i.test(userAgent) ? 'Edge' :
                      /opr/i.test(userAgent) ? 'Opera' : 'Trình duyệt không rõ'
      
      deviceName = `${browser} (${os}${isMobile ? ' Mobile' : ''})`
    }

    // Insert log to access_logs table
    const { error } = await supabase.from('access_logs').insert([{
      username: 'visitor',
      displayname: 'Khách truy cập',
      action: 'Truy cập',
      module: 'Khách truy cập Website',
      details: `Khách xem Landing Page [Thiết bị: ${deviceName}]`,
      ip_address: ip,
      timestamp: new Date().toISOString()
    }])

    if (error) {
      console.error('Error saving visitor log:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Visitor logging exception:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
