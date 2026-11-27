import { useEffect, useRef, useState } from 'react'
import { MapPin, Pencil, Plus, X } from 'lucide-react'
import { MAX_PIN_LABEL, MAX_PINS, interpAt, timeAtDist } from '../lib/insights.js'
import { fmtEle } from './format.js'

const cx = (...a) => a.filter(Boolean).join(' ')
const SUGGESTIONS = ['Refuge', 'Water', 'Viewpoint', 'Camp', 'Junction', 'Lunch']

export const pinColor = (dark) => (dark ? '#a78bfa' : '#2563eb')

/** "1h 05m" / "25m" */
const fmtTime = (h) => {
  const m = Math.round(h * 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function LabelEditor({ dark, initial, onDone }) {
  const [text, setText] = useState(initial)
  const ref = useRef()
  useEffect(() => { ref.current?.focus() }, [])
  const done = (v) => onDone(v.trim())
  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        value={text}
        maxLength={MAX_PIN_LABEL}
        placeholder="Name this pin"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => done(text)}
        onKeyDown={(e) => { if (e.key === 'Enter') done(text); if (e.key === 'Escape') done(initial) }}
        className={cx('w-full rounded-md px-2 py-1 text-xs font-semibold outline-none ring-1',
          dark ? 'bg-slate-900/60 ring-cyan-300/50' : 'bg-white ring-orange-500/50')}
      />
      <div className="flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          // mousedown so the input's blur doesn't commit the old text first
          <button key={s} onMouseDown={(e) => { e.preventDefault(); done(s) }}
            className={cx('rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1', dark ? 'ring-white/15 hover:bg-white/10' : 'bg-white/70 ring-stone-900/10 hover:bg-white')}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Your own pins along the trail (refuge, water…). Each shows how far in, how high and how long from the start.
 * Adding: "Add pin" turns on pin mode, then a tap on the 3D trail or the profile drops one.
 */
export default function PinList({ dark, track, metrics, eles, units, readOnly, pins, pinMode, setPinMode, editingPin, setEditingPin, onUpdatePin, onRemovePin, focus, onFocus }) {
  if (!track || !metrics) return null
  if (readOnly && !pins.length) return null
  const total = metrics.distanceM
  const unitM = units === 'imperial' ? 1609.344 : 1000
  const unit = units === 'imperial' ? 'mi' : 'km'
  const muted = dark ? 'text-slate-400' : 'text-stone-500'
  const full = pins.length >= MAX_PINS

  return (
    <div>
      <div className={cx('mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider', muted)}>
        <span>Pins</span>
        {!readOnly && (
          <button
            onClick={() => setPinMode(!pinMode)}
            disabled={full && !pinMode}
            className={cx('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ring-1 disabled:opacity-40',
              pinMode
                ? dark ? 'bg-cyan-400/20 text-cyan-100 ring-cyan-300/50' : 'bg-orange-600 text-white ring-orange-600'
                : dark ? 'text-slate-200 ring-white/15 hover:bg-white/10' : 'bg-white/70 text-stone-700 ring-stone-900/10 hover:bg-white')}
          >
            {pinMode ? <><X size={11} /> Cancel</> : <><Plus size={11} /> Add pin</>}
          </button>
        )}
      </div>

      {pinMode && (
        <div className={cx('mb-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium', dark ? 'bg-cyan-400/10 text-cyan-100' : 'bg-orange-500/10 text-orange-800')}>
          Tap the trail or the elevation profile to drop a pin.
        </div>
      )}
      {!pins.length && !pinMode && (
        <div className={cx('text-[11px]', muted)}>Mark refuges, water, viewpoints… Each pin shows its distance and time from the start.</div>
      )}

      <div className="space-y-1">
        {pins.map((p, n) => {
          const d = p.f * total
          const key = `pin-${p.id}`
          const editing = editingPin === p.id
          const active = focus?.key === key
          return (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => !editing && onFocus(active ? null : { key, f0: Math.max(0, p.f - 0.012), f1: Math.min(1, p.f + 0.012) })}
              className={cx('group flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition',
                active
                  ? dark ? 'bg-cyan-400/15 ring-1 ring-cyan-300/50' : 'bg-orange-500/10 ring-1 ring-orange-500/40'
                  : dark ? 'hover:bg-white/5' : 'hover:bg-white/70')}
            >
              <MapPin size={15} className="mt-0.5 shrink-0" style={{ color: pinColor(dark) }} />
              <div className="min-w-0 flex-1">
                {editing ? (
                  <LabelEditor dark={dark} initial={p.label} onDone={(label) => { onUpdatePin(p.id, label || `Pin ${n + 1}`); setEditingPin(null) }} />
                ) : (
                  <div className="truncate text-xs font-semibold">{p.label || `Pin ${n + 1}`}</div>
                )}
                <div className={cx('text-[11px] tabular-nums', muted)}>
                  {unit} {(d / unitM).toFixed(1)} · {fmtEle(interpAt(metrics.cumDist, eles, d), units)} · {fmtTime(timeAtDist(track, metrics, d))} from start
                </div>
              </div>
              {!readOnly && !editing && (
                <div className="flex shrink-0 gap-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); setEditingPin(p.id) }} className={cx('rounded-md p-1.5', dark ? 'hover:bg-white/10' : 'hover:bg-stone-900/5')} aria-label={`Rename ${p.label || 'pin'}`}>
                    <Pencil size={12} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onRemovePin(p.id) }} className={cx('rounded-md p-1.5', dark ? 'hover:bg-red-500/20 hover:text-red-300' : 'hover:bg-red-50 hover:text-red-600')} aria-label={`Delete ${p.label || 'pin'}`}>
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
