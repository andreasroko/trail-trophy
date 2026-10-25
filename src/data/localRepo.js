// On-device implementation (IndexedDB) used when no Supabase project is configured.
// Same interface as the cloud repo; sharing is unavailable because nothing leaves the browser.

const DB = 'trail-trophy'
const STORE = 'hikes'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('This browser blocked on-device storage.'))
  })
}

async function tx(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    let result
    Promise.resolve(fn(store, (r) => (result = r))).catch(reject)
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
  })
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })

const strip = ({ gpxText, ...hike }) => hike

export function createLocalRepo() {
  return {
    mode: 'local',

    async list() {
      const all = await tx('readonly', async (s, done) => done(await req(s.getAll())))
      return all.map(strip).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async get(id) {
      const rec = await tx('readonly', async (s, done) => done(await req(s.get(id))))
      if (!rec) throw new Error('Hike not found on this device.')
      return { hike: strip(rec), gpxText: rec.gpxText }
    },

    async getShared() {
      throw new Error('Share links need the cloud backend (see README → Accounts).')
    },

    async create({ meta, settings, gpxText }) {
      const now = new Date().toISOString()
      const rec = {
        id: crypto.randomUUID(), ...meta, settings, gpxText,
        isPublic: false, shareSlug: null, createdAt: now, updatedAt: now,
      }
      await tx('readwrite', (s) => s.put(rec))
      return strip(rec)
    },

    async update(id, patch) {
      if (patch.isPublic) throw new Error('Sharing needs the cloud backend.')
      return tx('readwrite', async (s, done) => {
        const rec = await req(s.get(id))
        if (!rec) throw new Error('Hike not found on this device.')
        const next = { ...rec, ...patch, updatedAt: new Date().toISOString() }
        s.put(next)
        done(strip(next))
      })
    },

    async remove(id) {
      await tx('readwrite', (s) => s.delete(id))
    },
  }
}
