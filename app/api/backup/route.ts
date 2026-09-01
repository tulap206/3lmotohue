import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: Request) {
  // 1. Verify Vercel Cron authorization or CRON_SECRET
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")
  
  const isAuthorized = 
    (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) || 
    (process.env.CRON_SECRET && secretParam === process.env.CRON_SECRET) ||
    (process.env.NODE_ENV === "development" && (url.hostname === "localhost" || url.hostname === "127.0.0.1"))

  if (!isAuthorized) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    console.log("📦 [Auto-Backup] Starting daily backup...")

    // 2. Fetch all data from tables
    const [customersRes, vehiclesRes, rentalsRes, transactionsRes] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("vehicles").select("*"),
      supabase.from("rentals").select("*"),
      supabase.from("transactions").select("*")
    ])

    if (customersRes.error) throw customersRes.error
    if (vehiclesRes.error) throw vehiclesRes.error
    if (rentalsRes.error) throw rentalsRes.error
    if (transactionsRes.error) console.error("Transactions backup error:", transactionsRes.error)

    const backupData = {
      timestamp: new Date().toISOString(),
      customers: customersRes.data || [],
      vehicles: vehiclesRes.data || [],
      rentals: rentalsRes.data || [],
      transactions: transactionsRes.data || [],
    }

    // 3. Upload to Supabase Storage
    const fileName = `auto-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const jsonString = JSON.stringify(backupData, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })

    const { error: uploadError } = await supabase.storage
      .from("backups")
      .upload(fileName, blob, { upsert: false })

    if (uploadError) throw uploadError
    console.log(`✅ [Auto-Backup] Uploaded backup file: ${fileName}`)

    // 4. Log to access_logs
    await supabase.from("access_logs").insert({
      username: "system",
      displayName: "Tự động sao lưu",
      action: "Tự động sao lưu",
      module: "settings",
      details: `Tự động sao lưu thành công: ${backupData.customers.length} khách, ${backupData.vehicles.length} xe, ${backupData.rentals.length} đơn thuê`,
      timestamp: new Date().toISOString()
    })

    // 5. Cleanup backup files older than 30 days
    const { data: files, error: listError } = await supabase.storage
      .from("backups")
      .list()

    if (listError) throw listError

    if (files && files.length > 0) {
      const now = new Date()
      const thresholdDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      
      const filesToDelete = files
        .filter(file => {
          if (!file.created_at) return false
          const createdDate = new Date(file.created_at)
          return createdDate < thresholdDate
        })
        .map(file => file.name)

      if (filesToDelete.length > 0) {
        console.log(`🧹 [Auto-Backup] Found ${filesToDelete.length} files older than 30 days to delete:`, filesToDelete)
        const { error: deleteError } = await supabase.storage
          .from("backups")
          .remove(filesToDelete)

        if (deleteError) throw deleteError
        console.log(`🧹 [Auto-Backup] Deleted old backups:`, filesToDelete)

        // Log deletion to access_logs
        await supabase.from("access_logs").insert({
          username: "system",
          displayName: "Tự động dọn dẹp",
          action: "Xoá dữ liệu",
          module: "settings",
          details: `Xoá tự động ${filesToDelete.length} file sao lưu cũ hết hạn 30 ngày: ${filesToDelete.join(', ')}`,
          timestamp: new Date().toISOString()
        })
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: "Backup and cleanup completed successfully",
      file: fileName
    })
  } catch (error: any) {
    console.error("❌ [Auto-Backup] Error:", error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
