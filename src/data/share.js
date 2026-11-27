// Share links without a server: the hike (simplified track + style) is compressed into the
// URL fragment (#...). Fragments are never sent to the web server, so the hike stays in the link.
import { pickSavedSettings } from './hikes.js'

const MAX_POINTS = 500 // plenty for a diorama-sized trail; keeps links around 2–4 KB
const VERSION = 1

/** Every k-th point, always keeping the last one. */
function thin(points) {
  if (points.length <= MAX_POINTS) return points
  const step = (points.length - 1) / (MAX_POINTS - 1)
  return Array.from({ length: MAX_POINTS }, (_, i) => points[Math.round(i * step)])
}

const deltas = (vals) => vals.map((v, i) => (i ? v - vals[i - 1] : v))
const undeltas = (ds) => { let acc = 0; return ds.map((d) => (acc += d)) }

const toB64url = (bytes) => {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())
}

/** Encode a hike into a URL-safe string. */
export async function encodeShare(track, settings) {
  if (typeof CompressionStream === 'undefined') throw new Error('This browser is too old to create share links.')
  const pts = thin(track.points)
  const payload = {
    v: VERSION,
    n: track.name.slice(0, 120),
    s: pickSavedSettings(settings),
    a: deltas(pts.map((p) => Math.round(p.lat * 1e5))),
    o: deltas(pts.map((p) => Math.round(p.lon * 1e5))),
  }
  if (track.hasEle) payload.e = deltas(pts.map((p) => Math.round(p.ele)))
  if (track.hasTime && pts.every((p) => p.time != null)) payload.t = deltas(pts.map((p) => Math.round(p.time / 1000)))
  const json = new TextEncoder().encode(JSON.stringify(payload))
  return toB64url(await pipe(json, new CompressionStream('deflate-raw')))
}

const esc = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))

/** Decode a share string back into GPX text (fed through the normal parser) and the saved style. */
export async function decodeShare(str) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to open share links.')
  const json = new TextDecoder().decode(await pipe(fromB64url(str), new DecompressionStream('deflate-raw')))
  const p = JSON.parse(json)
  if (p.v !== VERSION || !Array.isArray(p.a) || p.a.length !== p.o?.length || p.a.length < 2) throw new Error('bad link')
  const lat = undeltas(p.a), lon = undeltas(p.o)
  const ele = p.e ? undeltas(p.e) : null
  const time = p.t ? undeltas(p.t) : null
  const pts = lat.map((la, i) =>
    `<trkpt lat="${(la / 1e5).toFixed(5)}" lon="${(lon[i] / 1e5).toFixed(5)}">` +
    (ele ? `<ele>${ele[i]}</ele>` : '') +
    (time ? `<time>${new Date(time[i] * 1000).toISOString()}</time>` : '') +
    '</trkpt>')
  const name = esc(String(p.n || 'Shared hike'))
  const gpxText = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trail Trophy share link" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${name}</name><trkseg>${pts.join('')}</trkseg></trk>
</gpx>`
  return { gpxText, settings: p.s || {} }
}

/** Full share URL (works locally and under /trail-trophy/ on Pages). */
export async function shareUrl(track, settings) {
  return `${window.location.origin}${import.meta.env.BASE_URL}s#${await encodeShare(track, settings)}`
}
