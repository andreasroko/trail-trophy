import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

function Label({ children, dark, accent }) {
  return (
    <div
      className={`tt-label rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-lg backdrop-blur-md ${
        dark ? 'bg-slate-900/70 text-slate-100 ring-1 ring-white/15' : 'bg-white/80 text-stone-800 ring-1 ring-black/5'
      }`}
    >
      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: accent }} />
      {children}
    </div>
  )
}

function Pin({ position, color, color2, label, showLabel, dark }) {
  const h = 0.6
  return (
    <group position={position}>
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.03, 20]} />
        <meshStandardMaterial color={dark ? '#334155' : '#57534e'} roughness={0.6} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, h, 8]} />
        <meshStandardMaterial color="#d6d3d1" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, h, 0]} castShadow>
        <sphereGeometry args={[0.095, 24, 24]} />
        <meshStandardMaterial color={color} roughness={0.3} emissive={color} emissiveIntensity={dark ? 0.8 : 0.08} />
      </mesh>
      {color2 && (
        <mesh position={[0, h, 0]} rotation-z={Math.PI / 2} castShadow>
          <sphereGeometry args={[0.097, 24, 24, 0, Math.PI]} />
          <meshStandardMaterial color={color2} roughness={0.3} emissive={color2} emissiveIntensity={dark ? 0.8 : 0.08} />
        </mesh>
      )}
      {showLabel && (
        <Html position={[0, h + 0.12, 0]} center zIndexRange={[20, 0]}>
          <Label dark={dark} accent={color}>{label}</Label>
        </Html>
      )}
    </group>
  )
}

function SummitFlag({ position, color, label, showLabel, dark }) {
  const flagRef = useRef()
  const flagGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.42, 0.26, 12, 4)
    g.translate(0.21, 0, 0)
    g.userData.base = g.attributes.position.array.slice()
    return g
  }, [])
  const stones = useMemo(
    () => [
      { y: 0.05, s: [0.2, 0.09, 0.17], r: 0.2, c: '#8b8580' },
      { y: 0.15, s: [0.15, 0.075, 0.13], r: 1.1, c: '#a8a29e' },
      { y: 0.235, s: [0.11, 0.06, 0.1], r: 2.3, c: '#78716c' },
      { y: 0.3, s: [0.07, 0.045, 0.065], r: 0.7, c: '#a8a29e' },
    ],
    [],
  )

  useFrame(({ clock }) => {
    const pos = flagGeo.attributes.position
    const base = flagGeo.userData.base
    const t = clock.elapsedTime
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]
      pos.array[i * 3 + 2] = Math.sin(x * 14 - t * 5) * x * 0.12
    }
    pos.needsUpdate = true
    flagGeo.computeVertexNormals()
  })

  const poleH = 0.85
  return (
    <group position={position}>
      {stones.map((st, i) => (
        <mesh key={i} position={[0, st.y, 0]} rotation-y={st.r} scale={st.s} castShadow receiveShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={dark ? '#475569' : st.c} roughness={0.9} flatShading />
        </mesh>
      ))}
      <mesh position={[0, 0.3 + poleH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.012, 0.014, poleH, 8]} />
        <meshStandardMaterial color="#e7e5e4" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh ref={flagRef} geometry={flagGeo} position={[0.012, 0.3 + poleH - 0.14, 0]} castShadow>
        <meshStandardMaterial color={color} side={THREE.DoubleSide} roughness={0.6} emissive={color} emissiveIntensity={dark ? 0.35 : 0.1} />
      </mesh>
      {showLabel && (
        <Html position={[0, 0.3 + poleH + 0.12, 0]} center zIndexRange={[20, 0]}>
          <Label dark={dark} accent={color}>{label}</Label>
        </Html>
      )}
    </group>
  )
}

export default function Markers({ start, finish, summit, isLoop, theme, showLabels, summitLabel }) {
  const m = theme.marker
  return (
    <group>
      {isLoop ? (
        <Pin position={start} color={m.start} color2={m.finish} label="Start / Finish" showLabel={showLabels} dark={theme.dark} />
      ) : (
        <>
          <Pin position={start} color={m.start} label="Start" showLabel={showLabels} dark={theme.dark} />
          <Pin position={finish} color={m.finish} label="Finish" showLabel={showLabels} dark={theme.dark} />
        </>
      )}
      <SummitFlag position={summit} color={m.flag} label={summitLabel} showLabel={showLabels} dark={theme.dark} />
    </group>
  )
}
