// Canvas engines for the Living Sky screensaver.
// Two layers: a star canvas behind the photos (stars, twinkle, shooting stars)
// and an fx canvas in front (rain, snow, storm flashes, fireflies, birds).
// Tuned for low-end tablets: DPR capped, ~30fps, pre-rendered glow sprites, no layout thrashing.

export type SkyPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type SkyKind = 'clear' | 'cloudy' | 'rainy' | 'snowy' | 'stormy'

export interface SkyState {
  phase: SkyPhase
  kind: SkyKind
  paused?: boolean
  // 'high' | 'medium' — 'low' never mounts a canvas at all.
  quality?: 'high' | 'medium' | 'low'
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const isOctober = () => new Date().getMonth() === 9

// Cap the frame rate: full-screen 60fps canvas work is wasted on ambient
// weather. rAF still schedules, we just skip paints.
const FRAME_MS = 31
const FRAME_MS_LOW = 50
const FRAME_MS_MIN = 66 // ~15fps: enough for drifting ambience on weak devices

// 'low' still paints — just fewer particles, at a lower resolution and frame
// rate. An empty sky is a worse outcome than a cheap one.
const frameBudget = (s: SkyState) =>
  s.quality === 'low' ? FRAME_MS_MIN : s.quality === 'medium' ? FRAME_MS_LOW : FRAME_MS
const dprFor = (s: SkyState) =>
  Math.min(window.devicePixelRatio || 1, s.quality === 'high' ? 1.5 : 1)
const densityFor = (s: SkyState) =>
  s.quality === 'low' ? 0.28 : s.quality === 'medium' ? 0.5 : 1

// Pre-rendered radial glow sprite (avoids per-frame gradient allocations).
function makeGlowSprite(r: number, g: number, b: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
  grad.addColorStop(0, `rgba(${r},${g},${b},0.9)`)
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.35)`)
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 32, 32)
  return c
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
  let lastDraw = 0
  let raf = 0
  let blanked = false

  let w = canvas.clientWidth
  let h = canvas.clientHeight
  let dpr = dprFor(get())

  const resize = () => {
    w = canvas.clientWidth
    h = canvas.clientHeight
    dpr = dprFor(get())
    const pw = Math.max(1, Math.round(w * dpr))
    const ph = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
  }

  resize()
  window.addEventListener('resize', resize)

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame)
    const state = get()
    if (state.paused) return

    if (t - lastDraw < frameBudget(state)) return
    lastDraw = t

    const mult = starAlpha(state)

    // Daytime: no stars, no meteors — hide the layer so the compositor skips a
    // full-screen canvas that would render nothing.
    if (mult <= 0.01 && !shooting) {
      if (!blanked) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        canvas.style.visibility = 'hidden'
        blanked = true
      }
      return
    }
    if (blanked) {
      canvas.style.visibility = ''
      blanked = false
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Quality is part of the key so a tier change re-seeds particle counts.
    const key = `${w}x${h}x${state.quality ?? 'high'}`
    if (key !== sizeKey) {
      sizeKey = key
      const n = Math.round(((w * h) / 10_000) * densityFor(state))
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h * 0.92,
        r: rand(0.5, 1.5),
        alpha: rand(0.25, 0.9),
        speed: rand(0.4, 1.6),
        offset: rand(0, Math.PI * 2),
      }))
    }

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
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  }
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

interface WitchSparkle {
  x: number
  y: number
  alpha: number
  size: number
}

interface Witch {
  x: number
  y: number
  baseY: number
  speed: number
  dir: 1 | -1
  scale: number
  sparkles: WitchSparkle[]
}

export function startFxCanvas(canvas: HTMLCanvasElement, get: () => SkyState): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const fireflyGlow = makeGlowSprite(220, 255, 150)

  let drops: Drop[] = []
  let flakes: Flake[] = []
  let flies: Firefly[] = []
  let sizeKey = ''
  let flock: Flock | null = null
  let nextFlock = performance.now() + rand(15_000, 60_000)
  let witch: Witch | null = null
  let nextWitch = performance.now() + rand(20_000, 50_000)
  let flashUntil = 0
  let nextFlash = performance.now() + rand(8_000, 20_000)
  let lastDraw = performance.now()
  let raf = 0
  let blanked = false

  let w = canvas.clientWidth
  let h = canvas.clientHeight
  let dpr = dprFor(get())

  const resize = () => {
    w = canvas.clientWidth
    h = canvas.clientHeight
    dpr = dprFor(get())
    const pw = Math.max(1, Math.round(w * dpr))
    const ph = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
  }

  resize()
  window.addEventListener('resize', resize)

  const seed = (w: number, h: number, density: number) => {
    drops = Array.from({ length: Math.round(130 * density) }, () => ({
      x: Math.random() * (w + 120) - 60,
      y: Math.random() * h,
      len: rand(9, 22),
      speed: rand(520, 860),
    }))
    flakes = Array.from({ length: Math.round(80 * density) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: rand(1.2, 3.4),
      speed: rand(28, 70),
      sway: rand(12, 34),
      offset: rand(0, Math.PI * 2),
    }))
    flies = Array.from({ length: Math.round(12 * density) }, () => ({
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

  const drawBat = (
    x: number,
    y: number,
    flap: number,
    scale: number,
    color: string,
    dir: 1 | -1
  ) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(dir * scale, scale)

    const s = Math.sin(flap)
    const wingLift = s * 7

    ctx.fillStyle = color
    ctx.beginPath()

    // Head and ears
    ctx.moveTo(0, -3)
    ctx.lineTo(-2, -6)
    ctx.lineTo(-1, -3)
    ctx.lineTo(1, -3)
    ctx.lineTo(2, -6)
    ctx.lineTo(0, -3)

    // Left wing
    ctx.lineTo(-3, -1)
    ctx.quadraticCurveTo(-8, -4 - wingLift * 0.7, -15, -2 - wingLift)
    ctx.quadraticCurveTo(-11, 3 - wingLift * 0.4, -8, 2 - wingLift * 0.3)
    ctx.quadraticCurveTo(-5, 4 - wingLift * 0.1, -2, 3)

    // Body bottom
    ctx.lineTo(0, 5)

    // Right wing
    ctx.lineTo(2, 3)
    ctx.quadraticCurveTo(5, 4 - wingLift * 0.1, 8, 2 - wingLift * 0.3)
    ctx.quadraticCurveTo(11, 3 - wingLift * 0.4, 15, -2 - wingLift)
    ctx.quadraticCurveTo(8, -4 - wingLift * 0.7, 3, -1)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  const drawWitch = (
    x: number,
    y: number,
    scale: number,
    color: string,
    dir: 1 | -1,
    t: number
  ) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(dir * scale, scale)

    // 1. Broomstick
    ctx.strokeStyle = '#5c3a21'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-32, 6)
    ctx.lineTo(30, -5)
    ctx.stroke()

    // 2. Straw bristles at rear of broom
    ctx.fillStyle = '#b45309'
    ctx.beginPath()
    ctx.moveTo(-28, 5)
    ctx.lineTo(-46, -3)
    ctx.lineTo(-50, 6)
    ctx.lineTo(-45, 14)
    ctx.lineTo(-29, 8)
    ctx.closePath()
    ctx.fill()

    // Straw twigs detail strokes
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-28, 6)
    ctx.lineTo(-52, 2)
    ctx.moveTo(-28, 6.5)
    ctx.lineTo(-48, 10)
    ctx.stroke()

    // Twine band binding the broom bristles
    ctx.strokeStyle = '#d97706'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-30, 4)
    ctx.lineTo(-29, 8)
    ctx.stroke()

    // 3. Witch silhouette (body, dress, cape, hat)
    ctx.fillStyle = color

    // Billowing cloak behind her
    const capeWave = Math.sin(t / 140) * 3
    ctx.beginPath()
    ctx.moveTo(3, -15)
    ctx.quadraticCurveTo(-10, -10, -22 + capeWave, -2)
    ctx.quadraticCurveTo(-15, 6, -2, 5)
    ctx.lineTo(3, -15)
    ctx.closePath()
    ctx.fill()

    // Torso & sitting legs
    ctx.beginPath()
    ctx.moveTo(-2, 4)
    ctx.lineTo(4, -15)
    ctx.lineTo(8, -13)
    ctx.lineTo(12, 2)
    ctx.lineTo(17, 3)
    ctx.lineTo(14, 5)
    ctx.lineTo(5, 5)
    ctx.lineTo(-2, 4)
    ctx.closePath()
    ctx.fill()

    // Arm reaching forward holding broomstick
    ctx.strokeStyle = color
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(4, -13)
    ctx.lineTo(9, -7)
    ctx.lineTo(15, -2)
    ctx.stroke()

    // Head and profile (hooked nose & chin)
    ctx.beginPath()
    ctx.arc(8, -19, 4.5, 0, Math.PI * 2)
    ctx.fill()

    // Pointed nose & chin profile
    ctx.beginPath()
    ctx.moveTo(11, -21)
    ctx.lineTo(15, -19)
    ctx.lineTo(11, -17)
    ctx.lineTo(14, -15)
    ctx.lineTo(9, -15)
    ctx.closePath()
    ctx.fill()

    // 4. Iconic Witch Hat
    ctx.save()
    ctx.translate(8, -22)
    ctx.rotate(-0.2)

    // Wide Brim
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, 0, 11, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Hat Band (orange ribbon)
    ctx.fillStyle = '#ea580c'
    ctx.fillRect(-5, -3, 10, 2)

    // Cone of hat bending backward
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(-5, -2)
    ctx.lineTo(5, -2)
    ctx.quadraticCurveTo(3, -12, -2, -18)
    ctx.lineTo(-6, -17)
    ctx.quadraticCurveTo(-1, -10, -5, -2)
    ctx.closePath()
    ctx.fill()

    ctx.restore()

    // 5. Tiny black cat riding behind her on the broom
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(-14, 2, 3.5, 2.5, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-11, -1, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-12, -2)
    ctx.lineTo(-12.5, -4.5)
    ctx.lineTo(-10.5, -3)
    ctx.moveTo(-10.5, -3)
    ctx.lineTo(-9.5, -4.5)
    ctx.lineTo(-9, -2)
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-17, 3)
    ctx.quadraticCurveTo(-22, 1, -20, -3)
    ctx.stroke()

    ctx.restore()
  }

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame)
    const state = get()
    if (state.paused) return

    if (t - lastDraw < frameBudget(state)) return
    const dt = Math.min(0.08, (t - lastDraw) / 1000)
    lastDraw = t

    const { phase, kind } = state
    const daylight = phase === 'day' || phase === 'dawn'
    const calm = kind === 'clear' || kind === 'cloudy'
    const october = isOctober()

    // Decide whether this layer has anything to render at all. A clear day has
    // no weather and no fireflies, so the canvas would otherwise clear and
    // composite a full-screen transparent layer 30x/sec for nothing. Hide the
    // element entirely in that case so the compositor skips it.
    const wantsWeather = kind === 'rainy' || kind === 'stormy' || kind === 'snowy'
    const wantsFlies = (phase === 'night' || phase === 'dusk') && calm
    const creaturesPossible = calm && (october || daylight)
    const witchPossible = october && calm
    const active =
      wantsWeather ||
      wantsFlies ||
      flock !== null ||
      witch !== null ||
      (creaturesPossible && t > nextFlock) ||
      (witchPossible && t > nextWitch)

    if (!active) {
      if (!blanked) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        canvas.style.visibility = 'hidden'
        blanked = true
      }
      return
    }
    if (blanked) {
      canvas.style.visibility = ''
      blanked = false
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const key = `${w}x${h}x${state.quality ?? 'high'}`
    if (key !== sizeKey) {
      sizeKey = key
      seed(w, h, densityFor(state))
    }

    // Birds (non-October) or Bats (October)
    if (creaturesPossible) {
      if (!flock && t > nextFlock) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
        const scale = rand(0.8, 1.3)
        flock = {
          x: dir === 1 ? -120 : w + 120,
          y: h * rand(0.08, 0.35),
          speed: october ? rand(105, 150) : rand(90, 130),
          dir,
          scale,
          birds: Array.from({ length: 4 + Math.floor(Math.random() * (october ? 6 : 4)) }, (_, i) => ({
            dx: -i * rand(24, 38),
            dy: (i % 2 === 0 ? 1 : -1) * i * rand(6, 14),
            flapOffset: rand(0, Math.PI * 2),
          })),
        }
      }
      if (flock) {
        flock.x += flock.dir * flock.speed * dt
        const gone = flock.dir === 1 ? flock.x - 300 > w : flock.x + 300 < 0
        if (gone) {
          flock = null
          nextFlock = t + rand(60_000, 140_000)
        } else {
          const color =
            phase === 'night'
              ? (october ? 'rgba(20,16,30,0.92)' : 'rgba(30,45,60,0.8)')
              : phase === 'dusk'
              ? (october ? 'rgba(35,20,45,0.88)' : 'rgba(30,45,60,0.8)')
              : phase === 'dawn'
              ? (october ? 'rgba(45,30,55,0.85)' : 'rgba(50,40,60,0.75)')
              : (october ? 'rgba(30,30,40,0.85)' : 'rgba(30,45,60,0.8)')
          for (const b of flock.birds) {
            const bx = flock.x + b.dx * flock.dir
            const by = flock.y + b.dy + Math.sin(t / (october ? 450 : 900) + b.flapOffset) * (october ? 6 : 4)
            if (october) {
              drawBat(bx, by, t / 45 + b.flapOffset, flock.scale, color, flock.dir)
            } else {
              drawBird(bx, by, t / 90 + b.flapOffset, flock.scale, color)
            }
          }
        }
      }
    } else {
      flock = null
    }

    // Witch: occasional October flight across the sky on a broomstick.
    if (witchPossible) {
      if (!witch && t > nextWitch) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
        const scale = rand(0.85, 1.25)
        const baseY = h * rand(0.1, 0.3)
        witch = {
          x: dir === 1 ? -120 : w + 120,
          y: baseY,
          baseY,
          speed: rand(105, 145),
          dir,
          scale,
          sparkles: [],
        }
      }
      if (witch) {
        witch.x += witch.dir * witch.speed * dt
        witch.y = witch.baseY + Math.sin(t / 550) * 10

        // Trailing stardust sparkles behind broom
        if (Math.random() < 0.35) {
          witch.sparkles.push({
            x: witch.x - witch.dir * 44 * witch.scale + rand(-4, 4),
            y: witch.y + 4 * witch.scale + rand(-3, 3),
            alpha: rand(0.65, 0.95),
            size: rand(1.6, 2.8),
          })
        }

        // Update sparkles
        for (let i = witch.sparkles.length - 1; i >= 0; i--) {
          const sp = witch.sparkles[i]
          sp.alpha -= dt * 1.3
          sp.y += dt * 6
          if (sp.alpha <= 0) {
            witch.sparkles.splice(i, 1)
          }
        }

        const gone = witch.dir === 1 ? witch.x - 160 > w : witch.x + 160 < 0
        if (gone) {
          witch = null
          nextWitch = t + rand(80_000, 180_000)
        } else {
          // Draw sparkles
          for (const sp of witch.sparkles) {
            ctx.fillStyle = `rgba(253, 224, 71, ${sp.alpha})`
            ctx.beginPath()
            ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
            ctx.fill()
          }

          const witchColor =
            phase === 'night'
              ? 'rgba(18, 14, 28, 0.95)'
              : phase === 'dusk'
              ? 'rgba(28, 16, 38, 0.92)'
              : phase === 'dawn'
              ? 'rgba(38, 22, 48, 0.9)'
              : 'rgba(32, 28, 38, 0.88)'
          drawWitch(witch.x, witch.y, witch.scale, witchColor, witch.dir, t)
        }
      }
    } else {
      witch = null
    }

    // Fireflies: calm nights and dusk.
    if (wantsFlies) {
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
        ctx.globalAlpha = glow
        ctx.drawImage(fireflyGlow, f.x - 8, f.y - 8, 16, 16)
      }
      ctx.globalAlpha = 1
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
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
  }
}
