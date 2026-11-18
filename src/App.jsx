import { Suspense, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useNavigate, useParams } from 'react-router-dom'
import { Upload } from 'lucide-react'
import Scene from './three/Scene.jsx'
import { HikePanel, StylePanel, CameraBar } from './ui/Panels.jsx'
import { AccountButton, SignInDialog, SaveButton, TrophyShelf } from './ui/Account.jsx'
import { saveHike, listMyHikes, getMyHike, updateHike, deleteHike, pickSavedSettings, getSharedHike, shareUrl } from './data/hikes.js'
import { useAuth } from './data/auth.jsx'
import { parseGPX } from './lib/gpx.js'
import { DEMO_HIKES } from './lib/demoHikes.js'
import { THEMES } from './lib/themes.js'
import { fmtDist, fmtEle } from './ui/format.js'
import { useDiorama } from './hooks/useDiorama.js'

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
  // The hike on screen: its raw GPX (kept so it can be saved later), the parsed track, and which demo it is
  const [hike, setHike] = useState(null)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(DEFAULTS)
  const [units, setUnits] = useState('metric')
  const [preset, setPreset] = useState({ name: 'showcase', n: 0 })
  const [scrub, setScrub] = useState(null)
  const [animKey, setAnimKey] = useState(0)
  const [pageDrag, setPageDrag] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const closeSignIn = useCallback(() => setSignInOpen(false), [])
  const { user, ready } = useAuth()
  const { hikeId, shareSlug } = useParams() // /h/:hikeId = one of your hikes · /t/:shareSlug = someone's public hike
  const readOnly = !!shareSlug
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
      if (hikeId || shareSlug) navigate('/')
    } catch (e) {
      setError(e.message || 'Could not read that GPX file.')
    }
  }, [showHike, hikeId, shareSlug, navigate])

  const onFile = useCallback((file) => {
    if (!/\.gpx$/i.test(file.name) && !/xml/.test(file.type)) {
      setError('Please drop a .gpx file.')
      return
    }
    file.text().then((t) => loadText(t))
  }, [loadText])

  const onDemo = useCallback((d) => loadText(d.gpx(), d.id), [loadText])

  // Boot with the first demo so the diorama renders immediately
  // What to show for the current URL: the demo on "/", or one of your saved hikes on "/h/:id"
  useEffect(() => {
    const showDemo = () => showHike(DEMO_HIKES[0].gpx(), { demoId: DEMO_HIKES[0].id })
    if (shareSlug) {
      if (hike?.shared?.shareSlug === shareSlug) return
      let cancelled = false
      getSharedHike(shareSlug)
        .then(({ hike: shared, gpxText }) => {
          if (cancelled) return
          showHike(gpxText, { settings: shared.settings })
          setHike((h) => ({ ...h, shared }))
        })
        .catch(() => {
          if (cancelled) return
          if (!hike) showDemo() // before setError: showing a hike clears errors
          navigate('/', { replace: true })
          setError("That shared hike doesn't exist or is no longer public.")
        })
      return () => { cancelled = true }
    }
    if (!hikeId) { if (!hike) showDemo(); return }
    if (hike?.saved?.id === hikeId || !ready) return
    if (!user) {
      if (!hike) showDemo()
      setError('Sign in to open this saved hike.')
      setSignInOpen(true)
      return
    }
    let cancelled = false
    getMyHike(hikeId)
      .then(({ hike: saved, gpxText }) => {
        if (cancelled) return
        showHike(gpxText, { settings: saved.settings })
        setHike((h) => ({ ...h, saved }))
      })
      .catch((e) => {
        if (cancelled) return
        if (!hike) showDemo() // before setError: showing a hike clears errors
        setError(`Couldn't open that hike: ${e.message}`)
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hikeId, shareSlug, ready, user?.id])

  // Signing out leaves your private hike URL
  useEffect(() => {
    if (ready && !user && hike?.saved) {
      setHike((h) => ({ ...h, saved: null }))
      if (hikeId) navigate('/')
    }
  }, [ready, user, hike?.saved, hikeId, navigate])

  const openShelf = async () => {
    setShelf((s) => ({ ...s, open: true, loading: true, error: null }))
    try {
      setShelf({ open: true, list: await listMyHikes(), loading: false, error: null })
    } catch (e) {
      setShelf((s) => ({ ...s, loading: false, error: e.message }))
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
      setHike((h) => (h && h.gpxText === hike.gpxText ? { ...h, saved } : h))
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

  const togglePublic = async () => {
    setSaving(true)
    try {
      const saved = await updateHike(hike.saved.id, { isPublic: !hike.saved.isPublic })
      setHike((h) => (h?.saved?.id === saved.id ? { ...h, saved } : h))
    } catch (e) {
      setError(`Couldn't change sharing: ${e.message}`)
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
          activeDemo={hike?.demoId ?? null}
          onScrub={setScrub}
          error={error}
          readOnly={readOnly}
          onNew={() => onDemo(DEMO_HIKES[0])}
          saveSlot={
            <SaveButton
              dark={dark}
              signedIn={!!user}
              saved={!!hike?.saved}
              dirty={dirty}
              busy={saving}
              onSaveStyle={saveStyle}
              readOnly={readOnly}
              isPublic={!!hike?.saved?.isPublic}
              link={hike?.saved?.isPublic ? shareUrl(hike.saved) : null}
              onTogglePublic={togglePublic}
              onSignIn={() => setSignInOpen(true)}
              onSave={save}
            />
          }
        />
        <StylePanel dark={dark} settings={settings} set={set} demStatus={demStatus} osmStatus={wantsTiles ? osm.status : 'idle'} defaultOpen={!isNarrow} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-3 hidden justify-center px-3 lg:flex">
        <AccountButton dark={dark} onSignIn={() => setSignInOpen(true)} onOpenTrophies={openShelf} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-3">
        <div className="lg:hidden">
          <AccountButton dark={dark} onSignIn={() => setSignInOpen(true)} onOpenTrophies={openShelf} />
        </div>
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

      <SignInDialog open={signInOpen} onClose={closeSignIn} dark={dark} />
      <TrophyShelf
        {...shelf}
        dark={dark}
        units={units}
        currentId={hike?.saved?.id}
        onClose={() => setShelf((s) => ({ ...s, open: false }))}
        onOpen={(h) => { setShelf((s) => ({ ...s, open: false })); navigate(`/h/${h.id}`) }}
        onDelete={removeHike}
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
