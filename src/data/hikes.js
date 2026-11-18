// Saved hikes: rows in public.hikes, raw GPX in the private 'gpx' storage bucket.
// Who can see or change what is enforced by Row Level Security (supabase/migrations), not here.
import { supabase } from './supabase.js'

/** Diorama style fields stored with a hike (view-only toggles like auto-rotate are left out). */
export const SAVED_SETTING_KEYS = ['shape', 'theme', 'exaggeration', 'terrainSource', 'contours', 'trees', 'labels', 'tiltShift']
export const pickSavedSettings = (s) => Object.fromEntries(SAVED_SETTING_KEYS.map((k) => [k, s[k]]))

const COLUMNS =
  'id, name, recorded_at, distance_m, gain_m, peak_m, duration_h, start_lat, start_lon, gpx_path, settings, is_public, share_slug, created_at, updated_at'

const fromRow = (r) => ({
  id: r.id,
  name: r.name,
  recordedAt: r.recorded_at,
  distanceM: r.distance_m,
  gainM: r.gain_m,
  peakM: r.peak_m,
  durationH: r.duration_h,
  startLat: r.start_lat,
  startLon: r.start_lon,
  gpxPath: r.gpx_path,
  settings: r.settings || {},
  isPublic: r.is_public,
  shareSlug: r.share_slug,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user?.id
  if (!id) throw new Error('Sign in to save hikes.')
  return id
}

/** Upload the GPX, then create the row. Cleans up the file if the row can't be created. */
export async function saveHike({ track, metrics, gpxText, settings }) {
  const uid = await currentUserId()
  const id = crypto.randomUUID()
  const path = `${uid}/${id}.gpx`
  const t0 = track.points.find((p) => p.time != null)?.time

  unwrap(await supabase.storage.from('gpx').upload(path, new Blob([gpxText], { type: 'application/gpx+xml' }), {
    contentType: 'application/gpx+xml',
    upsert: false,
  }))
  try {
    const row = unwrap(await supabase.from('hikes').insert({
      id,
      user_id: uid,
      name: track.name.slice(0, 200),
      recorded_at: t0 ? new Date(t0).toISOString() : null,
      distance_m: metrics.distanceM,
      gain_m: metrics.gainM,
      peak_m: metrics.peakM,
      duration_h: metrics.durationH,
      start_lat: track.points[0].lat,
      start_lon: track.points[0].lon,
      gpx_path: path,
      settings: pickSavedSettings(settings),
    }).select(COLUMNS).single())
    return fromRow(row)
  } catch (e) {
    await supabase.storage.from('gpx').remove([path]) // don't leave an orphaned file behind
    throw e
  }
}

/** Your saved hikes, newest first. (RLS also exposes everyone's *public* hikes, so filter by owner.) */
export async function listMyHikes() {
  const uid = await currentUserId()
  const rows = unwrap(await supabase.from('hikes').select(COLUMNS).eq('user_id', uid).order('created_at', { ascending: false }))
  return rows.map(fromRow)
}

/** One of your hikes plus its raw GPX. */
export async function getMyHike(id) {
  const uid = await currentUserId()
  const hike = fromRow(unwrap(await supabase.from('hikes').select(COLUMNS).eq('id', id).eq('user_id', uid).single()))
  const blob = unwrap(await supabase.storage.from('gpx').download(hike.gpxPath))
  return { hike, gpxText: await blob.text() }
}

/** Change your hike's name, saved style, or visibility. */
export async function updateHike(id, { name, settings, isPublic } = {}) {
  const uid = await currentUserId()
  const patch = {}
  if (name != null) patch.name = name.slice(0, 200)
  if (settings != null) patch.settings = pickSavedSettings(settings)
  if (isPublic != null) patch.is_public = isPublic
  return fromRow(unwrap(await supabase.from('hikes').update(patch).eq('id', id).eq('user_id', uid).select(COLUMNS).single()))
}

/** Delete your hike: the row first, then its GPX file (an orphaned file is harmless; a row without its file is not). */
export async function deleteHike(id) {
  const uid = await currentUserId()
  const { gpx_path } = unwrap(await supabase.from('hikes').select('gpx_path').eq('id', id).eq('user_id', uid).single())
  unwrap(await supabase.from('hikes').delete().eq('id', id).eq('user_id', uid))
  const { error } = await supabase.storage.from('gpx').remove([gpx_path])
  if (error) console.warn('Hike deleted but its GPX file could not be removed:', error.message)
}
