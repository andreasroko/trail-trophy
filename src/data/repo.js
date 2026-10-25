// Hike persistence behind one interface. The rest of the app never talks to Supabase or
// IndexedDB directly, so the backend can be swapped by replacing a single implementation.
//
// interface HikeRepo {
//   mode: 'cloud' | 'local'
//   list(): Promise<Hike[]>                                   // current user's hikes, newest first
//   get(id): Promise<{ hike: Hike, gpxText: string }>
//   getShared(slug): Promise<{ hike: Hike, gpxText: string }> // public share link (cloud only)
//   create({ meta, settings, gpxText }): Promise<Hike>
//   update(id, { name?, settings?, isPublic? }): Promise<Hike>
//   remove(id): Promise<void>
// }
//
// Hike = { id, name, recordedAt, distanceM, gainM, peakM, durationH, startLat, startLon,
//          settings, isPublic, shareSlug, createdAt, updatedAt }
import { supabase } from './supabase.js'
import { createCloudRepo } from './cloudRepo.js'
import { createLocalRepo } from './localRepo.js'

export const repo = supabase ? createCloudRepo(supabase) : createLocalRepo()

/** Style fields worth persisting with a hike (view-only toggles like auto-rotate are left out). */
export const SAVED_SETTING_KEYS = ['shape', 'theme', 'exaggeration', 'terrainSource', 'contours', 'trees', 'labels', 'tiltShift']

export function pickSavedSettings(settings) {
  return Object.fromEntries(SAVED_SETTING_KEYS.map((k) => [k, settings[k]]))
}

/** Hike metadata derived from a parsed track + metrics. */
export function hikeMeta(track, metrics) {
  const first = track.points[0]
  const t0 = track.points.find((p) => p.time != null)?.time
  return {
    name: track.name.slice(0, 200),
    recordedAt: t0 ? new Date(t0).toISOString() : null,
    distanceM: metrics.distanceM,
    gainM: metrics.gainM,
    peakM: metrics.peakM,
    durationH: metrics.durationH,
    startLat: first.lat,
    startLon: first.lon,
  }
}
