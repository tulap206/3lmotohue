import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  
  // Clear cookie by setting expired time
  response.cookies.set('3l_moto_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0, // delete cookie immediately
    path: '/'
  })
  
  return response
}
