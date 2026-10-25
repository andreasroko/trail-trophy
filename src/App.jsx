import { Suspense, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useNavigate, useParams } from 'react-router-dom'
import { Upload } from 'lucide-react'
import Scene from './three/Scene.jsx'
import { HikePanel, StylePanel, CameraBar } from './ui/Panels.jsx'
import { AccountBar, SignInDialog, SaveControls, TrophyShelf } from './ui/Account.jsx'
import { parseGPX } from './lib/gpx.js'
import { DEMO_HIKES } from './lib/demoHikes.js'
import { THEMES } from './lib/themes.js'
import { fmtDist, fmtEle } from './ui/format.js'
import { useDiorama } from './hooks/useDiorama.js'
import { useAuth } from './data/auth.jsx'
import { repo, hikeMeta, pickSavedSettings } from './data/repo.js'

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

// A hike the user tried to save while signed out survives the sign-in redirect here.
const PENDING_KEY = 'tt:pending-save'
const stashPending = (v) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(v)) } catch { /* storage blocked */ } }
const takePending = () => {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null')
    localStorage.removeItem(PENDING_KEY)
    return v
  } catch { return null }
}

const sameSettings = (a, b) => JSON.stringify(pickSavedSettings(a)) === JSON.stringify(pickSavedSettings(b))

export default function App() {
  const { hikeId, shareSlug } = useParams()
  const navigate = useNavigate()
  const { user, ready, cloud } = useAuth()

  const [track, setTrack] = useState(null)
  const [gpxText, setGpxText] = useState(null)
  const [activeDemo, setActiveDemo] = useState(null)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState(DEFAULTS)
  const [units, setUnits] = useState('metric')
  const [preset, setPreset] = useState({ name: 'showcase', n: 0 })
  const [scrub, setScrub] = useState(null)
  const [animKey, setAnimKey] = useState(0)
  const [pageDrag, setPageDrag] = useState(false)

  const [saved, setSaved] = useState(null) // the persisted Hike currently shown (yours), or null
  const [busy, setBusy] = useState(false)
  const [hikes, setHikes] = useState({ list: [], loading: false, error: null })
  const [shelfOpen, setShelfOpen] = useState(false)
  const [signIn, setSignIn] = useState({ open: false, reason: null })

  const glRef = useRef()
  const pendingRef = useRef(null)
  const readOnly = !!shareSlug

  const set = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])
  const theme = THEMES[settings.theme] || THEMES.satellite
  const exag = useDeferredValue(settings.exaggeration)
  const { geo, route, field, eles, metrics, demStatus, osm, wantsTiles } = useDiorama(track, settings, theme)

  // ---------------------------------------------------------------- loading

  const showText = useCallback((text, demoId = null) => {
    const t = parseGPX(text) // throws with a readable message
    setTrack(t)
    setGpxText(text)
    setActiveDemo(demoId)
    setError(null)
    setAnimKey((k) => k + 1)
    setPreset({ name: 'showcase', n: Date.now() })
  }, [])

  /** A brand-new hike (upload or demo): leaves any saved/shared URL. */
  const startNew = useCallback((text, demoId = null) => {
    try {
      showText(text, demoId)
      setSaved(null)
      if (hikeId || shareSlug) navigate('/')
    } catch (e) {
      setError(e.message || 'Could not read that GPX file.')
    }
  }, [showText, hikeId, shareSlug, navigate])

  const onFile = useCallback((file) => {
    if (!/\.gpx$/i.test(file.name) && !/xml/.test(file.type)) { setError('Please drop a .gpx file.'); return }
    file.text().then((t) => startNew(t))
  }, [startNew])

  const onDemo = useCallback((d) => startNew(d.gpx(), d.id), [startNew])

  // Route → what to show
  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const fail = (e) => !cancelled && setError(e.message || 'Could not load that hike.')

    if (hikeId) {
      if (saved?.id === hikeId) return
      if (cloud && !user) {
        setError('Sign in to open this hike.')
        setSignIn({ open: true, reason: 'This hike is saved to an account.' })
        if (!track) showText(DEMO_HIKES[0].gpx(), DEMO_HIKES[0].id)
        return
      }
      repo.get(hikeId).then(({ hike, gpxText: text }) => {
        if (cancelled) return
        showText(text)
        setSettings({ ...DEFAULTS, ...hike.settings })
        setSaved(hike)
      }).catch(fail)
    } else if (shareSlug) {
      repo.getShared(shareSlug).then(({ hike, gpxText: text }) => {
        if (cancelled) return
        showText(text)
        setSettings({ ...DEFAULTS, ...hike.settings })
        setSaved(null)
      }).catch((e) => { fail(e); if (!track) showText(DEMO_HIKES[0].gpx(), DEMO_HIKES[0].id) })
    } else if (!track) {
      const pending = takePending()
      if (pending) {
        try {
          showText(pending.gpxText, pending.demoId)
          setSettings({ ...DEFAULTS, ...pending.settings })
          pendingRef.current = pending
        } catch { showText(DEMO_HIKES[0].gpx(), DEMO_HIKES[0].id) }
      } else {
        showText(DEMO_HIKES[0].gpx(), DEMO_HIKES[0].id)
      }
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hikeId, shareSlug, ready, user?.id])

  useEffect(() => { document.title = track ? `${track.name} · Trail Trophy` : 'Trail Trophy' }, [track])

  // ---------------------------------------------------------------- persistence

  const refreshHikes = useCallback(async () => {
    if (!user) { setHikes({ list: [], loading: false, error: null }); return }
    setHikes((h) => ({ ...h, loading: true, error: null }))
    try {
      setHikes({ list: await repo.list(), loading: false, error: null })
    } catch (e) {
      setHikes({ list: [], loading: false, error: e.message })
    }
  }, [user])
  useEffect(() => { refreshHikes() }, [refreshHikes])

  // Signing out hides anything account-bound
  useEffect(() => {
    if (ready && cloud && !user && saved) { setSaved(null); if (hikeId) navigate('/') }
  }, [ready, cloud, user, saved, hikeId, navigate])

  const save = useCallback(async () => {
    if (!track || !metrics || !gpxText) return
    if (!user) {
      stashPending({ gpxText, demoId: activeDemo, settings: pickSavedSettings(settings) })
      // pending saves resume on '/', where the boot logic picks them up
      setSignIn({ open: true, reason: 'Sign in to keep this hike in your trophy collection. It will be saved as soon as you are back.', redirectPath: '/' })
      return
    }
    setBusy(true)
    try {
      const hike = await repo.create({ meta: hikeMeta(track, metrics), settings: pickSavedSettings(settings), gpxText })
      setSaved(hike)
      setHikes((h) => ({ ...h, list: [hike, ...h.list] }))
      navigate(`/h/${hike.id}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [track, metrics, gpxText, user, activeDemo, settings, navigate])

  // Finish a save that was interrupted by the sign-in redirect
  useEffect(() => {
    if (pendingRef.current && user && metrics && gpxText) {
      pendingRef.current = null
      save()
    }
  }, [user, metrics, gpxText, save])

  const patchSaved = async (patch) => {
    setBusy(true)
    try {
      const hike = await repo.update(saved.id, patch)
      setSaved(hike)
      setHikes((h) => ({ ...h, list: h.list.map((x) => (x.id === hike.id ? hike : x)) }))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const removeHike = async (h) => {
    try {
      await repo.remove(h.id)
      setHikes((s) => ({ ...s, list: s.list.filter((x) => x.id !== h.id) }))
      if (saved?.id === h.id) { setSaved(null); navigate('/') }
    } catch (e) {
      setHikes((s) => ({ ...s, error: e.message }))
    }
  }

  const dirty = !!saved && !sameSettings(settings, { ...DEFAULTS, ...saved.settings })

  // ---------------------------------------------------------------- misc

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
          activeDemo={saved || readOnly ? null : activeDemo}
          onScrub={setScrub}
          error={error}
          readOnly={readOnly}
          onNew={() => onDemo(DEMO_HIKES[0])}
          saveSlot={
            <SaveControls
              dark={dark}
              saved={saved}
              dirty={dirty}
              readOnly={readOnly}
              busy={busy}
              onSave={save}
              onRemix={save}
              onUpdate={() => patchSaved({ settings: pickSavedSettings(settings) })}
              onTogglePublic={() => patchSaved({ isPublic: !saved.isPublic })}
            />
          }
        />
        <StylePanel dark={dark} settings={settings} set={set} demStatus={demStatus} osmStatus={wantsTiles ? osm.status : 'idle'} defaultOpen={!isNarrow} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-3 hidden justify-center px-3 lg:flex">
        <AccountBar dark={dark} count={hikes.list.length} onOpenShelf={() => { setShelfOpen(true); refreshHikes() }} onSignIn={() => setSignIn({ open: true, reason: null })} />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center gap-2 px-3">
        <div className="lg:hidden">
          <AccountBar dark={dark} count={hikes.list.length} onOpenShelf={() => { setShelfOpen(true); refreshHikes() }} onSignIn={() => setSignIn({ open: true, reason: null })} />
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

      <SignInDialog open={signIn.open} reason={signIn.reason} redirectPath={signIn.redirectPath} dark={dark} onClose={() => setSignIn({ open: false, reason: null })} />
      <TrophyShelf
        open={shelfOpen}
        onClose={() => setShelfOpen(false)}
        dark={dark}
        hikes={hikes.list}
        loading={hikes.loading && hikes.list.length === 0}
        error={hikes.error}
        units={units}
        currentId={saved?.id}
        onOpen={(h) => { setShelfOpen(false); navigate(`/h/${h.id}`) }}
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
