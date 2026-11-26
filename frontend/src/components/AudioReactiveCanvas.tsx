import React, { useEffect, useRef } from 'react'
import { LyricsVisualMode } from './FullscreenLyrics'

export interface SpectrumData {
  fps: number
  bands: number
  bytes: Uint8Array
  frameCount: number
}

interface AudioReactiveCanvasProps {
  mode: LyricsVisualMode
  isPlaying: boolean
  timeRef: React.MutableRefObject<number>
  spectrum: SpectrumData | null
}

interface ShockRing {
  x: number
  y: number
  r: number
  maxR: number
  hue: number
  alpha: number
  speed: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  hue: number
  alpha: number
  size: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  len: number
  alpha: number
  hue: number
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
  hue: number
  size: number
}

const NUM_BARS = 24
const TARGET_FRAME_MS = 33 // Smooth locked 30fps for Android kiosk tablets
const RENDER_SCALE = 0.5 // Half-res canvas (4x-9x fewer pixels, GPU-friendly)

function createStars(): Star[] {
  return Array.from({ length: 42 }, (_, i) => ({
    nx: ((i * 37 + 13) % 98) / 100 + 0.01,
    ny: ((i * 53 + 7) % 88) / 100 + 0.02,
    size: 1.5 + (i % 3) * 0.9,
    phase: (i * 1.7) % (Math.PI * 2),
    band: 8 + (i % 8),
  }))
}

function createFireflies(): Firefly[] {
  return Array.from({ length: 14 }, (_, i) => ({
    nx: ((i * 43 + 17) % 92) / 100 + 0.04,
    ny: ((i * 29 + 23) % 82) / 100 + 0.08,
    vx: (((i * 19) % 11) - 5) * 0.00028,
    vy: (((i * 23) % 11) - 5) * 0.00022,
    phase: (i * 0.9) % (Math.PI * 2),
    hue: i % 3 === 0 ? 45 : i % 3 === 1 ? 168 : 285,
    size: 2.2 + (i % 3) * 1.1,
  }))
}

export default function AudioReactiveCanvas({
  mode,
  isPlaying,
  timeRef,
  spectrum,
}: AudioReactiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const spectrumRef = useRef<SpectrumData | null>(spectrum)
  spectrumRef.current = spectrum

  const stateRef = useRef({
    smoothBands: new Float32Array(16),
    prevBands: new Float32Array(16),
    bandFloor: new Float32Array(16).fill(0.08),
    bandPeak: new Float32Array(16).fill(0.35),
    fluxBands: new Float32Array(16),
    peakCaps: new Float32Array(NUM_BARS),
    peakVels: new Float32Array(NUM_BARS),
    rollingBass: 0.18,
    lastBeatMs: 0,
    lastRenderMs: 0,
    huePhase: 0,
    rings: [] as ShockRing[],
    sparks: [] as Spark[],
    shootingStars: [] as ShootingStar[],
    stars: createStars(),
    fireflies: createFireflies(),
  })

  // Cache half-resolution canvas size on mount & window resize only (zero layout thrashing)
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = Math.max(320, Math.floor(window.innerWidth * RENDER_SCALE))
      const h = Math.max(200, Math.floor(window.innerHeight * RENDER_SCALE))
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
        for (let i = 0; i < 16; i++) {
          const v0 = spec.bytes[off0 + i] / 255
          const v1 = spec.bytes[off1 + i] / 255
          const raw = v0 + (v1 - v0) * frac

          st.bandFloor[i] =
            raw < st.bandFloor[i]
              ? st.bandFloor[i] * 0.92 + raw * 0.08
              : st.bandFloor[i] * 0.992 + raw * 0.008
          st.bandPeak[i] =
            raw > st.bandPeak[i]
              ? st.bandPeak[i] * 0.72 + raw * 0.28
              : Math.max(0.16, st.bandPeak[i] * 0.99 + raw * 0.01)

          const span = Math.max(0.1, st.bandPeak[i] - st.bandFloor[i] * 0.55)
          const agc = Math.max(0, Math.min(1, (raw - st.bandFloor[i] * 0.55) / span))
          const presence = Math.min(1, raw * 6.5)
          const dynamicVal = Math.pow(agc, 1.35) * presence

          const flux = Math.max(0, dynamicVal - st.prevBands[i])
          st.prevBands[i] = dynamicVal
          st.fluxBands[i] = st.fluxBands[i] * 0.68 + flux * 0.95

          const target = Math.min(1, dynamicVal + st.fluxBands[i] * 0.45)
          const cur = st.smoothBands[i]
          st.smoothBands[i] = target > cur ? cur + (target - cur) * 0.68 : cur + (target - cur) * 0.28
        }
      } else {
        for (let i = 0; i < 16; i++) {
          const target = isPlaying ? 0.06 + 0.04 * Math.sin(t * (1.4 + i * 0.2) + i) ** 2 : 0.02
          st.smoothBands[i] += (target - st.smoothBands[i]) * 0.2
          st.fluxBands[i] *= 0.8
        }
      }
    }

    const drawParty = (w: number, h: number, nowMs: number, t: number) => {
      const st = stateRef.current
      const sb = st.smoothBands
      const bass = (sb[0] + sb[1] + sb[2] + sb[3]) * 0.25
      const mid = (sb[4] + sb[5] + sb[6] + sb[7] + sb[8] + sb[9]) / 6
      const treble = (sb[10] + sb[11] + sb[12] + sb[13] + sb[14] + sb[15]) / 6
      const bassFlux = (st.fluxBands[0] + st.fluxBands[1] + st.fluxBands[2]) / 3
      const totalFlux = (bassFlux + st.fluxBands[5] + st.fluxBands[9] + st.fluxBands[12]) * 0.25

      st.rollingBass = st.rollingBass * 0.88 + bass * 0.12
      st.huePhase = (st.huePhase + 0.4 + totalFlux * 7.5 + mid * 1.8) % 360

      const focalX = w >= 512 ? w * 0.2 : w * 0.5
      const focalY = w >= 512 ? h * 0.44 : h * 0.22

      // Bass-kick shockwave rings (lightweight single-stroke arcs, max 5)
      if (
        isPlaying &&
        (bassFlux > 0.16 || bass > Math.max(0.38, st.rollingBass * 1.32)) &&
        nowMs - st.lastBeatMs > 260
      ) {
        st.lastBeatMs = nowMs
        st.rings.push({
          x: focalX,
          y: focalY,
          r: 22,
          maxR: Math.max(w, h) * 0.65,
          hue: (st.huePhase + bass * 140) % 360,
          alpha: Math.min(0.7, 0.32 + bass * 0.4),
          speed: 3.5 + bass * 5.5,
        })
        if (st.rings.length > 5) st.rings.shift()
      }

      for (let i = st.rings.length - 1; i >= 0; i--) {
        const ring = st.rings[i]
        ring.r += ring.speed
        ring.alpha *= 0.93
        if (ring.alpha < 0.02 || ring.r > ring.maxR) {
          st.rings.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${Math.round(ring.hue)}, 95%, 64%, ${ring.alpha.toFixed(2)})`
        ctx.lineWidth = 1.5 + bass * 2.5
        ctx.stroke()
      }

      // Single sleek Winamp/MilkDrop waveform ribbon (32 steps, zero gradients)
      ctx.beginPath()
      const baseY = h * 0.66
      const amp = 14 + bass * 42 + mid * 28
      const steps = 32
      for (let s = 0; s <= steps; s++) {
        const nx = s / steps
        const bi = Math.min(14, Math.floor(nx * 15))
        const bVal = sb[bi]
        const wave =
          Math.sin(nx * Math.PI * 4 + t * 2.8) * amp * (0.3 + bVal * 0.95) +
          Math.cos(nx * Math.PI * 7 - t * 3.8) * (treble * 14)
        const x = nx * w
        const y = baseY + wave
        if (s === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = `hsla(${Math.round((st.huePhase + 100) % 360)}, 95%, 66%, ${(0.28 + bass * 0.35).toFixed(2)})`
      ctx.lineWidth = 1.8 + bass * 2
      ctx.stroke()

      // 24-bar Winamp Spectrum Equalizer using fast fillRect (zero per-bar gradients)
      const padX = Math.max(8, w * 0.03)
      const availW = w - padX * 2
      const gap = Math.max(2, availW * 0.01)
      const barW = Math.max(3, (availW - gap * (NUM_BARS - 1)) / NUM_BARS)
      const maxBarH = Math.min(h * 0.27, 115)

      for (let i = 0; i < NUM_BARS; i++) {
        const pos = (i / (NUM_BARS - 1)) * 15
        const i0 = Math.floor(pos)
        const i1 = Math.min(15, i0 + 1)
        const val = sb[i0] + (sb[i1] - sb[i0]) * (pos - i0)
        const barH = Math.max(2, val * maxBarH)
        const x = padX + i * (barW + gap)
        const y = h - barH
        const hue = Math.round((st.huePhase + (i / NUM_BARS) * 260) % 360)

        if (barH >= st.peakCaps[i]) {
          st.peakCaps[i] = barH
          st.peakVels[i] = 0
        } else {
          st.peakVels[i] += 0.35
          st.peakCaps[i] = Math.max(2, st.peakCaps[i] - st.peakVels[i])
        }

        ctx.fillStyle = `hsla(${hue}, 92%, 58%, 0.72)`
        ctx.fillRect(x, y, barW, barH)

        // Bright Winamp peak-hold cap
        ctx.fillStyle = `hsla(${(hue + 45) % 360}, 100%, 86%, 0.92)`
        ctx.fillRect(x, h - st.peakCaps[i] - 3, barW, 2)

        if (isPlaying && val > 0.65 && Math.random() < 0.08 + treble * 0.1 && st.sparks.length < 24) {
          st.sparks.push({
            x: x + barW * 0.5,
            y,
            vx: (Math.random() - 0.5) * 1.4,
            vy: -(1.4 + Math.random() * 2.2),
            hue,
            alpha: 0.9,
            size: 1.8 + Math.random() * 1.4,
          })
        }
      }

      // Fast square treble sparks
      for (let i = st.sparks.length - 1; i >= 0; i--) {
        const sp = st.sparks[i]
        sp.x += sp.vx
        sp.y += sp.vy
        sp.alpha -= 0.04
        if (sp.alpha <= 0.03) {
          st.sparks.splice(i, 1)
          continue
        }
        ctx.fillStyle = `hsla(${sp.hue}, 100%, 78%, ${sp.alpha.toFixed(2)})`
        ctx.fillRect(sp.x, sp.y, sp.size, sp.size)
      }
    }

    const drawStarlight = (w: number, h: number, nowMs: number, t: number) => {
      const st = stateRef.current
      const sb = st.smoothBands
      const bass = (sb[0] + sb[1] + sb[2] + sb[3]) * 0.25
      const mid = (sb[4] + sb[5] + sb[6] + sb[7] + sb[8] + sb[9]) / 6
      const treble = (sb[10] + sb[11] + sb[12] + sb[13] + sb[14] + sb[15]) / 6

      st.rollingBass = st.rollingBass * 0.9 + bass * 0.1
      st.huePhase = (st.huePhase + 0.25 + mid * 0.8) % 360

      // 1. Lightweight bass-reactive Aurora wave (single pass, 20 steps, zero gradients)
      const baseY = h * 0.24
      const swell = 18 + bass * 50 + mid * 24
      ctx.beginPath()
      ctx.moveTo(0, 0)
      const steps = 20
      for (let s = 0; s <= steps; s++) {
        const nx = s / steps
        const bi = Math.min(15, Math.floor(nx * 10))
        const wave = Math.sin(nx * Math.PI * 2.5 + t * 0.8) * swell * (0.45 + sb[bi] * 0.7)
        ctx.lineTo(nx * w, baseY + wave)
      }
      ctx.lineTo(w, 0)
      ctx.closePath()
      const auroraHue = Math.round((162 + st.huePhase * 0.3) % 360)
      ctx.fillStyle = `hsla(${auroraHue}, 88%, 58%, ${(0.07 + bass * 0.14).toFixed(2)})`
      ctx.fill()

      // 2. Fast fillRect twinkling stars (treble-reactive)
      for (const star of st.stars) {
        const bVal = sb[star.band] || 0
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + star.phase))
        const alpha = Math.min(1, twinkle * (0.35 + bVal * 0.85 + treble * 0.45))
        const sz = star.size * (0.85 + bVal * 0.7)
        ctx.fillStyle = `rgba(255, 252, 240, ${alpha.toFixed(2)})`
        ctx.fillRect(star.nx * w, star.ny * h, sz, sz)
      }

      // 3. Melody/vocal-reactive fireflies (2 concentric circles, zero radialGradient allocations)
      const speedMul = isPlaying ? 1 + mid * 2.8 : 0.15
      for (const f of st.fireflies) {
        f.nx += f.vx * speedMul
        f.ny += f.vy * speedMul + Math.sin(t * 1.4 + f.phase) * 0.00025 * speedMul
        if (f.nx < 0.02) f.nx = 0.98
        if (f.nx > 0.98) f.nx = 0.02
        if (f.ny < 0.04) f.ny = 0.92
        if (f.ny > 0.94) f.ny = 0.06

        const fx = f.nx * w
        const fy = f.ny * h
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + f.phase)
        const haloR = f.size * (2.2 + mid * 3.4 + pulse * 1.2)
        const alpha = Math.min(0.9, 0.25 + mid * 0.55 + pulse * 0.2)

        ctx.fillStyle = `hsla(${f.hue}, 95%, 65%, ${(alpha * 0.22).toFixed(2)})`
        ctx.beginPath()
        ctx.arc(fx, fy, haloR, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `hsla(${f.hue}, 100%, 84%, ${alpha.toFixed(2)})`
        ctx.beginPath()
        ctx.arc(fx, fy, f.size * 0.85, 0, Math.PI * 2)
        ctx.fill()
      }

      // 4. Beat/accent-triggered shooting stars
      const hiFlux = (st.fluxBands[8] + st.fluxBands[11] + st.fluxBands[14]) / 3
      const loFlux = (st.fluxBands[0] + st.fluxBands[1] + st.fluxBands[2]) / 3
      if (
        isPlaying &&
        (loFlux > 0.18 || hiFlux > 0.16 || bass > Math.max(0.45, st.rollingBass * 1.38)) &&
        nowMs - st.lastBeatMs > 650 &&
        st.shootingStars.length < 4
      ) {
        st.lastBeatMs = nowMs
        const speed = 7 + bass * 6
        st.shootingStars.push({
          x: w * (0.3 + Math.random() * 0.65),
          y: h * (0.05 + Math.random() * 0.25),
          vx: -speed,
          vy: speed * 0.52,
          len: 36 + bass * 42,
          alpha: 0.95,
          hue: Math.random() > 0.4 ? 46 : 195,
        })
      }

      for (let i = st.shootingStars.length - 1; i >= 0; i--) {
        const ss = st.shootingStars[i]
        ss.x += ss.vx
        ss.y += ss.vy
        ss.alpha -= 0.045
        if (ss.alpha <= 0.03 || ss.x < -60 || ss.y > h + 60) {
          st.shootingStars.splice(i, 1)
          continue
        }
        ctx.strokeStyle = `hsla(${ss.hue}, 100%, 86%, ${ss.alpha.toFixed(2)})`
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(ss.x, ss.y)
        ctx.lineTo(ss.x - ss.vx * 3.5, ss.y - ss.vy * 3.5)
        ctx.stroke()
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
          const t = Math.max(0, timeRef.current)
          sampleBands(t)
          if (mode === 'party') {
            drawParty(w, h, nowMs, t)
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
  }, [mode, isPlaying, timeRef])

  if (mode === 'ambient') return null

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
