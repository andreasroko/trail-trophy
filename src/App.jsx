import { Suspense, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Mountain, Upload } from 'lucide-react'
import Scene from './three/Scene.jsx'
import { HikePanel, StylePanel, CameraBar } from './ui/Panels.jsx'
import MobileSheet from './ui/MobileSheet.jsx'
import { useIsMobile, useIsTouch } from './hooks/useMediaQuery.js'
import { TrophiesButton, SaveButton, TrophyShelf } from './ui/Trophies.jsx'
import { saveHike, listMyHikes, getMyHike, updateHike, deleteHike, pickSavedSettings, exportHikes, importHikes } from './data/hikes.js'
import { decodeShare, shareUrl } from './data/share.js'
import { parseGPX } from './lib/gpx.js'
import { DEMO_HIKES } from './lib/demoHikes.js'
import { THEMES } from './lib/themes.js'
import { fmtDist, fmtEle } from './ui/format.js'
import { useDiorama } from './hooks/useDiorama.js'

const DEFAULTS = {
  shape: 'hexagon',
  theme: 'satellite',
  exaggeration: 1.6,
  terrainSource: 'dem',
  autoRotate: false,
  tiltShift: false,
  contours: true,
  trees: true,
  labels: true,
}

export default function App() {
  // The hike on screen: its raw GPX (kept so it can be saved later), the parsed track, and which demo it is
  const [hike, setHike] = useState(null)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(DEFAULTS)
  const [units, setUnits] = useState('metric')
  const [preset, setPreset] = useState({ name: 'showcase', n: 0 })
  const [scrub, setScrub] = useState(null)
  const [animKey, setAnimKey] = useState(0)
  const [pageDrag, setPageDrag] = useState(false)
  const { hikeId } = useParams() // /h/:hikeId = one of your trophies
  const { pathname, hash } = useLocation()
  const shareCode = pathname === '/s' ? hash.slice(1) : null // /s#<code> = a shared hike carried in the link
  const readOnly = shareCode != null
  const navigate = useNavigate()
  const [shelf, setShelf] = useState({ open: false, list: [], loading: false, error: null })
  const [saving, setSaving] = useState(false)
  const glRef = useRef()

  const set = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])
  const theme = THEMES[settings.theme]
  const exag = useDeferredValue(settings.exaggeration)

  /**
   * Put a hike on screen. Throws a readable error if the GPX can't be parsed.
   * `settings` (optional) restores a saved diorama style on top of the defaults.
   */
  const showHike = useCallback((gpxText, { demoId = null, settings: style = null } = {}) => {
    const track = parseGPX(gpxText)
    setHike({ gpxText, track, demoId })
    if (style) setSettings({ ...DEFAULTS, ...style })
    setError(null)
    setAnimKey((k) => k + 1)
    setPreset({ name: 'showcase', n: Date.now() })
  }, [])

  const loadText = useCallback((text, demoId = null) => {
    try {
      showHike(text, { demoId })
      if (hikeId || readOnly) navigate('/')
    } catch (e) {
      setError(e.message || 'Could not read that GPX file.')
    }
  }, [showHike, hikeId, readOnly, navigate])

  const onFile = useCallback((file) => {
    if (!/\.gpx$/i.test(file.name) && !/xml/.test(file.type)) {
      setError('Please choose a .gpx file.')
      return
    }
    file.text().then((t) => loadText(t))
  }, [loadText])

  const onDemo = useCallback((d) => loadText(d.gpx(), d.id), [loadText])

  // What to show for the current URL: the demo on "/", a trophy on "/h/:id", a shared hike on "/s#..."
  useEffect(() => {
    let cancelled = false
    const showDemo = () => showHike(DEMO_HIKES[0].gpx(), { demoId: DEMO_HIKES[0].id })
    const fail = (msg) => {
      if (cancelled) return
      if (!hike) showDemo() // before setError: showing a hike clears errors
      navigate('/', { replace: true })
      setError(msg)
    }
    if (shareCode != null) {
      if (hike?.shareCode === shareCode) return
      decodeShare(shareCode)
        .then(({ gpxText, settings: style }) => {
          if (cancelled) return
          showHike(gpxText, { settings: style })
          setHike((h) => ({ ...h, shareCode }))
        })
        .catch(() => fail("That share link is incomplete or broken. Ask for it again, or check it wasn't cut off."))
    } else if (hikeId) {
      if (hike?.saved?.id === hikeId) return
      getMyHike(hikeId)
        .then(({ hike: saved, gpxText }) => {
          if (cancelled) return
          showHike(gpxText, { settings: saved.settings })
          setHike((h) => ({ ...h, saved }))
        })
        .catch(() => fail("That trophy isn't saved in this browser. Trophies live on the device that saved them; use Export / Import in My trophies to move them."))
    } else if (!hike) {
      showDemo()
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hikeId, shareCode])

  const refreshShelf = async (patch = {}) => {
    try {
      const list = await listMyHikes()
      setShelf((s) => ({ ...s, list, loading: false, ...patch }))
    } catch (e) {
      setShelf((s) => ({ ...s, loading: false, error: `Couldn't read your trophies: ${e.message}` }))
    }
  }
  const openShelf = () => {
    setShelf((s) => ({ ...s, open: true, loading: true, error: null }))
    refreshShelf()
  }

  const exportShelf = async () => {
    try {
      const blob = await exportHikes()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `trail-trophies-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e) {
      setShelf((s) => ({ ...s, error: `Couldn't export: ${e.message}` }))
    }
  }
  const importShelf = async (file) => {
    try {
      const n = await importHikes(await file.text())
      await refreshShelf({ error: n ? null : 'That backup had no trophies in it.' })
    } catch (e) {
      setShelf((s) => ({ ...s, error: e.message }))
    }
  }

  const track = hike?.track ?? null
  const { geo, route, field, eles, metrics, demStatus, osm, wantsTiles } = useDiorama(track, settings, theme)

  const save = async () => {
    if (!hike || !metrics) return
    setSaving(true)
    try {
      const saved = await saveHike({ track: hike.track, metrics, gpxText: hike.gpxText, settings })
      // Only attach if the same hike is still on screen
      setHike((h) => (h && h.gpxText === hike.gpxText ? { ...h, saved, shareCode: null } : h))
      navigate(`/h/${saved.id}`)
    } catch (e) {
      setError(`Couldn't save: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  // Saved hike whose style was changed since saving
  const dirty = !!hike?.saved &&
    JSON.stringify(pickSavedSettings(settings)) !== JSON.stringify(pickSavedSettings({ ...DEFAULTS, ...hike.saved.settings }))

  const saveStyle = async () => {
    setSaving(true)
    try {
      const saved = await updateHike(hike.saved.id, { settings })
      setHike((h) => (h?.saved?.id === saved.id ? { ...h, saved } : h))
    } catch (e) {
      setError(`Couldn't save changes: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const removeHike = async (h) => {
    try {
      await deleteHike(h.id)
      setShelf((s) => ({ ...s, list: s.list.filter((x) => x.id !== h.id) }))
      if (hike?.saved?.id === h.id) {
        setHike((cur) => ({ ...cur, saved: null })) // keep it on screen, now unsaved
        navigate('/')
      }
    } catch (e) {
      setShelf((s) => ({ ...s, error: `Couldn't delete: ${e.message}` }))
    }
  }

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
  const isMobile = useIsMobile()
  const isTouch = useIsTouch()
  const onPreset = (name) => setPreset({ name, n: Date.now() })

  const saveSlot = (
    <SaveButton
      dark={dark}
      saved={!!hike?.saved}
      dirty={dirty}
      busy={saving}
      readOnly={readOnly}
      onSave={save}
      onSaveStyle={saveStyle}
      onShare={() => shareUrl(track, settings)}
    />
  )
  const hikeProps = {
    accent, track, metrics, eles, units, setUnits, onFile, onDemo, onScrub: setScrub, saveSlot,
    activeDemo: hike?.demoId ?? null,
    touch: isTouch,
  }
  const styleProps = { settings, set, demStatus, osmStatus: wantsTiles ? osm.status : 'idle' }

  return (
    <div className="relative h-full w-full" style={{ background: theme.background }}>
      <div className="absolute inset-x-0 top-0 bottom-0 max-md:bottom-[150px] md:max-lg:bottom-0">
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
      </div>

      {isMobile ? (
        <>
          {/* Phone: slim top bar + bottom sheet */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 px-2 pt-[max(8px,env(safe-area-inset-top))]">
            <div className={`${dark ? 'glass-dark' : 'glass-light'} flex items-center gap-1.5 !rounded-full px-3 py-2 font-display text-sm font-semibold`}>
              <Mountain size={15} className={dark ? 'text-cyan-300' : 'text-orange-600'} /> Trail Trophy
            </div>
            <TrophiesButton dark={dark} onClick={openShelf} compact />
          </div>
          <MobileSheet
            dark={dark}
            track={track}
            metrics={metrics}
            units={units}
            error={error}
            readOnly={readOnly}
            onNew={() => onDemo(DEMO_HIKES[0])}
            hikeProps={hikeProps}
            styleProps={styleProps}
            cameraBar={<CameraBar dark={dark} compact onPreset={onPreset} onSnapshot={snapshot} />}
          />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 z-30 flex flex-row items-start justify-between gap-3 p-3">
            <HikePanel dark={dark} error={error} readOnly={readOnly} onNew={() => onDemo(DEMO_HIKES[0])} {...hikeProps} />
            <StylePanel dark={dark} {...styleProps} />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3">
            <TrophiesButton dark={dark} onClick={openShelf} />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-3">
            <CameraBar dark={dark} onPreset={onPreset} onSnapshot={snapshot} />
          </div>
        </>
      )}

      {wantsTiles && (
        // Required attribution for OpenStreetMap tiles
        <div className="pointer-events-auto absolute z-30 rounded max-md:left-2 max-md:top-[calc(max(8px,env(safe-area-inset-top))+44px)] md:bottom-1 md:right-2 bg-white/75 px-1.5 py-0.5 text-[10px] text-stone-700 backdrop-blur">
          Map ©{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">
            OpenStreetMap contributors
          </a>
        </div>
      )}

      <TrophyShelf
        {...shelf}
        dark={dark}
        units={units}
        currentId={hike?.saved?.id}
        onClose={() => setShelf((s) => ({ ...s, open: false }))}
        onOpen={(h) => { setShelf((s) => ({ ...s, open: false })); navigate(`/h/${h.id}`) }}
        onDelete={removeHike}
        onExport={exportShelf}
        onImport={importShelf}
      />

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
