import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/* ───────── small textures drawn once on a canvas (no image files) ───────── */
function radialTexture(stops: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  stops.forEach(([o, col]) => grad.addColorStop(o, col))
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A tapered propeller blade outline, extruded thin. */
function bladeGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0.02, -0.018)
  s.bezierCurveTo(0.12, -0.034, 0.26, -0.026, 0.315, -0.006)
  s.quadraticCurveTo(0.33, 0.004, 0.315, 0.012)
  s.bezierCurveTo(0.24, 0.026, 0.11, 0.03, 0.02, 0.018)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: false, curveSegments: 6 })
  g.rotateX(-Math.PI / 2) // lay flat
  return g
}

/* ───────── the fixed parts, merged: one mesh (one draw call) per material ───────── */
type Part = 'shell' | 'carbon' | 'canopy' | 'metal' | 'led' | 'ledRear' | 'lens'
type V3 = [number, number, number]
const ARMS: [number, number][] = [[0.82, 0.6], [-0.82, 0.6], [-0.82, -0.6], [0.82, -0.6]]

function buildBody() {
  const parts: Record<Part, THREE.BufferGeometry[]> = { shell: [], carbon: [], canopy: [], metal: [], led: [], ledRear: [], lens: [] }
  const outer = new THREE.Object3D(), inner = new THREE.Object3D()
  outer.add(inner)
  /** Places a geometry: `inner` transform inside an optional `outer` group transform. */
  const add = (part: Part, g: THREE.BufferGeometry, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], groupPos: V3 = [0, 0, 0], groupRot: V3 = [0, 0, 0]) => {
    outer.position.set(...groupPos); outer.rotation.set(...groupRot)
    inner.position.set(...pos); inner.rotation.set(...rot)
    outer.updateMatrixWorld(true)
    const geo = (g.index ? g.toNonIndexed() : g).applyMatrix4(inner.matrixWorld)
    geo.deleteAttribute('uv') // no textures on these parts
    parts[part].push(geo)
  }
  // body: shell, seam, canopy, front light bar, rear light, front sensors
  add('shell', new RoundedBoxGeometry(0.92, 0.24, 0.62, 3, 0.1))
  add('carbon', new RoundedBoxGeometry(0.94, 0.02, 0.64, 1, 0.01), [0, -0.02, 0])
  add('canopy', new RoundedBoxGeometry(0.58, 0.1, 0.42, 3, 0.05), [0.02, 0.15, 0])
  add('led', new THREE.BoxGeometry(0.02, 0.035, 0.34), [0.465, 0.02, 0])
  add('ledRear', new THREE.BoxGeometry(0.02, 0.03, 0.14), [-0.465, 0.03, 0])
  for (const z of [0.13, -0.13]) add('lens', new THREE.CylinderGeometry(0.03, 0.03, 0.012, 12), [0.462, 0.075, z], [0, 0, -Math.PI / 2])
  // arms and motors
  for (const [x, z] of ARMS) {
    const ang = Math.atan2(z, x), len = Math.hypot(x, z) - 0.28
    add('carbon', new THREE.CylinderGeometry(0.028, 0.045, len, 8), [0, 0, 0], [0, 0, Math.PI / 2], [x * 0.56, 0.02, z * 0.56], [0, -ang, 0])
    add('metal', new THREE.CylinderGeometry(0.072, 0.082, 0.13, 16), [x, 0.05, z])
    add('carbon', new THREE.CylinderGeometry(0.085, 0.085, 0.05, 16), [x, 0.05, z])
    add('led', new THREE.TorusGeometry(0.086, 0.007, 4, 24), [x, -0.005, z], [Math.PI / 2, 0, 0])
  }
  // camera gimbal
  const gp: V3 = [0.34, -0.15, 0]
  add('carbon', new THREE.BoxGeometry(0.08, 0.05, 0.16), [0, 0, 0], [0, 0, 0], gp)
  for (const z of [0.075, -0.075]) add('carbon', new THREE.BoxGeometry(0.03, 0.09, 0.015), [0.03, -0.05, z], [0, 0, 0], gp)
  add('shell', new THREE.SphereGeometry(0.07, 16, 12), [0.04, -0.08, 0], [0, 0, 0], gp)
  add('lens', new THREE.CylinderGeometry(0.04, 0.046, 0.04, 16), [0.1, -0.08, 0], [0, 0, Math.PI / 2], gp)
  add('led', new THREE.TorusGeometry(0.036, 0.004, 4, 20), [0.121, -0.08, 0], [0, Math.PI / 2, 0], gp)
  // landing skids
  for (const z of [0.2, -0.2]) {
    const lean = z > 0 ? -0.25 : 0.25
    add('carbon', new THREE.BoxGeometry(0.025, 0.13, 0.025), [0.1, -0.17, z], [lean, 0, 0])
    add('carbon', new THREE.BoxGeometry(0.025, 0.13, 0.025), [-0.2, -0.17, z], [lean, 0, 0])
    add('carbon', new THREE.CylinderGeometry(0.016, 0.016, 0.62, 6), [-0.05, -0.235, z * 1.08], [0, 0, Math.PI / 2])
  }
  return Object.fromEntries(Object.entries(parts).map(([k, list]) => [k, mergeGeometries(list)!])) as Record<Part, THREE.BufferGeometry>
}

/** One propeller (hub + two blades) as a single geometry, so each spinning prop is one draw call. */
function buildProp(blade: THREE.BufferGeometry) {
  const pieces = [
    new THREE.CylinderGeometry(0.032, 0.026, 0.04, 10).toNonIndexed(),
    blade.clone().rotateX(0.16),
    blade.clone().rotateY(Math.PI).rotateX(-0.16),
  ].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g })
  return mergeGeometries(pieces)!
}

type Glow = { pos: [number, number, number]; size: number; color: string; blink?: boolean }

/**
 * A quadcopter built from shapes, so every part can move on its own.
 * `color` is the shell colour (finish picker). Propellers spin, lights glow, the propwash ripples below.
 */
export const Drone = forwardRef<THREE.Group, { color: string }>(function Drone({ color }, ref) {
  const props = useRef<THREE.Group[]>([])
  const glows = useRef<THREE.Sprite[]>([])
  const wash = useRef<THREE.Mesh[]>([])

  const tex = useMemo(() => ({
    glow: radialTexture([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]),
    disc: radialTexture([[0, 'rgba(255,255,255,0)'], [0.55, 'rgba(255,255,255,0.05)'], [0.86, 'rgba(255,255,255,0.32)'], [0.97, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]),
  }), [])
  const body = useMemo(buildBody, [])
  const prop = useMemo(() => buildProp(bladeGeometry()), [])

  // standard (not physical/clearcoat) materials: same look under the environment light, far cheaper per pixel
  const shell = useMemo(() => new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.2, envMapIntensity: 1.25 }), [])
  const target = useMemo(() => new THREE.Color(color), [color])
  const mats = useMemo(() => ({
    canopy: new THREE.MeshStandardMaterial({ color: '#0a0c10', metalness: 0.3, roughness: 0.08, envMapIntensity: 1.4 }),
    carbon: new THREE.MeshStandardMaterial({ color: '#15171b', metalness: 0.55, roughness: 0.42 }),
    metal: new THREE.MeshStandardMaterial({ color: '#a7b0ba', metalness: 1, roughness: 0.22 }),
    blade: new THREE.MeshStandardMaterial({ color: '#1b1e24', metalness: 0.15, roughness: 0.45 }),
    disc: new THREE.MeshBasicMaterial({ map: tex.disc, color: '#c9d6ea', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    led: new THREE.MeshStandardMaterial({ color: '#5b9cff', emissive: '#5b9cff', emissiveIntensity: 2.2, toneMapped: false }),
    ledRear: new THREE.MeshStandardMaterial({ color: '#ff4d4d', emissive: '#ff4d4d', emissiveIntensity: 1.6, toneMapped: false }),
    lens: new THREE.MeshStandardMaterial({ color: '#04060a', metalness: 0.75, roughness: 0.05, envMapIntensity: 1.4 }),
    wash: new THREE.MeshBasicMaterial({ color: '#7fb0ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  }), [tex])

  const arms = ARMS
  const lights: Glow[] = [
    { pos: [0.47, 0.02, 0], size: 0.55, color: '#5b9cff' },
    { pos: [-0.47, 0.03, 0], size: 0.4, color: '#ff4d4d', blink: true },
    ...arms.map(([x, z]): Glow => ({ pos: [x, 0.0, z], size: 0.32, color: '#5b9cff' })),
    { pos: [0.47, -0.24, 0], size: 0.22, color: '#5b9cff' },
  ]

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    // 14 rad/s: fast enough to read as spinning, slow enough not to strobe at 60 fps (46 jumped ~44° a frame)
    props.current.forEach((p, i) => { if (p) p.rotation.y += (i % 2 ? -1 : 1) * Math.min(dt, 1 / 30) * 14 })
    shell.color.lerp(target, 1 - Math.pow(0.02, dt))

    const pulse = 1.8 + Math.sin(t * 3) * 0.6
    const blinkOn = Math.sin(t * 6) > 0.6
    mats.led.emissiveIntensity = pulse
    mats.ledRear.emissiveIntensity = blinkOn ? 2.4 : 0.3
    glows.current.forEach((s, i) => {
      if (!s) return
      const l = lights[i]
      ;(s.material as THREE.SpriteMaterial).opacity = l.blink ? (blinkOn ? 0.9 : 0.08) : 0.45 + Math.sin(t * 3) * 0.15
    })

    // propwash: two rings drop and fade under the drone, staggered
    wash.current.forEach((m, i) => {
      if (!m) return
      const u = (t * 0.7 + i * 0.5) % 1
      m.position.y = -0.3 - u * 0.55
      m.scale.setScalar(0.55 + u * 0.75)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.13 * Math.sin(u * Math.PI)
    })
  })

  return (
    <group ref={ref}>
      {/* every fixed part, merged per material */}
      <mesh geometry={body.shell} material={shell} />
      <mesh geometry={body.carbon} material={mats.carbon} />
      <mesh geometry={body.canopy} material={mats.canopy} />
      <mesh geometry={body.metal} material={mats.metal} />
      <mesh geometry={body.led} material={mats.led} />
      <mesh geometry={body.ledRear} material={mats.ledRear} />
      <mesh geometry={body.lens} material={mats.lens} />

      {/* the four spinning propellers, each one mesh, plus its speed disc */}
      {arms.map(([x, z], i) => (
        <group key={i} position={[x, 0.13, z]} ref={(el) => { if (el) props.current[i] = el }}>
          <mesh geometry={prop} material={mats.blade} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={mats.disc}><circleGeometry args={[0.34, 32]} /></mesh>
        </group>
      ))}

      {/* light halos (always face the camera) */}
      {lights.map((l, i) => (
        <sprite key={i} position={l.pos} scale={l.size} ref={(el) => { if (el) glows.current[i] = el }}>
          <spriteMaterial map={tex.glow} color={l.color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}

      {/* propwash rings */}
      {[0, 1].map((i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} material={mats.wash.clone()} ref={(el) => { if (el) wash.current[i] = el }}>
          <ringGeometry args={[0.55, 0.57, 40]} />
        </mesh>
      ))}
    </group>
  )
})
