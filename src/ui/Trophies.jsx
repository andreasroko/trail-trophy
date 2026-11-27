import { useEffect, useRef, useState } from 'react'
import { X, Loader2, Save, Check, Trophy, Trash2, Link2, Download, Upload, HardDrive } from 'lucide-react'
import { THEMES } from '../lib/themes.js'
import { fmtDist, fmtEle } from './format.js'

const cx = (...a) => a.filter(Boolean).join(' ')

/** Opens "My trophies". `compact` = round pill for the phone top bar. */
export function TrophiesButton({ dark, onClick, compact }) {
  const btn = cx('chip-btn px-3 py-2', dark ? 'text-slate-200 hover:bg-white/10' : 'text-stone-700 hover:bg-white/80')
  return (
    <button className={cx(dark ? 'glass-dark' : 'glass-light', 'pointer-events-auto', btn, compact ? '!rounded-full' : '!rounded-2xl')} onClick={onClick}>
      <Trophy size={15} /> My trophies
    </button>
  )
}

/**
 * Save + share controls for the hike on screen:
 * unsaved → "Save to my trophies" (or "Save a copy" on a shared link)
 * saved → "Saved" / "Save style changes"
 * always → "Share link", which copies a link that carries the hike itself.
 */
export function SaveButton({ dark, saved, dirty, busy, readOnly, onSave, onSaveStyle, onShare }) {
  const [share, setShare] = useState('idle') // idle | working | copied | error
  const primary = cx('chip-btn py-2 text-white', dark ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500')
  const done = cx('chip-btn flex-1 cursor-default py-2 ring-1', dark ? 'text-emerald-200 ring-emerald-300/30' : 'bg-emerald-50 text-emerald-800 ring-emerald-600/20')
  const secondary = cx('chip-btn shrink-0 px-3 py-2 ring-1', dark ? 'ring-white/15 hover:bg-white/5' : 'bg-white/70 ring-stone-900/10 hover:bg-white')
  const spinner = <Loader2 size={14} className="animate-spin" />

  const doShare = async () => {
    setShare('working')
    try {
      const url = await onShare()
      // Phones: native share sheet. Elsewhere: copy to clipboard.
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ url, title: 'Trail Trophy' }) } catch { /* cancelled */ }
        setShare('idle')
        return
      }
      await navigator.clipboard.writeText(url)
      setShare('copied')
    } catch {
      setShare('error')
    }
    setTimeout(() => setShare('idle'), 1800)
  }

  let main
  if (!saved) {
    main = (
      <button className={cx(primary, 'flex-1', busy && 'opacity-70')} onClick={onSave} disabled={busy}>
        {busy ? spinner : <Save size={14} />} {busy ? 'Saving…' : readOnly ? 'Save a copy' : <><span className="sm:hidden">Save</span><span className="hidden sm:inline">Save to my trophies</span></>}
      </button>
    )
  } else if (dirty) {
    main = (
      <button className={cx(primary, 'flex-1', busy && 'opacity-70')} onClick={onSaveStyle} disabled={busy}>
        {busy ? spinner : <Save size={14} />} {busy ? 'Saving…' : 'Save style changes'}
      </button>
    )
  } else {
    main = <div className={done}><Check size={14} /> Saved</div>
  }

  return (
    <div className="flex gap-2">
      {main}
      <button className={secondary} onClick={doShare} disabled={share === 'working'} title="Copy a link that shows this diorama to anyone">
        {share === 'working' ? spinner : share === 'copied' ? <Check size={14} className="text-emerald-500" /> : <Link2 size={14} />}
        {share === 'copied' ? 'Copied' : share === 'error' ? 'Failed' : 'Share'}
      </button>
    </div>
  )
}

/** Trophies saved in this browser, with backup export/import. Opening one navigates to /h/:id. */
export function TrophyShelf({ open, onClose, dark, list, loading, error, units, currentId, onOpen, onDelete, onExport, onImport }) {
  const fileRef = useRef()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  const muted = dark ? 'text-slate-400' : 'text-stone-500'
  const small = cx('chip-btn px-2.5 py-1.5 ring-1', dark ? 'ring-white/15 hover:bg-white/5' : 'bg-white/70 ring-stone-900/10 hover:bg-white')

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center sm:p-3" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="My trophies"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(dark ? 'glass-dark !bg-slate-900/90' : 'glass-light !bg-white/90', 'max-h-[85dvh] w-full max-w-2xl overflow-y-auto overscroll-contain !rounded-b-none p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:!rounded-b-2xl sm:pb-5')}
      >
        <div className="mb-1 flex items-center gap-2">
          <Trophy size={18} className={dark ? 'text-cyan-300' : 'text-orange-600'} />
          <h2 className="flex-1 font-display text-lg font-semibold">My trophies</h2>
          <button onClick={onClose} className="rounded-md p-1 opacity-60 hover:opacity-100" aria-label="Close"><X size={18} /></button>
        </div>
        <div className={cx('mb-4 flex flex-wrap items-center gap-2 text-[11px]', muted)}>
          <HardDrive size={12} />
          <span className="flex-1">Saved in this browser only. Export a backup to move them to another device.</span>
          <button className={small} onClick={onExport} disabled={!list.length}><Download size={13} /> Export</button>
          <button className={small} onClick={() => fileRef.current.click()}><Upload size={13} /> Import</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => { const f = e.target.files[0]; f && onImport(f); e.target.value = '' }} />
        </div>

        {loading && <div className="flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Loading your trophies…</div>}
        {error && <div className="mb-3 text-sm font-medium text-red-500">{error}</div>}
        {!loading && list.length === 0 && (
          <div className={cx('rounded-xl p-6 text-center text-sm', dark ? 'bg-white/5 text-slate-300' : 'bg-white/60 text-stone-600')}>
            No trophies yet. Load a GPX file and hit <b>Save to my trophies</b>.
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
                  <div className="truncate pr-8 font-display text-sm font-semibold">{h.name}</div>
                  <div className={cx('text-[11px]', muted)}>
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
                  title="Delete trophy"
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
