import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Center, ContactShadows, Environment, Lightformer, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { product } from '../config'

/* ─────────────────────────────────────────────────────────────
   Choreography: where the speaker sits for each part of the page.
   `el` is a section id, `at` is which moment of that section:
     'center' → section centred on screen, 'start' / 'end' → its first / last screen.
   x / y are fractions of the screen (-0.5 left/bottom … 0.5 right/top),
   rot is [x, y, z] in radians, s is a size multiplier,
   follow is how much it leans towards the cursor, spin is a constant turn (rad/s).
   ───────────────────────────────────────────────────────────── */
type Pose = { x: number; y: number; rot: [number, number, number]; s: number; follow: number; spin: number }
type Key = { el: string; at: 'center' | 'start' | 'end'; desktop: Pose; mobile: Pose }

const corner: Pose = { x: 0.3, y: 0.34, rot: [0.15, 0.6, 0], s: 0.32, follow: 0.25, spin: 0.25 }

const choreography: Key[] = [
  { el: 'hero', at: 'start', desktop: { x: 0, y: -0.2, rot: [0.06, -0.35, 0], s: 0.92, follow: 0.45, spin: 0 }, mobile: { x: 0, y: -0.1, rot: [0.06, -0.35, 0], s: 0.75, follow: 0.3, spin: 0 } },
  { el: 'sound', at: 'start', desktop: { x: 0.22, y: -0.02, rot: [0.12, -0.7, 0], s: 1.0, follow: 0.15, spin: 0 }, mobile: { ...corner, y: 0.3, s: 0.42 } },
  { el: 'sound', at: 'end', desktop: { x: 0.22, y: -0.02, rot: [0.18, -0.7 + Math.PI * 1.6, 0], s: 1.0, follow: 0.15, spin: 0 }, mobile: { ...corner, y: 0.3, s: 0.42, rot: [0.18, 4.4, 0] } },
  { el: 'specs', at: 'center', desktop: { x: -0.27, y: 0.0, rot: [0.45, 5.6, -0.2], s: 0.78, follow: 0.3, spin: 0 }, mobile: { ...corner, rot: [0.4, 5.6, -0.2] } },
  { el: 'finishes', at: 'center', desktop: { x: 0.21, y: -0.03, rot: [0.05, 6.55, 0], s: 0.95, follow: 0.5, spin: 0 }, mobile: { ...corner, rot: [0.05, 6.55, 0] } },
  { el: 'order', at: 'center', desktop: { x: 0, y: 0.23, rot: [0.12, 6.28, 0], s: 0.58, follow: 0.25, spin: 0.45 }, mobile: { x: 0, y: 0.2, rot: [0.12, 6.28, 0], s: 0.5, follow: 0.2, spin: 0.45 } },
  { el: 'faq', at: 'start', desktop: { ...corner, rot: [0.15, 7.2, 0] }, mobile: { ...corner, rot: [0.15, 7.2, 0] } },
]

const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = THREE.MathUtils.lerp

/** Reads the page layout and returns the pose for the current scroll position. */
function useChoreography() {
  const anchors = useRef<number[]>([])
  const measure = () => {
    const vh = innerHeight
    anchors.current = choreography.map((k) => {
      const el = document.getElementById(k.el)
      if (!el) return 0
      const top = el.getBoundingClientRect().top + scrollY, h = el.offsetHeight
      return k.at === 'start' ? Math.max(0, top - vh * 0.15) : k.at === 'end' ? top + h - vh : top + h / 2 - vh / 2
    })
    // keep the list increasing even if sections are short
    for (let i = 1; i < anchors.current.length; i++) anchors.current[i] = Math.max(anchors.current[i], anchors.current[i - 1] + 1)
  }
  useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.body)
    addEventListener('load', measure)
    return () => { ro.disconnect(); removeEventListener('load', measure) }
  }, [])

  return (mobile: boolean): Pose => {
    const a = anchors.current, y = scrollY
    const pose = (i: number) => (mobile ? choreography[i].mobile : choreography[i].desktop)
    if (!a.length || y <= a[0]) return pose(0)
    for (let i = 0; i < a.length - 1; i++) {
      if (y <= a[i + 1]) {
        const t = smooth((y - a[i]) / (a[i + 1] - a[i]))
        const p = pose(i), q = pose(i + 1)
        return {
          x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), s: lerp(p.s, q.s, t),
          follow: lerp(p.follow, q.follow, t), spin: lerp(p.spin, q.spin, t),
          rot: [lerp(p.rot[0], q.rot[0], t), lerp(p.rot[1], q.rot[1], t), lerp(p.rot[2], q.rot[2], t)],
        }
      }
    }
    return pose(a.length - 1)
  }
}

function Speaker({ tint }: { tint: string }) {
  const { scene } = useGLTF(product.modelUrl)
  const outer = useRef<THREE.Group>(null) // position + size (shadow travels with it)
  const inner = useRef<THREE.Group>(null) // rotation
  const viewport = useThree((s) => s.viewport)
  const size = useThree((s) => s.size)
  const poseAt = useChoreography()
  const spinAngle = useRef(0)
  const intro = useRef(0)
  const reduce = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  const model = useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) { const m = (mesh.material as THREE.MeshStandardMaterial).clone(); m.envMapIntensity = 1.2; mesh.material = m }
    })
    const box = new THREE.Box3().setFromObject(s)
    s.scale.setScalar(2.6 / box.getSize(new THREE.Vector3()).length())
    return s
  }, [scene])
  const materials = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = []
    model.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m) list.push(m) })
    return list
  }, [model])
  const target = useMemo(() => new THREE.Color(tint), [tint])

  useFrame((state, dt) => {
    const o = outer.current, g = inner.current
    if (!o || !g) return
    const k = 1 - Math.pow(0.0005, dt) // smoothing, frame-rate independent
    const mobile = size.width < 768
    const p = poseAt(mobile)
    const t = state.clock.elapsedTime

    // entrance: drops in and turns into place
    intro.current = reduce ? 1 : Math.min(1, intro.current + dt / 1.6)
    const e = 1 - Math.pow(1 - intro.current, 3)

    spinAngle.current += reduce ? 0 : p.spin * dt
    const px = state.pointer.x, py = state.pointer.y

    o.position.x = lerp(o.position.x, p.x * viewport.width, k * 0.5)
    o.position.y = lerp(o.position.y, p.y * viewport.height + (1 - e) * 1.2 + Math.sin(t * 1.1) * 0.04, k * 0.5)
    const sc = p.s * (0.6 + 0.4 * e) * Math.min(1, viewport.width / 4.2 + 0.25)
    o.scale.setScalar(lerp(o.scale.x, sc, k * 0.5))

    g.rotation.x = lerp(g.rotation.x, p.rot[0] - py * p.follow * 0.5, k * 0.5)
    g.rotation.y = lerp(g.rotation.y, p.rot[1] + spinAngle.current + px * p.follow + (1 - e) * -1.6, k * 0.5)
    g.rotation.z = lerp(g.rotation.z, p.rot[2], k * 0.5)

    const beat = 0.75 + 0.5 * Math.max(0, Math.sin(t * 7.5)) ** 6
    materials.forEach((m) => { m.color.lerp(target, k * 0.2); if (m.emissiveMap) m.emissiveIntensity = beat })
  })

  return (
    <group ref={outer} position={[0, 2, 0]} scale={0.6}>
      <group ref={inner}><Center><primitive object={model} /></Center></group>
      <ContactShadows position={[0, -1.05, 0]} opacity={0.3} scale={4} blur={2.8} far={2} />
    </group>
  )
}
useGLTF.preload(product.modelUrl)

/** One fixed 3D layer for the whole page. It never blocks clicks; pointer moves come from the page. */
export function Scene({ tint }: { tint: string }) {
  const webgl = useMemo(() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
  }, [])
  if (!webgl) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.1, 6], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        eventSource={document.body}
        eventPrefix="client"
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 3]} intensity={1.4} />
        <Suspense fallback={null}>
          <Speaker tint={tint} />
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={2.2} position={[0, 4, 1]} scale={[8, 2, 1]} rotation-x={Math.PI / 2} />
            <Lightformer form="rect" intensity={1.4} position={[-4, 1, 1]} scale={[2, 6, 1]} rotation-y={Math.PI / 2} />
            <Lightformer form="rect" intensity={1.4} position={[4, 1, 1]} scale={[2, 6, 1]} rotation-y={-Math.PI / 2} />
            <Lightformer form="ring" color="#5b9cff" intensity={3} position={[0, 0.5, -4]} scale={3} />
          </Environment>
        </Suspense>
      </Canvas>
    </div>
  )
}
