import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Supabase client, or null when no project is configured (the app then runs in on-device mode). */
export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } })
  : null

/** OAuth providers enabled in the Supabase dashboard, e.g. VITE_AUTH_PROVIDERS=google,github */
export const oauthProviders = (import.meta.env.VITE_AUTH_PROVIDERS || '')
  .split(',').map((s) => s.trim()).filter(Boolean)
