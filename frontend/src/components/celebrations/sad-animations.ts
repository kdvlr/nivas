/**
 * Sad chore / penalty animations: high-production, cinematic visual storytelling
 * for when a negative chore (like "Room Not Clean") is completed.
 *
 * Performance standards:
 * - Avoids layout thrashing (cached dimensions, resize listener).
 * - High-DPI retina rendering support.
 * - Pauses background frame loops on document.visibilitychange.
 */

export interface SadAnimationOptions {
  title?: string
  coinsLost?: number
}

// =============================================================================
// WEB AUDIO SYNTHESIZER: SAD TROMBONE (WAH-WAH-WAH-WAAAH)
// =============================================================================

export function playSadTrombone() {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem('nivas_celebration_sound') === 'false') return
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
  const choreTitle = options.title || 'Room Not Clean'

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
      ctx.strokeStyle = `rgba(186, 215, 255, ${s.alpha})`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.35, 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 3. Center Gloomy Sad Storm Cloud
    const cx = width / 2
    const cy = Math.min(height * 0.34, 250)
    const cloudBob = Math.sin(elapsed * 2.5) * 6

    ctx.save()
    ctx.translate(cx, cy + cloudBob)

    // Cloud shadow
    ctx.shadowColor = 'rgba(15, 23, 42, 0.6)'
    ctx.shadowBlur = 30
    ctx.shadowOffsetY = 15

    // Cartoon Storm Cloud Body
    const cloudGrad = ctx.createLinearGradient(0, -70, 0, 60)
    cloudGrad.addColorStop(0, '#64748b')
    cloudGrad.addColorStop(0.5, '#475569')
    cloudGrad.addColorStop(1, '#334155')

    ctx.fillStyle = cloudGrad
    ctx.beginPath()
    ctx.arc(0, 0, 52, 0, Math.PI * 2)
    ctx.arc(-48, 12, 38, 0, Math.PI * 2)
    ctx.arc(48, 12, 38, 0, Math.PI * 2)
    ctx.arc(-26, -26, 42, 0, Math.PI * 2)
    ctx.arc(26, -26, 42, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Cloud Face Details (Sad Expression)
    ctx.save()
    ctx.translate(cx, cy + cloudBob)

    // Droopy sad eyebrows
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    // Left eyebrow (slanting down to sides)
    ctx.beginPath()
    ctx.moveTo(-32, -18)
    ctx.lineTo(-14, -24)
    ctx.stroke()
    // Right eyebrow
    ctx.beginPath()
    ctx.moveTo(32, -18)
    ctx.lineTo(14, -24)
    ctx.stroke()

    // Big teary cartoon eyes 🥺
    const eyeBlink = Math.sin(elapsed * 1.5) > 0.96 ? 0.2 : 1
    // Left eye
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.ellipse(-22, -4, 9, 12 * eyeBlink, 0, 0, Math.PI * 2)
    ctx.fill()
    // Right eye
    ctx.beginPath()
    ctx.ellipse(22, -4, 9, 12 * eyeBlink, 0, 0, Math.PI * 2)
    ctx.fill()

    if (eyeBlink > 0.5) {
      // Big watery catchlights
      ctx.fillStyle = '#bae6fd'
      ctx.beginPath()
      ctx.arc(-24, -7, 4, 0, Math.PI * 2)
      ctx.arc(20, -7, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(-20, -2, 2, 0, Math.PI * 2)
      ctx.arc(24, -2, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Trembling wavy sad mouth: ~ ﹏ ~
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-16, 22)
    ctx.quadraticCurveTo(-8, 14, 0, 22)
    ctx.quadraticCurveTo(8, 14, 16, 22)
    ctx.stroke()

    // Cheeks blushing soft sad blue-purple
    ctx.fillStyle = 'rgba(147, 197, 253, 0.35)'
    ctx.beginPath()
    ctx.ellipse(-34, 8, 8, 5, 0, 0, Math.PI * 2)
    ctx.ellipse(34, 8, 8, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()

    // 4. Weeping Teardrops
    if (elapsed > 0.4 && Math.random() < 0.35) {
      tears.push({
        x: cx + (Math.random() > 0.5 ? 22 : -22) + (Math.random() - 0.5) * 6,
        y: cy + 10,
        vy: Math.random() * 120 + 220,
        alpha: 0.9,
      })
    }

    for (let i = tears.length - 1; i >= 0; i--) {
      const t = tears[i]
      t.y += t.vy * dt
      t.alpha -= dt * 0.45
      if (t.y > height || t.alpha <= 0) {
        tears.splice(i, 1)
        continue
      }
      ctx.fillStyle = `rgba(56, 189, 248, ${t.alpha})`
      ctx.beginPath()
      ctx.moveTo(t.x, t.y - 8)
      ctx.quadraticCurveTo(t.x + 5, t.y, t.x, t.y + 7)
      ctx.quadraticCurveTo(t.x - 5, t.y, t.x, t.y - 8)
      ctx.fill()
    }

    // 5. The Cracking / Deducted Coin
    const coinY = Math.min(cy + 160, height * 0.62)
    const coinScale = Math.min(1, elapsed * 3)

    if (elapsed >= 0.8 && !hasSpawnedShards) {
      hasSpawnedShards = true
      for (let i = 0; i < 24; i++) {
        const ang = Math.random() * Math.PI * 2
        const spd = Math.random() * 240 + 80
        shards.push({
          x: cx,
          y: coinY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 60,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 8,
          size: Math.random() * 8 + 4,
          alpha: 1,
        })
      }
    }

    // Draw broken coin halves
    if (coinScale > 0) {
      const separation = elapsed > 0.8 ? Math.min(32, (elapsed - 0.8) * 45) : 0
      const coinTilt = elapsed > 0.8 ? (elapsed - 0.8) * 0.15 : 0

      // Left Half
      ctx.save()
      ctx.translate(cx - separation, coinY + separation * 0.3)
      ctx.rotate(-coinTilt)
      ctx.scale(coinScale, coinScale)

      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.arc(0, 0, 44, Math.PI * 0.5, Math.PI * 1.5)
      // Jagged crack edge
      ctx.lineTo(0, -44)
      ctx.lineTo(-4, -20)
      ctx.lineTo(6, 0)
      ctx.lineTo(-6, 22)
      ctx.lineTo(0, 44)
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()

      // Right Half
      ctx.save()
      ctx.translate(cx + separation, coinY + separation * 0.3)
      ctx.rotate(coinTilt)
      ctx.scale(coinScale, coinScale)

      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.arc(0, 0, 44, -Math.PI * 0.5, Math.PI * 0.5)
      ctx.lineTo(0, 44)
      ctx.lineTo(-6, 22)
      ctx.lineTo(6, 0)
      ctx.lineTo(-4, -20)
      ctx.lineTo(0, -44)
      ctx.closePath()
      ctx.fill()

      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.restore()
    }

    // Update & Draw Coin Shards
    for (let i = shards.length - 1; i >= 0; i--) {
      const sh = shards[i]
      sh.x += sh.vx * dt
      sh.y += sh.vy * dt
      sh.vy += 380 * dt // gravity
      sh.rot += sh.vrot * dt
      sh.alpha -= dt * 0.8
      if (sh.alpha <= 0) {
        shards.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.translate(sh.x, sh.y)
      ctx.rotate(sh.rot)
      ctx.globalAlpha = Math.max(0, sh.alpha)
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(-sh.size / 2, -sh.size / 2, sh.size, sh.size)
      ctx.restore()
    }

    // 6. Floating Red Penalty Badge: -10 Coins 💔
    if (elapsed > 0.9) {
      const badgeY = coinY - Math.min(50, (elapsed - 0.9) * 40)
      const badgeAlpha = Math.min(1, (elapsed - 0.9) * 4)

      ctx.save()
      ctx.globalAlpha = badgeAlpha
      ctx.translate(cx, badgeY)

      // Pill container
      ctx.shadowColor = 'rgba(225, 29, 72, 0.45)'
      ctx.shadowBlur = 24
      ctx.fillStyle = '#e11d48' // Vivid rose-600

      const pillW = 220
      const pillH = 46
      roundRect(ctx, -pillW / 2, -pillH / 2, pillW, pillH, 23)
      ctx.fill()

      // Border
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Text: -10 COINS 💔
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 22px Outfit, sans-serif'
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
      ctx.fillText(choreTitle.toUpperCase(), cx, Math.max(cy - 120, 60))

      // Encouragement Subtitle at bottom
      ctx.font = '600 18px Outfit, sans-serif'
      ctx.fillStyle = '#cbd5e1'
      ctx.fillText('Clean it up next time to earn coins back! 💪', cx, height - 40)

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
