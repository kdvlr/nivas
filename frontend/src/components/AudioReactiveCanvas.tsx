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

const NUM_BARS = 32

function createStars(): Star[] {
  return Array.from({ length: 70 }, (_, i) => ({
    nx: ((i * 37 + 13) % 98) / 100 + 0.01,
    ny: ((i * 53 + 7) % 88) / 100 + 0.02,
    size: 1.1 + (i % 4) * 0.65,
    phase: (i * 1.7) % (Math.PI * 2),
    band: 8 + (i % 8),
  }))
}

function createFireflies(): Firefly[] {
  return Array.from({ length: 22 }, (_, i) => ({
    nx: ((i * 43 + 17) % 92) / 100 + 0.04,
    ny: ((i * 29 + 23) % 82) / 100 + 0.08,
    vx: (((i * 19) % 11) - 5) * 0.00018,
    vy: (((i * 23) % 11) - 5) * 0.00014,
    phase: (i * 0.9) % (Math.PI * 2),
    hue: i % 3 === 0 ? 45 : i % 3 === 1 ? 168 : 285,
    size: 2.5 + (i % 3) * 1.4,
  }))
}

export default function AudioReactiveCanvas({
  mode,
  isPlaying,
  timeRef,
  spectrum,
}: AudioReactiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 })
  const spectrumRef = useRef<SpectrumData | null>(spectrum)
  spectrumRef.current = spectrum

  const stateRef = useRef({
    smoothBands: new Float32Array(16),
    peakCaps: new Float32Array(NUM_BARS),
    peakVels: new Float32Array(NUM_BARS),
    rollingBass: 0.15,
    lastBeatMs: 0,
    huePhase: 0,
    rings: [] as ShockRing[],
    sparks: [] as Spark[],
    shootingStars: [] as ShootingStar[],
    stars: createStars(),
    fireflies: createFireflies(),
  })

  // Cache canvas size on mount & window resize only (zero layout thrashing in rAF)
  useEffect(() => {
    const updateSize = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = window.innerWidth
      const h = window.innerHeight
      sizeRef.current = { w, h, dpr }
      canvas.width = Math.max(1, Math.floor(w * dpr))
      canvas.height = Math.max(1, Math.floor(h * dpr))
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [mode])

  useEffect(() => {
    if (mode === 'ambient') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
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
          const target = v0 + (v1 - v0) * frac
          const cur = st.smoothBands[i]
          st.smoothBands[i] = target > cur ? cur + (target - cur) * 0.48 : cur + (target - cur) * 0.18
        }
      } else {
        // Gentle harmonic fallback while spectrum finishes extracting
        for (let i = 0; i < 16; i++) {
          const target = isPlaying
            ? 0.14 + 0.12 * Math.sin(t * (1.8 + i * 0.27) + i * 0.7) ** 2
            : 0.04
          st.smoothBands[i] += (target - st.smoothBands[i]) * 0.15
        }
      }
    }

    const drawParty = (w: number, h: number, nowMs: number, t: number) => {
      const st = stateRef.current
      const sb = st.smoothBands
      const bass = (sb[0] + sb[1] + sb[2] + sb[3]) * 0.25
      const mid = (sb[4] + sb[5] + sb[6] + sb[7] + sb[8] + sb[9]) / 6
      const treble = (sb[10] + sb[11] + sb[12] + sb[13] + sb[14] + sb[15]) / 6

      st.rollingBass = st.rollingBass * 0.92 + bass * 0.08
      st.huePhase = (st.huePhase + 0.35 + mid * 1.4) % 360

      const focalX = w >= 1024 ? w * 0.2 : w * 0.5
      const focalY = w >= 1024 ? h * 0.44 : h * 0.22

      // Trigger MilkDrop bass-kick shockwave ring
      if (isPlaying && bass > Math.max(0.24, st.rollingBass * 1.24) && nowMs - st.lastBeatMs > 230) {
        st.lastBeatMs = nowMs
        st.rings.push({
          x: focalX,
          y: focalY,
          r: 40,
          maxR: Math.max(w, h) * 0.65,
          hue: (st.huePhase + bass * 120) % 360,
          alpha: Math.min(0.65, 0.32 + bass * 0.45),
          speed: 4.5 + bass * 7.5,
        })
        if (st.rings.length > 8) st.rings.shift()
      }

      // 1. Expanding bass shockwave rings
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      for (let i = st.rings.length - 1; i >= 0; i--) {
        const ring = st.rings[i]
        ring.r += ring.speed
        ring.alpha *= 0.962
        if (ring.alpha < 0.015 || ring.r > ring.maxR) {
          st.rings.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${ring.hue}, 95%, 64%, ${ring.alpha})`
        ctx.lineWidth = 2.5 + bass * 5
        ctx.stroke()
      }

      // 2. Flowing Winamp / MilkDrop dual waveform ribbons
      for (let r = 0; r < 2; r++) {
        ctx.beginPath()
        const baseY = h * (0.64 + r * 0.08)
        const amp = (28 + bass * 78 + mid * 52) * (r === 0 ? 1 : 0.72)
        const steps = 64
        for (let s = 0; s <= steps; s++) {
          const nx = s / steps
          const bandPos = nx * 15
          const bi = Math.min(14, Math.floor(bandPos))
          const bVal = sb[bi] + (sb[bi + 1] - sb[bi]) * (bandPos - bi)
          const wave =
            Math.sin(nx * Math.PI * (3 + r * 2) + t * (2.6 + r * 1.1)) * amp * (0.35 + bVal * 0.9) +
            Math.cos(nx * Math.PI * 7 - t * 3.8) * (treble * 26)
          const x = nx * w
          const y = baseY + wave
          if (s === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        const grad = ctx.createLinearGradient(0, baseY - amp, w, baseY + amp)
        grad.addColorStop(0, `hsla(${(st.huePhase + r * 90) % 360}, 95%, 62%, ${0.14 + mid * 0.25})`)
        grad.addColorStop(0.5, `hsla(${(st.huePhase + 110 + r * 90) % 360}, 98%, 68%, ${0.22 + bass * 0.3})`)
        grad.addColorStop(1, `hsla(${(st.huePhase + 220 + r * 90) % 360}, 95%, 62%, ${0.14 + treble * 0.25})`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 2.5 + bass * 3.5
        ctx.stroke()
      }

      // 3. 32-bar Winamp Spectrum Equalizer + falling peak-hold caps
      const padX = Math.max(16, w * 0.03)
      const availW = w - padX * 2
      const gap = Math.max(4, availW * 0.008)
      const barW = Math.max(4, (availW - gap * (NUM_BARS - 1)) / NUM_BARS)
      const maxBarH = Math.min(h * 0.26, 210)

      for (let i = 0; i < NUM_BARS; i++) {
        const pos = (i / (NUM_BARS - 1)) * 15
        const i0 = Math.floor(pos)
        const i1 = Math.min(15, i0 + 1)
        const val = sb[i0] + (sb[i1] - sb[i0]) * (pos - i0)
        const barH = Math.max(4, val * maxBarH)
        const x = padX + i * (barW + gap)
        const y = h - barH
        const hue = (st.huePhase + (i / NUM_BARS) * 260) % 360

        // Peak-hold physics (classic Winamp)
        if (barH >= st.peakCaps[i]) {
          st.peakCaps[i] = barH
          st.peakVels[i] = 0
        } else {
          st.peakVels[i] += 0.24
          st.peakCaps[i] = Math.max(4, st.peakCaps[i] - st.peakVels[i])
        }

        const barGrad = ctx.createLinearGradient(x, h, x, y)
        barGrad.addColorStop(0, `hsla(${hue}, 92%, 52%, 0.72)`)
        barGrad.addColorStop(0.65, `hsla(${(hue + 35) % 360}, 95%, 64%, 0.62)`)
        barGrad.addColorStop(1, `hsla(${(hue + 70) % 360}, 100%, 78%, 0.85)`)
        ctx.fillStyle = barGrad
        ctx.beginPath()
        ctx.roundRect(x, y, barW, barH, [6, 6, 0, 0])
        ctx.fill()

        // Falling peak cap
        const capY = h - st.peakCaps[i] - 5
        ctx.fillStyle = `hsla(${(hue + 50) % 360}, 100%, 88%, 0.92)`
        ctx.beginPath()
        ctx.roundRect(x, capY, barW, 3.5, 2)
        ctx.fill()

        // Launch treble sparks on lively highs
        if (isPlaying && val > 0.62 && Math.random() < 0.08 + treble * 0.14 && st.sparks.length < 48) {
          st.sparks.push({
            x: x + barW * 0.5,
            y,
            vx: (Math.random() - 0.5) * 1.8,
            vy: -(1.8 + Math.random() * 3.2),
            hue,
            alpha: 0.9,
            size: 2 + Math.random() * 2.5,
          })
        }
      }

      // 4. Rising treble sparks
      for (let i = st.sparks.length - 1; i >= 0; i--) {
        const sp = st.sparks[i]
        sp.x += sp.vx
        sp.y += sp.vy
        sp.vy *= 0.985
        sp.alpha -= 0.022
        if (sp.alpha <= 0.02) {
          st.sparks.splice(i, 1)
          continue
        }
        ctx.fillStyle = `hsla(${sp.hue}, 100%, 78%, ${sp.alpha})`
        ctx.beginPath()
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const drawStarlight = (w: number, h: number, nowMs: number, t: number) => {
      const st = stateRef.current
      const sb = st.smoothBands
      const bass = (sb[0] + sb[1] + sb[2] + sb[3]) * 0.25
      const mid = (sb[4] + sb[5] + sb[6] + sb[7] + sb[8] + sb[9]) / 6
      const treble = (sb[10] + sb[11] + sb[12] + sb[13] + sb[14] + sb[15]) / 6

      st.rollingBass = st.rollingBass * 0.93 + bass * 0.07
      st.huePhase = (st.huePhase + 0.12 + mid * 0.45) % 360

      ctx.save()
      ctx.globalCompositeOperation = 'lighter'

      // 1. Bass-reactive Aurora Borealis curtain in upper sky
      for (let a = 0; a < 2; a++) {
        const baseY = h * (0.2 + a * 0.14)
        const swell = 35 + bass * 95 + mid * 45
        ctx.beginPath()
        ctx.moveTo(0, 0)
        const steps = 40
        for (let s = 0; s <= steps; s++) {
          const nx = s / steps
          const bi = Math.min(15, Math.floor(nx * 10))
          const wave =
            Math.sin(nx * Math.PI * (2.2 + a) + t * (0.7 + a * 0.35)) * swell * (0.45 + sb[bi] * 0.7) +
            Math.cos(nx * Math.PI * 5 - t * 1.1) * (mid * 25)
          ctx.lineTo(nx * w, baseY + wave)
        }
        ctx.lineTo(w, 0)
        ctx.closePath()
        const auroraHue = (158 + a * 95 + st.huePhase * 0.25) % 360
        const grad = ctx.createLinearGradient(0, 0, 0, baseY + swell + 40)
        grad.addColorStop(0, `hsla(${auroraHue}, 85%, 55%, 0.0)`)
        grad.addColorStop(0.55, `hsla(${auroraHue}, 90%, 60%, ${0.08 + bass * 0.18})`)
        grad.addColorStop(1, `hsla(${(auroraHue + 45) % 360}, 90%, 66%, 0.0)`)
        ctx.fillStyle = grad
        ctx.fill()
      }

      // 2. Treble-reactive twinkling starfield
      for (const star of st.stars) {
        const bVal = sb[star.band] || 0
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + star.phase))
        const alpha = Math.min(1, twinkle * (0.35 + bVal * 0.9 + treble * 0.5))
        const r = star.size * (0.85 + bVal * 0.9)
        const sx = star.nx * w
        const sy = star.ny * h
        ctx.fillStyle = `rgba(255, 252, 240, ${alpha})`
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fill()
        if (bVal > 0.52) {
          ctx.strokeStyle = `rgba(255, 244, 200, ${alpha * 0.5})`
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(sx - r * 2.8, sy)
          ctx.lineTo(sx + r * 2.8, sy)
          ctx.moveTo(sx, sy - r * 2.8)
          ctx.lineTo(sx, sy + r * 2.8)
          ctx.stroke()
        }
      }

      // 3. Melody/vocal-reactive glowing fireflies
      const speedMul = isPlaying ? 1 + mid * 2.6 : 0.2
      for (const f of st.fireflies) {
        f.nx += f.vx * speedMul
        f.ny += f.vy * speedMul + Math.sin(t * 1.4 + f.phase) * 0.00018 * speedMul
        if (f.nx < 0.02) f.nx = 0.98
        if (f.nx > 0.98) f.nx = 0.02
        if (f.ny < 0.04) f.ny = 0.92
        if (f.ny > 0.94) f.ny = 0.06

        const fx = f.nx * w
        const fy = f.ny * h
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + f.phase)
        const glowR = f.size * (2.6 + mid * 4.5 + pulse * 1.8)
        const alpha = Math.min(0.92, 0.25 + mid * 0.6 + pulse * 0.25)

        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, glowR)
        g.addColorStop(0, `hsla(${f.hue}, 100%, 82%, ${alpha})`)
        g.addColorStop(0.4, `hsla(${f.hue}, 95%, 65%, ${alpha * 0.45})`)
        g.addColorStop(1, `hsla(${f.hue}, 95%, 55%, 0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(fx, fy, glowR, 0, Math.PI * 2)
        ctx.fill()
      }

      // 4. Beat/accent-triggered shooting stars
      if (
        isPlaying &&
        (bass > Math.max(0.28, st.rollingBass * 1.28) || treble > 0.55) &&
        nowMs - st.lastBeatMs > 650 &&
        st.shootingStars.length < 5
      ) {
        st.lastBeatMs = nowMs
        const startX = w * (0.28 + Math.random() * 0.68)
        const startY = h * (0.04 + Math.random() * 0.28)
        const speed = 11 + bass * 10
        st.shootingStars.push({
          x: startX,
          y: startY,
          vx: -speed,
          vy: speed * 0.52,
          len: 75 + bass * 90,
          alpha: 0.95,
          hue: Math.random() > 0.4 ? 46 : 195,
        })
      }

      for (let i = st.shootingStars.length - 1; i >= 0; i--) {
        const ss = st.shootingStars[i]
        ss.x += ss.vx
        ss.y += ss.vy
        ss.alpha -= 0.024
        if (ss.alpha <= 0.02 || ss.x < -120 || ss.y > h + 120) {
          st.shootingStars.splice(i, 1)
          continue
        }
        const tailX = ss.x - (ss.vx / 14) * ss.len
        const tailY = ss.y - (ss.vy / 14) * ss.len
        const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY)
        grad.addColorStop(0, `hsla(${ss.hue}, 100%, 92%, ${ss.alpha})`)
        grad.addColorStop(0.4, `hsla(${ss.hue}, 95%, 72%, ${ss.alpha * 0.5})`)
        grad.addColorStop(1, `hsla(${ss.hue}, 95%, 65%, 0)`)
        ctx.strokeStyle = grad
        ctx.lineWidth = 2.6
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ss.x, ss.y)
        ctx.lineTo(tailX, tailY)
        ctx.stroke()
      }
      ctx.restore()
    }

    const renderFrame = (nowMs: number) => {
      if (!running) return
      const { w, h, dpr } = sizeRef.current
      if (w > 0 && h > 0) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        const t = Math.max(0, timeRef.current)
        sampleBands(t)
        if (mode === 'party') {
          drawParty(w, h, nowMs, t)
        } else if (mode === 'starlight') {
          drawStarlight(w, h, nowMs, t)
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
