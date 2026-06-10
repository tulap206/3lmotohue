import { supabase } from '../lib/supabase'

async function main() {
  const { data, error } = await supabase
    .from('access_logs')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('Error fetching access logs:', error)
  } else {
    console.log('Sample access log row:', data)
  }
}

main()
