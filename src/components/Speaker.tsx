import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Center, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { product } from '../config'

type Props = {
  /** Colour multiplied into the model's textures (finish picker). */
  tint: string
  /** Extra rotation driven by the page (scroll story), in radians. */
  spin?: React.MutableRefObject<number>
  /** How strongly the model leans towards the cursor. */
  follow?: number
  scale?: number
}

/** The 3D speaker: follows the cursor, takes a rotation from scroll, and its screen pulses like music. */
export function Speaker({ tint, spin, follow = 0.35, scale = 1 }: Props) {
  const { scene } = useGLTF(product.modelUrl)
  const group = useRef<THREE.Group>(null)

  // Clone so several canvases can show the model with different finishes.
  const model = useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        const m = (mesh.material as THREE.MeshStandardMaterial).clone()
        m.envMapIntensity = 1.2
        mesh.material = m
      }
    })
    // Normalise size: fit the model in a 2-unit box whatever its original scale.
    const box = new THREE.Box3().setFromObject(s)
    const size = box.getSize(new THREE.Vector3()).length()
    s.scale.setScalar((2.6 / size) * scale)
    return s
  }, [scene, scale])

  const materials = useMemo(() => {
    const list: THREE.MeshStandardMaterial[] = []
    model.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m) list.push(m) })
    return list
  }, [model])

  // Smoothly blend to the selected finish.
  const target = useMemo(() => new THREE.Color(tint), [tint])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const k = 1 - Math.pow(0.001, dt) // frame-rate independent smoothing
    const px = state.pointer.x, py = state.pointer.y
    const baseY = (spin?.current ?? 0) + Math.sin(state.clock.elapsedTime * 0.3) * 0.08
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, baseY + px * follow, k * 0.6)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -py * follow * 0.5 + 0.05, k * 0.6)
    g.position.y = Math.sin(state.clock.elapsedTime * 1.1) * 0.04

    const beat = 0.75 + 0.5 * Math.max(0, Math.sin(state.clock.elapsedTime * 7.5)) ** 6
    materials.forEach((m) => {
      m.color.lerp(target, k * 0.25)
      if (m.emissiveMap) m.emissiveIntensity = beat
    })
  })

  return (
    <group ref={group}>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  )
}

useGLTF.preload(product.modelUrl)
