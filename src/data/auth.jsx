import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase.js'

const AuthContext = createContext({ enabled: false, ready: true, user: null })

/** App root URL (works locally and under /trail-trophy/ on GitHub Pages). */
const homeUrl = () => window.location.origin + import.meta.env.BASE_URL

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({
    enabled: !!supabase,
    ready,
    user,
    /** Passwordless: emails a one-time link that signs you in and returns to the app. */
    async signInWithEmail(email) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: homeUrl() } })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
    },
  }), [ready, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
