import { useEffect, useRef } from 'react'

/** A slow wave of dots that swells (in the accent colour) around the cursor. */
export function DotField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, raf = 0, t = 0, last = 0, visible = true
    const m = { x: -9999, y: -9999, tx: -9999, ty: -9999 }

    const size = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(devicePixelRatio || 1, 2)
      W = r.width; H = r.height
      cv.width = W * dpr; cv.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(size); ro.observe(cv); size()

    const move = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); m.tx = e.clientX - r.left; m.ty = e.clientY - r.top }
    const leave = () => { m.tx = m.ty = -9999 }
    cv.addEventListener('pointermove', move)
    cv.addEventListener('pointerdown', move)
    cv.addEventListener('pointerleave', leave)

    // theme colours, read once and again only when the theme changes (not every frame)
    let fg = '', ac = ''
    const readColors = () => { const cs = getComputedStyle(document.documentElement); fg = cs.getPropertyValue('--fg').trim(); ac = cs.getPropertyValue('--accent').trim() }
    readColors()
    const mo = new MutationObserver(readColors)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', readColors)

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      m.x = m.tx < -999 ? m.tx : m.x < -999 ? m.tx : m.x + (m.tx - m.x) * 0.12
      m.y = m.ty < -999 ? m.ty : m.y < -999 ? m.ty : m.y + (m.ty - m.y) * 0.12
      const gap = W < 500 ? 14 : 18, cx = W / 2, cy = H / 2
      for (let y = gap / 2; y < H; y += gap) {
        for (let x = gap / 2; x < W; x += gap) {
          const ex = (x - cx) / cx, ey = (y - cy) / cy
          const edge = Math.max(0, 1 - Math.pow(ex * ex + ey * ey * 1.4, 1.6))
          if (edge <= 0.01) continue
          let v = Math.sin(x * 0.016 + t * 0.9) * Math.cos(y * 0.028 - t * 0.6) + Math.sin((x + y) * 0.009 + t * 0.45)
          v = (v + 2) / 4
          const d = Math.hypot(x - m.x, y - m.y), boost = Math.max(0, 1 - d / 130)
          ctx.globalAlpha = Math.min(1, (0.12 + v * 0.55 + boost * 0.5) * edge)
          ctx.fillStyle = boost > 0.35 ? ac : fg
          ctx.beginPath()
          ctx.arc(x, y, (0.5 + v * 1.7 + boost * boost * 3.2) * (0.5 + edge * 0.5), 0, 6.2832)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
    }
    const loop = (now: number) => {
      if (!visible) return
      t += Math.min(0.05, (now - (last || now)) / 1000); last = now
      draw(); raf = requestAnimationFrame(loop)
    }
    const io = new IntersectionObserver(([e]) => {
      const was = visible; visible = e.isIntersecting
      if (visible && !was && !reduce) { last = 0; raf = requestAnimationFrame(loop) }
    })
    io.observe(cv)
    if (reduce) { t = 1.3; draw() } else raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect(); mq.removeEventListener('change', readColors)
      cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerdown', move); cv.removeEventListener('pointerleave', leave)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className={`block w-full touch-pan-y ${className}`} />
}
