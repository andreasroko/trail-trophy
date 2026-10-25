import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Upload } from 'lucide-react'
import Scene from './three/Scene.jsx'
import { HikePanel, StylePanel, CameraBar } from './ui/Panels.jsx'
import { parseGPX, projectTrack, resampleRoute, computeMetrics } from './lib/gpx.js'
import { synthesizeField, fetchDEMField, sampleField } from './lib/terrain.js'
import { DEMO_HIKES } from './lib/demoHikes.js'
import { fetchMapTexture } from './lib/mapTiles.js'
import { THEMES } from './lib/themes.js'
import { fmtDist, fmtEle } from './ui/format.js'

const DEFAULTS = {
  shape: 'hexagon',
  theme: 'satellite',
  exaggeration: 1.6,
  terrainSource: 'synthetic',
  autoRotate: true,
  tiltShift: true,
  contours: true,
  trees: true,
  labels: true,
}

export default function App() {
  const [track, setTrack] = useState(null)
  const [activeDemo, setActiveDemo] = useState(null)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(DEFAULTS)
  const [units, setUnits] = useState('metric')
  const [preset, setPreset] = useState({ name: 'showcase', n: 0 })
  const [scrub, setScrub] = useState(null)
  const [animKey, setAnimKey] = useState(0)
  const [dem, setDem] = useState({ status: 'idle', field: null })
  const [pageDrag, setPageDrag] = useState(false)
  const glRef = useRef()

  const set = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])
  const theme = THEMES[settings.theme]
  const exag = useDeferredValue(settings.exaggeration)

  const loadText = useCallback((text, demoId = null) => {
    try {
      const t = parseGPX(text)
      setTrack(t)
      setActiveDemo(demoId)
      setError(null)
      setAnimKey((k) => k + 1)
      setPreset({ name: 'showcase', n: Date.now() })
    } catch (e) {
      setError(e.message || 'Could not read that GPX file.')
    }
  }, [])

  const onFile = useCallback((file) => {
    if (!/\.gpx$/i.test(file.name) && !/xml/.test(file.type)) {
      setError('Please drop a .gpx file.')
      return
    }
    file.text().then((t) => loadText(t))
  }, [loadText])

  const onDemo = useCallback((d) => loadText(d.gpx(), d.id), [loadText])

  // Boot with the first demo so the diorama renders immediately
  useEffect(() => { onDemo(DEMO_HIKES[0]) }, [onDemo])

  // ---- Data pipeline ----
  const geo = useMemo(() => (track ? projectTrack(track) : null), [track])
  const route = useMemo(() => (geo ? resampleRoute(geo.world, 700) : null), [geo])
  const synthField = useMemo(() => (track && geo ? synthesizeField(track, geo) : null), [track, geo])

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

  // OpenStreetMap imagery for the map theme (keeps the last texture for this hike when switching themes)
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

  const plateSub = metrics
    ? `${fmtDist(metrics.distanceM, units).toUpperCase()}  ·  +${fmtEle(metrics.gainM, units).toUpperCase()}  ·  ▲ ${fmtEle(metrics.peakM, units).toUpperCase()}`
    : ''

  const snapshot = () => {
    const gl = glRef.current
    if (!gl) return
    const a = document.createElement('a')
    a.href = gl.domElement.toDataURL('image/png')
    a.download = `${(track?.name || 'trail-trophy').replace(/[^\w-]+/g, '_')}.png`
    a.click()
  }

  // Whole-page drop target
  useEffect(() => {
    let depth = 0
    const enter = (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; setPageDrag(true) } }
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setPageDrag(false) }
    const over = (e) => e.preventDefault()
    // Always clear the overlay; only load here if the panel dropzone did not already handle it
    const drop = (e) => { depth = 0; setPageDrag(false); if (e.defaultPrevented) return; e.preventDefault(); const f = e.dataTransfer?.files?.[0]; f && onFile(f) }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [onFile])

  const dark = theme.dark
  const accent = theme.trail.emissive
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div className="relative h-full w-full" style={{ background: theme.background }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [18, 15, 21], fov: 32, near: 0.1, far: 200 }}
        gl={{ preserveDrawingBuffer: true, antialias: false }}
        onCreated={({ gl }) => (glRef.current = gl)}
      >
        <Suspense fallback={null}>
          {field && metrics && (
            <Scene
              field={field}
              geo={geo}
              route={route}
              metrics={metrics}
              settings={{ ...settings, exaggeration: exag }}
              theme={theme}
              preset={preset}
              scrub={scrub}
              animKey={animKey}
              title={track.name}
              subtitle={plateSub}
              units={units}
              mapTexture={osm.texture}
            />
          )}
        </Suspense>
      </Canvas>

      {/* overlays */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-3 p-3 md:flex-row md:items-start">
        <HikePanel
          dark={dark}
          accent={accent}
          track={track}
          metrics={metrics}
          eles={eles}
          units={units}
          setUnits={setUnits}
          onFile={onFile}
          onDemo={onDemo}
          activeDemo={activeDemo}
          onScrub={setScrub}
          error={error}
        />
        <StylePanel dark={dark} settings={settings} set={set} demStatus={dem.status} osmStatus={wantsTiles ? osm.status : 'idle'} defaultOpen={!isNarrow} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-3">
        <CameraBar dark={dark} onPreset={(name) => setPreset({ name, n: Date.now() })} onSnapshot={snapshot} />
      </div>

      {wantsTiles && (
        // Required attribution for OpenStreetMap tiles
        <div className="pointer-events-auto absolute bottom-1 right-2 rounded bg-white/75 px-1.5 py-0.5 text-[10px] text-stone-700 backdrop-blur">
          Map ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
            OpenStreetMap contributors
          </a>
        </div>
      )}

      {pageDrag && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-white/70 bg-white/10 px-12 py-10 text-white">
            <Upload size={36} />
            <div className="font-display text-xl font-semibold">Drop your GPX to build a diorama</div>
          </div>
        </div>
      )}
    </div>
  )
}
