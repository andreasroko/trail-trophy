import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mulberry32 } from '../lib/noise.js'
import { sampleField, terrainY, shapeRadius } from '../lib/terrain.js'

const MAX = 520

/** Scatter low-poly conifers on gentle, lower slopes, keeping clear of the trail. */
export default function Trees({ field, shape, exag, route, theme }) {
  const crowns = useRef()
  const trunks = useRef()

  const spots = useMemo(() => {
    const rand = mulberry32(42)
    const out = []
    const lo = field.hMin, span = Math.max(1, field.hMax - field.hMin)
    const step = route.length > 200 ? 3 : 1
    for (let tries = 0; tries < 9000 && out.length < MAX; tries++) {
      const th = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * shapeRadius(shape, th) * 0.94
      const x = Math.cos(th) * r, z = Math.sin(th) * r
      const m = sampleField(field, x, z)
      const t = (m - lo) / span
      if (t > 0.5 + rand() * 0.08) continue
      // slope in true scale (meters per meter)
      const e = 0.06
      const gx = (sampleField(field, x + e, z) - sampleField(field, x - e, z)) / (2 * e * field.mpu)
      const gz = (sampleField(field, x, z + e) - sampleField(field, x, z - e)) / (2 * e * field.mpu)
      if (Math.hypot(gx, gz) > 0.7) continue
      let near = false
      for (let k = 0; k < route.length; k += step) {
        if ((route[k].x - x) ** 2 + (route[k].z - z) ** 2 < 0.03) { near = true; break }
      }
      if (near) continue
      out.push({ x, z, s: 0.65 + rand() * 0.6, rot: rand() * Math.PI, tint: rand() })
    }
    return out
  }, [field, shape, route])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    const ca = new THREE.Color(theme.tree[0]), cb = new THREE.Color(theme.tree[1]), c = new THREE.Color()
    spots.forEach((t, i) => {
      const y = terrainY(field, t.x, t.z, exag)
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot)
      s.setScalar(t.s)
      p.set(t.x, y + 0.12 * t.s, t.z)
      m.compose(p, q, s)
      crowns.current.setMatrixAt(i, m)
      crowns.current.setColorAt(i, c.copy(ca).lerp(cb, t.tint))
      p.set(t.x, y + 0.02 * t.s, t.z)
      m.compose(p, q, s)
      trunks.current.setMatrixAt(i, m)
    })
    crowns.current.count = trunks.current.count = spots.length
    crowns.current.instanceMatrix.needsUpdate = trunks.current.instanceMatrix.needsUpdate = true
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true
    crowns.current.computeBoundingSphere()
    trunks.current.computeBoundingSphere()
  }, [spots, field, exag, theme])

  return (
    <group>
      <instancedMesh ref={crowns} args={[null, null, MAX]} castShadow receiveShadow>
        <coneGeometry args={[0.065, 0.2, 6]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[null, null, MAX]} castShadow>
        <cylinderGeometry args={[0.012, 0.014, 0.05, 5]} />
        <meshStandardMaterial color={theme.id === 'clay' ? '#cdbfa6' : '#4a3626'} roughness={1} />
      </instancedMesh>
    </group>
  )
}
