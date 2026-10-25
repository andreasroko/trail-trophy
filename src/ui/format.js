export const fmtDist = (m, units) =>
  units === 'imperial' ? `${(m / 1609.344).toFixed(m < 16093 ? 2 : 1)} mi` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`

export const fmtEle = (m, units) =>
  units === 'imperial' ? `${Math.round(m * 3.28084).toLocaleString()} ft` : `${Math.round(m).toLocaleString()} m`

export const fmtDuration = (h) => {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return mm === 60 ? `${hh + 1}h 00m` : `${hh}h ${String(mm).padStart(2, '0')}m`
}
