// Mesh builders for the diorama: radial terrain top clipped to the base shape, strata skirt, plinth.
import * as THREE from 'three'
import { sampleField, metersToY, shapeRadius, BASE_RADIUS } from './terrain.js'
import { createNoise2D } from './noise.js'

// 240 is divisible by 8 and 6, so square corners (45°) and hexagon vertices (60°) land exactly on a spoke.
export const SEG = 240
export const RINGS = 110

/**
 * Polar sample layout for a base shape: centre vertex + RINGS rings of SEG spokes.
 * Heights (meters) are cached here so exaggeration changes only re-scale Y.
 */
export function buildRadialSamples(field, shape) {
  const count = 1 + SEG * RINGS
  const xs = new Float32Array(count), zs = new Float32Array(count)
  const hm = new Float32Array(count), nv = new Float32Array(count)
  const noise = createNoise2D(1234)
  const radii = new Float32Array(SEG)
  for (let j = 0; j < SEG; j++) radii[j] = shapeRadius(shape, (j / SEG) * Math.PI * 2)

  hm[0] = sampleField(field, 0, 0)
  nv[0] = 0.5
  for (let i = 1; i <= RINGS; i++) {
    const f = i / RINGS
    for (let j = 0; j < SEG; j++) {
      const th = (j / SEG) * Math.PI * 2
      const k = 1 + (i - 1) * SEG + j
      const r = f * radii[j]
      xs[k] = Math.cos(th) * r
      zs[k] = Math.sin(th) * r
      hm[k] = sampleField(field, xs[k], zs[k])
      nv[k] = noise(xs[k] * 2.2, zs[k] * 2.2) * 0.5 + 0.5
    }
  }

  const tris = []
  for (let j = 0; j < SEG; j++) tris.push(0, 1 + ((j + 1) % SEG), 1 + j)
  for (let i = 1; i < RINGS; i++) {
    const a = 1 + (i - 1) * SEG, b = 1 + i * SEG
    for (let j = 0; j < SEG; j++) {
      const j1 = (j + 1) % SEG
      tris.push(a + j, b + j1, b + j, a + j, a + j1, b + j1)
    }
  }

  let lo = Infinity, hi = -Infinity
  for (let k = 0; k < count; k++) { lo = Math.min(lo, hm[k]); hi = Math.max(hi, hm[k]) }
  return { shape, count, xs, zs, hm, nv, radii, index: new THREE.Uint32BufferAttribute(tris, 1), lo, hi }
}

export function buildTopGeometry(samples, field, exag, theme) {
  const { count, xs, zs, hm, nv, lo, hi } = samples
  const pos = new Float32Array(count * 3)
  for (let k = 0; k < count; k++) {
    pos[k * 3] = xs[k]
    pos[k * 3 + 1] = metersToY(field, hm[k], exag)
    pos[k * 3 + 2] = zs[k]
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const half = field.half
  const uv = new Float32Array(count * 2)
  for (let k = 0; k < count; k++) {
    uv[k * 2] = (xs[k] + half) / (2 * half)
    uv[k * 2 + 1] = 1 - (zs[k] + half) / (2 * half) // canvas top = north = -Z
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(samples.index)
  g.computeVertexNormals()

  // Colour: theme function of normalized height + slope (slope from the true-scale normals feels
  // more natural, so derive it from exag-independent height deltas via the computed normal)
  const nrm = g.attributes.normal.array
  const col = new Float32Array(count * 3)
  const span = Math.max(1, hi - lo)
  for (let k = 0; k < count; k++) {
    const t = (hm[k] - lo) / span
    const slope = 1 - Math.pow(Math.abs(nrm[k * 3 + 1]), 1 / Math.max(1, exag * 0.8))
    const cc = theme.terrain(t, slope, nv[k])
    col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeBoundingSphere()
  return g
}

/** Vertical skirt from the terrain edge down to y = 0, with flat per-edge normals and perimeter UVs. */
export function buildWallGeometry(samples, field, exag) {
  const outer = 1 + (RINGS - 1) * SEG
  const pos = [], nrm = [], uv = []
  let perim = 0
  for (let j = 0; j < SEG; j++) {
    const a = outer + j, b = outer + ((j + 1) % SEG)
    const ax = samples.xs[a], az = samples.zs[a], bx = samples.xs[b], bz = samples.zs[b]
    const ay = metersToY(field, samples.hm[a], exag), by = metersToY(field, samples.hm[b], exag)
    const len = Math.hypot(bx - ax, bz - az)
    // outward normal = edge tangent rotated
    const nx = (bz - az) / len, nz = -(bx - ax) / len
    const u0 = perim / 2.5, u1 = (perim + len) / 2.5
    const V = (y) => y / 3
    // bottom-a, top-a, top-b | bottom-a, top-b, bottom-b  (CCW seen from outside)
    pos.push(ax, 0, az, ax, ay, az, bx, by, bz, ax, 0, az, bx, by, bz, bx, 0, bz)
    uv.push(u0, 0, u0, V(ay), u1, V(by), u0, 0, u1, V(by), u1, 0)
    for (let q = 0; q < 6; q++) nrm.push(nx, 0, nz)
    perim += len
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

/** Outline as a THREE.Shape in (x, -z) so that after rotateX(-90°) it lands on the XZ plane. */
function outlineShape(shape, pad) {
  const s = new THREE.Shape()
  const pts = []
  if (shape === 'circle') {
    for (let j = 0; j < 128; j++) {
      const th = (j / 128) * Math.PI * 2
      pts.push([Math.cos(th) * (BASE_RADIUS + pad), Math.sin(th) * (BASE_RADIUS + pad)])
    }
  } else {
    const corners = shape === 'square' ? [45, 135, 225, 315] : [0, 60, 120, 180, 240, 300]
    for (const deg of corners) {
      const th = (deg * Math.PI) / 180
      const r = shapeRadius(shape, th, BASE_RADIUS + pad)
      pts.push([Math.cos(th) * r, Math.sin(th) * r])
    }
  }
  pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)))
  s.closePath()
  return s
}

export const PLINTH_DEPTH = 0.6
export const PLINTH_PAD = 0.32

export function buildPlinthGeometry(shape) {
  const bevel = 0.06
  const g = new THREE.ExtrudeGeometry(outlineShape(shape, PLINTH_PAD - bevel), {
    depth: PLINTH_DEPTH - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 64,
  })
  g.rotateX(-Math.PI / 2)
  g.translate(0, -(PLINTH_DEPTH - bevel), 0)
  g.computeVertexNormals()
  return g
}

/** Wavy sedimentary strata texture for the skirt. */
export function makeStrataTexture(colors, dark) {
  const W = 512, H = 512
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')
  const noise = createNoise2D(99)
  const tops = []
  for (let y = 0; y < H + 40; ) {
    y += 18 + Math.abs(noise(tops.length * 1.7, 0.3)) * 60
    tops.push(y)
  }
  // Paint highest band first; each lower band then overlays from the bottom up
  for (let idx = tops.length - 1; idx >= 0; idx--) {
    ctx.fillStyle = colors[idx % colors.length]
    ctx.beginPath()
    ctx.moveTo(0, H)
    for (let x = 0; x <= W; x += 8) {
      // wobble wraps horizontally (period W) so the texture tiles seamlessly
      const a = (x / W) * Math.PI * 2
      const wob = noise(Math.cos(a) * 1.2, Math.sin(a) * 1.2 + idx * 0.9) * 10 + noise(Math.cos(a) * 4, Math.sin(a) * 4 + idx * 3.1) * 2.5
      ctx.lineTo(x, H - (tops[idx] + wob))
    }
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.fill()
  }
  // Speckle grain
  const img = ctx.getImageData(0, 0, W, H)
  for (let i = 0; i < img.data.length; i += 4) {
    const g = (Math.random() - 0.5) * (dark ? 10 : 18)
    img.data[i] += g; img.data[i + 1] += g; img.data[i + 2] += g
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Brass nameplate with the hike title + stats, rendered with Canvas2D (no font downloads). */
export function makePlateTexture(title, subtitle, theme) {
  const W = 1024, H = 160
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')
  const grad = ctx.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, theme.plate[0])
  grad.addColorStop(1, theme.plate[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(0,0,0,.35)'
  ctx.lineWidth = 6
  ctx.strokeRect(10, 10, W - 20, H - 20)
  ctx.fillStyle = theme.plateText
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 50px Georgia, "Times New Roman", serif'
  ctx.fillText(title.toUpperCase().slice(0, 34), W / 2, 62)
  ctx.font = '500 32px ui-monospace, Menlo, monospace'
  ctx.globalAlpha = 0.8
  ctx.fillText(subtitle, W / 2, 116)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
