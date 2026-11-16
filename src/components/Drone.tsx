import { forwardRef, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

/**
 * A quadcopter built from simple shapes, so every part can move on its own.
 * `color` is the shell colour (finish picker). The four propellers spin every frame.
 */
export const Drone = forwardRef<THREE.Group, { color: string }>(function Drone({ color }, ref) {
  const props = useRef<THREE.Group[]>([])
  const shell = useMemo(() => new THREE.MeshPhysicalMaterial({ color, metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12 }), [])
  const target = useMemo(() => new THREE.Color(color), [color])
  const mats = useMemo(() => ({
    canopy: new THREE.MeshPhysicalMaterial({ color: '#0b0d12', metalness: 0.2, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }),
    carbon: new THREE.MeshStandardMaterial({ color: '#16181c', metalness: 0.5, roughness: 0.45 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa3ad', metalness: 1, roughness: 0.25 }),
    blade: new THREE.MeshStandardMaterial({ color: '#1d2026', metalness: 0.1, roughness: 0.5 }),
    blur: new THREE.MeshBasicMaterial({ color: '#9fb6d9', transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    led: new THREE.MeshStandardMaterial({ color: '#5b9cff', emissive: '#5b9cff', emissiveIntensity: 2.2, toneMapped: false }),
    ledRear: new THREE.MeshStandardMaterial({ color: '#ff4d4d', emissive: '#ff4d4d', emissiveIntensity: 1.6, toneMapped: false }),
    lens: new THREE.MeshPhysicalMaterial({ color: '#05070a', metalness: 0.6, roughness: 0.05, clearcoat: 1 }),
  }), [])

  useFrame((state, dt) => {
    // propellers: fast spin, opposite directions on each diagonal like a real quad
    props.current.forEach((p, i) => { if (p) p.rotation.y += (i % 2 ? -1 : 1) * dt * 42 })
    shell.color.lerp(target, 1 - Math.pow(0.02, dt))
    const t = state.clock.elapsedTime
    mats.led.emissiveIntensity = 1.8 + Math.sin(t * 3) * 0.6
    mats.ledRear.emissiveIntensity = Math.sin(t * 6) > 0.6 ? 2.4 : 0.4 // navigation blink
  })

  const arms: [number, number][] = [[0.82, 0.6], [-0.82, 0.6], [-0.82, -0.6], [0.82, -0.6]]

  return (
    <group ref={ref}>
      {/* body */}
      <RoundedBox args={[0.9, 0.24, 0.62]} radius={0.1} smoothness={6} material={shell} />
      <RoundedBox args={[0.56, 0.1, 0.4]} radius={0.05} smoothness={4} position={[0.02, 0.15, 0]} material={mats.canopy} />
      {/* front light bar and rear blink */}
      <mesh position={[0.455, 0.02, 0]} material={mats.led}><boxGeometry args={[0.02, 0.035, 0.36]} /></mesh>
      <mesh position={[-0.455, 0.03, 0]} material={mats.ledRear}><boxGeometry args={[0.02, 0.03, 0.14]} /></mesh>

      {/* arms, motors, propellers */}
      {arms.map(([x, z], i) => {
        const len = Math.hypot(x, z) - 0.25
        const ang = Math.atan2(z, x)
        return (
          <group key={i}>
            <mesh position={[x * 0.55, 0.02, z * 0.55]} rotation={[0, -ang, 0]} material={mats.carbon}>
              <boxGeometry args={[len, 0.05, 0.07]} />
            </mesh>
            <mesh position={[x, 0.05, z]} material={mats.metal}><cylinderGeometry args={[0.075, 0.085, 0.13, 24]} /></mesh>
            <mesh position={[x, 0.005, z]} material={mats.led}><torusGeometry args={[0.088, 0.008, 8, 32]} /></mesh>
            <group position={[x, 0.13, z]} ref={(el) => { if (el) props.current[i] = el }}>
              <mesh material={mats.metal}><cylinderGeometry args={[0.03, 0.03, 0.04, 16]} /></mesh>
              {[0, Math.PI].map((r) => (
                <mesh key={r} rotation={[0.12, r, 0]} position={[Math.cos(r) * 0.16, 0, -Math.sin(r) * 0.16]} material={mats.blade}>
                  <boxGeometry args={[0.32, 0.012, 0.055]} />
                </mesh>
              ))}
              {/* spinning blur disc */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} material={mats.blur}><circleGeometry args={[0.33, 48]} /></mesh>
            </group>
          </group>
        )
      })}

      {/* camera gimbal under the nose */}
      <group position={[0.36, -0.17, 0]}>
        <mesh material={mats.carbon}><boxGeometry args={[0.06, 0.08, 0.06]} /></mesh>
        <mesh position={[0.02, -0.07, 0]} material={shell}><sphereGeometry args={[0.085, 32, 24]} /></mesh>
        <mesh position={[0.095, -0.07, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.lens}><cylinderGeometry args={[0.042, 0.048, 0.03, 32]} /></mesh>
        <mesh position={[0.112, -0.07, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.led}><torusGeometry args={[0.04, 0.005, 8, 32]} /></mesh>
      </group>

      {/* landing skids */}
      {[0.2, -0.2].map((z) => (
        <group key={z}>
          <mesh position={[0.12, -0.17, z]} material={mats.carbon}><boxGeometry args={[0.03, 0.12, 0.03]} /></mesh>
          <mesh position={[-0.18, -0.17, z]} material={mats.carbon}><boxGeometry args={[0.03, 0.12, 0.03]} /></mesh>
          <mesh position={[-0.03, -0.235, z]} rotation={[0, 0, Math.PI / 2]} material={mats.carbon}><cylinderGeometry args={[0.018, 0.018, 0.6, 12]} /></mesh>
        </group>
      ))}
    </group>
  )
})
