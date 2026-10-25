// Built-in demo hikes. Generated as real GPX XML so they flow through the same parser as uploads.
// Waypoints approximate the actual routes; densification adds switchbacks on steep pitches.
import { mulberry32 } from './noise.js'

const M = 111195 // meters per degree latitude

function densify(waypoints, { stepM = 22, seed = 7, withTime = false, startTime } = {}) {
  const rand = mulberry32(seed)
  const out = []
  let along = 0
  let t = startTime ? Date.parse(startTime) : 0
  for (let w = 0; w < waypoints.length - 1; w++) {
    const [la1, lo1, e1] = waypoints[w]
    const [la2, lo2, e2] = waypoints[w + 1]
    const cos = Math.cos((la1 * Math.PI) / 180)
    const dx = (lo2 - lo1) * cos * M, dy = (la2 - la1) * M
    const len = Math.hypot(dx, dy)
    const grade = Math.abs(e2 - e1) / Math.max(len, 1)
    const steps = Math.max(2, Math.round(len / stepM))
    // Perpendicular unit vector (meters) for switchback offsets
    const px = -dy / len, py = dx / len
    const amp = Math.min(70, grade * 260) // steeper → wider switchbacks
    const period = 110 + rand() * 60
    for (let s = 0; s < steps; s++) {
      const f = s / steps
      const d = along + f * len
      const taper = Math.sin(Math.PI * f) // keep waypoints fixed
      const off = Math.sin((d / period) * Math.PI) * amp * taper + (rand() - 0.5) * 3
      const lat = la1 + (la2 - la1) * f + (py * off) / M
      const lon = lo1 + (lo2 - lo1) * f + (px * off) / (M * cos)
      const ele = e1 + (e2 - e1) * f + (rand() - 0.5) * 1.6
      if (withTime && out.length) {
        const prev = out[out.length - 1]
        const dd = Math.hypot((lon - prev.lon) * cos * M, (lat - prev.lat) * M)
        const climb = Math.max(0, ele - prev.ele)
        t += (dd / 1.25 + climb * 6) * 1000 // ~4.5 km/h + 1 min per 10 m climbing
      }
      out.push({ lat, lon, ele, time: withTime ? t : null })
    }
    along += len
  }
  const [la, lo, e] = waypoints[waypoints.length - 1]
  out.push({ lat: la, lon: lo, ele: e, time: withTime ? t + 60000 : null })
  return out
}

function toGPX(name, pts) {
  const body = pts
    .map(
      (p) =>
        `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele>${
          p.time ? `<time>${new Date(p.time).toISOString()}</time>` : ''
        }</trkpt>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Trail Trophy demo" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${name}</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>`
}

const RAINIER_UP = [
  [46.7865, -121.7353, 1647],
  [46.7935, -121.7318, 1800],
  [46.8, -121.7302, 1950],
  [46.8045, -121.727, 2090],
  [46.81, -121.7285, 2200],
  [46.818, -121.73, 2500],
  [46.827, -121.7315, 2800],
  [46.8355, -121.7323, 3100],
]

const HALF_DOME = [
  [37.732, -119.5577, 1230],
  [37.7275, -119.552, 1370],
  [37.7273, -119.5442, 1530],
  [37.7255, -119.538, 1650],
  [37.7249, -119.533, 1820],
  [37.7315, -119.515, 1860],
  [37.739, -119.5165, 2130],
  [37.744, -119.526, 2400],
  [37.7459, -119.5332, 2694],
  // return via the John Muir Trail
  [37.744, -119.526, 2400],
  [37.739, -119.5165, 2130],
  [37.7315, -119.515, 1860],
  [37.7249, -119.533, 1820],
  [37.7215, -119.54, 1700],
  [37.724, -119.549, 1500],
  [37.7275, -119.552, 1370],
  [37.732, -119.5577, 1230],
]

export const DEMO_HIKES = [
  {
    id: 'rainier',
    label: 'Mt. Rainier · Camp Muir',
    blurb: 'Paradise → Camp Muir, out & back',
    gpx: () =>
      toGPX(
        'Mount Rainier — Camp Muir',
        densify([...RAINIER_UP, ...RAINIER_UP.slice(0, -1).reverse()], {
          seed: 11,
          withTime: true,
          startTime: '2025-07-19T06:10:00Z',
        }),
      ),
  },
  {
    id: 'halfdome',
    label: 'Half Dome · Yosemite',
    blurb: 'Mist Trail up, JMT down',
    gpx: () => toGPX('Half Dome via Mist Trail', densify(HALF_DOME, { seed: 23 })),
  },
]
