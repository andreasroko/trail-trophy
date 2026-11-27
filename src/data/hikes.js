// Saved hikes ("My trophies") live in this browser's IndexedDB: no account, no server.
// Each record keeps the raw GPX so the diorama can be rebuilt exactly.

/** Diorama style fields stored with a hike (view-only toggles like auto-rotate are left out). */
export const SAVED_SETTING_KEYS = ['shape', 'theme', 'exaggeration', 'terrainSource', 'contours', 'trees', 'labels', 'tiltShift', 'gradeColors', 'pins']
// Missing keys are left out (not undefined) so they fall back to the defaults when loaded
export const pickSavedSettings = (s) => Object.fromEntries(SAVED_SETTING_KEYS.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]))

const DB_NAME = 'trail-trophy'
const STORE = 'hikes'
let dbPromise

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('This browser has no local storage for trophies.'))
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(new Error(req.error?.message || 'Could not open local storage (private browsing?).'))
    })
    dbPromise.catch(() => { dbPromise = null }) // allow a retry
  }
  return dbPromise
}

/** Run one request in a transaction; resolves with its result once the transaction commits. */
async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req?.result)
    tx.onerror = tx.onabort = () => reject(new Error(tx.error?.message || 'Local storage error'))
  })
}

// Everything except the (large) GPX text, for lists
const summary = ({ gpxText, ...rest }) => rest

/** Save the hike on screen as a new trophy. */
export async function saveHike({ track, metrics, gpxText, settings }) {
  const t0 = track.points.find((p) => p.time != null)?.time
  const now = new Date().toISOString()
  const record = {
    id: crypto.randomUUID(),
    name: track.name.slice(0, 200),
    recordedAt: t0 ? new Date(t0).toISOString() : null,
    distanceM: metrics.distanceM,
    gainM: metrics.gainM,
    peakM: metrics.peakM,
    durationH: metrics.durationH,
    settings: pickSavedSettings(settings),
    gpxText,
    createdAt: now,
    updatedAt: now,
  }
  await run('readwrite', (s) => s.add(record))
  // Ask the browser not to evict our data under storage pressure (best effort, may be ignored)
  navigator.storage?.persist?.().catch(() => {})
  return summary(record)
}

/** All trophies in this browser, newest first. */
export async function listMyHikes() {
  const all = (await run('readonly', (s) => s.getAll())) || []
  return all.map(summary).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** One trophy plus its raw GPX. */
export async function getMyHike(id) {
  const rec = await run('readonly', (s) => s.get(id))
  if (!rec) throw new Error('not found in this browser')
  return { hike: summary(rec), gpxText: rec.gpxText }
}

/** Change a trophy's name or saved style. */
export async function updateHike(id, { name, settings } = {}) {
  const rec = await run('readonly', (s) => s.get(id))
  if (!rec) throw new Error('not found in this browser')
  if (name != null) rec.name = name.slice(0, 200)
  if (settings != null) rec.settings = pickSavedSettings(settings)
  rec.updatedAt = new Date().toISOString()
  await run('readwrite', (s) => s.put(rec))
  return summary(rec)
}

export async function deleteHike(id) {
  await run('readwrite', (s) => s.delete(id))
}

/** Backup file with every trophy (including GPX), for moving to another browser or device. */
export async function exportHikes() {
  const hikes = (await run('readonly', (s) => s.getAll())) || []
  return new Blob([JSON.stringify({ format: 'trail-trophy', version: 1, exportedAt: new Date().toISOString(), hikes })], { type: 'application/json' })
}

/** Restore from a backup file. Trophies with the same id are overwritten. Returns how many were imported. */
export async function importHikes(text) {
  let data
  try { data = JSON.parse(text) } catch { throw new Error("That file isn't a Trail Trophy backup.") }
  if (data?.format !== 'trail-trophy' || !Array.isArray(data.hikes)) throw new Error("That file isn't a Trail Trophy backup.")
  const valid = data.hikes.filter((h) => h && typeof h.id === 'string' && typeof h.gpxText === 'string' && typeof h.name === 'string' && h.createdAt)
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const s = tx.objectStore(STORE)
    valid.forEach((h) => s.put({ ...h, settings: pickSavedSettings(h.settings || {}) }))
    tx.oncomplete = resolve
    tx.onerror = tx.onabort = () => reject(new Error(tx.error?.message || 'Import failed'))
  })
  return valid.length
}
