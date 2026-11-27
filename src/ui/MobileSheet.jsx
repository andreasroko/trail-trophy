import { useRef, useState } from 'react'
import { ChevronUp, Footprints, Layers, Plus } from 'lucide-react'
import { HikeDetails, HikeLoader, SharedBanner, StyleControls } from './Panels.jsx'
import { fmtDist, fmtEle } from './format.js'

const cx = (...a) => a.filter(Boolean).join(' ')

/**
 * Phone layout: a bottom sheet over the diorama.
 * Collapsed it shows the hike name, headline stats and tabs (~120px); tapping a tab,
 * the header, or swiping up opens that tab; tapping the open tab or swiping down closes it.
 */
export default function MobileSheet({ dark, track, metrics, units, error, readOnly, onNew, hikeProps, styleProps, cameraBar }) {
  const [tab, setTab] = useState(null) // null = collapsed
  const swipe = useRef(null)
  const open = tab != null

  const tabs = [
    { id: 'hike', label: 'Hike', icon: Footprints },
    { id: 'style', label: 'Style', icon: Layers },
    ...(readOnly ? [] : [{ id: 'new', label: 'New hike', icon: Plus }]),
  ]
  const pick = (id) => setTab((t) => (t === id ? null : id))

  // Vertical swipe on the header: up opens (Hike tab), down closes
  const onPointerDown = (e) => { swipe.current = e.clientY }
  const onPointerUp = (e) => {
    if (swipe.current == null) return
    const dy = e.clientY - swipe.current
    swipe.current = null
    if (dy < -30) setTab((t) => t ?? 'hike')
    else if (dy > 30) setTab(null)
  }

  const muted = dark ? 'text-slate-400' : 'text-stone-500'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-2 md:right-auto md:w-[400px] pb-[max(8px,env(safe-area-inset-bottom))]">
      {!open && <div className="flex justify-end">{cameraBar}</div>}

      <div className={cx(dark ? 'glass-dark' : 'glass-light', 'pointer-events-auto flex max-h-[min(52dvh,520px)] md:max-h-[calc(100dvh-80px)] flex-col overflow-hidden')}>
        {/* Header: always visible */}
        <div onPointerDown={onPointerDown} onPointerUp={onPointerUp} className="touch-none select-none">
          <button
            onClick={() => setTab((t) => (t ? null : 'hike'))}
            className="flex w-full items-center gap-3 px-4 pb-2 pt-2 text-left"
            aria-expanded={open}
          >
            <div className="min-w-0 flex-1">
              <div className={cx('mx-auto mb-2 h-1 w-9 rounded-full', dark ? 'bg-white/20' : 'bg-stone-900/15')} />
              <div className="truncate font-display text-[15px] font-semibold leading-tight">{track?.name ?? 'Loading…'}</div>
              {metrics && (
                <div className={cx('mt-0.5 truncate text-xs tabular-nums', muted)}>
                  {fmtDist(metrics.distanceM, units)} · +{fmtEle(metrics.gainM, units)} · ▲ {fmtEle(metrics.peakM, units)}
                </div>
              )}
            </div>
            <ChevronUp size={18} className={cx('mt-3 shrink-0 transition-transform', open && 'rotate-180', muted)} />
          </button>
          {error && !open && (
            <div className="mx-3 mb-2 rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-600 ring-1 ring-red-500/30">{error}</div>
          )}
        </div>

        <div role="tablist" className={cx('mx-3 mb-3 grid gap-1 rounded-xl p-1', dark ? 'bg-white/5' : 'bg-stone-900/5')} style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => pick(id)}
              className={cx(
                'chip-btn',
                tab === id
                  ? dark ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/40' : 'bg-white text-stone-900 shadow-sm'
                  : dark ? 'text-slate-300' : 'text-stone-600',
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {open && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
            {tab === 'hike' && (
              <>
                {readOnly && <SharedBanner dark={dark} onNew={onNew} />}
                {error && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-600 ring-1 ring-red-500/30">{error}</div>}
                {/* Picking a climb/split closes the sheet so the highlighted stretch is visible */}
                <HikeDetails dark={dark} {...hikeProps} hideName onFocus={(f) => { hikeProps.onFocus(f); if (f) setTab(null) }} />
              </>
            )}
            {tab === 'style' && <StyleControls dark={dark} {...styleProps} />}
            {tab === 'new' && (
              <>
                {error && <div className="rounded-lg bg-red-500/15 px-3 py-2 text-xs font-medium text-red-600 ring-1 ring-red-500/30">{error}</div>}
                <HikeLoader dark={dark} {...hikeProps} onDemo={(d) => { hikeProps.onDemo(d); setTab(null) }} onFile={(f) => { hikeProps.onFile(f); setTab(null) }} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
