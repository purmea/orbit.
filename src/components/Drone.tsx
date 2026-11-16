import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

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
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 16 })
  g.rotateX(-Math.PI / 2) // lay flat
  return g
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
  const blade = useMemo(bladeGeometry, [])

  const shell = useMemo(() => new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.1 }), [])
  const target = useMemo(() => new THREE.Color(color), [color])
  const mats = useMemo(() => ({
    canopy: new THREE.MeshPhysicalMaterial({ color: '#0a0c10', metalness: 0.25, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }),
    carbon: new THREE.MeshStandardMaterial({ color: '#15171b', metalness: 0.55, roughness: 0.42 }),
    metal: new THREE.MeshStandardMaterial({ color: '#a7b0ba', metalness: 1, roughness: 0.22 }),
    blade: new THREE.MeshStandardMaterial({ color: '#1b1e24', metalness: 0.15, roughness: 0.45 }),
    disc: new THREE.MeshBasicMaterial({ map: tex.disc, color: '#c9d6ea', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    led: new THREE.MeshStandardMaterial({ color: '#5b9cff', emissive: '#5b9cff', emissiveIntensity: 2.2, toneMapped: false }),
    ledRear: new THREE.MeshStandardMaterial({ color: '#ff4d4d', emissive: '#ff4d4d', emissiveIntensity: 1.6, toneMapped: false }),
    lens: new THREE.MeshPhysicalMaterial({ color: '#04060a', metalness: 0.7, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0 }),
    wash: new THREE.MeshBasicMaterial({ color: '#7fb0ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  }), [tex])

  const arms: [number, number][] = [[0.82, 0.6], [-0.82, 0.6], [-0.82, -0.6], [0.82, -0.6]]
  const lights: Glow[] = [
    { pos: [0.47, 0.02, 0], size: 0.55, color: '#5b9cff' },
    { pos: [-0.47, 0.03, 0], size: 0.4, color: '#ff4d4d', blink: true },
    ...arms.map(([x, z]): Glow => ({ pos: [x, 0.0, z], size: 0.32, color: '#5b9cff' })),
    { pos: [0.47, -0.24, 0], size: 0.22, color: '#5b9cff' },
  ]

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    props.current.forEach((p, i) => { if (p) p.rotation.y += (i % 2 ? -1 : 1) * dt * 46 })
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
      {/* body: shell, glossy canopy, seam, front obstacle sensors */}
      <RoundedBox args={[0.92, 0.24, 0.62]} radius={0.1} smoothness={6} material={shell} />
      <RoundedBox args={[0.94, 0.02, 0.64]} radius={0.01} smoothness={2} position={[0, -0.02, 0]} material={mats.carbon} />
      <RoundedBox args={[0.58, 0.1, 0.42]} radius={0.05} smoothness={5} position={[0.02, 0.15, 0]} material={mats.canopy} />
      <mesh position={[0.465, 0.02, 0]} material={mats.led}><boxGeometry args={[0.02, 0.035, 0.34]} /></mesh>
      <mesh position={[-0.465, 0.03, 0]} material={mats.ledRear}><boxGeometry args={[0.02, 0.03, 0.14]} /></mesh>
      {[0.13, -0.13].map((z) => (
        <mesh key={z} position={[0.462, 0.075, z]} rotation={[0, 0, -Math.PI / 2]} material={mats.lens}><cylinderGeometry args={[0.03, 0.03, 0.012, 24]} /></mesh>
      ))}

      {/* tapered arms, finned motors, profiled propellers with a speed disc */}
      {arms.map(([x, z], i) => {
        const ang = Math.atan2(z, x), len = Math.hypot(x, z) - 0.28
        return (
          <group key={i}>
            <group position={[x * 0.56, 0.02, z * 0.56]} rotation={[0, -ang, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} material={mats.carbon}><cylinderGeometry args={[0.028, 0.045, len, 16]} /></mesh>
            </group>
            <mesh position={[x, 0.05, z]} material={mats.metal}><cylinderGeometry args={[0.072, 0.082, 0.13, 32]} /></mesh>
            <mesh position={[x, 0.05, z]} material={mats.carbon}><cylinderGeometry args={[0.085, 0.085, 0.05, 32]} /></mesh>
            <mesh position={[x, -0.005, z]} rotation={[Math.PI / 2, 0, 0]} material={mats.led}><torusGeometry args={[0.086, 0.007, 8, 40]} /></mesh>
            <group position={[x, 0.13, z]} ref={(el) => { if (el) props.current[i] = el }}>
              <mesh material={mats.metal}><cylinderGeometry args={[0.032, 0.026, 0.04, 20]} /></mesh>
              <mesh geometry={blade} material={mats.blade} rotation={[0.16, 0, 0]} />
              <mesh geometry={blade} material={mats.blade} rotation={[-0.16, Math.PI, 0]} />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={mats.disc}><circleGeometry args={[0.34, 56]} /></mesh>
            </group>
          </group>
        )
      })}

      {/* camera gimbal: yoke + ball + lens with a lit ring */}
      <group position={[0.34, -0.15, 0]}>
        <mesh material={mats.carbon}><boxGeometry args={[0.08, 0.05, 0.16]} /></mesh>
        {[0.075, -0.075].map((z) => <mesh key={z} position={[0.03, -0.05, z]} material={mats.carbon}><boxGeometry args={[0.03, 0.09, 0.015]} /></mesh>)}
        <mesh position={[0.04, -0.08, 0]} material={shell}><sphereGeometry args={[0.07, 32, 24]} /></mesh>
        <mesh position={[0.1, -0.08, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.lens}><cylinderGeometry args={[0.04, 0.046, 0.04, 32]} /></mesh>
        <mesh position={[0.121, -0.08, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.led}><torusGeometry args={[0.036, 0.004, 8, 32]} /></mesh>
      </group>

      {/* landing skids */}
      {[0.2, -0.2].map((z) => (
        <group key={z}>
          <mesh position={[0.1, -0.17, z]} rotation={[z > 0 ? -0.25 : 0.25, 0, 0]} material={mats.carbon}><boxGeometry args={[0.025, 0.13, 0.025]} /></mesh>
          <mesh position={[-0.2, -0.17, z]} rotation={[z > 0 ? -0.25 : 0.25, 0, 0]} material={mats.carbon}><boxGeometry args={[0.025, 0.13, 0.025]} /></mesh>
          <mesh position={[-0.05, -0.235, z * 1.08]} rotation={[0, 0, Math.PI / 2]} material={mats.carbon}><cylinderGeometry args={[0.016, 0.016, 0.62, 12]} /></mesh>
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
          <ringGeometry args={[0.55, 0.57, 64]} />
        </mesh>
      ))}
    </group>
  )
})
