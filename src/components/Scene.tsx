import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { Drone } from './Drone'

/* ─────────────────────────────────────────────────────────────
   Flight path: where the drone hovers for each part of the page.
   `el` is a section id, `at` is which moment of that section:
     'center' → section centred on screen, 'start' / 'end' → its first / last screen.
   x / y are fractions of the screen (-0.5 left/bottom … 0.5 right/top),
   yaw is the heading in radians (0 = nose to the right), s is a size multiplier,
   follow is how much it leans towards the cursor, orbit makes it circle slowly.
   The drone flies BEHIND the text: crossing a heading is intended.
   ───────────────────────────────────────────────────────────── */
/** Overall drone size. Raise it for a bigger drone, lower it for a smaller one. */
const SIZE = { desktop: 1.6, mobile: 1.3 }

type Pose = { x: number; y: number; yaw: number; s: number; follow: number; orbit: number }
type Key = { el: string; at: 'center' | 'start' | 'end'; desktop: Pose; mobile: Pose }

const choreography: Key[] = [
  { el: 'hero', at: 'start', desktop: { x: 0, y: -0.16, yaw: -0.5, s: 1.1, follow: 0.4, orbit: 0 }, mobile: { x: 0, y: -0.1, yaw: -0.5, s: 0.62, follow: 0.3, orbit: 0 } },
  { el: 'sound', at: 'start', desktop: { x: 0.24, y: 0.02, yaw: 2.6, s: 0.95, follow: 0.15, orbit: 0 }, mobile: { x: 0.18, y: 0.27, yaw: 2.6, s: 0.5, follow: 0.15, orbit: 0 } },
  { el: 'sound', at: 'end', desktop: { x: -0.18, y: 0.08, yaw: 0.6, s: 0.9, follow: 0.15, orbit: 0 }, mobile: { x: -0.18, y: 0.27, yaw: 0.6, s: 0.5, follow: 0.15, orbit: 0 } },
  { el: 'specs', at: 'center', desktop: { x: -0.16, y: -0.04, yaw: 0.9, s: 0.8, follow: 0.3, orbit: 0 }, mobile: { x: 0.2, y: 0.3, yaw: 2.2, s: 0.42, follow: 0.2, orbit: 0 } },
  { el: 'finishes', at: 'center', desktop: { x: 0.19, y: 0.0, yaw: -0.4, s: 0.9, follow: 0.5, orbit: 0 }, mobile: { x: 0, y: 0.28, yaw: -0.4, s: 0.55, follow: 0.3, orbit: 0 } },
  { el: 'order', at: 'center', desktop: { x: 0, y: 0.2, yaw: -0.3, s: 0.75, follow: 0.25, orbit: 0.35 }, mobile: { x: 0, y: 0.22, yaw: -0.3, s: 0.55, follow: 0.2, orbit: 0.35 } },
  { el: 'faq', at: 'start', desktop: { x: 0.3, y: 0.3, yaw: 2.4, s: 0.45, follow: 0.25, orbit: 0.2 }, mobile: { x: 0.28, y: 0.34, yaw: 2.4, s: 0.32, follow: 0.2, orbit: 0.2 } },
]

const smooth = (t: number) => t * t * (3 - 2 * t)
const lerp = THREE.MathUtils.lerp

/** Reads the page layout and returns the pose for the current scroll position. */
function useFlightPath() {
  const anchors = useRef<number[]>([])
  useEffect(() => {
    const measure = () => {
      const vh = innerHeight
      anchors.current = choreography.map((k) => {
        const el = document.getElementById(k.el)
        if (!el) return 0
        const top = el.getBoundingClientRect().top + scrollY, h = el.offsetHeight
        return k.at === 'start' ? Math.max(0, top - vh * 0.15) : k.at === 'end' ? top + h - vh : top + h / 2 - vh / 2
      })
      for (let i = 1; i < anchors.current.length; i++) anchors.current[i] = Math.max(anchors.current[i], anchors.current[i - 1] + 1)
    }
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
        return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), yaw: lerp(p.yaw, q.yaw, t), s: lerp(p.s, q.s, t), follow: lerp(p.follow, q.follow, t), orbit: lerp(p.orbit, q.orbit, t) }
      }
    }
    return pose(a.length - 1)
  }
}

/** Moves the drone like a real quadcopter: it banks into the direction it travels and hovers with a light bob. */
function Flight({ color }: { color: string }) {
  const pos = useRef<THREE.Group>(null) // position + size
  const body = useRef<THREE.Group>(null) // heading, bank and pitch
  const viewport = useThree((s) => s.viewport)
  const size = useThree((s) => s.size)
  const poseAt = useFlightPath()
  const vel = useRef(new THREE.Vector2())
  const orbitAngle = useRef(0)
  const intro = useRef(0)
  const reduce = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useFrame((state, dt) => {
    const o = pos.current, b = body.current
    if (!o || !b) return
    const step = Math.min(dt, 0.05) // for speed estimates only
    const mobile = size.width < 768
    const p = poseAt(mobile)
    const t = state.clock.elapsedTime

    if (intro.current === 0) intro.current = t || 0.0001 // remember when the drone appeared
    const introT = reduce ? 1 : Math.min(1, (t - intro.current) / 2)
    const e = 1 - Math.pow(1 - introT, 3)
    orbitAngle.current += reduce ? 0 : p.orbit * dt

    // target position on screen (+ take-off from below during the intro, + hover bob)
    const tx = p.x * viewport.width + Math.sin(orbitAngle.current) * p.orbit * (mobile ? 0.5 : 1.2)
    const ty = p.y * viewport.height - (1 - e) * 2.2 + (reduce ? 0 : Math.sin(t * 1.6) * 0.05 + Math.sin(t * 0.7) * 0.03)
    const k = 1 - Math.pow(0.004, dt)
    const nx = lerp(o.position.x, tx, k), ny = lerp(o.position.y, ty, k)
    vel.current.lerp(new THREE.Vector2((nx - o.position.x) / step, (ny - o.position.y) / step), 1 - Math.pow(0.01, step))
    o.position.set(nx, ny, 0)
    const sc = p.s * (mobile ? SIZE.mobile : SIZE.desktop) * (0.75 + 0.25 * e) * Math.min(1, viewport.width / 4.4 + 0.38)
    o.scale.setScalar(lerp(o.scale.x, sc, k))

    // attitude: bank (roll) against horizontal speed, nose dips when climbing fast, lean to the cursor
    const vx = vel.current.x, vy = vel.current.y
    const px = state.pointer.x, py = state.pointer.y
    const yaw = p.yaw + px * p.follow + orbitAngle.current * 0.6
    b.rotation.order = 'YXZ'
    b.rotation.y = lerp(b.rotation.y, yaw, k * 0.8)
    b.rotation.z = lerp(b.rotation.z, THREE.MathUtils.clamp(-vx * 0.09, -0.5, 0.5) + Math.sin(t * 1.3) * 0.02, k)
    b.rotation.x = lerp(b.rotation.x, 0.28 + THREE.MathUtils.clamp(vy * 0.05, -0.3, 0.3) - py * p.follow * 0.4, k)
  })

  return (
    <group ref={pos} position={[0, -3, 0]}>
      <group ref={body}><Drone color={color} /></group>
    </group>
  )
}

/** One fixed 3D layer behind the page content. It never blocks clicks; pointer moves come from the page. */
export function Scene({ tint }: { tint: string }) {
  const webgl = useMemo(() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
  }, [])
  if (!webgl) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.6, 6], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        eventSource={document.body}
        eventPrefix="client"
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <Suspense fallback={null}>
          <Flight color={tint} />
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={2.4} position={[0, 4, 1]} scale={[8, 2, 1]} rotation-x={Math.PI / 2} />
            <Lightformer form="rect" intensity={1.5} position={[-4, 1, 1]} scale={[2, 6, 1]} rotation-y={Math.PI / 2} />
            <Lightformer form="rect" intensity={1.5} position={[4, 1, 1]} scale={[2, 6, 1]} rotation-y={-Math.PI / 2} />
            <Lightformer form="ring" color="#5b9cff" intensity={3} position={[0, 0.5, -4]} scale={3} />
          </Environment>
        </Suspense>
      </Canvas>
    </div>
  )
}
