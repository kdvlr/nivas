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
import {
  getSeasonalDate,
  isOctober,
  isDecember,
  isElfSeason,
  isChristmasDay,
  isNewYearsDay,
} from './queryParam'

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

interface Santa {
  x: number
  y: number
  baseY: number
  speed: number
  dir: 1 | -1
  scale: number
  sparkles: WitchSparkle[]
}

interface FallingGift {
  x: number
  y: number
  baseX: number
  size: number
  speed: number
  sway: number
  angle: number
  rotSpeed: number
  offset: number
  boxColor: string
  ribbonColor: string
}

interface FireworksRocket {
  x: number
  y: number
  targetY: number
  speed: number
  color: string
  trail: { x: number; y: number; alpha: number }[]
}

interface FireworksSpark {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  alpha: number
  decay: number
  size: number
}

interface FireworksFlash {
  x: number
  y: number
  color: string
  radius: number
  alpha: number
}

export function startFxCanvas(canvas: HTMLCanvasElement, get: () => SkyState): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const fireflyGlow = makeGlowSprite(220, 255, 150)

  let drops: Drop[] = []
  let flakes: Flake[] = []
  let flies: Firefly[] = []
  let gifts: FallingGift[] = []
  let rockets: FireworksRocket[] = []
  let sparks: FireworksSpark[] = []
  let flashes: FireworksFlash[] = []
  let sizeKey = ''
  let flock: Flock | null = null
  let nextFlock = performance.now() + rand(15_000, 60_000)
  let witch: Witch | null = null
  let nextWitch = performance.now() + rand(20_000, 50_000)
  let santa: Santa | null = null
  let nextSanta = performance.now() + rand(15_000, 45_000)
  let nextRocket = performance.now() + 500
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
    const giftPalettes = [
      { box: '#dc2626', ribbon: '#22c55e' },
      { box: '#16a34a', ribbon: '#facc15' },
      { box: '#2563eb', ribbon: '#f8fafc' },
      { box: '#eab308', ribbon: '#dc2626' },
      { box: '#9333ea', ribbon: '#fde047' },
    ]
    gifts = Array.from({ length: Math.round(30 * density) }, () => {
      const pal = giftPalettes[Math.floor(Math.random() * giftPalettes.length)]
      return {
        x: Math.random() * w,
        baseX: Math.random() * w,
        y: Math.random() * h,
        size: rand(16, 26),
        speed: rand(45, 85),
        sway: rand(15, 35),
        angle: rand(0, Math.PI * 2),
        rotSpeed: rand(-0.7, 0.7),
        offset: rand(0, Math.PI * 2),
        boxColor: pal.box,
        ribbonColor: pal.ribbon,
      }
    })
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

    const outlineColor = 'rgba(156, 163, 175, 0.95)' // Clean crisp neutral gray (#9ca3af)

    // 1. Broomstick
    ctx.strokeStyle = '#5c3a21'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-32, 6)
    ctx.lineTo(30, -5)
    ctx.stroke()

    // Broomstick thin gray outline highlight
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.6
    ctx.beginPath()
    ctx.moveTo(-32, 4.8)
    ctx.lineTo(30, -6.2)
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
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.7
    ctx.stroke()

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
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.7
    ctx.stroke()

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
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.7
    ctx.stroke()

    // Arm reaching forward holding broomstick (outline undercoat + dark fill)
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 3.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(4, -13)
    ctx.lineTo(9, -7)
    ctx.lineTo(15, -2)
    ctx.stroke()

    ctx.strokeStyle = color
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(4, -13)
    ctx.lineTo(9, -7)
    ctx.lineTo(15, -2)
    ctx.stroke()

    // Head and profile (hooked nose & chin)
    ctx.beginPath()
    ctx.arc(8, -19, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.7
    ctx.stroke()

    // Pointed nose & chin profile
    ctx.beginPath()
    ctx.moveTo(11, -21)
    ctx.lineTo(15, -19)
    ctx.lineTo(11, -17)
    ctx.lineTo(14, -15)
    ctx.lineTo(9, -15)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.7
    ctx.stroke()

    // 4. Iconic Witch Hat
    ctx.save()
    ctx.translate(8, -22)
    ctx.rotate(-0.2)

    // Wide Brim
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(0, 0, 11, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.7
    ctx.stroke()

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
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.7
    ctx.stroke()

    ctx.restore()

    // 5. Tiny black cat riding behind her on the broom
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.ellipse(-14, 2, 3.5, 2.5, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.6
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(-11, -1, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.6
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(-12, -2)
    ctx.lineTo(-12.5, -4.5)
    ctx.lineTo(-10.5, -3)
    ctx.moveTo(-10.5, -3)
    ctx.lineTo(-9.5, -4.5)
    ctx.lineTo(-9, -2)
    ctx.fill()
    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 0.6
    ctx.stroke()

    ctx.strokeStyle = outlineColor
    ctx.lineWidth = 2.0
    ctx.beginPath()
    ctx.moveTo(-17, 3)
    ctx.quadraticCurveTo(-22, 1, -20, -3)
    ctx.stroke()

    ctx.strokeStyle = color
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-17, 3)
    ctx.quadraticCurveTo(-22, 1, -20, -3)
    ctx.stroke()

    // Tiny glowing cat eyes
    ctx.fillStyle = '#a3e635'
    ctx.beginPath()
    ctx.arc(-10.2, -1.2, 0.45, 0, Math.PI * 2)
    ctx.arc(-11.5, -1.2, 0.45, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const drawSanta = (
    x: number,
    y: number,
    scale: number,
    dir: 1 | -1,
    t: number
  ) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(dir * scale, scale)

    // Reindeer 1 (lead Rudolph at x = 70) and Reindeer 2 (at x = 36)
    const drawReindeer = (rx: number, ry: number, isLead: boolean) => {
      const gallop = Math.sin(t / 75 + rx) * 4
      ctx.save()
      ctx.translate(rx, ry + gallop * 0.3)

      // Reindeer Body
      ctx.fillStyle = '#78350f'
      ctx.beginPath()
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2)
      ctx.fill()

      // Neck & Chest
      ctx.beginPath()
      ctx.moveTo(8, -2)
      ctx.lineTo(16, -14)
      ctx.lineTo(11, -15)
      ctx.lineTo(4, 2)
      ctx.closePath()
      ctx.fill()

      // Head
      ctx.beginPath()
      ctx.ellipse(17, -15, 6, 4, 0.2, 0, Math.PI * 2)
      ctx.fill()

      // Antlers
      ctx.strokeStyle = '#451a03'
      ctx.lineWidth = 1.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(15, -18)
      ctx.lineTo(14, -26)
      ctx.lineTo(11, -28)
      ctx.moveTo(14, -23)
      ctx.lineTo(18, -26)
      ctx.stroke()

      // Galloping legs
      const legFront = Math.sin(t / 75 + rx) * 5
      const legBack = -legFront
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(8, 4)
      ctx.lineTo(15 + legFront, 15)
      ctx.moveTo(-8, 4)
      ctx.lineTo(-15 + legBack, 14)
      ctx.stroke()

      // Nose
      if (isLead) {
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(23, -15, 2.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)'
        ctx.beginPath()
        ctx.arc(23, -15, 6, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillStyle = '#1c1917'
        ctx.beginPath()
        ctx.arc(22, -15, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Red harness with bell
      ctx.strokeStyle = '#dc2626'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(0, 0, 8, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.arc(4, 4, 1.5, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }

    drawReindeer(70, -4, true)
    drawReindeer(36, -2, false)

    // Golden reins from Santa to reindeer
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-6, -8)
    ctx.quadraticCurveTo(15, -4, 36, -4)
    ctx.quadraticCurveTo(52, -6, 70, -6)
    ctx.stroke()

    // Sleigh: Golden Runners underneath
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(-36, 12)
    ctx.lineTo(8, 12)
    ctx.quadraticCurveTo(18, 12, 16, 4)
    ctx.moveTo(-32, 12)
    ctx.lineTo(-28, 4)
    ctx.moveTo(-2, 12)
    ctx.lineTo(2, 4)
    ctx.stroke()

    // Sleigh Red Body
    ctx.fillStyle = '#b91c1c'
    ctx.beginPath()
    ctx.moveTo(-34, 4)
    ctx.quadraticCurveTo(-38, -6, -26, -4)
    ctx.lineTo(2, -4)
    ctx.quadraticCurveTo(12, -4, 8, 4)
    ctx.lineTo(-30, 4)
    ctx.closePath()
    ctx.fill()

    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 1.8
    ctx.stroke()

    // Giant toy sack in the back of sleigh
    ctx.fillStyle = '#15803d'
    ctx.beginPath()
    ctx.ellipse(-26, -10, 11, 13, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-30, -18)
    ctx.lineTo(-22, -18)
    ctx.stroke()

    // Santa in sleigh
    // Body & Belt
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.ellipse(-10, -8, 9, 10, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1c1917'
    ctx.fillRect(-16, -6, 13, 3)
    ctx.fillStyle = '#facc15'
    ctx.fillRect(-11, -7, 4, 5)

    // White Beard
    ctx.fillStyle = '#f8fafc'
    ctx.beginPath()
    ctx.ellipse(-6, -13, 6, 7, 0.2, 0, Math.PI * 2)
    ctx.fill()

    // Face & Nose
    ctx.fillStyle = '#fde68a'
    ctx.beginPath()
    ctx.arc(-7, -18, 4.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f43f5e'
    ctx.beginPath()
    ctx.arc(-5, -17, 1.6, 0, Math.PI * 2)
    ctx.fill()

    // Red Hat & white trim & pompom
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(-8, -22, 6, 2.5, 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#dc2626'
    ctx.beginPath()
    ctx.moveTo(-13, -22)
    ctx.lineTo(-3, -22)
    ctx.quadraticCurveTo(-14, -30, -22, -24)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(-22, -24, 2.8, 0, Math.PI * 2)
    ctx.fill()

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

    const seasonalDate = getSeasonalDate()
    const october = isOctober(seasonalDate)
    const christmasDay = isChristmasDay(seasonalDate)
    const newYearsDay = isNewYearsDay(seasonalDate)

    // Decide whether this layer has anything to render at all. A clear day has
    // no weather and no fireflies, so the canvas would otherwise clear and
    // composite a full-screen transparent layer 30x/sec for nothing. Hide the
    // element entirely in that case so the compositor skips it.
    const wantsWeather = kind === 'rainy' || kind === 'stormy' || kind === 'snowy'
    const wantsFlies = (phase === 'night' || phase === 'dusk') && calm
    const creaturesPossible = calm && (october || daylight)
    const witchPossible = october && calm
    const santaPossible = christmasDay && calm

    const active =
      wantsWeather ||
      wantsFlies ||
      flock !== null ||
      witch !== null ||
      santa !== null ||
      christmasDay ||
      newYearsDay ||
      (creaturesPossible && t > nextFlock) ||
      (witchPossible && t > nextWitch) ||
      (santaPossible && t > nextSanta)

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
        const scale = rand(1.9, 2.3) // 2 sizes bigger (was 0.85-1.25)
        const baseY = h * rand(0.08, 0.28)
        witch = {
          x: dir === 1 ? -240 : w + 240,
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
            x: witch.x - witch.dir * 46 * witch.scale + rand(-4, 4),
            y: witch.y + 4 * witch.scale + rand(-3, 3),
            alpha: rand(0.65, 0.95),
            size: rand(2.0, 3.8),
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

        const gone = witch.dir === 1 ? witch.x - 260 > w : witch.x + 260 < 0
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

    // Santa: Christmas Day flight across the sky with reindeer and sleigh.
    if (santaPossible) {
      if (!santa && t > nextSanta) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
        const scale = rand(0.9, 1.3)
        const baseY = h * rand(0.1, 0.28)
        santa = {
          x: dir === 1 ? -160 : w + 160,
          y: baseY,
          baseY,
          speed: rand(110, 150),
          dir,
          scale,
          sparkles: [],
        }
      }
      if (santa) {
        santa.x += santa.dir * santa.speed * dt
        santa.y = santa.baseY + Math.sin(t / 500) * 12

        // Magical golden stardust sparkles behind sleigh
        if (Math.random() < 0.4) {
          santa.sparkles.push({
            x: santa.x - santa.dir * 45 * santa.scale + rand(-6, 6),
            y: santa.y + 4 * santa.scale + rand(-4, 4),
            alpha: rand(0.7, 1),
            size: rand(1.8, 3.2),
          })
        }

        for (let i = santa.sparkles.length - 1; i >= 0; i--) {
          const sp = santa.sparkles[i]
          sp.alpha -= dt * 1.3
          sp.y += dt * 6
          if (sp.alpha <= 0) {
            santa.sparkles.splice(i, 1)
          }
        }

        const gone = santa.dir === 1 ? santa.x - 200 > w : santa.x + 200 < 0
        if (gone) {
          santa = null
          nextSanta = t + rand(60_000, 130_000)
        } else {
          for (const sp of santa.sparkles) {
            ctx.fillStyle = `rgba(250, 204, 21, ${sp.alpha})`
            ctx.beginPath()
            ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
            ctx.fill()
          }
          drawSanta(santa.x, santa.y, santa.scale, santa.dir, t)
        }
      }
    } else {
      santa = null
    }

    // Christmas Day: falling wrapped gifts in the background!
    if (christmasDay) {
      for (const g of gifts) {
        g.y += g.speed * dt
        if (g.y > h + 30) {
          g.y = -35
          g.baseX = Math.random() * w
        }
        g.x = g.baseX + Math.sin(t / 1400 + g.offset) * g.sway
        g.angle += g.rotSpeed * dt

        ctx.save()
        ctx.translate(g.x, g.y)
        ctx.rotate(g.angle)
        const s = g.size
        // Box
        ctx.fillStyle = g.boxColor
        ctx.fillRect(-s / 2, -s / 2, s, s)
        // Ribbon cross
        ctx.fillStyle = g.ribbonColor
        ctx.fillRect(-s / 2, -s / 6, s, s / 3)
        ctx.fillRect(-s / 6, -s / 2, s / 3, s)
        // Bow loops
        ctx.beginPath()
        ctx.ellipse(-s / 4, -s / 2 - 2, s / 4, s / 6, -0.4, 0, Math.PI * 2)
        ctx.ellipse(s / 4, -s / 2 - 2, s / 4, s / 6, 0.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
    }

    // January 1st: New Year fireworks and explosions!
    if (newYearsDay) {
      if (t > nextRocket) {
        nextRocket = t + rand(650, 1500)
        const fireworkColors = [
          '#facc15', // Gold
          '#f43f5e', // Ruby
          '#22c55e', // Emerald
          '#38bdf8', // Cyan
          '#a855f7', // Violet
          '#fb923c', // Amber
          '#ffffff', // Diamond
        ]
        const launchCount = Math.random() < 0.3 ? 2 : 1
        for (let l = 0; l < launchCount; l++) {
          rockets.push({
            x: w * rand(0.12, 0.88),
            y: h + 10,
            targetY: h * rand(0.1, 0.45),
            speed: rand(620, 880),
            color: fireworkColors[Math.floor(Math.random() * fireworkColors.length)],
            trail: [],
          })
        }
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.y -= r.speed * dt
        r.trail.push({ x: r.x, y: r.y, alpha: 1 })

        if (r.y <= r.targetY) {
          // Burst apex: Flash
          flashes.push({
            x: r.x,
            y: r.y,
            color: r.color,
            radius: rand(45, 90),
            alpha: 0.85,
          })

          // Burst apex: Sparks
          const count = Math.floor(rand(45, 70))
          for (let j = 0; j < count; j++) {
            const angle = Math.random() * Math.PI * 2
            const speed = rand(70, 240)
            sparks.push({
              x: r.x,
              y: r.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: r.color,
              alpha: 1,
              decay: rand(0.55, 1.1),
              size: rand(1.6, 3.2),
            })
          }
          rockets.splice(i, 1)
        }
      }

      // Rocket heads & fizzing trails
      for (const r of rockets) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2)
        ctx.fill()

        for (let k = r.trail.length - 1; k >= 0; k--) {
          const pt = r.trail[k]
          pt.alpha -= dt * 4.5
          if (pt.alpha <= 0) {
            r.trail.splice(k, 1)
          } else {
            ctx.fillStyle = `rgba(254, 240, 138, ${pt.alpha})`
            ctx.fillRect(pt.x - 1, pt.y - 1, 2, 4)
          }
        }
      }

      // Explosions / Flashes
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i]
        fl.alpha -= dt * 4.2
        if (fl.alpha <= 0) {
          flashes.splice(i, 1)
        } else {
          const grad = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.radius)
          grad.addColorStop(0, `rgba(255, 255, 255, ${fl.alpha * 0.9})`)
          grad.addColorStop(0.35, `${fl.color}${Math.floor(fl.alpha * 180).toString(16).padStart(2, '0')}`)
          grad.addColorStop(1, 'transparent')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(fl.x, fl.y, fl.radius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Exploding Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i]
        sp.x += sp.vx * dt
        sp.y += sp.vy * dt
        sp.vy += 120 * dt
        sp.vx *= 0.96
        sp.vy *= 0.96
        sp.alpha -= sp.decay * dt

        if (sp.alpha <= 0) {
          sparks.splice(i, 1)
        } else {
          ctx.globalAlpha = sp.alpha
          ctx.fillStyle = sp.color
          ctx.beginPath()
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.globalAlpha = 1
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
