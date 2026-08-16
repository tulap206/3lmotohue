import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
const supabase = createClient(supabaseUrl, supabaseKey)

// Endpoint secret token for security
const SYNC_SECRET = process.env.LOCATION_SYNC_SECRET || "3lmotohue-sync-secret-2026"

function extractVehicleLocation(notes?: string) {
  if (!notes) return { location: "", cleanNotes: "" }
  const match = notes.match(/\[location:(.*?)\]/i)
  if (match) {
    const cleanNotes = notes.replace(/\[location:(.*?)\]/gi, "").trim()
    return { location: match[1].trim(), cleanNotes }
  }
  return { location: "", cleanNotes: notes }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-sync-secret")
    if (authHeader !== `Bearer ${SYNC_SECRET}` && authHeader !== SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized invalid sync secret token" }, { status: 401 })
    }

    const body = await req.json()
    const items = Array.isArray(body) ? body : [body]

    const { data: vehicles, error: fetchErr } = await supabase.from("vehicles").select("id, licensePlate, name, notes")
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    const results = []

    for (const item of items) {
      const { vehicleId, licensePlate, lat, lng, address = "", timestamp = new Date().toISOString() } = item
      if (!lat || !lng) continue

      // Match vehicle by vehicleId or licensePlate
      const targetPlate = licensePlate ? String(licensePlate).toLowerCase().replace(/[^a-z0-9]/g, '') : ""
      
      const vehicle = vehicles.find((v) => {
        if (vehicleId && v.id === vehicleId) return true
        if (targetPlate) {
          const vPlate = String(v.licensePlate || "").toLowerCase().replace(/[^a-z0-9]/g, '')
          return vPlate === targetPlate || vPlate.includes(targetPlate) || targetPlate.includes(vPlate)
        }
        return false
      })

      if (!vehicle) {
        results.push({ item, status: "not_found" })
        continue
      }

      const cleanNotes = extractVehicleLocation(vehicle.notes).cleanNotes
      const locAddress = address || `${lat}, ${lng}`
      const formattedLoc = `${lat},${lng}|${locAddress}|${timestamp}`
      const newNotes = cleanNotes ? `${cleanNotes}\n[location:${formattedLoc}]` : `[location:${formattedLoc}]`

      const { error: updateErr } = await supabase
        .from("vehicles")
        .update({ notes: newNotes })
        .eq("id", vehicle.id)

      if (updateErr) {
        results.push({ vehicleId: vehicle.id, licensePlate: vehicle.licensePlate, status: "error", error: updateErr.message })
      } else {
        results.push({ vehicleId: vehicle.id, licensePlate: vehicle.licensePlate, status: "success" })
      }
    }

    return NextResponse.json({ success: true, updatedCount: results.filter(r => r.status === 'success').length, results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
