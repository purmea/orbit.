import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { Drone } from './Drone'

/* ─────────────────────────────────────────────────────────────
   Flight path: where the drone hovers for each part of the page.
   `el` is a section id, `at` is which moment of that section:
     'center' → section centred on screen, 'start' / 'end' → its first / last screen.
   x / y are fractions of the screen (-0.5 left/bottom … 0.5 right/top),
   s is a size multiplier, turn counts full turns on itself: going from one section to the next
   with turn +1 makes it spin once, level, while it travels. At rest it faces the viewer.
   Each pose puts it in the empty part of its section, and it never leaves the screen.
   ───────────────────────────────────────────────────────────── */
/** Overall drone size. Raise it for a bigger drone, lower it for a smaller one. */
const SIZE = { desktop: 1.6, mobile: 1.3 }

/** The one heading the drone keeps everywhere (radians): camera facing the viewer, turned a touch for a 3/4 look. */
const HEADING = -1.32
/** How far it turns towards the cursor, at most (radians). Small, so it always reads as straight. */
const FOLLOW = 0.08

type Pose = { x: number; y: number; s: number; turn: number }
type Key = { el: string; at: 'center' | 'start' | 'end'; desktop: Pose; mobile: Pose }

const choreography: Key[] = [
  // hero: centred, between the title and the text
  { el: 'hero', at: 'start', desktop: { x: 0, y: -0.04, s: 1, turn: 0 }, mobile: { x: 0, y: -0.05, s: 0.56, turn: 0 } },
  // story: text on the left, so the drone holds the right side
  { el: 'sound', at: 'start', desktop: { x: 0.2, y: 0.02, s: 0.82, turn: 1 }, mobile: { x: 0, y: 0.17, s: 0.56, turn: 1 } },
  { el: 'sound', at: 'end', desktop: { x: 0.2, y: 0.02, s: 0.82, turn: 1 }, mobile: { x: 0, y: 0.17, s: 0.56, turn: 1 } },
  // specs: numbers on the right, drone on the left
  { el: 'specs', at: 'center', desktop: { x: -0.25, y: -0.03, s: 0.62, turn: 2 }, mobile: { x: 0, y: -0.39, s: 0.46, turn: 2 } },
  // finishes: colour list on the left, drone on the right
  { el: 'finishes', at: 'center', desktop: { x: 0.25, y: 0, s: 0.64, turn: 3 }, mobile: { x: 0, y: -0.36, s: 0.48, turn: 3 } },
  // order: price in the middle, drone above it
  { el: 'order', at: 'center', desktop: { x: 0, y: 0.22, s: 0.72, turn: 4 }, mobile: { x: 0, y: 0.23, s: 0.5, turn: 4 } },
  // faq: questions on the right, drone under the heading on the left
  { el: 'faq', at: 'start', desktop: { x: -0.27, y: -0.14, s: 0.5, turn: 5 }, mobile: { x: 0.2, y: 0.33, s: 0.3, turn: 5 } },
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
        return { x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t), s: lerp(p.s, q.s, t), turn: lerp(p.turn, q.turn, t) }
      }
    }
    return pose(a.length - 1)
  }
}

/**
 * Moves the drone between poses with a critically damped spring (no overshoot), a gentle
 * hover bob, and a fixed level attitude: no banking, no spinning, same heading all along.
 */
function Flight({ color }: { color: string }) {
  const pos = useRef<THREE.Group>(null) // position + size
  const body = useRef<THREE.Group>(null) // heading (fixed) and a level attitude
  const viewport = useThree((s) => s.viewport)
  const size = useThree((s) => s.size)
  const poseAt = useFlightPath()
  const st = useRef({ x: 0, y: -2.6, vx: 0, vy: 0, yaw: HEADING, born: -1 })
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

    // size first, so the position can keep the whole drone on screen
    const e = 1 - Math.pow(1 - intro, 3)
    const sc = p.s * (mobile ? SIZE.mobile : SIZE.desktop) * (0.7 + 0.3 * e) * Math.min(1, viewport.width / 4.4 + 0.38)
    o.scale.setScalar(THREE.MathUtils.lerp(o.scale.x, sc, 1 - Math.pow(0.002, dt)))
    const halfW = o.scale.x * 1.55, halfH = o.scale.x * 0.6 // drone half-extent with its propellers
    const maxX = Math.max(0, viewport.width / 2 - halfW - 0.08), maxY = Math.max(0, viewport.height / 2 - halfH - 0.08)

    // target: the pose, plus a small hover bob
    const bob = reduce ? 0 : 1
    const tx = THREE.MathUtils.clamp(p.x * viewport.width + Math.sin(t * 0.7) * 0.03 * bob, -maxX, maxX)
    const ty = THREE.MathUtils.clamp(p.y * viewport.height + Math.sin(t * 1.4) * 0.04 * bob, -maxY, maxY)

    // critically damped spring: glides to each spot and stops without overshooting
    const K = 18, C = 2 * Math.sqrt(K)
    let rest = Math.min(dt, 0.1)
    while (rest > 0) {
      const h = Math.min(rest, 1 / 120); rest -= h
      s.vx += ((tx - s.x) * K - s.vx * C) * h
      s.vy += ((ty - s.y) * K - s.vy * C) * h
      s.x += s.vx * h; s.y += s.vy * h
    }
    o.position.set(s.x, s.y, 0)

    // level, but alive: one full turn per section change (scroll-linked), a slow idle sway at rest,
    // a hint of cursor follow. Never any roll; a constant small tilt shows the top.
    const sway = reduce ? 0 : Math.sin(t * 0.45) * 0.32
    const yawT = HEADING + p.turn * Math.PI * 2 + sway + THREE.MathUtils.clamp(state.pointer.x, -1, 1) * FOLLOW
    s.yaw += (yawT - s.yaw) * (1 - Math.pow(0.004, dt))
    b.rotation.order = 'YXZ'
    b.rotation.set(0.12, s.yaw, 0)
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
  const maxDpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 2)
  const [dpr, setDpr] = useState(maxDpr)
  if (!webgl) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 0.6, 6], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        eventSource={document.body}
        eventPrefix="client"
      >
        {/* holds 60 fps: lowers the resolution a step when frames drop, raises it back when there is headroom */}
        <PerformanceMonitor bounds={() => [55, 60]} flipflops={4} onDecline={() => setDpr((d) => Math.max(1, d - 0.25))} onIncline={() => setDpr((d) => Math.min(maxDpr, d + 0.25))} />
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
