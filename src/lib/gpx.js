// GPX parsing, hike metrics, and projection into diorama-local coordinates.

const EARTH_R = 6371000
const DEG = Math.PI / 180
/** Meters per degree of latitude on a spherical Earth (matches haversine). */
export const M_PER_DEG = EARTH_R * DEG

/** Diorama footprint: the route is scaled to fit inside this radius (world units). */
export const ROUTE_RADIUS = 4.1
/** Half-size of the square height-field grid (world units). Covers square-shape corners (5·√2). */
export const FIELD_HALF = 7.3

/**
 * Parse a GPX XML string into a normalized track.
 * Accepts <trkpt>, falls back to <rtept>, then <wpt>. Namespace-agnostic.
 * @returns {{ name: string, points: {lat:number, lon:number, ele:number|null, time:number|null}[], hasEle: boolean, hasTime: boolean }}
 */
export function parseGPX(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('That file is not valid XML.')
  }
  // '*' namespace matches both GPX 1.0/1.1 namespaced and bare documents
  const byTag = (root, tag) => Array.from(root.getElementsByTagNameNS('*', tag))

  let nodes = byTag(doc, 'trkpt')
  if (nodes.length < 2) nodes = byTag(doc, 'rtept')
  if (nodes.length < 2) nodes = byTag(doc, 'wpt')
  if (nodes.length < 2) throw new Error('No track points found (expected <trkpt lat=".." lon="..">).')

  const childText = (el, tag) => {
    const c = el.getElementsByTagNameNS('*', tag)[0]
    return c ? c.textContent.trim() : null
  }

  const points = []
  for (const n of nodes) {
    const lat = parseFloat(n.getAttribute('lat'))
    const lon = parseFloat(n.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    const eleRaw = childText(n, 'ele')
    const ele = eleRaw != null && eleRaw !== '' && Number.isFinite(parseFloat(eleRaw)) ? parseFloat(eleRaw) : null
    const tRaw = childText(n, 'time')
    const t = tRaw ? Date.parse(tRaw) : NaN
    const prev = points[points.length - 1]
    // Drop exact duplicates (common when devices pause)
    if (prev && prev.lat === lat && prev.lon === lon) continue
    points.push({ lat, lon, ele, time: Number.isFinite(t) ? t : null })
  }
  if (points.length < 2) throw new Error('Track needs at least two valid points.')

  // Fill sparse elevation gaps by linear interpolation along the track
  const withEle = points.filter((p) => p.ele != null).length
  const hasEle = withEle >= points.length * 0.5
  if (hasEle) fillGaps(points, 'ele')
  else points.forEach((p) => (p.ele = null))

  const hasTime = points.filter((p) => p.time != null).length >= points.length * 0.5

  const nameEl =
    doc.getElementsByTagNameNS('*', 'trk')[0]?.getElementsByTagNameNS('*', 'name')[0] ||
    doc.getElementsByTagNameNS('*', 'metadata')[0]?.getElementsByTagNameNS('*', 'name')[0] ||
    doc.getElementsByTagNameNS('*', 'name')[0]
  const name = nameEl?.textContent?.trim() || 'Untitled Hike'

  return { name, points, hasEle, hasTime }
}

function fillGaps(points, key) {
  let last = -1
  for (let i = 0; i < points.length; i++) {
    if (points[i][key] == null) continue
    if (last === -1) for (let k = 0; k < i; k++) points[k][key] = points[i][key]
    else if (i - last > 1) {
      for (let k = last + 1; k < i; k++) {
        const t = (k - last) / (i - last)
        points[k][key] = points[last][key] * (1 - t) + points[i][key] * t
      }
    }
    last = i
  }
  for (let k = last + 1; k < points.length; k++) points[k][key] = points[last][key]
}

export function haversine(a, b) {
  const dLat = (b.lat - a.lat) * DEG
  const dLon = (b.lon - a.lon) * DEG
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Distance, gain/loss (smoothed + hysteresis to ignore GPS jitter), peak, duration.
 * `eles` lets callers supply elevations sampled from terrain when the GPX has none.
 */
export function computeMetrics(track, eles = null) {
  const pts = track.points
  const E = eles || pts.map((p) => p.ele ?? 0)
  let dist = 0
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    dist += haversine(pts[i - 1], pts[i])
    cum.push(dist)
  }

  // Moving-average smoothing, then 3 m hysteresis
  const win = 3
  const smooth = E.map((_, i) => {
    let s = 0, c = 0
    for (let k = Math.max(0, i - win); k <= Math.min(E.length - 1, i + win); k++) { s += E[k]; c++ }
    return s / c
  })
  let gain = 0, loss = 0, ref = smooth[0]
  for (const e of smooth) {
    const d = e - ref
    if (d > 3) { gain += d; ref = e } else if (d < -3) { loss -= d; ref = e }
  }

  let peakIdx = 0, minEle = Infinity
  E.forEach((e, i) => { if (e > E[peakIdx]) peakIdx = i; if (e < minEle) minEle = e })

  let durationH, durationSource
  const t0 = pts.find((p) => p.time != null)?.time
  const t1 = [...pts].reverse().find((p) => p.time != null)?.time
  if (track.hasTime && t0 != null && t1 > t0) {
    durationH = (t1 - t0) / 3.6e6
    durationSource = 'GPS time'
  } else {
    // Naismith's rule: 5 km/h + 1 h per 600 m of ascent
    durationH = dist / 1000 / 5 + gain / 600
    durationSource = "Naismith's rule"
  }

  const start = pts[0], end = pts[pts.length - 1]
  return {
    distanceM: dist,
    gainM: gain,
    lossM: loss,
    peakM: E[peakIdx],
    minM: minEle,
    peakIdx,
    durationH,
    durationSource,
    isLoop: haversine(start, end) < Math.max(150, dist * 0.02),
    cumDist: cum,
  }
}

/**
 * Project lat/lon to local meters (equirectangular around the route's bbox centre),
 * then to world units so the route fits inside ROUTE_RADIUS. North = -Z.
 */
export function projectTrack(track) {
  const pts = track.points
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon)
  }
  const lat0 = (minLat + maxLat) / 2
  const lon0 = (minLon + maxLon) / 2
  const cosLat = Math.cos(lat0 * DEG)

  const local = pts.map((p) => ({
    mx: (p.lon - lon0) * cosLat * M_PER_DEG,
    mz: -(p.lat - lat0) * M_PER_DEG,
  }))
  let rMax = 0
  for (const l of local) rMax = Math.max(rMax, Math.hypot(l.mx, l.mz))
  rMax = Math.max(rMax, 50)
  const metersPerUnit = rMax / ROUTE_RADIUS

  let d = 0
  const world = local.map((l, i) => {
    if (i > 0) d += haversine(pts[i - 1], pts[i])
    return { x: l.mx / metersPerUnit, z: l.mz / metersPerUnit, ele: pts[i].ele, d }
  })

  return { lat0, lon0, cosLat, metersPerUnit, world, totalDist: d }
}

/** Convert world (x,z) back to lat/lon — used for DEM tile sampling. */
export function worldToLatLon(geo, x, z) {
  const mx = x * geo.metersPerUnit
  const mz = z * geo.metersPerUnit
  return { lat: geo.lat0 - mz / M_PER_DEG, lon: geo.lon0 + mx / (geo.cosLat * M_PER_DEG) }
}

/** Resample the world-space route to `n` points evenly spaced by along-track distance. */
export function resampleRoute(world, n) {
  const total = world[world.length - 1].d
  const out = []
  let j = 0
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total
    while (j < world.length - 2 && world[j + 1].d < target) j++
    const a = world[j], b = world[j + 1]
    const span = b.d - a.d || 1
    const t = Math.min(1, Math.max(0, (target - a.d) / span))
    out.push({
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      ele: a.ele == null ? null : a.ele + (b.ele - a.ele) * t,
      d: target,
    })
  }
  return out
}
