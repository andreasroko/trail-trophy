import { useEffect, useState } from 'react'
import { LogIn, LogOut, Mail, X, Loader2, UserRound } from 'lucide-react'
import { useAuth } from '../data/auth.jsx'

const cx = (...a) => a.filter(Boolean).join(' ')

/** Sign-in button, or the signed-in email + sign-out. Renders nothing if accounts aren't configured. */
export function AccountButton({ dark, onSignIn }) {
  const { enabled, ready, user, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  if (!enabled || !ready) return null
  const btn = cx('chip-btn px-3 py-2', dark ? 'text-slate-200 hover:bg-white/10' : 'text-stone-700 hover:bg-white/80')

  return (
    <div className={cx(dark ? 'glass-dark' : 'glass-light', 'pointer-events-auto flex items-center gap-1 p-1.5')}>
      {user ? (
        <>
          <span className={cx('flex max-w-[220px] items-center gap-1.5 truncate px-2 text-xs', dark ? 'text-slate-300' : 'text-stone-600')}>
            <UserRound size={14} className="shrink-0" />
            <span className="truncate">{user.email}</span>
          </span>
          <button
            className={btn}
            disabled={busy}
            onClick={async () => { setBusy(true); try { await signOut() } finally { setBusy(false) } }}
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Sign out
          </button>
        </>
      ) : (
        <button className={btn} onClick={onSignIn}><LogIn size={15} /> Sign in</button>
      )}
    </div>
  )
}

export function SignInDialog({ open, onClose, dark }) {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ status: 'idle', error: null })

  useEffect(() => { if (open) setState({ status: 'idle', error: null }) }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'sending', error: null })
    try {
      await signInWithEmail(email.trim())
      setState({ status: 'sent', error: null })
    } catch (err) {
      setState({ status: 'idle', error: err.message })
    }
  }

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Sign in"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(dark ? 'glass-dark !bg-slate-900/90' : 'glass-light !bg-white/90', 'w-full max-w-sm p-5')}
      >
        <div className="mb-4 flex items-center gap-2">
          <LogIn size={18} className={dark ? 'text-cyan-300' : 'text-orange-600'} />
          <h2 className="flex-1 font-display text-lg font-semibold">Sign in to Trail Trophy</h2>
          <button onClick={onClose} className="rounded-md p-1 opacity-60 hover:opacity-100" aria-label="Close"><X size={18} /></button>
        </div>

        {state.status === 'sent' ? (
          <div className={cx('rounded-xl p-4 text-sm', dark ? 'bg-emerald-400/10 text-emerald-200' : 'bg-emerald-50 text-emerald-800')}>
            <div className="mb-1 flex items-center gap-2 font-semibold"><Mail size={16} /> Check your inbox</div>
            We sent a sign-in link to <b>{email}</b>. Open it <b>in this browser</b> and you'll be signed in.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className={cx('text-sm', dark ? 'text-slate-300' : 'text-stone-600')}>
              No password needed — we'll email you a one-time sign-in link.
            </p>
            <input
              type="email" required autoFocus placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cx('w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-1 focus:ring-2',
                dark ? 'bg-white/5 ring-white/15 focus:ring-cyan-300' : 'bg-white ring-stone-900/10 focus:ring-orange-500')}
            />
            <button
              type="submit" disabled={state.status === 'sending'}
              className={cx('flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition',
                dark ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500', state.status === 'sending' && 'opacity-60')}
            >
              {state.status === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Email me a sign-in link
            </button>
            {state.error && <div className="text-xs font-medium text-red-500">{state.error}</div>}
          </form>
        )}
      </div>
    </div>
  )
}
