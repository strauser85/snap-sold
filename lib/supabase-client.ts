// lib/supabase-client.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cache the client across hot-reloads in dev so we don't create multiple instances
const globalForSupabase = globalThis as unknown as {
  supabase?: SupabaseClient
}

export const supabase =
  globalForSupabase.supabase ??
  createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true }
  })

if (!globalForSupabase.supabase) globalForSupabase.supabase = supabase
