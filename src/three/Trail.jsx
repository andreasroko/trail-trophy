import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainY } from '../lib/terrain.js'
import { gradeAtFrac, gradeRGB } from '../lib/insights.js'

const RADIUS = 0.034
const LIFT = 0.05 // float above the surface to avoid z-fighting

/** Interpolate a point along the evenly-resampled route at fraction f ∈ [0,1]. */
export function pointAt(points, f) {
  const x = Math.min(1, Math.max(0, f)) * (points.length - 1)
  const i = Math.min(points.length - 2, Math.floor(x))
  return points[i].clone().lerp(points[i + 1], x - i)
}

export function useTrailPoints(route, field, exag) {
  return useMemo(
    () => route.map((p) => new THREE.Vector3(p.x, terrainY(field, p.x, p.z, exag) + LIFT, p.z)),
    [route, field, exag],
  )
}

/** Outline around the part of the trail that's selected (a climb or a split). */
function Highlight({ points, focus, glow }) {
  const geometry = useMemo(() => {
    const n = points.length - 1
    const i0 = Math.max(0, Math.floor(focus.f0 * n)), i1 = Math.min(n, Math.ceil(focus.f1 * n))
    const pts = points.slice(i0, i1 + 1)
    if (pts.length < 2) return null
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    return new THREE.TubeGeometry(curve, pts.length * 2, RADIUS * 2.6, 10, false)
  }, [points, focus])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return (
    <mesh geometry={geometry} renderOrder={2}>
      {/* Back faces only: reads as an outline around the trail without hiding its steepness colours */}
      <meshBasicMaterial color={glow ? '#7dd3fc' : '#1c1917'} side={THREE.BackSide} transparent opacity={glow ? 0.35 : 1} />
    </mesh>
  )
}

export default function Trail({ points, theme, scrub, animKey, grades, gradeColors, focus }) {
  const meshRef = useRef()
  const beadRef = useRef()
  const haloRef = useRef()
  const draw = useRef(0)
  const walk = useRef(0)

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    const tube = new THREE.TubeGeometry(curve, points.length * 2, RADIUS, 8, false)
    if (grades) {
      // One colour per ring of the tube, from the steepness at that point along the trail
      const rings = tube.parameters.tubularSegments + 1, ring = tube.parameters.radialSegments + 1
      const col = new Float32Array(rings * ring * 3)
      for (let i = 0; i < rings; i++) {
        const [r, g, b] = gradeRGB(gradeAtFrac(grades, i / (rings - 1)))
        for (let j = 0; j < ring; j++) col.set([r, g, b], (i * ring + j) * 3)
      }
      tube.setAttribute('color', new THREE.BufferAttribute(col, 3))
    }
    return tube
  }, [points, grades])
  useEffect(() => () => geometry.dispose(), [geometry])

  // Restart the "draw-on" animation whenever a new hike is loaded
  useEffect(() => { draw.current = 0; walk.current = 0 }, [animKey])

  const glow = theme.dark
  const byGrade = gradeColors && !!grades
  const trailColor = useMemo(() => {
    const c = new THREE.Color(byGrade ? '#ffffff' : theme.trail.color)
    return glow ? c.multiplyScalar(byGrade ? 1.8 : 2.2) : c // HDR colour → picked up by bloom
  }, [theme, glow, byGrade])

  useFrame((state, dt) => {
    if (draw.current < 1) {
      draw.current = Math.min(1, draw.current + dt / 2.2)
      const e = 1 - (1 - draw.current) ** 3
      const total = geometry.index.count
      geometry.setDrawRange(0, Math.floor((total * e) / 6) * 6)
    }
    else walk.current = (walk.current + dt / 16) % 1
    const f = scrub ?? (draw.current < 1 ? draw.current : walk.current)
    const p = pointAt(points, f)
    beadRef.current.position.copy(p)
    haloRef.current.position.copy(p)
    const s = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.15
    haloRef.current.scale.setScalar(s)
  })

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} castShadow>
        <meshStandardMaterial
          key={byGrade ? 'grade' : 'theme'}
          color={trailColor}
          vertexColors={byGrade}
          emissive={byGrade ? '#000000' : theme.trail.emissive}
          emissiveIntensity={byGrade ? 0 : theme.trail.emissiveIntensity}
          roughness={0.35}
          toneMapped={!glow}
        />
      </mesh>
      {focus && <Highlight points={points} focus={focus} glow={glow} />}
      {/* hiker bead */}
      <mesh ref={beadRef} castShadow>
        <sphereGeometry args={[0.075, 20, 20]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={glow ? 2 : 0.4} toneMapped={!glow} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshBasicMaterial color={theme.trail.emissive} transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
