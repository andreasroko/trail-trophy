// Visual themes. Terrain colouring is done per-vertex from normalized height (t), slope (0 flat → 1 cliff)
// and a small noise value (n ∈ [0,1]) so each theme can paint its own material story.
import { Color } from 'three'

const c = (hex) => new Color(hex)
const mix = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)))
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

const SAT = {
  forest: c('#2f5a2e'), meadow: c('#6e8b3d'), dry: c('#a39467'),
  rock: c('#7d766d'), darkRock: c('#55504a'), snow: c('#f3f5f7'),
}

export const THEMES = {
  clay: {
    id: 'clay',
    label: 'Topo Clay',
    dark: false,
    background: '#e7e1d6',
    table: '#ddd5c7',
    plinth: '#5a3b26',
    plate: ['#d9b46a', '#a8803a'],
    plateText: '#3b2a12',
    strata: ['#d9ccb5', '#cbb999', '#e3d8c4', '#bfae8f', '#d4c6ac'],
    contour: { color: '#8a6f4e', strength: 0.55, minor: 0.18 },
    trail: { color: '#e4572e', emissive: '#e4572e', emissiveIntensity: 0.35 },
    marker: { start: '#2f9e5b', finish: '#c43c2c', flag: '#e4572e' },
    tree: ['#efe8da', '#e3dac8'],
    key: { color: '#ffe3c2', intensity: 2.6 },
    fill: { sky: '#cfe0ff', ground: '#bfa88a', intensity: 0.75 },
    bloom: 0.15,
    terrain(t, slope, n) {
      const base = mix(c('#d8ccb6'), c('#f2ece0'), t * 0.9 + n * 0.08)
      return mix(base, c('#c9b99c'), smooth(0.25, 0.7, slope) * 0.6)
    },
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite / Earth',
    dark: false,
    background: '#cfd8dc',
    table: '#c3ccd0',
    plinth: '#3d2a1d',
    plate: ['#e2c27a', '#9c7631'],
    plateText: '#2a1c0b',
    strata: ['#8a6a4f', '#6f5442', '#9b7c5e', '#5e4838', '#7d6149'],
    contour: { color: '#ffffff', strength: 0.12, minor: 0.0 },
    trail: { color: '#ff5a1f', emissive: '#ff6a2a', emissiveIntensity: 0.6 },
    marker: { start: '#22c55e', finish: '#ef4444', flag: '#ff5a1f' },
    tree: ['#264d27', '#33612f'],
    key: { color: '#fff0d6', intensity: 2.8 },
    fill: { sky: '#bcd4ff', ground: '#7a6a52', intensity: 0.7 },
    bloom: 0.25,
    terrain(t, slope, n) {
      const tt = t + (n - 0.5) * 0.08
      let col = mix(SAT.forest, SAT.meadow, smooth(0.15, 0.4, tt))
      col = mix(col, SAT.dry, smooth(0.38, 0.58, tt))
      col = mix(col, SAT.rock, smooth(0.5, 0.72, tt))
      col = mix(col, SAT.darkRock, smooth(0.35, 0.75, slope))
      const snow = smooth(0.7, 0.8, tt) * (1 - smooth(0.45, 0.8, slope))
      return mix(col, SAT.snow, snow)
    },
  },
  osm: {
    id: 'osm',
    label: 'OpenStreetMap',
    dark: false,
    mapTiles: true, // drapes OSM tiles; terrain() is the untextured fallback while tiles load
    background: '#dfe3e6',
    table: '#d3d8db',
    plinth: '#2f3b45',
    plate: ['#f2efe9', '#cfc8bb'],
    plateText: '#2b2b2b',
    strata: ['#b9ab94', '#a3937a', '#c7baa4', '#93836c', '#b2a38b'],
    contour: { color: '#6b5a45', strength: 0.22, minor: 0.0 },
    trail: { color: '#d6136b', emissive: '#ff2d87', emissiveIntensity: 0.5 },
    marker: { start: '#16a34a', finish: '#dc2626', flag: '#d6136b' },
    tree: ['#3f6b3a', '#4d7a43'],
    key: { color: '#fff4e2', intensity: 2.4 },
    fill: { sky: '#d6e4ff', ground: '#9a8f80', intensity: 0.9 },
    bloom: 0.15,
    terrain() { return c('#ffffff') },
  },
  tactical: {
    id: 'tactical',
    label: 'Dark Tactical',
    dark: true,
    background: '#0b0f16',
    table: '#0f141c',
    plinth: '#11161e',
    plate: ['#1f2937', '#111827'],
    plateText: '#5eead4',
    strata: ['#1b2330', '#151c27', '#202a38', '#121821', '#1a2230'],
    contour: { color: '#22d3ee', strength: 0.75, minor: 0.22 },
    trail: { color: '#f0abfc', emissive: '#ff2bd6', emissiveIntensity: 3.2 },
    marker: { start: '#4ade80', finish: '#f43f5e', flag: '#facc15' },
    tree: ['#1e293b', '#1e293b'],
    key: { color: '#c7d7ff', intensity: 1.6 },
    fill: { sky: '#2a4365', ground: '#0b0f16', intensity: 0.6 },
    bloom: 1.1,
    terrain(t, slope, n) {
      const base = mix(c('#1a2230'), c('#334155'), t * 0.9 + n * 0.05)
      return mix(base, c('#111722'), smooth(0.4, 0.85, slope) * 0.6)
    },
  },
}

export const THEME_LIST = Object.values(THEMES)
