import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import {
  buildRadialSamples, buildTopGeometry, buildWallGeometry, buildPlinthGeometry,
  makeStrataTexture, makePlateTexture, PLINTH_DEPTH, PLINTH_PAD,
} from '../lib/geometry.js'
import { BASE_RADIUS, SLAB } from '../lib/terrain.js'

const niceInterval = (relief) => {
  const raw = relief / 14
  const p = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((v) => v >= raw) || 10 * p
}

/** MeshStandardMaterial + screen-space contour lines (fwidth) injected via onBeforeCompile. */
function useContourMaterial() {
  return useMemo(() => {
    const uniforms = {
      uSlab: { value: SLAB }, uMin: { value: 0 }, uScale: { value: 1 },
      uInterval: { value: 100 }, uMajor: { value: 0.5 }, uMinor: { value: 0.2 },
      uGlow: { value: 0 }, uContourColor: { value: new THREE.Color('#000') },
    }
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vElevY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvElevY = position.y;')
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying float vElevY;
          uniform float uSlab, uMin, uScale, uInterval, uMajor, uMinor, uGlow;
          uniform vec3 uContourColor;
          float contourLine(float v, float w) {
            float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-5);
            return 1.0 - smoothstep(0.0, w, d);
          }`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float meters = (vElevY - uSlab) / uScale + uMin;
          float cMajor = contourLine(meters / uInterval, 1.1) * uMajor;
          float cMinor = contourLine(meters / (uInterval * 0.2), 0.7) * uMinor;
          float cl = max(cMajor, cMinor);
          diffuseColor.rgb = mix(diffuseColor.rgb, uContourColor, cl);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += uContourColor * cl * uGlow;`,
        )
    }
    m.userData.uniforms = uniforms
    return m
  }, [])
}

export default function Terrain({ field, shape, exag, theme, contours, title, subtitle, mapTexture }) {
  const samples = useMemo(() => buildRadialSamples(field, shape), [field, shape])
  const topGeo = useMemo(() => buildTopGeometry(samples, field, exag, theme), [samples, field, exag, theme])
  const wallGeo = useMemo(() => buildWallGeometry(samples, field, exag), [samples, field, exag])
  const plinthGeo = useMemo(() => buildPlinthGeometry(shape), [shape])
  const strata = useMemo(() => makeStrataTexture(theme.strata, theme.dark), [theme])
  const plateTex = useMemo(() => makePlateTexture(title, subtitle, theme), [title, subtitle, theme])
  const material = useContourMaterial()

  useEffect(() => () => topGeo.dispose(), [topGeo])
  useEffect(() => () => wallGeo.dispose(), [wallGeo])
  useEffect(() => () => plinthGeo.dispose(), [plinthGeo])
  useEffect(() => () => strata.dispose(), [strata])
  useEffect(() => () => plateTex.dispose(), [plateTex])

  // Swapping map on/off changes shader defines (USE_MAP), so flag a recompile
  useEffect(() => {
    material.map = mapTexture || null
    material.needsUpdate = true
  }, [material, mapTexture])

  useEffect(() => {
    const u = material.userData.uniforms
    u.uMin.value = field.hMin
    u.uScale.value = exag / field.mpu
    u.uInterval.value = niceInterval(samples.hi - samples.lo)
    u.uMajor.value = contours ? theme.contour.strength : 0
    u.uMinor.value = contours ? theme.contour.minor : 0
    u.uGlow.value = theme.dark ? 0.9 : 0
    u.uContourColor.value.set(theme.contour.color)
  }, [material, field, exag, samples, contours, theme])

  // Nameplate on the front face of the plinth (+Z)
  const plateW = shape === 'circle' ? 2.4 : 3.2
  const frontZ = BASE_RADIUS + PLINTH_PAD + 0.004
  // polygon rings are sized by circumradius
  const rimR = BASE_RADIUS * (shape === 'hexagon' ? 1 / Math.cos(Math.PI / 6) : shape === 'square' ? Math.SQRT2 : 1)

  return (
    <group>
      <mesh geometry={topGeo} material={material} castShadow receiveShadow />
      <mesh geometry={wallGeo} castShadow receiveShadow>
        <meshStandardMaterial map={strata} roughness={0.9} color="#ffffff" />
      </mesh>
      <mesh geometry={plinthGeo} castShadow receiveShadow>
        <meshStandardMaterial color={theme.plinth} roughness={theme.dark ? 0.5 : 0.55} metalness={theme.dark ? 0.3 : 0.05} />
      </mesh>
      {theme.dark && (
        // neon rim line where the earth meets the plinth
        <mesh position={[0, 0.004, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[rimR + 0.02, rimR + 0.07, shape === 'circle' ? 128 : shape === 'square' ? 4 : 6, 1, shape === 'square' ? Math.PI / 4 : 0]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
      )}
      <mesh position={[0, -PLINTH_DEPTH / 2, shape === 'circle' ? frontZ + 0.02 : frontZ]}>
        <planeGeometry args={[plateW, plateW * 0.156]} />
        <meshStandardMaterial map={plateTex} metalness={theme.dark ? 0.2 : 0.65} roughness={0.35} />
      </mesh>
      {/* tabletop */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -PLINTH_DEPTH - 0.001, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color={theme.table} roughness={1} />
      </mesh>
    </group>
  )
}
