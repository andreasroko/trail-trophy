// Trail insights computed from the track: steepness along the trail, per-km/mi splits,
// and the steepest climbs. Everything is keyed by distance along the trail (metres).

const STEP = 20 // resample spacing (m)
const SMOOTH_M = 50 // moving-average half-window (m), removes GPS elevation jitter
const GRADE_M = 60 // grade = rise over ±GRADE_M (m)

/** Value of `arr` (aligned with sorted `xs`) at x, linearly interpolated. */
export function interpAt(xs, arr, x) {
  if (x <= xs[0]) return arr[0]
  const n = xs.length - 1
  if (x >= xs[n]) return arr[n]
  let a = 0, b = n
  while (b - a > 1) { const m = (a + b) >> 1; xs[m] <= x ? (a = m) : (b = m) }
  const span = xs[b] - xs[a] || 1
  return arr[a] + (arr[b] - arr[a]) * ((x - xs[a]) / span)
}

/**
 * Elevation resampled every ~20 m, smoothed, plus the grade (rise/run, signed) at each sample.
 * @returns {{ total:number, step:number, ele:Float32Array, grade:Float32Array }}
 */
export function gradeProfile(cumDist, eles) {
  const total = cumDist[cumDist.length - 1] || 1
  const n = Math.max(2, Math.ceil(total / STEP) + 1)
  const step = total / (n - 1)
  const raw = new Float32Array(n)
  for (let k = 0; k < n; k++) raw[k] = interpAt(cumDist, eles, k * step)

  const w = Math.max(1, Math.round(SMOOTH_M / step))
  const ele = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    let s = 0, c = 0
    for (let j = Math.max(0, k - w); j <= Math.min(n - 1, k + w); j++) { s += raw[j]; c++ }
    ele[k] = s / c
  }

  const h = Math.max(1, Math.round(GRADE_M / step))
  const grade = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, k - h), b = Math.min(n - 1, k + h)
    grade[k] = b > a ? (ele[b] - ele[a]) / ((b - a) * step) : 0
  }
  return { total, step, ele, grade }
}

/** Grade at fraction f ∈ [0,1] of the trail. */
export function gradeAtFrac(gp, f) {
  const x = Math.min(1, Math.max(0, f)) * (gp.grade.length - 1)
  const i = Math.min(gp.grade.length - 2, Math.floor(x))
  return gp.grade[i] + (gp.grade[i + 1] - gp.grade[i]) * (x - i)
}

// Steepness colour scale by |grade|: easy green → yellow → orange → red → deep red.
const STOPS = [
  [0.0, [0x22, 0xc5, 0x5e]],
  [0.05, [0x84, 0xcc, 0x16]],
  [0.1, [0xea, 0xb3, 0x08]],
  [0.15, [0xf9, 0x73, 0x16]],
  [0.25, [0xdc, 0x26, 0x26]],
  [0.4, [0x88, 0x13, 0x37]],
]

/** [r,g,b] in 0..1 for a grade (sign ignored: steep down is as hard as steep up). */
export function gradeRGB(g) {
  const a = Math.abs(g)
  for (let i = 1; i < STOPS.length; i++) {
    if (a <= STOPS[i][0]) {
      const [g0, c0] = STOPS[i - 1], [g1, c1] = STOPS[i]
      const t = (a - g0) / (g1 - g0)
      return c0.map((v, j) => (v + (c1[j] - v) * t) / 255)
    }
  }
  return STOPS[STOPS.length - 1][1].map((v) => v / 255)
}
export const gradeCSS = (g) => `rgb(${gradeRGB(g).map((v) => Math.round(v * 255)).join(',')})`

/** Legend bands shown under the profile. */
export const GRADE_LEGEND = [
  { label: '<5%', g: 0.025 },
  { label: '5–10%', g: 0.075 },
  { label: '10–15%', g: 0.125 },
  { label: '15–25%', g: 0.2 },
  { label: '25%+', g: 0.32 },
]

/**
 * Splits of `unitM` metres (1000 for km, 1609.344 for miles).
 * Climb/descent come from the same smoothed+hysteresis series as the headline totals, so they add up.
 * Time is from GPS timestamps when the track has them, otherwise Naismith's rule per split.
 */
export function computeSplits(track, metrics, unitM) {
  const { cumDist, cumGain, cumLoss, distanceM } = metrics
  const useTime = metrics.durationSource === 'GPS time'
  let times = null
  if (useTime) {
    // Only points with a timestamp take part in time interpolation
    const xs = [], ts = []
    track.points.forEach((p, i) => { if (p.time != null) { xs.push(cumDist[i]); ts.push(p.time) } })
    times = (d) => interpAt(xs, ts, d)
  }
  const rows = []
  for (let d0 = 0, i = 1; d0 < distanceM - 20; d0 += unitM, i++) {
    const d1 = Math.min(distanceM, d0 + unitM)
    const gain = interpAt(cumDist, cumGain, d1) - interpAt(cumDist, cumGain, d0)
    const loss = interpAt(cumDist, cumLoss, d1) - interpAt(cumDist, cumLoss, d0)
    const h = useTime ? Math.max(0, times(d1) - times(d0)) / 3.6e6 : (d1 - d0) / 5000 + gain / 600
    rows.push({ i, d0, d1, gain, loss, h, partial: d1 - d0 < unitM - 1 })
  }
  return rows
}

/**
 * Up to `count` steepest climbs, non-overlapping, each a fixed-length window
 * (about 1/12 of the hike, 200–1000 m). Climbs under 8% are ignored.
 * @returns {{ d0:number, d1:number, grade:number, rise:number }[]} steepest first
 */
export function steepestClimbs(gp, count = 3) {
  const { total, step, ele } = gp
  if (total < 400) return []
  const L = Math.min(1000, Math.max(200, Math.round(total / 12 / 100) * 100))
  const m = Math.max(1, Math.round(L / step))
  const cands = []
  for (let i = 0; i + m < ele.length; i++) {
    const g = (ele[i + m] - ele[i]) / (m * step)
    if (g >= 0.08) cands.push({ i, g })
  }
  cands.sort((a, b) => b.g - a.g)
  const picked = []
  for (const c of cands) {
    if (picked.length >= count) break
    if (picked.some((p) => c.i < p.i + m && p.i < c.i + m)) continue
    picked.push(c)
  }
  return picked.map(({ i, g }) => ({ d0: i * step, d1: (i + m) * step, grade: g, rise: ele[i + m] - ele[i] }))
}

/** Hours from the start to `d` metres: GPS time when the track has it, otherwise Naismith's rule. */
export function timeAtDist(track, metrics, d) {
  const { cumDist, cumGain } = metrics
  if (metrics.durationSource === 'GPS time') {
    const xs = [], ts = []
    track.points.forEach((p, i) => { if (p.time != null) { xs.push(cumDist[i]); ts.push(p.time) } })
    return Math.max(0, interpAt(xs, ts, d) - ts[0]) / 3.6e6
  }
  return d / 5000 + interpAt(cumDist, cumGain, d) / 600
}

export const MAX_PINS = 30
export const MAX_PIN_LABEL = 40

/** Pins from storage or a share link: keep only well-formed ones. */
export function cleanPins(pins) {
  if (!Array.isArray(pins)) return []
  return pins
    .filter((p) => p && Number.isFinite(p.f) && p.f >= 0 && p.f <= 1)
    .slice(0, MAX_PINS)
    .map((p, i) => ({ id: String(p.id || `p${i}`).slice(0, 16), f: p.f, label: String(p.label ?? '').slice(0, MAX_PIN_LABEL) }))
    .sort((a, b) => a.f - b.f)
}
