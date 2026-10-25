import { useEffect, useState } from 'react'
import {
  Trophy, LogIn, LogOut, Mail, X, Save, Check, Loader2, Share2, Link2, Trash2, HardDrive, Globe, Lock,
} from 'lucide-react'
import { useAuth } from '../data/auth.jsx'
import { fmtDist, fmtEle } from './format.js'
import { THEMES } from '../lib/themes.js'

const cx = (...a) => a.filter(Boolean).join(' ')
const glass = (dark) => (dark ? 'glass-dark' : 'glass-light')

// ---------------------------------------------------------------- Account pill (top centre)

export function AccountBar({ dark, count, onOpenShelf, onSignIn }) {
  const { user, cloud, ready, signOut } = useAuth()
  const btn = cx('chip-btn px-3 py-2', dark ? 'text-slate-200 hover:bg-white/10' : 'text-stone-700 hover:bg-white/80')
  if (!ready) return null
  return (
    <div className={cx(glass(dark), 'pointer-events-auto flex items-center gap-1 p-1.5')}>
      {user ? (
        <>
          <button className={btn} onClick={onOpenShelf}>
            <Trophy size={15} /> My trophies
            {count > 0 && <span className={cx('rounded-full px-1.5 text-[10px] font-bold', dark ? 'bg-cyan-400/20 text-cyan-200' : 'bg-orange-500/15 text-orange-700')}>{count}</span>}
          </button>
          {cloud ? (
            <>
              <div className={cx('mx-0.5 h-5 w-px', dark ? 'bg-white/15' : 'bg-stone-900/10')} />
              <span className={cx('hidden max-w-[160px] truncate px-1 text-[11px] sm:inline', dark ? 'text-slate-400' : 'text-stone-500')}>{user.email}</span>
              <button className={btn} onClick={signOut} title="Sign out"><LogOut size={15} /></button>
            </>
          ) : (
            <span className={cx('hidden items-center gap-1 px-2 text-[11px] sm:flex', dark ? 'text-slate-400' : 'text-stone-500')} title="No backend configured — hikes are stored in this browser">
              <HardDrive size={12} /> On this device
            </span>
          )}
        </>
      ) : (
        <button className={btn} onClick={onSignIn}><LogIn size={15} /> Sign in to save your hikes</button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Sign-in dialog

export function SignInDialog({ open, onClose, dark, reason, redirectPath }) {
  const { signInWithEmail, signInWithProvider, providers } = useAuth()
  const [email, setEmail] = useState('')
  const [state, setState] = useState({ status: 'idle', error: null })
  useEffect(() => { if (open) setState({ status: 'idle', error: null }) }, [open])
  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'sending', error: null })
    try {
      await signInWithEmail(email.trim(), redirectPath)
      setState({ status: 'sent', error: null })
    } catch (err) {
      setState({ status: 'idle', error: err.message })
    }
  }

  return (
    <Modal onClose={onClose} dark={dark} title="Sign in to Trail Trophy" icon={LogIn}>
      {reason && <p className={cx('text-sm', dark ? 'text-slate-300' : 'text-stone-600')}>{reason}</p>}
      {state.status === 'sent' ? (
        <div className={cx('rounded-xl p-4 text-sm', dark ? 'bg-emerald-400/10 text-emerald-200' : 'bg-emerald-50 text-emerald-800')}>
          <div className="mb-1 flex items-center gap-2 font-semibold"><Mail size={16} /> Check your inbox</div>
          We sent a sign-in link to <b>{email}</b>. Open it on this device and you'll come right back{redirectPath ? ' — your hike will be saved automatically' : ''}.
        </div>
      ) : (
        <>
          <form onSubmit={submit} className="space-y-2">
            <input
              type="email" required autoFocus placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cx('w-full rounded-xl px-3 py-2.5 text-sm outline-none ring-1 focus:ring-2',
                dark ? 'bg-white/5 ring-white/15 focus:ring-cyan-300' : 'bg-white ring-stone-900/10 focus:ring-orange-500')}
            />
            <button type="submit" disabled={state.status === 'sending'}
              className={cx('flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition',
                dark ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500', state.status === 'sending' && 'opacity-60')}>
              {state.status === 'sending' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Email me a sign-in link
            </button>
          </form>
          {providers.length > 0 && (
            <div className="space-y-2">
              <div className={cx('text-center text-[11px] uppercase tracking-wider', dark ? 'text-slate-500' : 'text-stone-400')}>or</div>
              {providers.map((p) => (
                <button key={p} onClick={() => signInWithProvider(p, redirectPath).catch((err) => setState({ status: 'idle', error: err.message }))}
                  className={cx('w-full rounded-xl px-3 py-2.5 text-sm font-semibold capitalize ring-1',
                    dark ? 'ring-white/15 hover:bg-white/5' : 'bg-white ring-stone-900/10 hover:bg-stone-50')}>
                  Continue with {p}
                </button>
              ))}
            </div>
          )}
          {state.error && <div className="text-xs font-medium text-red-500">{state.error}</div>}
        </>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------- Save / share controls (inside the hike panel)

export function SaveControls({ dark, saved, dirty, readOnly, busy, onSave, onUpdate, onTogglePublic, onRemix }) {
  const { cloud } = useAuth()
  const [copied, setCopied] = useState(false)
  const primary = cx('chip-btn flex-1 py-2 text-white', dark ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500')
  const secondary = cx('chip-btn flex-1 py-2 ring-1', dark ? 'ring-white/15 hover:bg-white/5' : 'bg-white/70 ring-stone-900/10 hover:bg-white')
  const spin = busy && <Loader2 size={14} className="animate-spin" />

  if (readOnly) {
    return (
      <button className={primary} onClick={onRemix}>
        {spin || <Save size={14} />} Save a copy to my trophies
      </button>
    )
  }
  if (!saved) {
    return (
      <button className={primary} onClick={onSave} disabled={busy}>
        {spin || <Save size={14} />} Save to my trophies
      </button>
    )
  }

  const shareUrl = saved.shareSlug ? `${window.location.origin}/t/${saved.shareSlug}` : null
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard blocked */ }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {dirty ? (
          <button className={primary} onClick={onUpdate} disabled={busy}>{spin || <Save size={14} />} Save style changes</button>
        ) : (
          <div className={cx(secondary, 'cursor-default')}><Check size={14} /> Saved</div>
        )}
        {cloud && (
          <button className={secondary} onClick={onTogglePublic} disabled={busy} title={saved.isPublic ? 'Anyone with the link can view' : 'Only you can see this hike'}>
            {saved.isPublic ? <Globe size={14} /> : <Lock size={14} />} {saved.isPublic ? 'Public' : 'Private'}
          </button>
        )}
      </div>
      {cloud && saved.isPublic && shareUrl && (
        <button onClick={copy} className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] ring-1',
          dark ? 'bg-white/5 ring-white/10' : 'bg-white/60 ring-stone-900/10')}>
          {copied ? <Check size={13} className="shrink-0 text-emerald-500" /> : <Link2 size={13} className="shrink-0" />}
          <span className="truncate font-mono">{shareUrl.replace(/^https?:\/\//, '')}</span>
          <span className="ml-auto shrink-0 font-semibold">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      )}
      {!cloud && (
        <div className={cx('flex items-center gap-1.5 text-[11px]', dark ? 'text-slate-400' : 'text-stone-500')}>
          <HardDrive size={12} /> Saved in this browser. Connect Supabase to sync &amp; share.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Trophy shelf

export function TrophyShelf({ open, onClose, dark, hikes, loading, error, units, currentId, onOpen, onDelete }) {
  if (!open) return null
  return (
    <Modal onClose={onClose} dark={dark} title="My trophies" icon={Trophy} wide>
      {loading && <div className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading…</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}
      {!loading && !error && hikes.length === 0 && (
        <div className={cx('rounded-xl p-6 text-center text-sm', dark ? 'bg-white/5 text-slate-300' : 'bg-white/60 text-stone-600')}>
          No trophies yet. Drop a GPX file and hit <b>Save to my trophies</b>.
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {hikes.map((h) => {
          const theme = THEMES[h.settings?.theme] || THEMES.satellite
          return (
            <div key={h.id} className={cx('group relative overflow-hidden rounded-xl ring-1 transition',
              currentId === h.id ? (dark ? 'ring-cyan-300' : 'ring-orange-500') : dark ? 'ring-white/10 hover:ring-white/30' : 'ring-stone-900/10 hover:ring-stone-900/30',
              dark ? 'bg-white/5' : 'bg-white/70')}>
              <button onClick={() => onOpen(h)} className="block w-full p-3 text-left">
                <div className="mb-2 h-1.5 w-12 rounded-full" style={{ background: theme.trail.emissive }} />
                <div className="truncate pr-6 font-display text-sm font-semibold">{h.name}</div>
                <div className={cx('text-[11px]', dark ? 'text-slate-400' : 'text-stone-500')}>
                  {new Date(h.recordedAt || h.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  {h.isPublic && <> · <Share2 size={10} className="inline" /> shared</>}
                </div>
                <div className="mt-2 flex gap-3 text-[11px] font-medium tabular-nums">
                  <span>{fmtDist(h.distanceM, units)}</span>
                  <span>+{fmtEle(h.gainM, units)}</span>
                  <span>▲ {fmtEle(h.peakM, units)}</span>
                </div>
              </button>
              <button
                onClick={() => { if (window.confirm(`Delete "${h.name}"? This can't be undone.`)) onDelete(h) }}
                className={cx('absolute right-2 top-2 rounded-md p-1.5 opacity-0 transition group-hover:opacity-100 focus:opacity-100',
                  dark ? 'text-slate-400 hover:bg-red-500/20 hover:text-red-300' : 'text-stone-400 hover:bg-red-50 hover:text-red-600')}
                title="Delete hike"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Modal shell

function Modal({ onClose, dark, title, icon: Icon, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(glass(dark), 'max-h-[85vh] w-full overflow-y-auto p-5', wide ? 'max-w-2xl' : 'max-w-sm', dark ? '!bg-slate-900/90' : '!bg-white/90')}
      >
        <div className="mb-4 flex items-center gap-2">
          <Icon size={18} className={dark ? 'text-cyan-300' : 'text-orange-600'} />
          <h2 className="flex-1 font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 opacity-60 hover:opacity-100"><X size={18} /></button>
        </div>
        <div className="space-y-4">{children}</div>
      </div>
    </div>
  )
}
