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
  isNovember,
  isDiwaliSeason,
  isDecember,
  isElfSeason,
  isChristmasDay,
  isNewYearsDay,
  isNewYearSeason,
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

interface SwarmBat {
  dx: number
  dy: number
  scale: number
  isAlpha: boolean
  isDistant: boolean
  isBehind: boolean
  speedMult: number
  flapRate: number
  flapOffset: number
  swoopPeriod: number
  swoopDepth: number
  swoopPhase: number
  dartPeriod: number
  dartAmp: number
  dartPhase: number
}

interface BatSwarm {
  x: number
  y: number
  speed: number
  dir: 1 | -1
  bats: SwarmBat[]
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

interface FallingLeaf {
  x: number
  baseX: number
  y: number
  size: number
  speed: number
  sway: number
  angle: number
  rotSpeed: number
  flipSpeed: number
  offset: number
  leafType: 'maple' | 'oak' | 'birch'
  color: string
}

interface SkyLantern {
  x: number
  baseX: number
  y: number
  size: number
  speed: number
  sway: number
  offset: number
  color: string
}

interface FireworksRocket {
  x: number
  y: number
  targetY: number
  speed: number
  color: string
  trail: { x: number; y: number; alpha: number }[]
  isBottleRocket?: boolean
  stickLength?: number
  tilt?: number
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

export function startFxCanvas(
  canvas: HTMLCanvasElement,
  get: () => SkyState,
  bgCanvas?: HTMLCanvasElement | null
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const bgCtx = bgCanvas?.getContext('2d') ?? null
  let bgHadDraw = false

  const fireflyGlow = makeGlowSprite(220, 255, 150)

  let drops: Drop[] = []
  let flakes: Flake[] = []
  let flies: Firefly[] = []
  let gifts: FallingGift[] = []
  let leaves: FallingLeaf[] = []
  let lanterns: SkyLantern[] = []
  let rockets: FireworksRocket[] = []
  let sparks: FireworksSpark[] = []
  let flashes: FireworksFlash[] = []
  let sizeKey = ''
  let flock: Flock | null = null
  let nextFlock = performance.now() + rand(15_000, 60_000)
  let batSwarm: BatSwarm | null = null
  let nextBatSwarm = performance.now() + rand(25_000, 55_000)
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
    if (bgCanvas && (bgCanvas.width !== pw || bgCanvas.height !== ph)) {
      bgCanvas.width = pw
      bgCanvas.height = ph
    }
  }

  resize()
  window.addEventListener('resize', resize)

  const handleTriggerGeese = () => {
    nextFlock = 0
  }
  window.addEventListener('trigger-geese', handleTriggerGeese)

  const handleTriggerBats = () => {
    nextBatSwarm = 0
  }
  window.addEventListener('trigger-bats', handleTriggerBats)

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

    const leafColors = ['#dc2626', '#b91c1c', '#ea580c', '#c2410c', '#d97706', '#b45309', '#f59e0b']
    const leafTypes: ('maple' | 'oak' | 'birch')[] = ['maple', 'oak', 'birch']
    leaves = Array.from({ length: Math.round(26 * density) }, () => ({
      x: Math.random() * w,
      baseX: Math.random() * w,
      y: Math.random() * h,
      size: rand(14, 24),
      speed: rand(34, 68),
      sway: rand(22, 50),
      angle: rand(0, Math.PI * 2),
      rotSpeed: rand(-0.8, 0.8),
      flipSpeed: rand(1.2, 2.4),
      offset: rand(0, Math.PI * 2),
      leafType: leafTypes[Math.floor(Math.random() * leafTypes.length)],
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
    }))

    const lanternColors = ['#f97316', '#ea580c', '#f59e0b', '#dc2626', '#eab308']
    lanterns = Array.from({ length: Math.round(12 * density) }, () => ({
      x: Math.random() * w,
      baseX: Math.random() * w,
      y: Math.random() * h,
      size: rand(16, 26),
      speed: rand(18, 36),
      sway: rand(12, 28),
      offset: rand(0, Math.PI * 2),
      color: lanternColors[Math.floor(Math.random() * lanternColors.length)],
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

  const createBatSwarm = (w: number, h: number): BatSwarm => {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
    const count = 18 + Math.floor(Math.random() * 5) // 18 - 22 bats: ideal colony size
    const bats: SwarmBat[] = []

    for (let i = 0; i < count; i++) {
      const isAlpha = i < 2 // 2 prominent scary foreground alpha bats with glowing eyes & fangs
      const isDistant = !isAlpha && i >= 10 // ~8-10 background silhouette bats
      // Assign layering: distant bats go behind the photos!
      const isBehind = isDistant && !!bgCtx

      const scale = isAlpha
        ? rand(1.85, 2.35)
        : isDistant
        ? rand(0.7, 1.1)
        : rand(1.25, 1.65)

      // Wide, organic cloud distribution across the swarm
      const dx = (Math.random() - 0.5) * 500 - i * 14 * dir
      const dy = (Math.random() - 0.5) * 190

      const speedMult = rand(0.85, 1.35)
      const flapRate = rand(0.022, 0.032) // Rapid flutter (22-32 rad/ms)
      const flapOffset = Math.random() * Math.PI * 2

      // Deep acrobatic swoops & plunges
      const swoopPeriod = rand(1100, 2400)
      const swoopDepth = rand(35, isAlpha ? 110 : 70)
      const swoopPhase = Math.random() * Math.PI * 2

      // Erratic hunting twitches
      const dartPeriod = rand(320, 700)
      const dartAmp = rand(10, 26)
      const dartPhase = Math.random() * Math.PI * 2

      bats.push({
        dx,
        dy,
        scale,
        isAlpha,
        isDistant,
        isBehind,
        speedMult,
        flapRate,
        flapOffset,
        swoopPeriod,
        swoopDepth,
        swoopPhase,
        dartPeriod,
        dartAmp,
        dartPhase,
      })
    }

    // Sort: background bats first, then foreground bats by scale ascending
    bats.sort((a, b) => {
      if (a.isBehind !== b.isBehind) return a.isBehind ? -1 : 1
      return a.scale - b.scale
    })

    return {
      x: dir === 1 ? -350 : w + 350,
      y: h * rand(0.12, 0.38),
      speed: rand(145, 195),
      dir,
      bats,
    }
  }

  const drawBat = (
    targetCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    flap: number,
    scale: number,
    dir: 1 | -1,
    pitch: number = 0,
    isAlpha: boolean = false,
    isDistant: boolean = false,
    skyPhase: string = 'night'
  ) => {
    targetCtx.save()
    targetCtx.translate(x, y)
    targetCtx.scale(dir * scale, scale)
    targetCtx.rotate(pitch)

    const s = Math.sin(flap) // -1: upstroke, +1: downstroke

    // Colors adapted for contrast across sky phases
    const isBrightSky = skyPhase === 'day' || skyPhase === 'dawn'
    const bodyColor = isBrightSky ? '#15121e' : '#0b0911'
    const wingMembrane = isBrightSky ? '#1e1a2b' : '#14111d'
    const boneColor = isBrightSky ? '#3d3452' : '#342c48'
    const earInner = isBrightSky ? '#2d253d' : '#262035'

    // 1. LEFT & RIGHT WINGS: Scalloped leathery membrane, carpal thumb spurs, and finger bones
    for (const side of [-1, 1]) {
      targetCtx.save()
      targetCtx.beginPath()
      targetCtx.moveTo(side * 2.5, -3)

      const wristX = side * 13
      const wristY = -6 - s * 9
      const thumbX = side * 14.5
      const thumbY = -11 - s * 9.5

      const tipX = side * 27
      const tipY = -1 - s * 16
      const d4X = side * 21
      const d4Y = 7 - s * 10
      const d5X = side * 13.5
      const d5Y = 10 - s * 6
      const hipX = side * 2.5
      const hipY = 5

      // Leading edge
      targetCtx.quadraticCurveTo(side * 7, -5 - s * 5, wristX, wristY)
      targetCtx.lineTo(thumbX, thumbY)
      targetCtx.lineTo(wristX + side * 0.5, wristY - 1)
      targetCtx.quadraticCurveTo(side * 19, -4 - s * 13, tipX, tipY)

      // Scalloped trailing edge between finger struts
      targetCtx.quadraticCurveTo(side * 23, 0 - s * 13, d4X, d4Y)
      targetCtx.quadraticCurveTo(side * 16.5, 6 - s * 8, d5X, d5Y)
      targetCtx.quadraticCurveTo(side * 8, 8 - s * 3.5, hipX, hipY)

      targetCtx.closePath()
      targetCtx.fillStyle = wingMembrane
      targetCtx.fill()

      // Finger bone struts (skip on distant background silhouettes for tablet efficiency)
      if (!isDistant) {
        targetCtx.strokeStyle = boneColor
        targetCtx.lineWidth = 0.8
        targetCtx.beginPath()
        targetCtx.moveTo(side * 2.5, -3)
        targetCtx.lineTo(wristX, wristY)
        targetCtx.moveTo(wristX, wristY)
        targetCtx.quadraticCurveTo(side * 20, -3 - s * 12, tipX, tipY)
        targetCtx.moveTo(wristX, wristY)
        targetCtx.quadraticCurveTo(side * 17, 1 - s * 9, d4X, d4Y)
        targetCtx.moveTo(wristX, wristY)
        targetCtx.quadraticCurveTo(side * 13, 3 - s * 7, d5X, d5Y)
        targetCtx.stroke()
      }

      targetCtx.restore()
    }

    // 2. BODY & TAIL MEMBRANE
    targetCtx.fillStyle = bodyColor
    targetCtx.beginPath()
    targetCtx.ellipse(0, 1, 3.8, 6.5, 0, 0, Math.PI * 2)
    targetCtx.fill()

    // Uropatagium (tail membrane)
    targetCtx.beginPath()
    targetCtx.moveTo(-2.8, 4)
    targetCtx.lineTo(2.8, 4)
    targetCtx.lineTo(0, 11)
    targetCtx.closePath()
    targetCtx.fillStyle = bodyColor
    targetCtx.fill()

    if (!isDistant) {
      // Clawed rear feet
      targetCtx.fillStyle = boneColor
      targetCtx.fillRect(-3.2, 7.5, 1.2, 2.5)
      targetCtx.fillRect(2.0, 7.5, 1.2, 2.5)
    }

    // 3. HEAD & POINTED DEMONIC EARS
    targetCtx.fillStyle = bodyColor
    targetCtx.beginPath()
    targetCtx.arc(0, -6.5, 4.2, 0, Math.PI * 2)
    targetCtx.moveTo(-1.2, -8.5)
    targetCtx.lineTo(-4.8, -16)
    targetCtx.lineTo(-4.0, -6.5)
    targetCtx.moveTo(1.2, -8.5)
    targetCtx.lineTo(4.8, -16)
    targetCtx.lineTo(4.0, -6.5)
    targetCtx.fill()

    if (!isDistant) {
      // Inner ear depth
      targetCtx.fillStyle = earInner
      targetCtx.beginPath()
      targetCtx.moveTo(-1.8, -8.5)
      targetCtx.lineTo(-4.2, -14.5)
      targetCtx.lineTo(-3.4, -7.5)
      targetCtx.moveTo(1.8, -8.5)
      targetCtx.lineTo(4.2, -14.5)
      targetCtx.lineTo(3.4, -7.5)
      targetCtx.fill()

      // 4. MOUTH & SHARP WHITE FANGS
      targetCtx.fillStyle = '#050308'
      targetCtx.beginPath()
      targetCtx.ellipse(0, -4.2, 2.2, 1.0, 0, 0, Math.PI)
      targetCtx.fill()

      targetCtx.fillStyle = '#ffffff'
      targetCtx.beginPath()
      targetCtx.moveTo(-1.6, -4.6)
      targetCtx.lineTo(-0.8, -4.6)
      targetCtx.lineTo(-1.2, -2.4)
      targetCtx.closePath()
      targetCtx.fill()

      targetCtx.beginPath()
      targetCtx.moveTo(0.8, -4.6)
      targetCtx.lineTo(1.6, -4.6)
      targetCtx.lineTo(1.2, -2.4)
      targetCtx.closePath()
      targetCtx.fill()
    }

    // 5. DEMONIC RED EYES
    if (isAlpha) {
      // Full demonic glow for alpha leaders
      targetCtx.save()
      targetCtx.shadowColor = '#ff1111'
      targetCtx.shadowBlur = 10
      targetCtx.fillStyle = '#ff2222'
      targetCtx.beginPath()
      targetCtx.arc(-2.0, -7.0, 1.5, 0, Math.PI * 2)
      targetCtx.arc(2.0, -7.0, 1.5, 0, Math.PI * 2)
      targetCtx.fill()
      targetCtx.restore()

      // Bright eye core
      targetCtx.fillStyle = '#fff5f5'
      targetCtx.beginPath()
      targetCtx.arc(-2.0, -7.0, 0.45, 0, Math.PI * 2)
      targetCtx.arc(2.0, -7.0, 0.45, 0, Math.PI * 2)
      targetCtx.fill()
    } else if (!isDistant) {
      // Crisp red eye dots without expensive shadowBlur for midground bats (tablet friendly)
      targetCtx.fillStyle = '#ff2222'
      targetCtx.beginPath()
      targetCtx.arc(-2.0, -7.0, 1.2, 0, Math.PI * 2)
      targetCtx.arc(2.0, -7.0, 1.2, 0, Math.PI * 2)
      targetCtx.fill()
    }

    targetCtx.restore()
  }

  const drawGoose = (
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

    const s = Math.sin(flap) // -1 on upstroke, +1 on downstroke
    // Subtle body pitch with flap
    ctx.rotate(s * 0.04)

    // Palette: Authentically colored Canada Goose with contrast
    const isDark = color.includes('1e293b') || color.includes('rgba(20') || color.includes('rgba(30')
    const bodyMantle = isDark ? '#332922' : '#524337'
    const breastBelly = isDark ? '#64748b' : '#94a3b8'
    const blackPlumage = isDark ? '#0f172a' : '#18181b'
    const whitePatch = '#ffffff'
    const farWingColor = isDark ? '#1e1915' : '#382e25'
    const nearWingColor = isDark ? '#2a221b' : '#45382e'
    const primaryFeatherColor = isDark ? '#14110e' : '#231d17'

    // 1. Far Wing (behind body)
    // Upstroke: sweeps high back; Downstroke: pushes down/back
    ctx.save()
    ctx.fillStyle = farWingColor
    ctx.beginPath()
    ctx.moveTo(2, -2)
    if (s < 0) {
      // High upstroke
      const lift = -s * 14
      ctx.quadraticCurveTo(-2, -8 - lift * 0.5, -8, -14 - lift)
      ctx.quadraticCurveTo(-15, -18 - lift, -18, -15 - lift)
      ctx.quadraticCurveTo(-12, -8 - lift * 0.6, -6, -2)
    } else {
      // Downstroke
      const drop = s * 10
      ctx.quadraticCurveTo(-4, -6, -14, 2 + drop)
      ctx.quadraticCurveTo(-18, 0 + drop, -16, -4)
      ctx.quadraticCurveTo(-8, -6, -6, -2)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // 2. Tucked Black Webbed Feet (under tail)
    ctx.fillStyle = blackPlumage
    ctx.beginPath()
    ctx.ellipse(-15, 2.5, 3.5, 1.2, 0.1, 0, Math.PI * 2)
    ctx.fill()

    // 3. Short Black Wedge Tail
    ctx.fillStyle = blackPlumage
    ctx.beginPath()
    ctx.moveTo(-13, 0)
    ctx.lineTo(-20, 1.5)
    ctx.lineTo(-14, 3.2)
    ctx.closePath()
    ctx.fill()

    // 4. Iconic Pure White "U"-Shaped Rump Band (distinctive Canada Goose field mark!)
    ctx.fillStyle = whitePatch
    ctx.beginPath()
    ctx.moveTo(-10, -1.8)
    ctx.lineTo(-14, 0)
    ctx.lineTo(-14, 3.2)
    ctx.lineTo(-10, 3.8)
    ctx.closePath()
    ctx.fill()

    // 5. Main Streamlined Body (Mantle & Breast)
    // Dark grayish-brown mantle back
    ctx.fillStyle = bodyMantle
    ctx.beginPath()
    ctx.ellipse(-1, 0.8, 11, 4.2, 0.08, 0, Math.PI * 2)
    ctx.fill()

    // Paler buff/tan breast and underbelly
    ctx.fillStyle = breastBelly
    ctx.beginPath()
    ctx.ellipse(2, 2.2, 7.5, 2.8, 0.05, 0, Math.PI * 2)
    ctx.fill()

    // 6. Long Outstretched Slender Jet-Black Neck & Head
    ctx.fillStyle = blackPlumage
    ctx.beginPath()
    // Base of neck smoothly joining chest
    ctx.moveTo(6, 3.5)
    ctx.quadraticCurveTo(12, 1.5, 18, 0)
    // Head crown
    ctx.quadraticCurveTo(24, -1, 27, -1.5)
    // Pointed bill tip
    ctx.lineTo(33, -1.8)
    ctx.lineTo(27, 0.8)
    // Throat
    ctx.quadraticCurveTo(18, 1.8, 8, -2)
    ctx.closePath()
    ctx.fill()

    // 7. Bold Signature White Cheek Patch ("Chinstrap")
    // Runs cleanly from throat under chin up the side of head behind eye
    ctx.fillStyle = whitePatch
    ctx.beginPath()
    ctx.moveTo(22, 0.5)
    ctx.lineTo(24, -1.8)
    ctx.lineTo(26, -1.5)
    ctx.lineTo(25, 0.6)
    ctx.closePath()
    ctx.fill()

    // Tiny dark eye highlight
    ctx.fillStyle = '#09090b'
    ctx.beginPath()
    ctx.arc(26.5, -0.8, 0.7, 0, Math.PI * 2)
    ctx.fill()

    // 8. Near Wing (in front of body with realistic avian joint and primary feather notches)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(1, 0)

    if (s < 0) {
      // UPSTROKE: Wing rises gracefully with wrist arched and feathers trailing
      const lift = -s * 18
      const elbowX = 0
      const elbowY = -8 - lift * 0.4
      const wristX = -8
      const wristY = -18 - lift * 0.9

      // Leading edge to wing tip
      ctx.quadraticCurveTo(elbowX, elbowY, wristX, wristY)

      // Primary feather fingers at wing tip
      ctx.lineTo(wristX - 6, wristY + 4)
      ctx.lineTo(wristX - 4, wristY + 7)
      ctx.lineTo(wristX - 8, wristY + 10)
      ctx.lineTo(wristX - 5, wristY + 13)

      // Trailing edge back to body
      ctx.quadraticCurveTo(-6, -4, -8, 1)
      ctx.closePath()

      ctx.fillStyle = nearWingColor
      ctx.fill()

      // Darker primary flight feathers accent
      ctx.fillStyle = primaryFeatherColor
      ctx.beginPath()
      ctx.moveTo(wristX, wristY)
      ctx.lineTo(wristX - 6, wristY + 4)
      ctx.lineTo(wristX - 4, wristY + 7)
      ctx.lineTo(wristX - 8, wristY + 10)
      ctx.lineTo(wristX - 5, wristY + 13)
      ctx.lineTo(wristX + 3, wristY + 8)
      ctx.closePath()
      ctx.fill()
    } else {
      // DOWNSTROKE: Powerful broad wing pushing down and back
      const drop = s * 14
      const elbowX = 2
      const elbowY = 6 + drop * 0.35
      const wristX = -10
      const wristY = 16 + drop * 0.85

      // Leading edge curving down
      ctx.quadraticCurveTo(elbowX, elbowY, wristX, wristY)

      // Primary feather tip notches trailing back
      ctx.lineTo(wristX - 5, wristY - 4)
      ctx.lineTo(wristX - 3, wristY - 7)
      ctx.lineTo(wristX - 7, wristY - 10)
      ctx.lineTo(wristX - 4, wristY - 13)

      // Trailing edge returning to shoulder
      ctx.quadraticCurveTo(-4, 0, -6, 0)
      ctx.closePath()

      ctx.fillStyle = nearWingColor
      ctx.fill()

      // Primary feather tip accents
      ctx.fillStyle = primaryFeatherColor
      ctx.beginPath()
      ctx.moveTo(wristX, wristY)
      ctx.lineTo(wristX - 5, wristY - 4)
      ctx.lineTo(wristX - 3, wristY - 7)
      ctx.lineTo(wristX - 7, wristY - 10)
      ctx.lineTo(wristX - 4, wristY - 13)
      ctx.lineTo(wristX + 4, wristY - 8)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()

    ctx.restore()
  }

  const drawLeaf = (leaf: FallingLeaf, t: number) => {
    ctx.save()
    ctx.translate(leaf.x, leaf.y)
    ctx.rotate(leaf.angle)
    // 3D tumble flip
    const flip = Math.cos((t / 800) * leaf.flipSpeed + leaf.offset)
    ctx.scale(1, flip)

    const s = leaf.size
    ctx.fillStyle = leaf.color
    ctx.strokeStyle = 'rgba(60, 20, 5, 0.4)'
    ctx.lineWidth = 0.8

    if (leaf.leafType === 'maple') {
      // Canadian Maple leaf: 5 lobes
      ctx.beginPath()
      ctx.moveTo(0, s * 0.45)
      ctx.lineTo(0, s * 0.25)
      // left lower lobe
      ctx.lineTo(-s * 0.28, s * 0.15)
      ctx.lineTo(-s * 0.42, s * 0.05)
      ctx.lineTo(-s * 0.25, -s * 0.08)
      // left middle lobe
      ctx.lineTo(-s * 0.48, -s * 0.25)
      ctx.lineTo(-s * 0.22, -s * 0.25)
      // center lobe
      ctx.lineTo(0, -s * 0.5)
      // right middle lobe
      ctx.lineTo(s * 0.22, -s * 0.25)
      ctx.lineTo(s * 0.48, -s * 0.25)
      // right lower lobe
      ctx.lineTo(s * 0.25, -s * 0.08)
      ctx.lineTo(s * 0.42, s * 0.05)
      ctx.lineTo(s * 0.28, s * 0.15)
      ctx.lineTo(0, s * 0.25)
      ctx.closePath()
      ctx.fill()

      // Vein lines
      ctx.beginPath()
      ctx.moveTo(0, s * 0.45)
      ctx.lineTo(0, -s * 0.42)
      ctx.moveTo(0, 0)
      ctx.lineTo(-s * 0.35, -s * 0.18)
      ctx.moveTo(0, 0)
      ctx.lineTo(s * 0.35, -s * 0.18)
      ctx.stroke()
    } else if (leaf.leafType === 'oak') {
      // Rounded lobed oak leaf
      ctx.beginPath()
      ctx.moveTo(0, s * 0.5)
      ctx.lineTo(0, s * 0.35)
      ctx.bezierCurveTo(-s * 0.25, s * 0.28, -s * 0.35, s * 0.1, -s * 0.15, s * 0.02)
      ctx.bezierCurveTo(-s * 0.4, -s * 0.08, -s * 0.42, -s * 0.26, -s * 0.18, -s * 0.3)
      ctx.bezierCurveTo(-s * 0.3, -s * 0.42, -s * 0.15, -s * 0.55, 0, -s * 0.52)
      ctx.bezierCurveTo(s * 0.15, -s * 0.55, s * 0.3, -s * 0.42, s * 0.18, -s * 0.3)
      ctx.bezierCurveTo(s * 0.42, -s * 0.26, s * 0.4, -s * 0.08, s * 0.15, s * 0.02)
      ctx.bezierCurveTo(s * 0.35, s * 0.1, s * 0.25, s * 0.28, 0, s * 0.35)
      ctx.closePath()
      ctx.fill()

      // Central vein
      ctx.beginPath()
      ctx.moveTo(0, s * 0.5)
      ctx.lineTo(0, -s * 0.45)
      ctx.stroke()
    } else {
      // Birch: teardrop / heart serrated leaf
      ctx.beginPath()
      ctx.moveTo(0, s * 0.45)
      ctx.lineTo(0, s * 0.3)
      ctx.bezierCurveTo(-s * 0.38, s * 0.18, -s * 0.42, -s * 0.12, 0, -s * 0.5)
      ctx.bezierCurveTo(s * 0.42, -s * 0.12, s * 0.38, s * 0.18, 0, s * 0.3)
      ctx.closePath()
      ctx.fill()

      // Central vein
      ctx.beginPath()
      ctx.moveTo(0, s * 0.45)
      ctx.lineTo(0, -s * 0.42)
      ctx.stroke()
    }

    ctx.restore()
  }

  const drawLantern = (lantern: SkyLantern, t: number) => {
    ctx.save()
    ctx.translate(lantern.x, lantern.y)
    const s = lantern.size
    const flicker = Math.sin(t / 110 + lantern.offset) * 0.15 + 0.85

    // Outer warm ambient glow halo
    const glowRad = s * 1.5
    const glow = ctx.createRadialGradient(0, -s * 0.1, s * 0.2, 0, -s * 0.1, glowRad)
    glow.addColorStop(0, `rgba(251, 191, 36, ${0.45 * flicker})`)
    glow.addColorStop(0.5, `rgba(249, 115, 22, ${0.2 * flicker})`)
    glow.addColorStop(1, 'rgba(249, 115, 22, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(0, -s * 0.1, glowRad, 0, Math.PI * 2)
    ctx.fill()

    // Lantern paper body (slightly tapered cylinder/dome)
    const bodyGrad = ctx.createLinearGradient(-s * 0.5, -s * 0.7, s * 0.5, s * 0.5)
    bodyGrad.addColorStop(0, '#fef08a') // bright warm yellow center
    bodyGrad.addColorStop(0.3, '#f59e0b') // warm amber
    bodyGrad.addColorStop(0.8, lantern.color) // festive orange/red
    bodyGrad.addColorStop(1, '#b45309')

    ctx.fillStyle = bodyGrad
    ctx.beginPath()
    // Domed top
    ctx.moveTo(-s * 0.32, -s * 0.5)
    ctx.quadraticCurveTo(0, -s * 0.72, s * 0.32, -s * 0.5)
    // Tapering curved sides down to base
    ctx.quadraticCurveTo(s * 0.46, 0, s * 0.28, s * 0.45)
    ctx.lineTo(-s * 0.28, s * 0.45)
    ctx.quadraticCurveTo(-s * 0.46, 0, -s * 0.32, -s * 0.5)
    ctx.closePath()
    ctx.fill()

    // Bamboo/wire rim bottom opening
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.ellipse(0, s * 0.45, s * 0.28, s * 0.08, 0, 0, Math.PI * 2)
    ctx.stroke()

    // Flame / inner light at bottom opening
    ctx.fillStyle = `rgba(255, 255, 220, ${0.9 * flicker})`
    ctx.beginPath()
    ctx.ellipse(0, s * 0.38, s * 0.12, s * 0.16, 0, 0, Math.PI * 2)
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
    const november = isNovember(seasonalDate)
    const diwali = isDiwaliSeason(seasonalDate)
    const christmasDay = isChristmasDay(seasonalDate)
    const newYearSeason = isNewYearSeason(seasonalDate)

    // Decide whether this layer has anything to render at all. A clear day has
    // no weather and no fireflies, so the canvas would otherwise clear and
    // composite a full-screen transparent layer 30x/sec for nothing. Hide the
    // element entirely in that case so the compositor skips it.
    const wantsWeather = kind === 'rainy' || kind === 'stormy' || kind === 'snowy'
    const wantsFlies = (phase === 'night' || phase === 'dusk') && calm
    const wantsLeaves = november && calm
    const wantsLanterns = diwali && (phase === 'night' || phase === 'dusk') && calm
    const wantsDiwaliFireworks = diwali && calm
    const batsPossible = october && calm
    const creaturesPossible = calm && (daylight || november)
    const witchPossible = october && calm
    const santaPossible = christmasDay && calm

    const active =
      wantsWeather ||
      wantsFlies ||
      wantsLeaves ||
      wantsLanterns ||
      wantsDiwaliFireworks ||
      batSwarm !== null ||
      flock !== null ||
      witch !== null ||
      santa !== null ||
      christmasDay ||
      newYearSeason ||
      (batsPossible && t > nextBatSwarm) ||
      (creaturesPossible && t > nextFlock) ||
      (witchPossible && t > nextWitch) ||
      (santaPossible && t > nextSanta)

    if (!active) {
      if (!blanked) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        canvas.style.visibility = 'hidden'
        if (bgCtx && bgCanvas) {
          bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
          bgCtx.clearRect(0, 0, w, h)
          bgCanvas.style.visibility = 'hidden'
        }
        blanked = true
      }
      return
    }
    if (blanked) {
      canvas.style.visibility = ''
      if (bgCanvas) bgCanvas.style.visibility = ''
      blanked = false
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    if (bgCtx) {
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (bgHadDraw) {
        bgCtx.clearRect(0, 0, w, h)
        bgHadDraw = false
      }
    }

    const key = `${w}x${h}x${state.quality ?? 'high'}`
    if (key !== sizeKey) {
      sizeKey = key
      seed(w, h, densityFor(state))
    }

    // 1. October Bat Swarms (spooky, erratic, high-density colony with leathery scalloped wings & glowing red eyes)
    if (batsPossible) {
      if (!batSwarm && t > nextBatSwarm) {
        batSwarm = createBatSwarm(w, h)
      }
      if (batSwarm) {
        batSwarm.x += batSwarm.dir * batSwarm.speed * dt
        const gone = batSwarm.dir === 1 ? batSwarm.x - 750 > w : batSwarm.x + 750 < 0
        if (gone) {
          batSwarm = null
          nextBatSwarm = t + rand(65_000, 130_000) // Spaced out: every 1 to 2.2 minutes
        } else {
          for (const b of batSwarm.bats) {
            // Compute erratic swooping and deep vertical diving
            const swoop = Math.sin((t / b.swoopPeriod) * Math.PI * 2 + b.swoopPhase)
            const dartX = Math.sin((t / b.dartPeriod) * Math.PI * 2 + b.dartPhase) * b.dartAmp
            const dartY = Math.cos((t / (b.dartPeriod * 1.3)) * Math.PI * 2 + b.dartPhase) * (b.dartAmp * 0.4)

            const bx = batSwarm.x + (b.dx + dartX) * batSwarm.dir
            const by = batSwarm.y + b.dy + swoop * b.swoopDepth + dartY

            // Dynamic pitch / banking along vertical dive velocity!
            // When swooping down, bat pitches down; when climbing out, bat banks upward
            const swoopVelY = Math.cos((t / b.swoopPeriod) * Math.PI * 2 + b.swoopPhase) * b.swoopDepth
            const pitch = Math.max(-0.55, Math.min(0.55, (swoopVelY / 65) * 0.45))

            // Frantic, jittery flap flutter
            const flap = t * b.flapRate + b.flapOffset

            const targetCtx = (b.isBehind && bgCtx) ? bgCtx : ctx
            if (b.isBehind && bgCtx) bgHadDraw = true

            drawBat(targetCtx, bx, by, flap, b.scale, batSwarm.dir, pitch, b.isAlpha, b.isDistant, phase)
          }
        }
      }
    } else {
      batSwarm = null
    }

    // 2. Birds (daylight) or Canada Geese in V-formation (November)
    if (creaturesPossible) {
      if (!flock && t > nextFlock) {
        const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1
        const scale = november ? rand(1.2, 1.55) : rand(0.8, 1.3)
        const gooseCount = 7 + Math.floor(Math.random() * 4) // 7-10 geese in V
        flock = {
          x: dir === 1 ? -160 : w + 160,
          y: november ? h * rand(0.04, 0.14) : h * rand(0.08, 0.32),
          speed: november ? rand(90, 125) : rand(90, 130),
          dir,
          scale,
          birds: november
            ? Array.from({ length: gooseCount }, (_, i) => {
                if (i === 0) return { dx: 0, dy: 0, flapOffset: 0 } // Leader
                const arm = i % 2 === 1 ? 1 : -1
                const row = Math.ceil(i / 2)
                return {
                  dx: -row * rand(38, 48),
                  dy: arm * row * rand(20, 28),
                  flapOffset: row * 0.42, // Graceful aerodynamic wave
                }
              })
            : Array.from({ length: 4 + Math.floor(Math.random() * 4) }, (_, i) => ({
                dx: -i * rand(24, 38),
                dy: (i % 2 === 0 ? 1 : -1) * i * rand(6, 14),
                flapOffset: rand(0, Math.PI * 2),
              })),
        }
      }
      if (flock) {
        flock.x += flock.dir * flock.speed * dt
        const gone = flock.dir === 1 ? flock.x - 450 > w : flock.x + 450 < 0
        if (gone) {
          flock = null
          nextFlock = t + rand(50_000, 130_000)
        } else {
          const color =
            phase === 'night'
              ? (november ? '#1e293b' : 'rgba(30,45,60,0.8)')
              : phase === 'dusk'
              ? (november ? '#334155' : 'rgba(30,45,60,0.8)')
              : phase === 'dawn'
              ? (november ? '#334155' : 'rgba(50,40,60,0.75)')
              : (november ? '#1e293b' : 'rgba(30,45,60,0.8)')
          for (const b of flock.birds) {
            const bx = flock.x + b.dx * flock.dir
            const by = flock.y + b.dy + Math.sin(t / 800 + b.flapOffset) * 4
            if (november) {
              drawGoose(bx, by, t / 195 + b.flapOffset, flock.scale, color, flock.dir)
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

    // November: swirling falling autumn leaves
    if (wantsLeaves) {
      for (const l of leaves) {
        l.y += l.speed * dt
        if (l.y > h + 30) {
          l.y = -35
          l.baseX = Math.random() * w
        }
        l.x = l.baseX + Math.sin(t / 1200 + l.offset) * l.sway
        l.angle += l.rotSpeed * dt
        drawLeaf(l, t)
      }
    }

    // Diwali: floating sky lanterns gently ascending into the night sky
    if (wantsLanterns) {
      for (const lan of lanterns) {
        lan.y -= lan.speed * dt
        if (lan.y < -40) {
          lan.y = h + 40
          lan.baseX = Math.random() * w
        }
        lan.x = lan.baseX + Math.sin(t / 1800 + lan.offset) * lan.sway
        drawLantern(lan, t)
      }
    }

    // Festive Fireworks: New Year's Season & Diwali Nights (Pataka & Rockets)!
    const wantsFireworks = newYearSeason || wantsDiwaliFireworks
    if (wantsFireworks) {
      if (t > nextRocket) {
        nextRocket = t + rand(diwali ? 450 : 650, diwali ? 1200 : 1500)
        const fireworkColors = diwali
          ? [
              '#facc15', // Sparkling Diwali Gold (Zari)
              '#ef4444', // Festive Crimson (Gulal)
              '#22c55e', // Emerald Green (Hara)
              '#f97316', // Saffron Orange (Kesari)
              '#c084fc', // Vibrant Violet
              '#38bdf8', // Sky Blue
              '#ffffff', // Diamond Sparkler
            ]
          : [
              '#facc15', // Gold
              '#f43f5e', // Ruby
              '#22c55e', // Emerald
              '#38bdf8', // Cyan
              '#a855f7', // Violet
              '#fb923c', // Amber
              '#ffffff', // Diamond
            ]
        const launchCount = Math.random() < 0.35 ? 2 : 1
        for (let l = 0; l < launchCount; l++) {
          let rx: number
          let tilt = 0
          const isBottle = diwali && Math.random() < 0.85
          if (diwali) {
            // Strictly constrain to side columns so central photo frame is never obstructed
            const side = Math.random() < 0.5 ? 'left' : 'right'
            if (side === 'left') {
              rx = w * rand(0.03, 0.14)
              tilt = rand(0.02, 0.06)
            } else {
              rx = w * rand(0.86, 0.97)
              tilt = rand(-0.06, -0.02)
            }
          } else {
            rx = w * rand(0.08, 0.92)
            tilt = rand(-0.03, 0.03)
          }

          rockets.push({
            x: rx,
            y: h + 15,
            targetY: h * rand(0.08, 0.40),
            speed: isBottle ? rand(720, 960) : rand(620, 880),
            color: fireworkColors[Math.floor(Math.random() * fireworkColors.length)],
            trail: [],
            isBottleRocket: isBottle,
            stickLength: rand(24, 30),
            tilt,
          })
        }
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.y -= r.speed * dt
        r.x += (r.tilt ?? 0) * r.speed * dt * 0.35
        r.trail.push({ x: r.x, y: r.y, alpha: 1 })

        // Sputtering exhaust sparks shooting down behind bottle rocket
        if (r.isBottleRocket && Math.random() < 0.55) {
          sparks.push({
            x: r.x + rand(-2, 2),
            y: r.y + (r.stickLength || 26),
            vx: rand(-16, 16),
            vy: rand(60, 140),
            color: Math.random() < 0.65 ? '#facc15' : '#ffffff',
            alpha: 0.9,
            decay: rand(3.0, 5.0),
            size: rand(1.2, 2.4),
          })
        }

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
        if (r.isBottleRocket) {
          ctx.save()
          ctx.translate(r.x, r.y)
          ctx.rotate(r.tilt || 0)

          const sl = r.stickLength || 26
          // 1. Bamboo guide stick
          ctx.strokeStyle = '#d97706'
          ctx.lineWidth = 1.3
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(0, sl)
          ctx.stroke()

          // 2. Rocket Cartridge Body
          ctx.fillStyle = r.color
          ctx.fillRect(-2.5, -14, 5, 14)

          // Metallic / Gold brand band
          ctx.fillStyle = '#facc15'
          ctx.fillRect(-2.5, -9, 5, 4)

          // 3. Conical Nose Cone
          ctx.fillStyle = '#ef4444'
          ctx.beginPath()
          ctx.moveTo(-3, -14)
          ctx.lineTo(0, -22)
          ctx.lineTo(3, -14)
          ctx.closePath()
          ctx.fill()

          ctx.fillStyle = '#fef08a'
          ctx.beginPath()
          ctx.arc(0, -21, 1, 0, Math.PI * 2)
          ctx.fill()

          // 4. White-gold fiery exhaust jet at base nozzle
          const fl = rand(7, 13)
          const fw = rand(3, 5)
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.moveTo(-fw * 0.5, 0)
          ctx.lineTo(0, fl)
          ctx.lineTo(fw * 0.5, 0)
          ctx.closePath()
          ctx.fill()

          ctx.fillStyle = '#f97316'
          ctx.beginPath()
          ctx.moveTo(-fw, 0)
          ctx.lineTo(0, fl * 1.6)
          ctx.lineTo(fw, 0)
          ctx.closePath()
          ctx.fill()

          ctx.restore()
        } else {
          ctx.fillStyle = '#ffffff'
          ctx.beginPath()
          ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2)
          ctx.fill()
        }

        for (let k = r.trail.length - 1; k >= 0; k--) {
          const pt = r.trail[k]
          pt.alpha -= dt * 4.5
          if (pt.alpha <= 0) {
            r.trail.splice(k, 1)
          } else {
            ctx.fillStyle = r.isBottleRocket
              ? `rgba(251, 191, 36, ${pt.alpha * 0.85})`
              : `rgba(254, 240, 138, ${pt.alpha})`
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
    window.removeEventListener('trigger-geese', handleTriggerGeese)
    window.removeEventListener('trigger-bats', handleTriggerBats)
  }
}
