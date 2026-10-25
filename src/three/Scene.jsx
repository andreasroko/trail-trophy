import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, TiltShift2, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import Terrain from './Terrain.jsx'
import Trail, { useTrailPoints } from './Trail.jsx'
import Markers from './Markers.jsx'
import Trees from './Trees.jsx'
import { terrainY } from '../lib/terrain.js'

/** Smoothly flies camera + orbit target to a preset; any user drag cancels the flight. */
function CameraRig({ preset, summit }) {
  const { camera, controls } = useThree()
  const goal = useRef(null)
  const summitRef = useRef(summit)
  summitRef.current = summit

  // Only re-fly when a preset is (re)selected — not when the summit moves due to exaggeration
  useEffect(() => {
    if (!preset) return
    const s = summitRef.current
    // Back off on portrait / narrow viewports so the whole base stays in frame
    const k = Math.max(1, 1.45 / Math.max(0.5, camera.aspect))
    const presets = {
      showcase: { pos: [14.5 * k, 12.5 * k, 17 * k], target: [0, 0.6, 0] },
      top: { pos: [0, 27 * k, 0.02], target: [0, 0, 0] },
      summit: { pos: [s.x + 3.6, s.y + 2.8, s.z + 4.6], target: [s.x, s.y + 0.35, s.z] },
    }
    const p = presets[preset.name]
    goal.current = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target) }
  }, [preset])

  useEffect(() => {
    if (!controls) return
    const cancel = () => (goal.current = null)
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls])

  useFrame((_, dt) => {
    if (!goal.current || !controls) return
    const k = 1 - Math.exp(-dt * 3.5)
    camera.position.lerp(goal.current.pos, k)
    controls.target.lerp(goal.current.target, k)
    controls.update()
    if (camera.position.distanceTo(goal.current.pos) < 0.01 && controls.target.distanceTo(goal.current.target) < 0.01) {
      goal.current = null
    }
  })
  return null
}

function Lights({ theme }) {
  const key = useRef()
  useEffect(() => {
    const l = key.current
    l.shadow.camera.left = l.shadow.camera.bottom = -9
    l.shadow.camera.right = l.shadow.camera.top = 9
    l.shadow.camera.near = 1
    l.shadow.camera.far = 50
    l.shadow.camera.updateProjectionMatrix()
  }, [])
  return (
    <>
      <directionalLight
        ref={key}
        position={[-8, 13, 6]}
        color={theme.key.color}
        intensity={theme.key.intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={4}
      />
      <hemisphereLight args={[theme.fill.sky, theme.fill.ground, theme.fill.intensity]} />
      <ambientLight color="#b9ccff" intensity={theme.dark ? 0.15 : 0.22} />
      {theme.dark && <directionalLight position={[9, 4, -8]} color="#22d3ee" intensity={0.8} />}
    </>
  )
}

export default function Scene({ field, geo, route, metrics, settings, theme, preset, scrub, animKey, title, subtitle, units, mapTexture }) {
  const { shape, exaggeration: exag } = settings
  const points = useTrailPoints(route, field, exag)

  const markers = useMemo(() => {
    const at = (p) => [p.x, terrainY(field, p.x, p.z, exag), p.z]
    const w = geo.world
    return { start: at(w[0]), finish: at(w[w.length - 1]), summit: at(w[metrics.peakIdx]) }
  }, [geo, field, exag, metrics])
  const summitVec = useMemo(() => ({ x: markers.summit[0], y: markers.summit[1], z: markers.summit[2] }), [markers])

  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.background = new THREE.Color(theme.background)
    scene.fog = new THREE.Fog(theme.background, 28, 60)
  }, [scene, theme])

  const peakLabel = units === 'imperial'
    ? `Summit · ${Math.round(metrics.peakM * 3.28084).toLocaleString()} ft`
    : `Summit · ${Math.round(metrics.peakM).toLocaleString()} m`

  return (
    <>
      <Lights theme={theme} />
      <Terrain field={field} shape={shape} exag={exag} theme={theme} contours={settings.contours} title={title} subtitle={subtitle} mapTexture={theme.mapTiles ? mapTexture : null} />
      {settings.trees && theme.id !== 'tactical' && !theme.mapTiles && <Trees field={field} shape={shape} exag={exag} route={route} theme={theme} />}
      <Trail points={points} theme={theme} scrub={scrub} animKey={animKey} />
      <Markers {...markers} isLoop={metrics.isLoop} theme={theme} showLabels={settings.labels} summitLabel={peakLabel} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={settings.autoRotate}
        autoRotateSpeed={0.6}
        minDistance={3}
        maxDistance={40}
        maxPolarAngle={Math.PI * 0.49}
      />
      <CameraRig preset={preset} summit={summitVec} />

      <EffectComposer key={settings.tiltShift ? 'ts' : 'plain'} multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={theme.bloom} />
        {settings.tiltShift && <TiltShift2 blur={0.22} taper={0.32} start={[0, 0.48]} end={[1, 0.48]} direction={[1, 0]} samples={12} />}
        {settings.tiltShift && <TiltShift2 blur={0.22} taper={0.32} start={[0, 0.48]} end={[1, 0.48]} direction={[0, 1]} samples={12} />}
        <Vignette eskil={false} offset={0.25} darkness={theme.dark ? 0.75 : 0.45} />
      </EffectComposer>
    </>
  )
}
