import { useEffect, useRef, useState } from 'react'
import { faq, finishes, product, specs, story } from './config'
import { DotField } from './components/DotField'
import { Stage } from './components/Stage'

export default function App() {
  const [finish, setFinish] = useState(finishes[0])
  useReveal()

  return (
    <>
      <Nav />
      <main>
        <Hero tint={finish.tint} />
        <Story tint={finish.tint} />
        <Specs />
        <Finishes finish={finish} setFinish={setFinish} />
        <Order />
        <Faq />
      </main>
      <Footer />
    </>
  )
}

/* ───────────── Navigation ───────────── */
function Nav() {
  return (
    <header className="gutter sticky z-30 bg-bg/80 backdrop-blur-md" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
        <a href="#" className="text-[17px] font-semibold tracking-[-0.03em]">{product.brand}<span className="text-accent">.</span></a>
        <nav className="flex items-center gap-1 text-sm text-muted sm:gap-5">
          <a href="#sound" className="hidden px-2 py-1 transition hover:text-fg sm:block">Sound</a>
          <a href="#specs" className="hidden px-2 py-1 transition hover:text-fg sm:block">Specs</a>
          <a href="#finishes" className="hidden px-2 py-1 transition hover:text-fg sm:block">Finishes</a>
          <a href={product.ctaUrl} className="rounded-full bg-fg px-4 py-2 font-medium text-bg transition hover:opacity-85 active:scale-[0.97]">{product.ctaLabel}</a>
        </nav>
      </div>
    </header>
  )
}

/* ───────────── Hero: the 3D speaker over the dot field ───────────── */
function Hero({ tint }: { tint: string }) {
  const words = [...product.tagline[0].split(' '), ...product.tagline[1].split(' ')]
  const firstLine = product.tagline[0].split(' ').length
  return (
    <section className="gutter relative overflow-hidden">
      <div className="mx-auto max-w-6xl pt-14 text-center sm:pt-20">
        <p className="rise mb-6 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {product.name} · Pre-orders open
        </p>
        <h1 className="text-[clamp(44px,8vw,104px)] leading-[0.98] font-medium tracking-[-0.045em]">
          {words.map((w, i) => (
            <span key={i}>
              <span className={`word ${i >= firstLine ? 'text-muted' : ''}`} style={{ animationDelay: `${i * 70}ms` }}>{w}</span>
              {i === firstLine - 1 ? <br /> : i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>
      </div>
      <div className="relative mx-auto -mt-4 max-w-5xl">
        <DotField className="absolute inset-0 h-full opacity-80" />
        <Stage tint={tint} follow={0.45} label={`${product.name} speaker in 3D, follows your cursor`} className="rise h-[clamp(340px,58vh,620px)]" />
      </div>
      <div className="rise mx-auto max-w-xl pb-20 text-center" style={{ animationDelay: '500ms' }}>
        <p className="text-lg leading-relaxed text-muted text-pretty">{product.intro}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={product.ctaUrl} className="rounded-full bg-fg px-6 py-3 text-[15px] font-medium text-bg transition hover:shadow-[0_10px_40px_-8px_color-mix(in_srgb,var(--accent)_70%,transparent)] active:scale-[0.97]">
            {product.ctaLabel} · {product.price} {product.currency}
          </a>
          <a href="#sound" className="rounded-full border border-line px-6 py-3 text-[15px] font-medium transition hover:border-faint active:scale-[0.97]">See it turn ↓</a>
        </div>
      </div>
    </section>
  )
}

/* ───────────── Story: sticky 3D, rotates with scroll ───────────── */
function Story({ tint }: { tint: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const spin = useRef(0)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = wrap.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)))
      spin.current = -0.5 + p * Math.PI * 1.5
      setStep(Math.min(story.length - 1, Math.floor(p * story.length)))
    }
    onScroll()
    addEventListener('scroll', onScroll, { passive: true })
    return () => removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section id="sound" ref={wrap} className="gutter relative border-t border-line" style={{ height: `${story.length * 90 + 40}vh` }}>
      <div className="sticky top-16 mx-auto grid h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 md:grid-cols-2">
        <div className="relative order-2 min-h-[220px] md:order-1">
          {story.map((s, i) => (
            <div
              key={s.eyebrow}
              className="absolute inset-x-0 top-1/2 transition-all duration-700 ease-out-soft"
              style={{ opacity: step === i ? 1 : 0, transform: `translateY(calc(-50% + ${(i - step) * 28}px))`, pointerEvents: step === i ? 'auto' : 'none' }}
              aria-hidden={step !== i}
            >
              <p className="font-mono text-xs tracking-[0.2em] text-accent uppercase">0{i + 1} · {s.eyebrow}</p>
              <h2 className="duo mt-4 text-[clamp(30px,4vw,52px)] leading-[1.05] font-medium tracking-[-0.035em]">
                {s.title[0]}<span>{s.title[1]}</span>
              </h2>
              <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
          <div className="absolute bottom-0 left-0 flex gap-2 md:-bottom-6">
            {story.map((s, i) => (
              <span key={s.eyebrow} className={`h-1 rounded-full transition-all duration-500 ${step === i ? 'w-8 bg-fg' : 'w-3 bg-line'}`} />
            ))}
          </div>
        </div>
        <Stage tint={tint} spin={spin} follow={0.15} label={`${product.name} rotating as you scroll`} className="order-1 h-[42vh] md:order-2 md:h-[70vh]" />
      </div>
    </section>
  )
}

/* ───────────── Specs: numbers count up ───────────── */
function Specs() {
  return (
    <section id="specs" className="gutter scroll-mt-16 border-t border-line">
      <div className="reveal mx-auto max-w-6xl py-24">
        <h2 className="duo mb-12 text-[clamp(28px,3.4vw,40px)] leading-[1.1] font-medium tracking-[-0.025em]">Specs<span>Small box, big numbers</span></h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {specs.map((s) => (
            <div key={s.label} className="bg-bg p-7">
              <dt className="text-sm text-muted">{s.label}</dt>
              <dd className="mt-3 text-[clamp(40px,5vw,64px)] leading-none font-medium tracking-[-0.04em] tabular-nums">
                <CountUp value={s.value} decimals={s.decimals ?? 0} />
                <span className="text-muted">{s.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function CountUp({ value, decimals }: { value: number; decimals: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < innerHeight) return // already on screen: keep the final value
    setShown(0)
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const tick = (t: number) => {
        const u = Math.min(1, (t - t0) / 1400), eased = 1 - Math.pow(1 - u, 3)
        setShown(value * eased)
        if (u < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [value])
  return <span ref={ref}>{shown.toFixed(decimals)}</span>
}

/* ───────────── Finishes: recolour the model live ───────────── */
function Finishes({ finish, setFinish }: { finish: (typeof finishes)[number]; setFinish: (f: (typeof finishes)[number]) => void }) {
  return (
    <section id="finishes" className="gutter scroll-mt-16 border-t border-line">
      <div className="reveal mx-auto grid max-w-6xl items-center gap-10 py-24 md:grid-cols-[1fr_1.3fr]">
        <div>
          <h2 className="duo text-[clamp(28px,3.4vw,40px)] leading-[1.1] font-medium tracking-[-0.025em]">Finishes<span>Pick yours, watch it change</span></h2>
          <div className="mt-10 flex flex-col gap-2" role="radiogroup" aria-label="Finish">
            {finishes.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={finish.id === f.id}
                onClick={() => setFinish(f)}
                className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition active:scale-[0.99] ${finish.id === f.id ? 'border-fg' : 'border-line hover:border-faint'}`}
              >
                <span className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-full ring-1 ring-line" style={{ background: f.swatch }} />
                  <span className="font-medium">{f.name}</span>
                </span>
                <span className={`font-mono text-xs transition ${finish.id === f.id ? 'text-accent' : 'text-faint'}`}>{finish.id === f.id ? 'Selected' : 'Select'}</span>
              </button>
            ))}
          </div>
        </div>
        <Stage tint={finish.tint} follow={0.5} label={`${product.name} in ${finish.name}`} className="h-[clamp(320px,50vh,520px)] rounded-3xl bg-panel" />
      </div>
    </section>
  )
}

/* ───────────── Order ───────────── */
function Order() {
  return (
    <section id="order" className="gutter scroll-mt-16 border-t border-line">
      <div className="reveal mx-auto max-w-6xl py-28 text-center">
        <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">{product.name}</p>
        <h2 className="mt-5 text-[clamp(56px,11vw,150px)] leading-[0.9] font-semibold tracking-[-0.06em] tabular-nums">
          {product.price}<span className="text-accent">{product.currency}</span>
        </h2>
        <p className="mx-auto mt-6 max-w-md text-muted">Free shipping. Two-year warranty. Pay nothing until it ships.</p>
        <a href={product.ctaUrl} className="mt-10 inline-block rounded-full bg-fg px-8 py-4 text-[15px] font-medium text-bg transition hover:shadow-[0_10px_40px_-8px_color-mix(in_srgb,var(--accent)_70%,transparent)] active:scale-[0.97]">
          {product.ctaLabel} now
        </a>
      </div>
    </section>
  )
}

/* ───────────── FAQ ───────────── */
function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="gutter border-t border-line">
      <div className="reveal mx-auto grid max-w-6xl gap-10 py-24 md:grid-cols-[1fr_1.4fr]">
        <h2 className="duo text-[clamp(28px,3.4vw,40px)] leading-[1.1] font-medium tracking-[-0.025em]">Questions<span>Before you order</span></h2>
        <div>
          {faq.map((f, i) => (
            <div key={f.q} className="border-t border-line last:border-b">
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left font-medium">
                {f.q}
                <span className="relative h-3 w-3 shrink-0">
                  <span className="absolute top-[5px] left-0 h-[1.5px] w-3 bg-current" />
                  <span className={`absolute top-[5px] left-0 h-[1.5px] w-3 bg-current transition-transform duration-300 ${open === i ? 'rotate-0' : 'rotate-90'}`} />
                </span>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-500 ease-out-soft ${open === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden"><p className="pb-5 text-[15px] leading-relaxed text-muted">{f.a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────── Footer with theme switch ───────────── */
type Theme = 'system' | 'light' | 'dark'
function Footer() {
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem('orbit-theme') as Theme) || 'system' } catch { return 'system' } })
  const [host] = useState(() => document.documentElement.getAttribute('data-theme'))
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') { if (host) root.setAttribute('data-theme', host); else root.removeAttribute('data-theme') } else root.setAttribute('data-theme', theme)
    try { localStorage.setItem('orbit-theme', theme) } catch { /* storage unavailable */ }
  }, [theme, host])
  const themes: Theme[] = ['system', 'light', 'dark']
  return (
    <footer className="gutter border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 py-10 text-sm text-muted">
        <span className="text-[17px] font-semibold tracking-[-0.03em] text-fg">{product.brand}<span className="text-accent">.</span></span>
        <div className="relative flex gap-0.5 rounded-full border border-line p-[3px]" role="group" aria-label="Theme">
          <span className="absolute top-[3px] left-[3px] h-[26px] w-[44px] rounded-full bg-panel transition-transform duration-500 ease-spring" style={{ transform: `translateX(${themes.indexOf(theme) * 46}px)` }} />
          {themes.map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)} className={`relative h-[26px] w-[44px] rounded-full text-xs capitalize transition-colors ${theme === t ? 'text-fg' : 'text-muted'}`}>{t === 'system' ? 'Auto' : t}</button>
          ))}
        </div>
        <span>© {new Date().getFullYear()} {product.name}. 3D model: Boom Box, CC0, Khronos glTF Sample Assets.</span>
      </div>
    </footer>
  )
}

/* ───────────── Scroll reveal ───────────── */
function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>('.reveal')]
    els.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight * 0.92) el.classList.add('pre') })
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target) } }), { rootMargin: '0px 0px -10% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}
