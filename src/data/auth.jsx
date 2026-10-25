import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, oauthProviders } from './supabase.js'

const AuthContext = createContext(null)

// In on-device mode there is no sign-in: everything belongs to this browser.
const LOCAL_USER = { id: 'local', email: null, local: true }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(supabase ? null : LOCAL_USER)
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
    user,
    ready,
    cloud: !!supabase,
    providers: oauthProviders,
    /** Passwordless email link; returns to the current page. */
    async signInWithEmail(email, redirectPath = window.location.pathname) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + redirectPath },
      })
      if (error) throw new Error(error.message)
    },
    async signInWithProvider(provider, redirectPath = window.location.pathname) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + redirectPath },
      })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      await supabase?.auth.signOut()
    },
  }), [user, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
