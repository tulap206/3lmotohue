import { supabase } from './supabase'

const MAX_ATTEMPTS = 5
const LOCKOUT_MINUTES = 30

export async function checkLoginAttempts(username: string): Promise<{ allowed: boolean; remainingMinutes?: number }> {
  try {
    const { data, error } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('username', username)
      .single()
      
    if (error || !data) return { allowed: true }
    
    if (data.locked_until && new Date(data.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 60000)
      return { allowed: false, remainingMinutes: remaining }
    }
    
    // Auto reset if lockout period has expired but database has not updated
    if (data.locked_until && new Date(data.locked_until) <= new Date()) {
      await resetLoginAttempts(username)
    }
  } catch (err) {
    console.error('Error checking login attempts:', err)
  }
  return { allowed: true }
}

export async function recordFailedLogin(username: string, ip: string): Promise<number> {
  try {
    const { data: existing } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('username', username)
      .single()
      
    const count = existing ? existing.attempt_count + 1 : 1
    const lockedUntil = count >= MAX_ATTEMPTS 
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString()
      : null
      
    await supabase
      .from('login_attempts')
      .upsert({
        username,
        ip_address: ip,
        attempt_count: count,
        locked_until: lockedUntil,
        last_attempt: new Date().toISOString()
      })
      
    if (lockedUntil) {
      const { sendTelegramNotification } = await import('./telegram-notify')
      await sendTelegramNotification(
        '🚨 CẢNH BÁO BẢO MẬT',
        `Tài khoản *${username}* bị TẠM KHÓA ${LOCKOUT_MINUTES} phút do nhập sai mật khẩu quá 5 lần.\nIP: ${ip}\nThiết bị: Hệ thống tự động`
      ).catch(err => console.error('Telegram lockout alert error:', err))
    }
    
    return count
  } catch (err) {
    console.error('Error recording failed login:', err)
    return 1
  }
}

export async function resetLoginAttempts(username: string): Promise<void> {
  try {
    await supabase
      .from('login_attempts')
      .delete()
      .eq('username', username)
  } catch (err) {
    console.error('Error resetting login attempts:', err)
  }
}
