import { useEffect, useState } from 'react'
import { LogIn, LogOut, Mail, X, Loader2, UserRound, Save, Check, Trophy, Trash2, Globe, Lock, Link2 } from 'lucide-react'
import { useAuth } from '../data/auth.jsx'
import { THEMES } from '../lib/themes.js'
import { fmtDist, fmtEle } from './format.js'

const cx = (...a) => a.filter(Boolean).join(' ')

/** Sign-in button, or the signed-in email + sign-out. Renders nothing if accounts aren't configured. */
export function AccountButton({ dark, onSignIn, onOpenTrophies, compact }) {
  const { enabled, ready, user, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState(false)
  if (!enabled || !ready) return null
  const btn = cx('chip-btn px-3 py-2', dark ? 'text-slate-200 hover:bg-white/10' : 'text-stone-700 hover:bg-white/80')
  const doSignOut = async () => { setBusy(true); try { await signOut() } finally { setBusy(false); setMenu(false) } }

  if (compact) {
    const glass = cx(dark ? 'glass-dark' : 'glass-light', 'pointer-events-auto')
    if (!user) return <button className={cx(glass, btn, '!rounded-full')} onClick={onSignIn}><LogIn size={15} /> Sign in</button>
    return (
      <div className="relative">
        <button className={cx(glass, btn, '!rounded-full')} onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Account menu">
          <Trophy size={15} /> <UserRound size={15} />
        </button>
        {menu && (
          <>
            <div className="pointer-events-auto fixed inset-0" onClick={() => setMenu(false)} />
            <div className={cx(glass, 'absolute right-0 top-full z-10 mt-2 w-60 space-y-1 p-1.5', dark ? '!bg-slate-900/90' : '!bg-white/90')}>
              <div className={cx('flex items-center gap-1.5 truncate px-2.5 py-2 text-xs', dark ? 'text-slate-400' : 'text-stone-500')}>
                <UserRound size={14} className="shrink-0" /><span className="truncate">{user.email}</span>
              </div>
              <button className={cx(btn, 'w-full !justify-start')} onClick={() => { setMenu(false); onOpenTrophies() }}><Trophy size={15} /> My trophies</button>
              <button className={cx(btn, 'w-full !justify-start')} disabled={busy} onClick={doSignOut}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Sign out
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={cx(dark ? 'glass-dark' : 'glass-light', 'pointer-events-auto flex items-center gap-1 p-1.5')}>
      {user ? (
        <>
          <button className={btn} onClick={onOpenTrophies}><Trophy size={15} /> My trophies</button>
          <div className={cx('mx-0.5 h-5 w-px', dark ? 'bg-white/15' : 'bg-stone-900/10')} />
          <span className={cx('flex max-w-[220px] items-center gap-1.5 truncate px-2 text-xs', dark ? 'text-slate-300' : 'text-stone-600')}>
            <UserRound size={14} className="shrink-0" />
            <span className="truncate">{user.email}</span>
          </span>
          <button
            className={btn}
            disabled={busy}
            onClick={doSignOut}
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
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-3" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Sign in"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(dark ? 'glass-dark !bg-slate-900/90' : 'glass-light !bg-white/90', 'w-full max-w-sm !rounded-b-none p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:!rounded-b-2xl sm:pb-5')}
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
              className={cx('w-full rounded-xl px-3 py-2.5 text-base outline-none sm:text-sm ring-1 focus:ring-2',
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

/**
 * Save controls for the hike on screen:
 * unsaved → "Save to my trophies" (or "Save a copy" on a shared link) · signed out → "Sign in to save"
 * saved → "Saved" / "Save style changes", plus a Public/Private toggle and copyable share link.
 * Hidden when accounts aren't configured.
 */
export function SaveButton({ dark, signedIn, saved, dirty, busy, readOnly, isPublic, link, onSignIn, onSave, onSaveStyle, onTogglePublic }) {
  const { enabled, ready } = useAuth()
  const [copied, setCopied] = useState(false)
  if (!enabled || !ready) return null
  const primary = cx('chip-btn w-full py-2 text-white', dark ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500')
  const done = cx('chip-btn flex-1 cursor-default py-2 ring-1', dark ? 'text-emerald-200 ring-emerald-300/30' : 'bg-emerald-50 text-emerald-800 ring-emerald-600/20')
  const secondary = cx('chip-btn py-2 px-3 ring-1', dark ? 'ring-white/15 hover:bg-white/5' : 'bg-white/70 ring-stone-900/10 hover:bg-white')
  const spinner = <Loader2 size={14} className="animate-spin" />

  if (!saved) {
    if (!signedIn) {
      return <button className={primary} onClick={onSignIn}><LogIn size={14} /> {readOnly ? 'Sign in to save a copy' : 'Sign in to save this hike'}</button>
    }
    return (
      <button className={cx(primary, busy && 'opacity-70')} onClick={onSave} disabled={busy}>
        {busy ? spinner : <Save size={14} />} {busy ? 'Saving…' : readOnly ? 'Save a copy to my trophies' : 'Save to my trophies'}
      </button>
    )
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard blocked */ }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {dirty ? (
          <button className={cx(primary, 'flex-1', busy && 'opacity-70')} onClick={onSaveStyle} disabled={busy}>
            {busy ? spinner : <Save size={14} />} {busy ? 'Saving…' : 'Save style changes'}
          </button>
        ) : (
          <div className={done}><Check size={14} /> Saved</div>
        )}
        <button
          className={secondary}
          onClick={onTogglePublic}
          disabled={busy}
          title={isPublic ? 'Anyone with the link can view this hike — click to make private' : 'Only you can see this hike — click to share'}
        >
          {isPublic ? <Globe size={14} /> : <Lock size={14} />} {isPublic ? 'Public' : 'Private'}
        </button>
      </div>
      {isPublic && link && (
        <button
          onClick={copy}
          className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] ring-1',
            dark ? 'bg-white/5 ring-white/10' : 'bg-white/60 ring-stone-900/10')}
        >
          {copied ? <Check size={13} className="shrink-0 text-emerald-500" /> : <Link2 size={13} className="shrink-0" />}
          <span className="truncate font-mono">{link.replace(/^https?:\/\//, '')}</span>
          <span className="ml-auto shrink-0 font-semibold">{copied ? 'Copied' : 'Copy link'}</span>
        </button>
      )}
    </div>
  )
}

/** Your saved hikes. Opening one navigates to /h/:id. */
export function TrophyShelf({ open, onClose, dark, list, loading, error, units, currentId, onOpen, onDelete }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-3" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="My trophies"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(dark ? 'glass-dark !bg-slate-900/90' : 'glass-light !bg-white/90', 'max-h-[85dvh] w-full max-w-2xl overflow-y-auto overscroll-contain !rounded-b-none p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:!rounded-b-2xl sm:pb-5')}
      >
        <div className="mb-4 flex items-center gap-2">
          <Trophy size={18} className={dark ? 'text-cyan-300' : 'text-orange-600'} />
          <h2 className="flex-1 font-display text-lg font-semibold">My trophies</h2>
          <button onClick={onClose} className="rounded-md p-1 opacity-60 hover:opacity-100" aria-label="Close"><X size={18} /></button>
        </div>

        {loading && <div className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading your hikes…</div>}
        {error && <div className="text-sm font-medium text-red-500">Couldn't load your hikes: {error}</div>}
        {!loading && !error && list.length === 0 && (
          <div className={cx('rounded-xl p-6 text-center text-sm', dark ? 'bg-white/5 text-slate-300' : 'bg-white/60 text-stone-600')}>
            No trophies yet. Drop a GPX file and hit <b>Save to my trophies</b>.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((h) => {
            const accent = (THEMES[h.settings?.theme] || THEMES.satellite).trail.emissive
            return (
              <div key={h.id} className="group relative">
              <button
                onClick={() => onOpen(h)}
                className={cx('w-full rounded-xl p-3 text-left ring-1 transition',
                  dark ? 'bg-white/5' : 'bg-white/70',
                  currentId === h.id
                    ? (dark ? 'ring-cyan-300' : 'ring-orange-500')
                    : (dark ? 'ring-white/10 hover:ring-white/30' : 'ring-stone-900/10 hover:ring-stone-900/30'))}
              >
                <div className="mb-2 h-1.5 w-12 rounded-full" style={{ background: accent }} />
                <div className="truncate font-display text-sm font-semibold">{h.name}</div>
                <div className={cx('text-[11px]', dark ? 'text-slate-400' : 'text-stone-500')}>
                  {new Date(h.recordedAt || h.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
                <div className="mt-2 flex gap-3 text-[11px] font-medium tabular-nums">
                  <span>{fmtDist(h.distanceM, units)}</span>
                  <span>+{fmtEle(h.gainM, units)}</span>
                  <span>▲ {fmtEle(h.peakM, units)}</span>
                </div>
              </button>
              <button
                onClick={() => { if (window.confirm(`Delete "${h.name}"? This can't be undone.`)) onDelete(h) }}
                className={cx('absolute right-1.5 top-1.5 rounded-md p-2 transition [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus:opacity-100 [@media(hover:hover)]:group-hover:opacity-100',
                  dark ? 'text-slate-400 hover:bg-red-500/20 hover:text-red-300' : 'text-stone-400 hover:bg-red-50 hover:text-red-600')}
                title="Delete hike"
                aria-label={`Delete ${h.name}`}
              >
                <Trash2 size={15} />
              </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
