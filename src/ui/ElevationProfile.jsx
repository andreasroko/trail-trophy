import { useMemo, useRef, useState } from 'react'
import { fmtDist, fmtEle } from './format.js'

const W = 300, H = 84, PAD = 4

/** Elevation profile; hovering scrubs the hiker bead along the 3D trail. */
export default function ElevationProfile({ cumDist, eles, peakIdx, units, dark, accent, onScrub }) {
  const [hover, setHover] = useState(null)
  const svgRef = useRef()

  const { path, area, sx, sy, total, lo, hi } = useMemo(() => {
    const total = cumDist[cumDist.length - 1] || 1
    let lo = Infinity, hi = -Infinity
    for (const e of eles) { lo = Math.min(lo, e); hi = Math.max(hi, e) }
    const span = Math.max(1, hi - lo)
    const sx = (d) => PAD + (d / total) * (W - PAD * 2)
    const sy = (e) => H - PAD - ((e - lo) / span) * (H - PAD * 2 - 10)
    const step = Math.max(1, Math.floor(eles.length / 300))
    let path = ''
    for (let i = 0; i < eles.length; i += step) path += `${i ? 'L' : 'M'}${sx(cumDist[i]).toFixed(1)},${sy(eles[i]).toFixed(1)}`
    path += `L${sx(total).toFixed(1)},${sy(eles[eles.length - 1]).toFixed(1)}`
    const area = `${path}L${sx(total)},${H}L${sx(0)},${H}Z`
    return { path, area, sx, sy, total, lo, hi }
  }, [cumDist, eles])

  const move = (e) => {
    const r = svgRef.current.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width * W - PAD) / (W - PAD * 2)))
    const d = f * total
    // binary search nearest index
    let a = 0, b = cumDist.length - 1
    while (b - a > 1) { const m = (a + b) >> 1; cumDist[m] < d ? (a = m) : (b = m) }
    setHover({ f, d, ele: eles[a] })
    onScrub(f)
  }
  const leave = () => { setHover(null); onScrub(null) }

  const grid = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'
  return (
    <div className="relative">
      <div className={`mb-1 flex justify-between text-[10px] font-medium uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-stone-500'}`}>
        <span>Elevation profile</span>
        <span>{fmtEle(lo, units)} – {fmtEle(hi, units)}</span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[84px] w-full cursor-crosshair touch-none select-none"
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={leave}
        onPointerUp={(e) => e.pointerType !== 'mouse' && leave()}
      >
        <defs>
          <linearGradient id="tt-prof" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.45" />
            <stop offset="1" stopColor={accent} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke={grid} />)}
        <path d={area} fill="url(#tt-prof)" />
        <path d={path} fill="none" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={sx(cumDist[peakIdx])} cy={sy(eles[peakIdx])} r="3.2" fill={accent} stroke="white" strokeWidth="1.5" />
        {hover && (
          <g>
            <line x1={sx(hover.d)} x2={sx(hover.d)} y1="0" y2={H} stroke={dark ? '#e2e8f0' : '#292524'} strokeDasharray="2 2" strokeWidth="1" />
            <circle cx={sx(hover.d)} cy={sy(hover.ele)} r="3.5" fill="white" stroke={accent} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className={`pointer-events-none absolute top-4 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow ${dark ? 'bg-slate-800 text-slate-100' : 'bg-stone-900 text-white'}`}
          style={{ left: `${Math.min(85, Math.max(15, hover.f * 100))}%` }}
        >
          {fmtDist(hover.d, units)} · {fmtEle(hover.ele, units)}
        </div>
      )}
    </div>
  )
}
