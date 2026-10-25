import { useEffect, useMemo, useState } from 'react'
import { projectTrack, resampleRoute, computeMetrics } from '../lib/gpx.js'
import { synthesizeField, fetchDEMField, sampleField } from '../lib/terrain.js'
import { fetchMapTexture } from '../lib/mapTiles.js'

/**
 * Track + settings → everything the scene and panels need:
 * projected route, height field (procedural or real DEM), optional OSM texture, metrics.
 */
export function useDiorama(track, settings, theme) {
  const geo = useMemo(() => (track ? projectTrack(track) : null), [track])
  const route = useMemo(() => (geo ? resampleRoute(geo.world, 700) : null), [geo])
  const synthField = useMemo(() => (track && geo ? synthesizeField(track, geo) : null), [track, geo])

  const [dem, setDem] = useState({ status: 'idle', field: null })
  useEffect(() => {
    if (settings.terrainSource !== 'dem' || !geo) { setDem({ status: 'idle', field: null }); return }
    const ctrl = new AbortController()
    setDem({ status: 'loading', field: null })
    fetchDEMField(geo, ctrl.signal)
      .then((field) => !ctrl.signal.aborted && setDem({ status: 'ok', field }))
      .catch((e) => !ctrl.signal.aborted && (console.warn(e), setDem({ status: 'error', field: null })))
    return () => ctrl.abort()
  }, [settings.terrainSource, geo])

  const field = dem.field || synthField

  const [osm, setOsm] = useState({ status: 'idle', texture: null })
  const wantsTiles = !!theme.mapTiles
  useEffect(() => {
    if (!wantsTiles || !geo) return
    const ctrl = new AbortController()
    let tex = null
    setOsm({ status: 'loading', texture: null })
    fetchMapTexture(geo, ctrl.signal)
      .then((t) => { tex = t; if (!ctrl.signal.aborted) setOsm({ status: 'ok', texture: t }) })
      .catch((e) => !ctrl.signal.aborted && (console.warn(e), setOsm({ status: 'error', texture: null })))
    return () => { ctrl.abort(); tex?.dispose() }
  }, [wantsTiles, geo])

  // Elevations used for metrics: GPX <ele> if present, otherwise sampled from the terrain
  const eles = useMemo(() => {
    if (!track || !geo || !field) return null
    return track.hasEle ? track.points.map((p) => p.ele) : geo.world.map((p) => sampleField(field, p.x, p.z))
  }, [track, geo, field])
  const metrics = useMemo(() => (track && eles ? computeMetrics(track, eles) : null), [track, eles])

  return { geo, route, field, eles, metrics, demStatus: dem.status, osm, wantsTiles }
}
