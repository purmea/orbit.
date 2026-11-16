import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer } from '@react-three/drei'
import { Speaker } from './Speaker'

type Props = {
  tint: string
  spin?: React.MutableRefObject<number>
  follow?: number
  className?: string
  label: string
}

function useWebGL() {
  const [ok] = useState(() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
  })
  return ok
}

/** A transparent 3D canvas with studio lighting. No network needed: the lights are built in code. */
export function Stage({ tint, spin, follow, className = '', label }: Props) {
  const webgl = useWebGL()
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 30); return () => clearTimeout(t) }, [])

  if (!webgl) {
    return (
      <div className={`grid place-items-center rounded-3xl bg-panel text-sm text-muted ${className}`} role="img" aria-label={label}>
        3D preview needs WebGL
      </div>
    )
  }

  return (
    <div
      className={`relative ${className}`}
      role="img"
      aria-label={label}
      style={{ maskImage: 'linear-gradient(to bottom, #000 82%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, #000 82%, transparent)' }}
    >
      {!ready && <Loader />}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.15, 4.2], fov: 32 }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 3]} intensity={1.4} />
        <Suspense fallback={null}>
          <Speaker tint={tint} spin={spin} follow={follow} />
          <ContactShadows position={[0, -1.05, 0]} opacity={0.32} scale={4.2} blur={2.8} far={2} />
          <Environment resolution={256}>
            {/* soft studio: a big overhead softbox, two side strips and a blue rim light */}
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

function Loader() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
      <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
    </div>
  )
}
