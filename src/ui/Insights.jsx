import { useMemo, useState } from 'react'
import { ChevronDown, Crosshair, X } from 'lucide-react'
import { computeSplits, gradeCSS } from '../lib/insights.js'
import { fmtEle } from './format.js'

const cx = (...a) => a.filter(Boolean).join(' ')
const MI = 1609.344
const COLLAPSED_ROWS = 5

/** "12m" under an hour, "1h 05m" above. */
const fmtShort = (h) => {
  const m = Math.round(h * 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

function Heading({ dark, children, right }) {
  return (
    <div className={cx('mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider', dark ? 'text-slate-400' : 'text-stone-500')}>
      <span>{children}</span>
      {right}
    </div>
  )
}

/**
 * Steepest climbs and per-km (or per-mile) splits.
 * Tapping a climb or a split highlights that stretch on the trail and flies the camera to it.
 */
export default function TrailInsights({ dark, track, metrics, climbs, units, focus, onFocus }) {
  const [showAll, setShowAll] = useState(false)
  const unitM = units === 'imperial' ? MI : 1000
  const unit = units === 'imperial' ? 'mi' : 'km'
  const splits = useMemo(() => (track && metrics ? computeSplits(track, metrics, unitM) : []), [track, metrics, unitM])
  if (!track || !metrics) return null

  const total = metrics.distanceM
  const at = (d) => (d / unitM).toFixed(1)
  const estimated = metrics.durationSource !== 'GPS time'
  const rows = showAll || splits.length <= COLLAPSED_ROWS + 1 ? splits : splits.slice(0, COLLAPSED_ROWS)
  const muted = dark ? 'text-slate-400' : 'text-stone-500'
  const item = (active) => cx(
    'w-full rounded-lg text-left transition',
    active
      ? dark ? 'bg-cyan-400/15 ring-1 ring-cyan-300/50' : 'bg-orange-500/10 ring-1 ring-orange-500/40'
      : dark ? 'hover:bg-white/5' : 'hover:bg-white/70',
  )
  const pick = (key, d0, d1) => onFocus(focus?.key === key ? null : { key, f0: d0 / total, f1: d1 / total })

  return (
    <div className="space-y-4">
      {focus && (
        <button onClick={() => onFocus(null)}
          className={cx('chip-btn w-full py-1.5 text-[11px] ring-1', dark ? 'ring-white/15 hover:bg-white/5' : 'bg-white/70 ring-stone-900/10 hover:bg-white')}>
          <X size={12} /> Clear highlight
        </button>
      )}

      <div>
        <Heading dark={dark}>Steepest climbs</Heading>
        {climbs.length === 0 ? (
          <div className={cx('text-[11px]', muted)}>No sustained climbs over 8% on this trail.</div>
        ) : (
          <div className="space-y-1">
            {climbs.map((c, n) => {
              const key = `climb-${n}`
              return (
                <button key={key} onClick={() => pick(key, c.d0, c.d1)} className={cx(item(focus?.key === key), 'flex items-center gap-2.5 px-2 py-1.5')}>
                  <span className="flex h-6 w-11 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums text-white" style={{ background: gradeCSS(c.grade) }}>
                    {Math.round(c.grade * 100)}%
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold tabular-nums">{unit} {at(c.d0)}–{at(c.d1)}</span>
                    <span className={cx('block text-[11px] tabular-nums', muted)}>+{fmtEle(c.rise, units)} over {fmtEle(Math.round((c.d1 - c.d0) / 10) * 10, units)}</span>
                  </span>
                  <Crosshair size={13} className={cx('shrink-0', muted)} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <Heading dark={dark} right={estimated && <span className="normal-case tracking-normal">times estimated</span>}>
          Splits per {unit}
        </Heading>
        <div className={cx('grid grid-cols-[1fr_1fr_1fr_1fr] px-2 pb-1 text-[10px] font-medium uppercase tracking-wider', muted)}>
          <span>{unit === 'km' ? 'Km' : 'Mile'}</span>
          <span className="text-right">Climb</span>
          <span className="text-right">Descent</span>
          <span className="text-right">Time</span>
        </div>
        <div className="space-y-0.5">
          {rows.map((r) => {
            const key = `split-${r.i}`
            const steep = Math.max(r.gain, r.loss) / Math.max(1, r.d1 - r.d0)
            return (
              <button key={key} onClick={() => pick(key, r.d0, r.d1)}
                className={cx(item(focus?.key === key), 'grid grid-cols-[1fr_1fr_1fr_1fr] items-center px-2 py-1 text-xs tabular-nums')}>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: gradeCSS(steep) }} />
                  {r.partial ? at(r.d1) : r.i}
                </span>
                <span className="text-right">{r.gain >= 1 ? `+${fmtEle(r.gain, units)}` : '–'}</span>
                <span className={cx('text-right', muted)}>{r.loss >= 1 ? `−${fmtEle(r.loss, units)}` : '–'}</span>
                <span className="text-right font-medium">{fmtShort(r.h)}</span>
              </button>
            )
          })}
        </div>
        {splits.length > COLLAPSED_ROWS + 1 && (
          <button onClick={() => setShowAll((v) => !v)} className={cx('mt-1 flex w-full items-center justify-center gap-1 py-1 text-[11px] font-semibold', dark ? 'text-cyan-300' : 'text-orange-700')}>
            {showAll ? 'Show fewer' : `Show all ${splits.length}`}
            <ChevronDown size={12} className={cx('transition-transform', showAll && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  )
}
