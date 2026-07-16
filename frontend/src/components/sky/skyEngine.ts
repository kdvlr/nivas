// Canvas engines for the Living Sky screensaver.
// Two layers: a star canvas behind the photos (stars, twinkle, shooting stars)
// and an fx canvas in front (rain, snow, storm flashes, fireflies, birds).

export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type SkyKind = 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'stormy'

export interface SkyState {
  phase: SkyPhase
  kind: SkyKind
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function fit(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const pw = Math.max(1, Math.round(w * dpr))
  const ph = Math.max(1, Math.round(h * dpr))
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }
  return { w, h, dpr }
}

// How visible the star field is for a given sky state (0..1).
function starAlpha({ phase, kind }: SkyState): number {
  const base = phase === 'night' ? 1 : phase === 'dusk' || phase === 'dawn' ? 0.35 : 0
  if (base === 0) return 0
  if (kind === 'cloudy') return base * 0.35
  if (kind !== 'clear') return base * 0.12
  return base
}

interface Star {
  x: number
  y: number
  r: number
  alpha: number
  speed: number
  offset: number
}

export function startStarCanvas(canvas: HTMLCanvasElement, get: () => SkyState): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let stars: Star[] = []
  let sizeKey = ''
  let shooting: { x: number; y: number; vx: number; vy: number; born: number; life: number } | null = null
  let nextShoot = performance.now() + rand(12_000, 45_000)
  let raf = 0

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame)
    const { w, h, dpr } = fit(canvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const key = `${w}x${h}`
    if (key !== sizeKey) {
      sizeKey = key
      const n = Math.round((w * h) / 8500)
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.92,
        r: rand(0.4, 1.5),
        alpha: rand(0.25, 0.9),
        speed: rand(0.4, 1.6),
        offset: rand(0, Math.PI * 2),
      }))
    }

    const state = get()
    const mult = starAlpha(state)

    if (mult > 0.01) {
      ctx.fillStyle = '#ffffff'
      for (const s of stars) {
        const tw = 0.65 + 0.35 * Math.sin(t / 1000 * s.speed + s.offset)
        ctx.globalAlpha = s.alpha * tw * mult
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // Shooting stars: clear nights only, every so often.
    if (state.phase === 'night' && state.kind === 'clear') {
      if (!shooting && t > nextShoot) {
        const fromLeft = Math.random() < 0.5
        shooting = {
          x: fromLeft ? rand(0, w * 0.3) : rand(w * 0.7, w),
          y: rand(h * 0.05, h * 0.35),
          vx: (fromLeft ? 1 : -1) * rand(0.55, 0.8),
          vy: rand(0.18, 0.3),
          born: t,
          life: rand(900, 1400),
        }
      }
      if (shooting) {
        const age = t - shooting.born
        if (age > shooting.life) {
          shooting = null
          nextShoot = t + rand(45_000, 140_000)
        } else {
          const px = shooting.x + shooting.vx * age
          const py = shooting.y + shooting.vy * age
          const fade = 1 - age / shooting.life
          const tail = 110
          const gx = px - shooting.vx * tail
          const gy = py - shooting.vy * tail
          const grad = ctx.createLinearGradient(gx, gy, px, py)
          grad.addColorStop(0, 'rgba(255,255,255,0)')
          grad.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 2
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(gx, gy)
          ctx.lineTo(px, py)
          ctx.stroke()
          ctx.globalAlpha = fade
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(px, py, 2.2, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
    } else {
      shooting = null
    }
  }

  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

interface Drop {
  x: number
  y: number
  len: number
  speed: number
}

interface Flake {
  x: number
  y: number
  r: number
  speed: number
  sway: number
  offset: number
}

interface Firefly {
  x: number
  y: number
  angle: number
  speed: number
  pulse: number
  offset: number
}

interface Flock {
  x: number
  y: number
  speed: number
  dir: 1 | -1
  scale: number
  birds: { dx: number; dy: number; flapOffset: number }[]
}

export function startFxCanvas(canvas: HTMLCanvasElement, get: () => SkyState): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let drops: Drop[] = []
  let flakes: Flake[] = []
  let flies: Firefly[] = []
  let sizeKey = ''
  let flock: Flock | null = null
  let nextFlock = performance.now() + rand(15_000, 60_000)
  let flashUntil = 0
  let nextFlash = performance.now() + rand(8_000, 20_000)
  let last = performance.now()
  let raf = 0

  const seed = (w: number, h: number) => {
    drops = Array.from({ length: 150 }, () => ({
      x: Math.random() * (w + 120) - 60,
      y: Math.random() * h,
      len: rand(9, 22),
      speed: rand(520, 860),
    }))
    flakes = Array.from({ length: 90 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(1.2, 3.4),
      speed: rand(28, 70),
      sway: rand(12, 34),
      offset: rand(0, Math.PI * 2),
    }))
    flies = Array.from({ length: 14 }, () => ({
      x: Math.random() * w,
      y: h * rand(0.45, 0.95),
      angle: rand(0, Math.PI * 2),
      speed: rand(9, 22),
      pulse: rand(0.6, 1.4),
      offset: rand(0, Math.PI * 2),
    }))
  }

  const drawBird = (x: number, y: number, flap: number, scale: number, color: string) => {
    const w = 13 * scale
    const lift = Math.sin(flap) * 5 * scale
    ctx.strokeStyle = color
    ctx.lineWidth = 1.9 * scale
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - w, y - lift)
    ctx.quadraticCurveTo(x - w * 0.45, y + 3 * scale, x, y)
    ctx.quadraticCurveTo(x + w * 0.45, y + 3 * scale, x + w, y - lift)
    ctx.stroke()
  }

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (t - last) / 1000)
    last = t
    const { w, h, dpr } = fit(canvas)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const key = `${w}x${h}`
    if (key !== sizeKey) {
      sizeKey = key
      seed(w, h)
    }

    const { phase, kind } = get()
    const daylight = phase === 'day' || phase === 'dawn'

    // Birds: occasional flock crossing the sky on nice days.
    if (daylight && (kind === 'clear' || kind === 'cloudy')) {
      if (!flock && t > nextFlock) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
        const scale = rand(0.8, 1.3)
        flock = {
          x: dir === 1 ? -120 : w + 120,
          y: h * rand(0.08, 0.3),
          speed: rand(90, 130),
          dir,
          scale,
          birds: Array.from({ length: 4 + Math.floor(Math.random() * 4) }, (_, i) => ({
            dx: -i * rand(26, 40),
            dy: (i % 2 === 0 ? 1 : -1) * i * rand(6, 12),
            flapOffset: rand(0, Math.PI * 2),
          })),
        }
      }
      if (flock) {
        flock.x += flock.dir * flock.speed * dt
        const gone = flock.dir === 1 ? flock.x - 300 > w : flock.x + 300 < 0
        if (gone) {
          flock = null
          nextFlock = t + rand(70_000, 160_000)
        } else {
          const color = phase === 'dawn' ? 'rgba(50,40,60,0.75)' : 'rgba(30,45,60,0.8)'
          for (const b of flock.birds) {
            const bx = flock.x + b.dx * flock.dir
            const by = flock.y + b.dy + Math.sin(t / 900 + b.flapOffset) * 4
            drawBird(bx, by, t / 90 + b.flapOffset, flock.scale, color)
          }
        }
      }
    } else {
      flock = null
    }

    // Fireflies: calm nights and dusk.
    if ((phase === 'night' || phase === 'dusk') && (kind === 'clear' || kind === 'cloudy')) {
      for (const f of flies) {
        f.angle += rand(-1.6, 1.6) * dt
        f.x += Math.cos(f.angle) * f.speed * dt
        f.y += Math.sin(f.angle) * f.speed * dt * 0.6
        if (f.x < -10) f.x = w + 10
        if (f.x > w + 10) f.x = -10
        if (f.y < h * 0.35) f.y = h * 0.35
        if (f.y > h) f.y = h * rand(0.5, 0.95)
        const glow = Math.max(0, Math.sin(t / 1000 * f.pulse + f.offset))
        if (glow < 0.05) continue
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 7)
        g.addColorStop(0, `rgba(220,255,150,${0.85 * glow})`)
        g.addColorStop(1, 'rgba(220,255,150,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(f.x, f.y, 7, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // Rain (and storms).
    if (kind === 'rainy' || kind === 'stormy') {
      const count = kind === 'stormy' ? drops.length : Math.round(drops.length * 0.65)
      ctx.strokeStyle = phase === 'night' ? 'rgba(160,180,220,0.35)' : 'rgba(220,235,250,0.5)'
      ctx.lineWidth = 1.1
      ctx.lineCap = 'round'
      ctx.beginPath()
      for (let i = 0; i < count; i++) {
        const d = drops[i]
        d.y += d.speed * dt
        d.x += d.speed * 0.16 * dt
        if (d.y - d.len > h) {
          d.y = -d.len
          d.x = Math.random() * (w + 120) - 60
        }
        ctx.moveTo(d.x, d.y - d.len)
        ctx.lineTo(d.x + d.len * 0.16, d.y)
      }
      ctx.stroke()

      if (kind === 'stormy') {
        if (t > nextFlash && t > flashUntil) {
          flashUntil = t + rand(120, 240)
          nextFlash = t + rand(9_000, 26_000)
        }
        if (t < flashUntil) {
          ctx.fillStyle = `rgba(235,240,255,${rand(0.12, 0.28)})`
          ctx.fillRect(0, 0, w, h)
        }
      }
    }

    // Snow.
    if (kind === 'snowy') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      for (const f of flakes) {
        f.y += f.speed * dt
        if (f.y - 4 > h) {
          f.y = -4
          f.x = Math.random() * w
        }
        const x = f.x + Math.sin(t / 1400 + f.offset) * f.sway * 0.4
        ctx.globalAlpha = 0.4 + (f.r - 1.2) / 2.2 * 0.5
        ctx.beginPath()
        ctx.arc(x, f.y, f.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
  }

  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}
