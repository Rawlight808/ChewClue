import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined',
)

const spaAuth = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'pkce' as const,
}

function createSafeClient(): SupabaseClient {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    console.error('ChewClue: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    return createClient('https://placeholder.invalid', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.invalid', {
      auth: spaAuth,
    })
  }
  return createClient(supabaseUrl, supabaseAnonKey, { auth: spaAuth })
}

export const supabase = createSafeClient()
