import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env.local', 'utf8')
const env = {} as any
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim()
  }
})

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function run() {
  const { error: vErr } = await supabase.from('vehicles').select('*')
  console.log("Vehicles error:", vErr)
  const { error: rErr } = await supabase.from('rentals').select('*')
  console.log("Rentals error:", rErr)
  const { error: tErr } = await supabase.from('transactions').select('*')
  console.log("Transactions error:", tErr)
}

run().catch(console.error)
