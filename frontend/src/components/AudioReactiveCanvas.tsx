import React, { useEffect, useRef } from 'react'
import { LyricsVisualMode } from './FullscreenLyrics'

export interface SpectrumData {
  fps: number
  bands: number
  bytes: Uint8Array
  frameCount: number
}

export interface PlaybackClock {
  elapsed: number
  perfMs: number
  syncOffset: number
}

interface AudioReactiveCanvasProps {
  mode: LyricsVisualMode
  isPlaying: boolean
  clockRef: React.MutableRefObject<PlaybackClock>
  spectrum: SpectrumData | null
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  colorIdx: number
}

interface Star {
  nx: number
  ny: number
  size: number
  phase: number
  band: number
}

interface Firefly {
  nx: number
  ny: number
  vx: number
  vy: number
  phase: number
  spriteIdx: number
  size: number
}

const NUM_BARS = 24
const TARGET_FRAME_MS = 33 // Smooth locked 30fps on Android kiosk tablets
const RENDER_SCALE = 0.6

// Balanced weights across the 200Hz - 8000Hz spectrum (vocals, melody, snare, presence, brilliance)
const MAIN_FOCUS_WEIGHTS = [
  0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.2, 1.18,
  1.15, 1.12, 1.1, 1.08, 1.05, 1.02, 1.0, 0.95,
]

function makeGlowOrb(hue: number, sat = 95, light = 68): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  grad.addColorStop(0, `hsla(${hue}, 100%, 92%, 1)`)
  grad.addColorStop(0.28, `hsla(${hue}, ${sat}%, ${light}%, 0.72)`)
  grad.addColorStop(0.65, `hsla(${hue}, ${sat}%, ${light - 10}%, 0.18)`)
  grad.addColorStop(1, `hsla(${hue}, ${sat}%, ${light - 15}%, 0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return c
}

function makeStarSprite(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 14)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.3, 'rgba(255,248,220,0.65)')
  grad.addColorStop(1, 'rgba(255,248,220,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  g.fillStyle = 'rgba(255,255,255,0.92)'
  g.fillRect(15, 3, 2, 26)
  g.fillRect(3, 15, 26, 2)
  return c
}

function makeBarGradientStrip(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = NUM_BARS * 4
  c.height = 180
  const g = c.getContext('2d')!
  for (let i = 0; i < NUM_BARS; i++) {
    const hue = Math.round((i / NUM_BARS) * 260 + 190) % 360
    const grad = g.createLinearGradient(0, 180, 0, 0)
    grad.addColorStop(0, `hsla(${hue}, 90%, 50%, 0.85)`)
    grad.addColorStop(0.55, `hsla(${(hue + 32) % 360}, 95%, 62%, 0.84)`)
    grad.addColorStop(1, `hsla(${(hue + 65) % 360}, 100%, 78%, 0.96)`)
    g.fillStyle = grad
    g.fillRect(i * 4, 0, 4, 180)
  }
  return c
}

function makeAuroraStrip(hue1: number, hue2: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 160
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 160)
  grad.addColorStop(0, `hsla(${hue1}, 90%, 60%, 0)`)
  grad.addColorStop(0.35, `hsla(${hue1}, 92%, 62%, 0.45)`)
  grad.addColorStop(0.7, `hsla(${hue2}, 90%, 64%, 0.25)`)
  grad.addColorStop(1, `hsla(${hue2}, 90%, 60%, 0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 160)
  return c
}

function createStars(): Star[] {
  return Array.from({ length: 44 }, (_, i) => ({
    nx: ((i * 37 + 13) % 98) / 100 + 0.01,
    ny: ((i * 53 + 7) % 86) / 100 + 0.02,
    size: 5 + (i % 4) * 3.0,
    phase: (i * 1.7) % (Math.PI * 2),
    band: 4 + (i % 7), // Tie stars to main vocal/melody bands rather than noisy hiss
  }))
}

function createFireflies(): Firefly[] {
  return Array.from({ length: 16 }, (_, i) => ({
    nx: ((i * 43 + 17) % 92) / 100 + 0.04,
    ny: ((i * 29 + 23) % 80) / 100 + 0.08,
    vx: (((i * 19) % 11) - 5) * 0.00022,
    vy: (((i * 23) % 11) - 5) * 0.00016,
    phase: (i * 0.9) % (Math.PI * 2),
    spriteIdx: i % 3,
    size: 16 + (i % 3) * 8,
  }))
}

export default function AudioReactiveCanvas({
  mode,
  isPlaying,
  clockRef,
  spectrum,
}: AudioReactiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const spectrumRef = useRef<SpectrumData | null>(spectrum)
  spectrumRef.current = spectrum

  const spritesRef = useRef<{
    orbs: HTMLCanvasElement[]
    star: HTMLCanvasElement
    barStrip: HTMLCanvasElement
    auroraA: HTMLCanvasElement
    auroraB: HTMLCanvasElement
  } | null>(null)

  const stateRef = useRef({
    smoothBands: new Float32Array(16),
    prevMain: 0,
    rollingPeak: 0.45,
    rollingFloor: 0.08,
    rollingBass: 0.16,
    peakCaps: new Float32Array(NUM_BARS),
    peakVels: new Float32Array(NUM_BARS),
    lastBeatMs: 0,
    lastRenderMs: 0,
    huePhase: 0,
    shootingStars: [] as ShootingStar[],
    stars: createStars(),
    fireflies: createFireflies(),
  })

  useEffect(() => {
    if (!spritesRef.current) {
      spritesRef.current = {
        orbs: [makeGlowOrb(46), makeGlowOrb(172), makeGlowOrb(292)],
        star: makeStarSprite(),
        barStrip: makeBarGradientStrip(),
        auroraA: makeAuroraStrip(165, 220),
        auroraB: makeAuroraStrip(275, 195),
      }
    }
  }, [])

  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = Math.max(360, Math.floor(window.innerWidth * RENDER_SCALE))
      const h = Math.max(220, Math.floor(window.innerHeight * RENDER_SCALE))
      sizeRef.current = { w, h }
      canvas.width = w
      canvas.height = h
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [mode])

  useEffect(() => {
    if (mode === 'ambient') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
    if (!ctx) return

    let rafId = 0
    let running = true

    const sampleBands = (t: number) => {
      const st = stateRef.current
      const spec = spectrumRef.current
      if (spec && spec.frameCount > 0) {
        const fPos = Math.max(0, t * spec.fps)
        const f0 = Math.min(spec.frameCount - 1, Math.floor(fPos))
        const f1 = Math.min(spec.frameCount - 1, f0 + 1)
        const frac = fPos - Math.floor(fPos)
        const b = spec.bands
        const off0 = f0 * b
        const off1 = f1 * b

        // Use true song-level normalized spectrum directly (no fast AGC that boosts quiet intros!)
        for (let i = 0; i < 16; i++) {
          const v0 = spec.bytes[off0 + i] / 255
          const v1 = spec.bytes[off1 + i] / 255
          const raw = v0 + (v1 - v0) * frac
          // Slight contrast curve so quiet parts stay genuinely low and peaks punch cleanly
          const target = Math.min(1, Math.pow(raw, 1.25))
          const cur = st.smoothBands[i]
          st.smoothBands[i] = target > cur ? cur + (target - cur) * 0.78 : cur + (target - cur) * 0.28
        }
      } else {
        for (let i = 0; i < 16; i++) {
          st.smoothBands[i] *= 0.85
        }
      }
    }

    const drawParty = (w: number, h: number, t: number) => {
      const st = stateRef.current
      const sp = spritesRef.current
      if (!sp) return
      const sb = st.smoothBands
      const bass = (sb[0] + sb[1] + sb[2] + sb[3]) * 0.25
      const vocal = (sb[4] + sb[5] + sb[6] + sb[7] + sb[8] + sb[9]) / 6
      const mainEnergy = bass * 0.55 + vocal * 0.45

      st.huePhase = (st.huePhase + 0.3 + mainEnergy * 2.4) % 360

      // 1. Clean Winamp harmonic ribbon driven purely by main bass + vocal melody
      ctx.beginPath()
      const baseY = h * 0.72
      const amp = 10 + bass * 46 + vocal * 36
      const steps = 36
      for (let s = 0; s <= steps; s++) {
        const nx = s / steps
        const bi = Math.min(10, Math.floor(nx * 10))
        const bVal = sb[bi]
        const wave = Math.sin(nx * Math.PI * 3.5 + t * 2.6) * amp * (0.2 + bVal * 0.95)
        const x = nx * w
        const y = baseY + wave
        if (s === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `hsla(${Math.round((st.huePhase + 110) % 360)}, 95%, 70%, ${(0.18 + mainEnergy * 0.45).toFixed(2)})`
      ctx.lineWidth = 2 + bass * 3
      ctx.stroke()

      // 2. 24-bar Winamp Spectrum Equalizer across full 200Hz - 8000Hz range (bands 0..15)
      const padX = Math.max(12, w * 0.035)
      const availW = w - padX * 2
      const gap = Math.max(3, availW * 0.01)
      const barW = Math.max(4, (availW - gap * (NUM_BARS - 1)) / NUM_BARS)
      const maxBarH = Math.min(h * 0.28, 145)

      for (let i = 0; i < NUM_BARS; i++) {
        const pos = (i / (NUM_BARS - 1)) * 15
        const i0 = Math.floor(pos)
        const i1 = Math.min(15, i0 + 1)
        const val = sb[i0] + (sb[i1] - sb[i0]) * (pos - i0)
        const barH = Math.max(3, val * maxBarH)
        const x = padX + i * (barW + gap)
        const y = h - barH

        if (barH >= st.peakCaps[i]) {
          st.peakCaps[i] = barH
          st.peakVels[i] = 0
        } else {
          st.peakVels[i] += 0.44
          st.peakCaps[i] = Math.max(3, st.peakCaps[i] - st.peakVels[i])
        }

        const srcY = Math.max(0, 180 - Math.round((barH / maxBarH) * 180))
        ctx.drawImage(sp.barStrip, i * 4, srcY, 4, 180 - srcY, x, y, barW, barH)

        // Glowing floating peak cap
        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
        ctx.fillRect(x, h - st.peakCaps[i] - 4, barW, 2.5)
      }
    }

    const drawStarlight = (w: number, h: number, nowMs: number, t: number) => {
      const st = stateRef.current
      const sp = spritesRef.current
      if (!sp) return
      const sb = st.smoothBands
      const bass = (sb[0] + sb[1] + sb[2] + sb[3]) * 0.25
      const vocal = (sb[4] + sb[5] + sb[6] + sb[7] + sb[8] + sb[9]) / 6
      const mainEnergy = bass * 0.55 + vocal * 0.45
      const mainFlux = Math.max(0, mainEnergy - st.prevMain)
      st.prevMain = mainEnergy

      st.rollingBass = st.rollingBass * 0.9 + bass * 0.1

      // 1. Lush Northern Lights Aurora curtain driven by bass + vocal swells
      const slices = 22
      const sliceW = Math.ceil(w / slices) + 1
      ctx.globalAlpha = Math.min(0.85, 0.16 + mainEnergy * 0.65)
      for (let s = 0; s < slices; s++) {
        const nx = s / slices
        const bi = Math.min(10, Math.floor(nx * 10))
        const waveY = h * 0.04 + Math.sin(nx * Math.PI * 2.4 + t * 0.75) * (18 + bass * 44)
        const curtainH = h * (0.24 + mainEnergy * 0.24 + sb[bi] * 0.18)
        ctx.drawImage(s % 2 === 0 ? sp.auroraA : sp.auroraB, 0, 0, 4, 160, s * (w / slices), waveY, sliceW, curtainH)
      }

      // 2. Twinkling star sprites reacting to main vocal/melody energy
      for (const star of st.stars) {
        const bVal = sb[star.band] || 0
        const twinkle = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * 2.0 + star.phase))
        const alpha = Math.min(1, twinkle * (0.3 + bVal * 0.85))
        const sz = star.size * (0.8 + bVal * 0.85)
        ctx.globalAlpha = alpha
        ctx.drawImage(sp.star, star.nx * w - sz * 0.5, star.ny * h - sz * 0.5, sz, sz)
      }

      // 3. Dreamy glowing fireflies blooming with the lead vocals
      const speedMul = isPlaying ? 0.8 + vocal * 3.0 : 0.15
      for (const f of st.fireflies) {
        f.nx += f.vx * speedMul
        f.ny += f.vy * speedMul + Math.sin(t * 1.4 + f.phase) * 0.00022 * speedMul
        if (f.nx < 0.02) f.nx = 0.98
        if (f.nx > 0.98) f.nx = 0.02
        if (f.ny < 0.04) f.ny = 0.92
        if (f.ny > 0.94) f.ny = 0.06

        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + f.phase)
        const sz = f.size * (0.8 + vocal * 1.4 + pulse * 0.4)
        ctx.globalAlpha = Math.min(0.95, 0.22 + vocal * 0.6 + pulse * 0.2)
        ctx.drawImage(sp.orbs[f.spriteIdx], f.nx * w - sz * 0.5, f.ny * h - sz * 0.5, sz, sz)
      }
      ctx.globalAlpha = 1

      // 4. Main-beat-triggered glowing shooting stars
      if (
        isPlaying &&
        (mainFlux > 0.14 || bass > Math.max(0.45, st.rollingBass * 1.4)) &&
        nowMs - st.lastBeatMs > 650 &&
        st.shootingStars.length < 4
      ) {
        st.lastBeatMs = nowMs
        const speed = 9 + bass * 7
        st.shootingStars.push({
          x: w * (0.3 + Math.random() * 0.65),
          y: h * (0.05 + Math.random() * 0.25),
          vx: -speed,
          vy: speed * 0.5,
          alpha: 0.98,
          colorIdx: Math.random() > 0.4 ? 0 : 1,
        })
      }

      for (let i = st.shootingStars.length - 1; i >= 0; i--) {
        const ss = st.shootingStars[i]
        ss.x += ss.vx
        ss.y += ss.vy
        ss.alpha -= 0.04
        if (ss.alpha <= 0.03 || ss.x < -80 || ss.y > h + 80) {
          st.shootingStars.splice(i, 1)
          continue
        }
        ctx.strokeStyle =
          ss.colorIdx === 0
            ? `rgba(255, 240, 185, ${ss.alpha.toFixed(2)})`
            : `rgba(185, 240, 255, ${ss.alpha.toFixed(2)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(ss.x, ss.y)
        ctx.lineTo(ss.x - ss.vx * 4.5, ss.y - ss.vy * 4.5)
        ctx.stroke()
        ctx.globalAlpha = ss.alpha
        ctx.drawImage(sp.star, ss.x - 10, ss.y - 10, 20, 20)
        ctx.globalAlpha = 1
      }
    }

    const renderFrame = (nowMs: number) => {
      if (!running) return
      const st = stateRef.current
      if (nowMs - st.lastRenderMs >= TARGET_FRAME_MS || !isPlaying) {
        st.lastRenderMs = nowMs
        const { w, h } = sizeRef.current
        if (w > 0 && h > 0) {
          ctx.clearRect(0, 0, w, h)
          const clk = clockRef.current
          const liveElapsed = isPlaying ? clk.elapsed + (nowMs - clk.perfMs) / 1000 : clk.elapsed
          const t = Math.max(0, liveElapsed + clk.syncOffset)
          sampleBands(t)
          if (mode === 'party') {
            drawParty(w, h, t)
          } else if (mode === 'starlight') {
            drawStarlight(w, h, nowMs, t)
          }
        }
      }
      if (isPlaying) {
        rafId = window.requestAnimationFrame(renderFrame)
      }
    }

    rafId = window.requestAnimationFrame(renderFrame)
    return () => {
      running = false
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [mode, isPlaying, clockRef])

  if (mode === 'ambient') return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
