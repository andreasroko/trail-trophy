// Height fields: synthetic route-conforming terrain + optional real DEM (AWS Terrarium tiles, no key).
import { createNoise2D, fbm, ridged, hashString } from './noise.js'
import { FIELD_HALF, resampleRoute, worldToLatLon } from './gpx.js'

export const GRID_N = 193
/** Diorama inscribed radius (world units): apothem for hexagon, half-side for square. */
export const BASE_RADIUS = 5
/** Thickness of rock below the lowest terrain point (world units). */
export const SLAB = 0.55

/**
 * @typedef {Object} HeightField
 * @property {number} n         grid resolution (n × n)
 * @property {number} half      half-size of the grid in world units
 * @property {Float32Array} h   heights in meters, row-major [iz * n + ix]
 * @property {number} hMin
 * @property {number} hMax
 * @property {number} mpu       meters per world unit (horizontal)
 * @property {'synthetic'|'dem'} source
 */

/** Bilinear sample in meters at world (x, z). */
export function sampleField(f, x, z) {
  const g = f.n - 1
  const u = Math.min(g, Math.max(0, ((x + f.half) / (2 * f.half)) * g))
  const v = Math.min(g, Math.max(0, ((z + f.half) / (2 * f.half)) * g))
  const i = Math.min(g - 1, Math.floor(u)), j = Math.min(g - 1, Math.floor(v))
  const fu = u - i, fv = v - j
  const a = f.h[j * f.n + i], b = f.h[j * f.n + i + 1]
  const c = f.h[(j + 1) * f.n + i], d = f.h[(j + 1) * f.n + i + 1]
  return (a * (1 - fu) + b * fu) * (1 - fv) + (c * (1 - fu) + d * fu) * fv
}

/** Meters → world Y, with vertical exaggeration. */
export function metersToY(f, m, exag) {
  return SLAB + ((m - f.hMin) / f.mpu) * exag
}

export function terrainY(f, x, z, exag) {
  return metersToY(f, sampleField(f, x, z), exag)
}

/** Boundary radius of the base shape at polar angle θ (θ measured in the X→Z plane). */
export function shapeRadius(shape, theta, R = BASE_RADIUS) {
  if (shape === 'square') return R / Math.max(Math.abs(Math.cos(theta)), Math.abs(Math.sin(theta)))
  if (shape === 'hexagon') {
    const sector = Math.PI / 3
    let u = theta % sector
    if (u < 0) u += sector
    return R / Math.cos(u - sector / 2) // vertices at k·60°, flat edge facing +Z (front)
  }
  return R
}

function finalize(h, n, mpu, source) {
  let hMin = Infinity, hMax = -Infinity
  for (let i = 0; i < h.length; i++) { if (h[i] < hMin) hMin = h[i]; if (h[i] > hMax) hMax = h[i] }
  return { n, half: FIELD_HALF, h, hMin, hMax, mpu, source }
}

/**
 * Synthetic terrain that honours the route: domain-warped fBm + ridged noise, a massif centred on
 * the hike's high point, then a Gaussian RBF correction so the surface passes through the GPX
 * elevations along the track and relaxes back to pure noise away from it.
 */
export function synthesizeField(track, geo) {
  const n = GRID_N
  const half = FIELD_HALF
  const mpu = geo.metersPerUnit
  const noise = createNoise2D(hashString(track.name + track.points.length))
  const noise2 = createNoise2D(hashString('warp' + track.name))

  const route = resampleRoute(geo.world, 160)
  const hasEle = track.hasEle
  let minE = 600, maxE = 1400, peak = route[Math.floor(route.length / 2)]
  if (hasEle) {
    minE = Infinity; maxE = -Infinity
    for (const p of route) {
      if (p.ele < minE) minE = p.ele
      if (p.ele > maxE) { maxE = p.ele; peak = p }
    }
  }
  const domainM = 2 * half * mpu
  const relief = Math.max(maxE - minE, domainM * 0.07, 120)

  // Push the massif slightly outward from the route centroid so peaks rise beyond the summit
  const cx = route.reduce((s, p) => s + p.x, 0) / route.length
  const cz = route.reduce((s, p) => s + p.z, 0) / route.length
  const px = peak.x + (peak.x - cx) * 0.35
  const pz = peak.z + (peak.z - cz) * 0.35
  const sig2 = 2 * 3.4 * 3.4

  const raw = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    const z = -half + (j / (n - 1)) * 2 * half
    for (let i = 0; i < n; i++) {
      const x = -half + (i / (n - 1)) * 2 * half
      const wx = x + 1.6 * noise2(x * 0.09 + 3.1, z * 0.09)
      const wz = z + 1.6 * noise2(x * 0.09, z * 0.09 + 7.7)
      const f = fbm(noise, wx * 0.16, wz * 0.16, 6) * 0.5 + 0.5
      const r = ridged(noise, wx * 0.11 + 11, wz * 0.11 - 4, 6)
      const massif = Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / sig2)
      raw[j * n + i] = minE - 0.3 * relief + relief * (0.75 * massif * (0.55 + 0.45 * r) + 0.35 * f + 0.3 * r)
    }
  }

  if (!hasEle) return finalize(raw, n, mpu, 'synthetic')

  // Residuals between GPX elevation and raw noise along the route
  const rawField = { n, half, h: raw }
  const res = route.map((p) => p.ele - sampleField(rawField, p.x, p.z))
  const sorted = [...res].sort((a, b) => a - b)
  const offset = sorted[Math.floor(sorted.length / 2)]
  const resid = res.map((r) => r - offset)

  const s = 0.75, s2 = 2 * s * s, cutoff2 = (3 * s) ** 2
  const h = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    const z = -half + (j / (n - 1)) * 2 * half
    for (let i = 0; i < n; i++) {
      const x = -half + (i / (n - 1)) * 2 * half
      let sw = 0, swr = 0
      for (let k = 0; k < route.length; k++) {
        const d2 = (x - route[k].x) ** 2 + (z - route[k].z) ** 2
        if (d2 > cutoff2) continue
        const w = Math.exp(-d2 / s2)
        sw += w
        swr += w * resid[k]
      }
      const corr = sw > 0 ? (swr / sw) * (1 - Math.exp(-sw * 0.8)) : 0
      h[j * n + i] = raw[j * n + i] + offset + corr
    }
  }
  return finalize(h, n, mpu, 'synthetic')
}

// ---------- Real DEM: AWS Open Data "Terrarium" elevation tiles (public, CORS-enabled, no key) ----------

const TERRARIUM = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`

function lonToTileX(lon, z) { return ((lon + 180) / 360) * 2 ** z }
function latToTileY(lat, z) {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Tile failed: ' + url))
    img.src = url
  })
}

export async function fetchDEMField(geo, signal) {
  const n = GRID_N
  const half = FIELD_HALF
  const nw = worldToLatLon(geo, -half, -half)
  const se = worldToLatLon(geo, half, half)

  // Pick the zoom that gives ~grid resolution, capped at 16 tiles
  const spanM = 2 * half * geo.metersPerUnit
  const targetMPerPx = spanM / (n - 1)
  let z = Math.round(Math.log2((156543.03 * geo.cosLat) / targetMPerPx))
  z = Math.min(14, Math.max(5, z))
  let x0, x1, y0, y1
  for (; z >= 3; z--) {
    x0 = Math.floor(lonToTileX(nw.lon, z)); x1 = Math.floor(lonToTileX(se.lon, z))
    y0 = Math.floor(latToTileY(nw.lat, z)); y1 = Math.floor(latToTileY(se.lat, z))
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 16) break
  }
  const tw = x1 - x0 + 1, th = y1 - y0 + 1

  const canvas = document.createElement('canvas')
  canvas.width = tw * 256
  canvas.height = th * 256
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const jobs = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      jobs.push(loadImage(TERRARIUM(z, tx, ty)).then((img) => ctx.drawImage(img, (tx - x0) * 256, (ty - y0) * 256)))
    }
  }
  await Promise.all(jobs)
  if (signal?.aborted) throw new Error('aborted')
  const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const W = canvas.width, H = canvas.height

  const decode = (ix, iy) => {
    ix = Math.min(W - 1, Math.max(0, ix)); iy = Math.min(H - 1, Math.max(0, iy))
    const o = (iy * W + ix) * 4
    return px[o] * 256 + px[o + 1] + px[o + 2] / 256 - 32768
  }

  const h = new Float32Array(n * n)
  for (let j = 0; j < n; j++) {
    const zW = -half + (j / (n - 1)) * 2 * half
    for (let i = 0; i < n; i++) {
      const xW = -half + (i / (n - 1)) * 2 * half
      const { lat, lon } = worldToLatLon(geo, xW, zW)
      const gx = (lonToTileX(lon, z) - x0) * 256 - 0.5
      const gy = (latToTileY(lat, z) - y0) * 256 - 0.5
      const ix = Math.floor(gx), iy = Math.floor(gy)
      const fx = gx - ix, fy = gy - iy
      const a = decode(ix, iy), b = decode(ix + 1, iy), c = decode(ix, iy + 1), d = decode(ix + 1, iy + 1)
      h[j * n + i] = Math.max(-50, (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)
    }
  }
  return finalize(h, n, geo.metersPerUnit, 'dem')
}
