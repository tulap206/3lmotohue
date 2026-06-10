import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fpiupgmknsydqrihqdbo.supabase.co'.trim()
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaXVwZ21rbnN5ZHFyaWhqZGJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTYzNzAsImV4cCI6MjA5NDYzMjM3MH0.0YK7DmgpA8YuWEalt1wh07dOQXW5GFlQzo3JydfFaL8'.trim()

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  const { data, error } = await supabase
    .from('access_logs')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Row:', data)
  }
}
main()
