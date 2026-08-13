import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const parts = line.split('=')
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
  console.log('Fetching users from auth_users...')
  const { data: users, error: fetchError } = await supabase.from('auth_users').select('*')
  if (fetchError) {
    console.error('Error fetching users:', fetchError)
    return
  }

  console.log(`Found ${users?.length} users. Migrating to Supabase Auth...`)

  for (const user of users || []) {
    const email = `${user.username}@3lmoto.local`
    const password = user.password

    console.log(`Migrating user: ${user.username} with email: ${email}...`)

    // Sign up the user in Supabase Auth
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: user.username,
          displayname: user.displayname,
          role: user.role,
        }
      }
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered') || signUpError.status === 400) {
        console.log(`User ${user.username} is already registered. Searching for user ID...`)
        
        // Since we can't query auth.users directly without service role key,
        // we can try logging in to verify it works and get the ID.
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (signInError) {
          console.error(`Error signing in user ${user.username} to get ID:`, signInError)
          continue
        }
        
        const newId = signInData.user.id
        console.log(`Successfully verified. Updating auth_users ID to ${newId} for ${user.username}...`)
        
        // Update the ID in auth_users
        const { error: updateError } = await supabase
          .from('auth_users')
          .update({ id: newId })
          .eq('username', user.username)

        if (updateError) {
          console.error(`Error updating ID in auth_users for ${user.username}:`, updateError)
        } else {
          console.log(`✅ Updated ID for ${user.username} successfully.`)
        }
      } else {
        console.error(`Error signing up user ${user.username}:`, signUpError)
      }
      continue
    }

    const newId = signUpData.user?.id
    if (newId) {
      console.log(`Successfully signed up. Updating auth_users ID to ${newId} for ${user.username}...`)
      
      const { error: updateError } = await supabase
        .from('auth_users')
        .update({ id: newId })
        .eq('username', user.username)

      if (updateError) {
        console.error(`Error updating ID in auth_users for ${user.username}:`, updateError)
      } else {
        console.log(`✅ Updated ID for ${user.username} successfully.`)
      }
    }
  }

  console.log('Migration process finished!')
}

main()
