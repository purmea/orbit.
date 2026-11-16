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
  { el: 'hero', at: 'start', desktop: { x: 0, y: -0.16, yaw: -0.5, s: 1.1, follow: 0.4, orbit: 0 }, mobile: { x: 0, y: -0.06, yaw: -0.5, s: 0.56, follow: 0.3, orbit: 0 } },
  { el: 'sound', at: 'start', desktop: { x: 0.24, y: 0.02, yaw: -0.4, s: 0.95, follow: 0.15, orbit: 0 }, mobile: { x: 0, y: 0.13, yaw: -0.4, s: 0.58, follow: 0.15, orbit: 0 } },
  // a full turn on itself while the three story texts scroll by
  { el: 'sound', at: 'end', desktop: { x: -0.18, y: 0.08, yaw: -0.4 + Math.PI * 2, s: 0.9, follow: 0.15, orbit: 0 }, mobile: { x: 0, y: 0.13, yaw: -0.4 + Math.PI * 2, s: 0.58, follow: 0.15, orbit: 0 } },
  { el: 'specs', at: 'center', desktop: { x: -0.16, y: -0.04, yaw: 6.9, s: 0.8, follow: 0.3, orbit: 0 }, mobile: { x: 0, y: 0.04, yaw: 6.9, s: 0.52, follow: 0.2, orbit: 0 } },
  { el: 'finishes', at: 'center', desktop: { x: 0.19, y: 0.0, yaw: 5.9, s: 0.9, follow: 0.5, orbit: 0 }, mobile: { x: 0, y: 0.2, yaw: 5.9, s: 0.5, follow: 0.3, orbit: 0 } },
  { el: 'order', at: 'center', desktop: { x: 0, y: 0.2, yaw: 5.98, s: 0.75, follow: 0.25, orbit: 0.35 }, mobile: { x: 0, y: 0.22, yaw: 5.98, s: 0.5, follow: 0.2, orbit: 0.35 } },
  { el: 'faq', at: 'start', desktop: { x: 0.3, y: 0.3, yaw: 8.7, s: 0.45, follow: 0.25, orbit: 0.2 }, mobile: { x: 0, y: 0.32, yaw: 8.7, s: 0.36, follow: 0.2, orbit: 0.2 } },
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

/** Shortest signed difference between two angles. */
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a))

/**
 * Moves the drone like a real quadcopter: a slightly bouncy spring pulls it to each pose,
 * the nose turns into the direction of travel, it banks with acceleration and traces a
 * small figure-8 while hovering.
 */
function Flight({ color }: { color: string }) {
  const pos = useRef<THREE.Group>(null) // position + size
  const body = useRef<THREE.Group>(null) // heading, bank and pitch
  const viewport = useThree((s) => s.viewport)
  const size = useThree((s) => s.size)
  const poseAt = useFlightPath()
  const st = useRef({ x: 0, y: -2.6, vx: 0, vy: 0, ax: 0, ay: 0, yaw: -0.5, orbit: 0, born: -1 })
  const reduce = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useFrame((state, dt) => {
    const o = pos.current, b = body.current
    if (!o || !b) return
    const s = st.current
    const mobile = size.width < 768
    const p = poseAt(mobile)
    const t = state.clock.elapsedTime
    if (s.born < 0) s.born = t
    const intro = reduce ? 1 : Math.min(1, (t - s.born) / 2.2)
    s.orbit += reduce ? 0 : p.orbit * dt

    // target: pose + slow orbit + figure-8 hover
    const hover = reduce ? 0 : 1
    const tx = p.x * viewport.width + Math.sin(s.orbit) * p.orbit * (mobile ? 0.2 : 1.2) + Math.sin(t * 0.8) * (mobile ? 0.025 : 0.07) * hover
    const ty = p.y * viewport.height + Math.sin(t * 1.6) * 0.045 * hover

    // spring (underdamped: a hint of overshoot, like a real drone braking)
    const K = 22, C = 2 * 0.72 * Math.sqrt(K)
    let rest = Math.min(dt, 0.1)
    while (rest > 0) {
      const h = Math.min(rest, 1 / 120); rest -= h
      s.ax = (tx - s.x) * K - s.vx * C
      s.ay = (ty - s.y) * K - s.vy * C
      s.vx += s.ax * h; s.vy += s.ay * h
      s.x += s.vx * h; s.y += s.vy * h
    }
    o.position.set(s.x, s.y, 0)
    const e = 1 - Math.pow(1 - intro, 3)
    const sc = p.s * (mobile ? SIZE.mobile : SIZE.desktop) * (0.7 + 0.3 * e) * Math.min(1, viewport.width / 4.4 + 0.38)
    o.scale.setScalar(THREE.MathUtils.lerp(o.scale.x, sc, 1 - Math.pow(0.002, dt)))

    // heading: pose heading, turned towards the travel direction when moving sideways fast
    const px = state.pointer.x, py = state.pointer.y
    let yawT = p.yaw + px * p.follow + s.orbit * 0.6
    const side = THREE.MathUtils.clamp((Math.abs(s.vx) - 0.35) / 1.6, 0, 0.55)
    if (side > 0) {
      const travel = s.vx > 0 ? 0 : Math.PI
      yawT += angleDiff(yawT, travel + Math.round((yawT - travel) / (Math.PI * 2)) * Math.PI * 2) * side
    }
    s.yaw += (yawT - s.yaw) * (1 - Math.pow(0.02, dt))

    // attitude: bank with sideways acceleration and speed, nose dips when it speeds up
    const speed = Math.hypot(s.vx, s.vy)
    const roll = THREE.MathUtils.clamp(-s.vx * 0.07 - s.ax * 0.012, -0.55, 0.55) + Math.sin(t * 1.3) * 0.02 * hover
    const pitch = 0.26 + THREE.MathUtils.clamp(speed * 0.05 - s.vy * 0.03, -0.25, 0.3) - py * p.follow * 0.4
    const k = 1 - Math.pow(0.004, dt)
    b.rotation.order = 'YXZ'
    b.rotation.y = s.yaw
    b.rotation.z += (roll - b.rotation.z) * k
    b.rotation.x += (pitch - b.rotation.x) * k
  })

  return (
    <group ref={pos} position={[0, -2.6, 0]} scale={0.3}>
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
