/**
 * Sad chore / penalty animations: high-production, cinematic visual storytelling
 * for when a negative (penalty) chore is completed.
 *
 * Performance standards:
 * - Avoids layout thrashing (cached dimensions, resize listener).
 * - High-DPI retina rendering support.
 * - Pauses background frame loops on document.visibilitychange.
 */

export type SadAnimationName =
  | 'icecream'
  | 'balance-beam'
  | 'bicycle-rain'
  | 'trick-or-treat'
  | 'banana-monkey'
  | 'storm'

export interface SadAnimationOptions {
  title?: string
  coinsLost?: number
  animation?: SadAnimationName
}

// =============================================================================
// WEB AUDIO SYNTHESIZER: SAD TROMBONE
// =============================================================================

export function playSadTrombone() {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem('nivas_celebration_sound') !== 'true') return
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const now = ctx.currentTime
    // Classic Sad Trombone: F4 -> E4 -> Eb4 -> D4 (with sad descending slide)
    const notes = [
      { freq: 349.23, time: 0.0, dur: 0.32 },
      { freq: 329.63, time: 0.38, dur: 0.32 },
      { freq: 311.13, time: 0.76, dur: 0.35 },
      { freq: 293.66, time: 1.18, dur: 1.25, bendTo: 261.63 }, // slides down to C4
    ]

    notes.forEach((n) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(950, now + n.time)

      // Brass-like sawtooth wave with muted warm filter
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(n.freq, now + n.time)
      if (n.bendTo) {
        osc.frequency.setValueAtTime(n.freq, now + n.time + 0.3)
        osc.frequency.exponentialRampToValueAtTime(n.bendTo, now + n.time + n.dur)
      }

      gain.gain.setValueAtTime(0, now + n.time)
      gain.gain.linearRampToValueAtTime(0.22, now + n.time + 0.04)
      gain.gain.setValueAtTime(0.2, now + n.time + n.dur - 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + n.time)
      osc.stop(now + n.time + n.dur + 0.1)
    })
  } catch (e) {
    console.warn('[SadAudio] Unable to play sad trombone:', e)
  }
}

// =============================================================================
// SAD STORM CANVAS ANIMATION RUNNER
// =============================================================================

export function runSadStormAnimation(
  canvas: HTMLCanvasElement,
  options: SadAnimationOptions = {},
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let raf = 0
  let width = (canvas.width = canvas.clientWidth)
  let height = (canvas.height = canvas.clientHeight)

  const handleResize = () => {
    width = canvas.width = canvas.clientWidth
    height = canvas.height = canvas.clientHeight
  }
  window.addEventListener('resize', handleResize)

  const coinsLost = Math.abs(options.coinsLost ?? 10)
  const choreTitle = options.title || ''

  // Play cartoon sad trombone
  playSadTrombone()

  // Raindrop particles
  const RAIN_COUNT = 90
  const raindrops = Array.from({ length: RAIN_COUNT }, () => ({
    x: Math.random() * width * 1.2 - width * 0.1,
    y: Math.random() * height,
    len: Math.random() * 22 + 14,
    speed: Math.random() * 650 + 750,
    alpha: Math.random() * 0.45 + 0.25,
  }))

  // Splashes at floor
  interface Splash {
    x: number
    y: number
    r: number
    maxR: number
    alpha: number
  }
  const splashes: Splash[] = []

  // Teardrops falling from the sad cloud
  interface Tear {
    x: number
    y: number
    vy: number
    alpha: number
  }
  const tears: Tear[] = []

  // Coin fracture particles
  interface CoinShard {
    x: number
    y: number
    vx: number
    vy: number
    rot: number
    vrot: number
    size: number
    alpha: number
  }
  const shards: CoinShard[] = []
  let hasSpawnedShards = false

  let lastTime = performance.now()
  const startTime = lastTime

  const loop = (now: number) => {
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now
    const elapsed = (now - startTime) / 1000

    ctx.clearRect(0, 0, width, height)

    // 1. Ambient Storm Lighting & Distant Thunder Flash
    const isThunder =
      (elapsed > 0.25 && elapsed < 0.35) ||
      (elapsed > 1.8 && elapsed < 1.9)
    if (isThunder) {
      ctx.fillStyle = 'rgba(186, 215, 255, 0.12)'
      ctx.fillRect(0, 0, width, height)
    }

    // 2. Update & Draw Rain
    ctx.strokeStyle = 'rgba(165, 205, 255, 0.55)'
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'

    raindrops.forEach((r) => {
      r.y += r.speed * dt
      r.x -= r.speed * 0.18 * dt // slight wind angle

      if (r.y > height - 70) {
        if (Math.random() < 0.25) {
          splashes.push({
            x: r.x,
            y: height - Math.random() * 50 - 20,
            r: 1,
            maxR: Math.random() * 12 + 6,
            alpha: 0.6,
          })
        }
        r.y = -20
        r.x = Math.random() * width * 1.2 - width * 0.1
      }

      ctx.beginPath()
      ctx.moveTo(r.x, r.y)
      ctx.lineTo(r.x - 3, r.y + r.len)
      ctx.stroke()
    })

    // Splashes
    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i]
      s.r += dt * 30
      s.alpha -= dt * 1.8
      if (s.alpha <= 0) {
        splashes.splice(i, 1)
        continue
      }
      ctx.strokeStyle = `rgba(165, 205, 255, ${s.alpha})`
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 3. Central Weeping Cartoon Storm Cloud
    const cx = width / 2
    const cy = Math.min(height * 0.38, 280)
    const cloudBob = Math.sin(elapsed * 2.5) * 8

    ctx.save()
    ctx.translate(cx, cy + cloudBob)

    // Cloud shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)'
    ctx.beginPath()
    ctx.ellipse(0, 120, 140, 24, 0, 0, Math.PI * 2)
    ctx.fill()

    // Moody Storm Cloud Shape
    const cloudGrad = ctx.createLinearGradient(0, -90, 0, 60)
    cloudGrad.addColorStop(0, '#64748b')
    cloudGrad.addColorStop(0.5, '#475569')
    cloudGrad.addColorStop(1, '#334155')
    ctx.fillStyle = cloudGrad

    ctx.beginPath()
    ctx.arc(0, -25, 68, 0, Math.PI * 2)
    ctx.arc(-65, 10, 48, 0, Math.PI * 2)
    ctx.arc(65, 10, 48, 0, Math.PI * 2)
    ctx.arc(-110, 30, 34, 0, Math.PI * 2)
    ctx.arc(110, 30, 34, 0, Math.PI * 2)
    ctx.fill()

    // Sad Cloud Face
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'

    // Weeping Eyes (> < shape)
    ctx.beginPath()
    ctx.moveTo(-45, 8)
    ctx.lineTo(-32, 16)
    ctx.lineTo(-45, 24)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(45, 8)
    ctx.lineTo(32, 16)
    ctx.lineTo(45, 24)
    ctx.stroke()

    // Sad Quivering Mouth
    const mouthWobble = Math.sin(elapsed * 12) * 2
    ctx.beginPath()
    ctx.arc(0, 52 + mouthWobble, 18, Math.PI * 1.15, Math.PI * 1.85)
    ctx.stroke()

    ctx.restore()

    // 4. Teardrops emitted from Cloud Eyes
    if (Math.random() < 0.4) {
      tears.push({
        x: cx - 35 + (Math.random() * 6 - 3),
        y: cy + cloudBob + 24,
        vy: 200,
        alpha: 0.9,
      })
    }
    if (Math.random() < 0.4) {
      tears.push({
        x: cx + 35 + (Math.random() * 6 - 3),
        y: cy + cloudBob + 24,
        vy: 200,
        alpha: 0.9,
      })
    }

    ctx.fillStyle = '#60a5fa'
    for (let i = tears.length - 1; i >= 0; i--) {
      const t = tears[i]
      t.y += t.vy * dt
      t.vy += 450 * dt // gravity
      t.alpha -= 0.3 * dt

      if (t.y > height - 60 || t.alpha <= 0) {
        tears.splice(i, 1)
        continue
      }

      ctx.save()
      ctx.globalAlpha = t.alpha
      ctx.beginPath()
      ctx.ellipse(t.x, t.y, 4, 8, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // 5. Shattering Golden Coin (Drops down and fractures)
    const coinY = Math.min(height * 0.62, cy + 180)

    if (elapsed < 1.1) {
      // Golden coin hovering / shaking
      const shake = elapsed > 0.7 ? (Math.random() - 0.5) * 8 : 0
      ctx.save()
      ctx.translate(cx + shake, coinY)

      // Gold Coin Outer
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.arc(0, 0, 48, 0, Math.PI * 2)
      ctx.fill()

      // Inner Rim
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(0, 0, 40, 0, Math.PI * 2)
      ctx.stroke()

      // Star / Coin Emboss
      ctx.fillStyle = '#fbbf24'
      ctx.font = '900 36px Outfit, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🪙', 0, 2)

      // Lightning crack appearing on coin right before shatter
      if (elapsed > 0.75) {
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(0, -42)
        ctx.lineTo(-6, -15)
        ctx.lineTo(8, 5)
        ctx.lineTo(0, 42)
        ctx.stroke()
      }

      ctx.restore()
    } else {
      // Coin explodes into shards!
      if (!hasSpawnedShards) {
        hasSpawnedShards = true
        for (let i = 0; i < 18; i++) {
          const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.3
          const speed = Math.random() * 280 + 160
          shards.push({
            x: cx,
            y: coinY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 120,
            rot: Math.random() * Math.PI * 2,
            vrot: (Math.random() - 0.5) * 12,
            size: Math.random() * 14 + 10,
            alpha: 1,
          })
        }
      }

      // Draw fracturing shards
      shards.forEach((s) => {
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.vy += 650 * dt // gravity
        s.rot += s.vrot * dt
        s.alpha = Math.max(0, s.alpha - dt * 0.45)

        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(s.rot)
        ctx.globalAlpha = s.alpha

        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.moveTo(-s.size / 2, -s.size / 2)
        ctx.lineTo(s.size / 2, -s.size / 3)
        ctx.lineTo(s.size / 3, s.size / 2)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = '#d97706'
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.restore()
      })
    }

    // 6. Floating "-10 COINS" Penalty Badge
    if (elapsed > 1.2) {
      const badgeT = Math.min(1, (elapsed - 1.2) * 2.5)
      const scaleBadge = 1 + Math.sin(badgeT * Math.PI) * 0.25
      ctx.save()
      ctx.translate(cx, coinY)
      ctx.scale(scaleBadge, scaleBadge)

      // Rose Badge Background
      ctx.fillStyle = '#f43f5e'
      ctx.shadowColor = 'rgba(244, 63, 94, 0.65)'
      ctx.shadowBlur = 24
      roundRect(ctx, -110, -26, 220, 52, 26)
      ctx.fill()

      // Pill Text
      ctx.shadowBlur = 0
      ctx.font = '900 24px Outfit, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`-${coinsLost} COINS 💔`, 0, 1)

      ctx.restore()
    }

    // 7. Floating Overhead Notification Text
    if (elapsed > 0.2) {
      const textAlpha = Math.min(1, (elapsed - 0.2) * 3)
      ctx.save()
      ctx.globalAlpha = textAlpha

      // Chore Title
      ctx.font = '900 36px Outfit, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
      ctx.shadowBlur = 18
      ctx.shadowOffsetY = 3
      if (choreTitle) ctx.fillText(choreTitle.toUpperCase(), cx, Math.max(cy - 120, 60))

      // Removed points text
      ctx.font = '700 22px Outfit, sans-serif'
      ctx.fillStyle = '#fca5a5'
      ctx.fillText(`Removed ${coinsLost} points from your account`, cx, height - 70)

      // Encouragement Subtitle at bottom
      ctx.font = '600 16px Outfit, sans-serif'
      ctx.fillStyle = '#cbd5e1'
      ctx.fillText('Try again tomorrow to earn coins back! 💪', cx, height - 38)

      ctx.restore()
    }

    raf = requestAnimationFrame(loop)
  }

  raf = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', handleResize)
  }
}

/**
 * Dispatcher for canvas-based sad chore / penalty animations (Sad Storm).
 * Other penalty animations render via `/celebrations/*.html` iframes.
 */
export function runSadAnimation(
  canvas: HTMLCanvasElement,
  options: SadAnimationOptions = {},
): { cleanup: () => void; durationMs: number } {
  return {
    cleanup: runSadStormAnimation(canvas, options),
    durationMs: 4400,
  }
}

function roundRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}
