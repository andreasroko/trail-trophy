// Supabase implementation: rows in public.hikes, raw GPX in the private 'gpx' storage bucket.
// Access control lives in the database (see supabase/migrations), not here.

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

export function createCloudRepo(sb) {
  async function userId() {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user?.id
    if (!id) throw new Error('Sign in to save hikes.')
    return id
  }

  async function download(path) {
    const blob = unwrap(await sb.storage.from('gpx').download(path))
    return blob.text()
  }

  return {
    mode: 'cloud',

    async list() {
      // RLS also lets everyone read *public* hikes, so filter to the owner explicitly
      const uid = await userId()
      const rows = unwrap(await sb.from('hikes').select(COLUMNS).eq('user_id', uid).order('created_at', { ascending: false }))
      return rows.map(fromRow)
    },

    async get(id) {
      const uid = await userId()
      const hike = fromRow(unwrap(await sb.from('hikes').select(COLUMNS).eq('id', id).eq('user_id', uid).single()))
      return { hike, gpxText: await download(hike.gpxPath) }
    },

    async getShared(slug) {
      const hike = fromRow(
        unwrap(await sb.from('hikes').select(COLUMNS).eq('share_slug', slug).eq('is_public', true).single()),
      )
      return { hike, gpxText: await download(hike.gpxPath) }
    },

    async create({ meta, settings, gpxText }) {
      const uid = await userId()
      const id = crypto.randomUUID()
      const path = `${uid}/${id}.gpx`
      unwrap(await sb.storage.from('gpx').upload(path, new Blob([gpxText], { type: 'application/gpx+xml' }), {
        contentType: 'application/gpx+xml',
        upsert: false,
      }))
      try {
        const row = unwrap(
          await sb
            .from('hikes')
            .insert({
              id,
              user_id: uid,
              name: meta.name,
              recorded_at: meta.recordedAt,
              distance_m: meta.distanceM,
              gain_m: meta.gainM,
              peak_m: meta.peakM,
              duration_h: meta.durationH,
              start_lat: meta.startLat,
              start_lon: meta.startLon,
              gpx_path: path,
              settings,
            })
            .select(COLUMNS)
            .single(),
        )
        return fromRow(row)
      } catch (e) {
        await sb.storage.from('gpx').remove([path]) // don't leave orphaned files behind
        throw e
      }
    },

    async update(id, patch) {
      const row = {}
      if (patch.name != null) row.name = patch.name
      if (patch.settings != null) row.settings = patch.settings
      if (patch.isPublic != null) row.is_public = patch.isPublic
      return fromRow(unwrap(await sb.from('hikes').update(row).eq('id', id).select(COLUMNS).single()))
    },

    async remove(id) {
      const { gpx_path } = unwrap(await sb.from('hikes').select('gpx_path').eq('id', id).single())
      unwrap(await sb.from('hikes').delete().eq('id', id))
      await sb.storage.from('gpx').remove([gpx_path])
    },
  }
}
