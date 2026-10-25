// Map imagery draped over the terrain. OpenStreetMap standard tiles (CORS-enabled, no key).
// Usage policy: https://operations.osmfoundation.org/policies/tiles/ — light, interactive use with
// visible attribution is fine; keep tile counts small and never bulk-prefetch.
import * as THREE from 'three'
import { FIELD_HALF, worldToLatLon } from './gpx.js'

const OSM = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
const MAX_TILES = 36

const lonToX = (lon, z) => ((lon + 180) / 360) * 2 ** z
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

function loadImage(url, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Map tile failed: ' + url))
    signal?.addEventListener('abort', () => { img.src = ''; reject(new Error('aborted')) })
    img.src = url
  })
}

/**
 * Build a texture covering the height-field square [-FIELD_HALF, FIELD_HALF]² (north up).
 * The mosaic is cropped in Web-Mercator pixel space; over a diorama-sized area the difference
 * from the local equirectangular projection is sub-pixel.
 */
export async function fetchMapTexture(geo, signal) {
  const nw = worldToLatLon(geo, -FIELD_HALF, -FIELD_HALF)
  const se = worldToLatLon(geo, FIELD_HALF, FIELD_HALF)

  // Highest zoom (≤17) that covers the area with at most MAX_TILES tiles
  let z = 17, x0, x1, y0, y1
  for (; z >= 3; z--) {
    x0 = Math.floor(lonToX(nw.lon, z)); x1 = Math.floor(lonToX(se.lon, z))
    y0 = Math.floor(latToY(nw.lat, z)); y1 = Math.floor(latToY(se.lat, z))
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_TILES) break
  }

  const mosaic = document.createElement('canvas')
  mosaic.width = (x1 - x0 + 1) * 256
  mosaic.height = (y1 - y0 + 1) * 256
  const mctx = mosaic.getContext('2d')
  const jobs = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      jobs.push(loadImage(OSM(z, tx, ty), signal).then((img) => mctx.drawImage(img, (tx - x0) * 256, (ty - y0) * 256)))
    }
  }
  await Promise.all(jobs)
  if (signal?.aborted) throw new Error('aborted')

  const sx = (lonToX(nw.lon, z) - x0) * 256
  const sy = (latToY(nw.lat, z) - y0) * 256
  const sw = (lonToX(se.lon, z) - x0) * 256 - sx
  const sh = (latToY(se.lat, z) - y0) * 256 - sy

  const out = document.createElement('canvas')
  out.width = out.height = 2048
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mosaic, sx, sy, sw, sh, 0, 0, out.width, out.height)

  const tex = new THREE.CanvasTexture(out)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}
