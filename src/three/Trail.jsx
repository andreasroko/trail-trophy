import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainY } from '../lib/terrain.js'

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

export default function Trail({ points, theme, scrub, animKey }) {
  const meshRef = useRef()
  const beadRef = useRef()
  const haloRef = useRef()
  const draw = useRef(0)
  const walk = useRef(0)

  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    return new THREE.TubeGeometry(curve, points.length * 2, RADIUS, 8, false)
  }, [points])
  useEffect(() => () => geometry.dispose(), [geometry])

  // Restart the "draw-on" animation whenever a new hike is loaded
  useEffect(() => { draw.current = 0; walk.current = 0 }, [animKey])

  const glow = theme.dark
  const trailColor = useMemo(() => {
    const c = new THREE.Color(theme.trail.color)
    return glow ? c.multiplyScalar(2.2) : c // HDR colour → picked up by bloom
  }, [theme, glow])

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
          color={trailColor}
          emissive={theme.trail.emissive}
          emissiveIntensity={theme.trail.emissiveIntensity}
          roughness={0.35}
          toneMapped={!glow}
        />
      </mesh>
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
