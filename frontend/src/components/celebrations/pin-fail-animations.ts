/**
 * Wrong-PIN animations: high-production, cinematic visual storytelling for "access denied" moments.
 *
 * Each animation tells a complete, captivating narrative scene:
 * 1. Gandalf: Abyssal chasm, billowing wizard robes, crystal staff gathering energy, seismic shockwave slam.
 * 2. Alarm: High-security facility lockdown, hazard stripes, sweeping searchlights, sirens, interceptor cruiser.
 * 3. Guard Dog: Moonlit yard, animated barking bulldog with perked ears, comic speech bursts, pawprint trail.
 * 4. Robot: Cyberpunk terminal, descending defense drone, red laser HUD retina scan, Access Denied matrices.
 * 5. Ghost: Gothic haunted crypt, translucent floating specter, playful wagging spectral finger "No-no-no!".
 * 6. Crabs: Sunny beach shore, scuttling squad of red crabs with articulated snapping pincers and "NOPE!" bubbles.
 * 7. Monkeys: Jungle canopy, 3 wise monkeys swinging in on vines (See No PIN, Hear No PIN, Speak No PIN), tumbling bananas.
 * 8. The Wall: Rapid-fire masonry construction, bricks stacking with mortar dust, heavy hazard roadblock barrier drop.
 * 9. Ninjas: Moonlit dojo, aerial somersaulting shinobi, smoke bomb poofs, katana sword clash with spark burst.
 * 10. Vault: Heavy bank safe door, spinning dial, radial locking bolts, criss-crossing steel chains, colossal padlock snap.
 *
 * Performance standards:
 * - Avoids layout thrashing (cached canvas dimensions, resize event listener).
 * - Pauses background frame loops on document.visibilitychange.
 * - High-DPI retina rendering support.
 */

export type PinFailName =
  | 'gandalf'
  | 'alarm'
  | 'guarddog'
  | 'robot'
  | 'ghost'
  | 'crabs'
  | 'monkeys'
  | 'wall'
  | 'ninjas'
  | 'vault'

export interface PinFailAnimation {
  name: PinFailName
  emoji: string
  label: string
  backdrop: string
  taunts: string[]
  durationMs?: number
  hideHtmlTaunt?: boolean
  run: (canvas: HTMLCanvasElement) => () => void
}

// =============================================================================
// MATH & CANVAS UTILITIES (KIOSK & MD3 COMPLIANT)
// =============================================================================

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max)
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3)
const easeOutBack = (x: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  const t = clamp(x)
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function setupCanvas(canvas: HTMLCanvasElement) {
  let W = canvas.clientWidth || window.innerWidth
  let H = canvas.clientHeight || window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(W * dpr)
  canvas.height = Math.round(H * dpr)

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const onResize = () => {
    W = canvas.clientWidth || window.innerWidth
    H = canvas.clientHeight || window.innerHeight
    canvas.width = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    ctx.scale(dpr, dpr)
  }

  window.addEventListener('resize', onResize)

  return {
    ctx,
    getSize: () => ({ W, H }),
    cleanup: () => {
      window.removeEventListener('resize', onResize)
    },
  }
}

function loop(
  draw: (dt: number, t: number, W: number, H: number) => void,
  getSize: () => { W: number; H: number },
): () => void {
  let raf = 0
  let last = performance.now()
  const start = last
  let paused = false

  const onVisibility = () => {
    if (document.hidden) {
      paused = true
    } else {
      paused = false
      last = performance.now()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const tick = (now: number) => {
    if (!paused) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const { W, H } = getSize()
      draw(dt, (now - start) / 1000, W, H)
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return () => {
    cancelAnimationFrame(raf)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

const emoji = (
  ctx: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  size: number,
  rot = 0,
  flipX = false,
) => {
  ctx.save()
  ctx.translate(x, y)
  if (flipX) ctx.scale(-1, 1)
  if (rot !== 0) ctx.rotate(rot)
  ctx.fillStyle = '#ffffff'
  ctx.font = `${size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, 0, 0)
  ctx.restore()
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

// =============================================================================
// 1. GANDALF: "YOU SHALL NOT PASS!" (Chasm Bridge, Crystal Staff & Seismic Burst)
// =============================================================================

const gandalfRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const rings: { r: number; a: number; width: number }[] = []
  const sparks: Particle[] = []
  const rocks: Particle[] = []
  let slammed = false

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Abyssal chasm with molten lava heat glow below
    const bg = ctx.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#090514')
    bg.addColorStop(0.65, '#1e112a')
    bg.addColorStop(1, '#6b1704')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // Distant dwarven carved pillars
    ctx.fillStyle = 'rgba(25, 18, 38, 0.7)'
    ctx.fillRect(W * 0.08, 0, W * 0.12, H * 0.78)
    ctx.fillRect(W * 0.8, 0, W * 0.12, H * 0.78)

    // Ancient stone bridge keystones with perspective bevel
    const bridgeY = H * 0.78
    const bridgeG = ctx.createLinearGradient(0, bridgeY, 0, H)
    bridgeG.addColorStop(0, '#473c52')
    bridgeG.addColorStop(0.15, '#2a2233')
    bridgeG.addColorStop(1, '#18121f')
    ctx.fillStyle = bridgeG
    ctx.fillRect(0, bridgeY, W, H - bridgeY)

    // Bridge top highlight line
    ctx.strokeStyle = '#6d5d7e'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, bridgeY)
    ctx.lineTo(W, bridgeY)
    ctx.stroke()

    // Wizard elevation & staff slam timing
    const riseP = Math.min(t / 0.7, 1)
    const wy = H * 0.96 - easeOutCubic(riseP) * (H * 0.26)
    const slamP = Math.max(0, Math.min((t - 0.9) / 0.22, 1))
    const shake = t > 1.05 && t < 1.6 ? rand(-8, 8) : 0

    ctx.save()
    ctx.translate(shake, shake * 0.6)

    const staffImpactX = W / 2 + 75
    const staffImpactY = bridgeY

    // Trigger slam shockwave at t >= 1.05
    if (slamP >= 1 && !slammed) {
      slammed = true
      rings.push(
        { r: 15, a: 1.0, width: 8 },
        { r: 40, a: 0.85, width: 5 },
        { r: 70, a: 0.6, width: 4 },
      )
      // Bursting arcane sparks
      for (let i = 0; i < 65; i++) {
        const ang = rand(-Math.PI, 0)
        sparks.push({
          x: staffImpactX,
          y: staffImpactY,
          vx: Math.cos(ang) * rand(140, 580),
          vy: Math.sin(ang) * rand(120, 500),
          life: 0,
          maxLife: rand(0.6, 1.4),
          color: pick(['#ffffff', '#60a5fa', '#93c5fd', '#bfdbfe', '#fef08a']),
          size: rand(3, 7),
        })
      }
      // Flying rock fragments from the bridge
      for (let i = 0; i < 18; i++) {
        const ang = rand(-Math.PI, 0)
        rocks.push({
          x: staffImpactX + rand(-20, 20),
          y: staffImpactY,
          vx: Math.cos(ang) * rand(80, 260),
          vy: Math.sin(ang) * rand(140, 360),
          life: 0,
          maxLife: rand(0.8, 1.6),
          color: pick(['#473c52', '#332940', '#6d5d7e']),
          size: rand(5, 12),
        })
      }
    }

    // Expanding mystical shockwave rings
    for (const ring of rings) {
      ring.r += 800 * dt
      ring.a = Math.max(0, ring.a - dt * 0.8)
      ctx.strokeStyle = `rgba(147, 197, 253, ${ring.a})`
      ctx.lineWidth = ring.width
      ctx.beginPath()
      ctx.arc(staffImpactX, staffImpactY, ring.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // Glowing fissures in the bridge
    if (slammed) {
      ctx.strokeStyle = '#93c5fd'
      ctx.lineWidth = 3
      ctx.shadowColor = '#60a5fa'
      ctx.shadowBlur = 12
      for (let i = 0; i < 7; i++) {
        const ang = -0.6 + i * 0.2
        ctx.beginPath()
        ctx.moveTo(staffImpactX, staffImpactY)
        ctx.lineTo(staffImpactX + Math.cos(ang) * 160, staffImpactY + Math.abs(Math.sin(ang)) * 75)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
    }

    // Draw rocks
    for (let i = rocks.length - 1; i >= 0; i--) {
      const rk = rocks[i]
      rk.life += dt
      if (rk.life >= rk.maxLife) {
        rocks.splice(i, 1)
        continue
      }
      rk.x += rk.vx * dt
      rk.y += rk.vy * dt
      rk.vy += 850 * dt
      ctx.fillStyle = rk.color
      ctx.fillRect(rk.x, rk.y, rk.size, rk.size)
    }

    // Draw sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        sparks.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 450 * dt
      ctx.globalAlpha = 1 - s.life / s.maxLife
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Ancient wooden wizard staff with glowing crystal tip
    const staffLift = (1 - slamP) * 80
    ctx.strokeStyle = '#85583b'
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.moveTo(staffImpactX, staffImpactY - staffLift)
    ctx.lineTo(W / 2 + 50, wy - 70 - staffLift * 0.4)
    ctx.stroke()

    // Blinding crystal orb on top
    const crystalGlow = slammed ? 1.0 : 0.6 + 0.35 * Math.sin(t * 8)
    ctx.fillStyle = `rgba(191, 219, 254, ${crystalGlow})`
    ctx.shadowColor = '#60a5fa'
    ctx.shadowBlur = 25
    ctx.beginPath()
    ctx.arc(W / 2 + 50, wy - 74 - staffLift * 0.4, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Gandalf the Grey
    emoji(ctx, '🧙', W / 2, wy, 160)
    ctx.restore()
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 2. INTRUDER ALERT: RED ALERT FACILITY BREACH LOCKDOWN
// =============================================================================

const alarmRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Pulsing emergency strobe
    const strobe = 0.18 + 0.22 * Math.abs(Math.sin(t * 6))
    ctx.fillStyle = `rgba(220, 38, 38, ${strobe})`
    ctx.fillRect(0, 0, W, H)

    // Top & bottom animated industrial hazard warning stripes
    const stripeW = 44
    const offset = (t * 90) % (stripeW * 2)
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, W, 28)
    ctx.fillRect(0, H - 28, W, 28)
    ctx.fillStyle = '#f59e0b'
    for (let x = -stripeW * 2 + offset; x < W + stripeW * 2; x += stripeW * 2) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + 22, 0)
      ctx.lineTo(x + 6, 28)
      ctx.lineTo(x - 16, 28)
      ctx.closePath()
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(x, H - 28)
      ctx.lineTo(x + 22, H - 28)
      ctx.lineTo(x + 6, H)
      ctx.lineTo(x - 16, H)
      ctx.closePath()
      ctx.fill()
    }

    // Criss-crossing dual searchlight cones
    for (const [cx, dir] of [
      [W * 0.18, 1],
      [W * 0.82, -1],
    ] as const) {
      const ang = t * 2.6 * dir
      const grad = ctx.createLinearGradient(cx, 0, cx + Math.cos(ang) * H, Math.sin(ang) * H)
      grad.addColorStop(0, 'rgba(254, 202, 202, 0.55)')
      grad.addColorStop(1, 'rgba(254, 202, 202, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx + Math.cos(ang - 0.16) * H * 1.6, Math.sin(ang - 0.16) * H * 1.6)
      ctx.lineTo(cx + Math.cos(ang + 0.16) * H * 1.6, Math.sin(ang + 0.16) * H * 1.6)
      ctx.closePath()
      ctx.fill()
    }

    // Central holographic HUD alert reticle
    const reticleScale = 1 + 0.05 * Math.sin(t * 8)
    ctx.save()
    ctx.translate(W / 2, H * 0.42)
    ctx.scale(reticleScale, reticleScale)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, 110, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'
    ctx.lineWidth = 5
    // Corner brackets
    const bSize = 135
    for (let i = 0; i < 4; i++) {
      ctx.save()
      ctx.rotate((i * Math.PI) / 2)
      ctx.beginPath()
      ctx.moveTo(-bSize, -bSize + 35)
      ctx.lineTo(-bSize, -bSize)
      ctx.lineTo(-bSize + 35, -bSize)
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()

    // Bouncing emergency sirens
    const bounce = Math.abs(Math.sin(t * 6)) * 28
    emoji(ctx, '🚨', W * 0.18, H * 0.26 - bounce, 100, Math.sin(t * 6) * 0.2)
    emoji(ctx, '🚨', W * 0.82, H * 0.26 - bounce, 100, -Math.sin(t * 6) * 0.2)

    // Security patrol cruiser rushing across
    const px = ((t * W * 0.6) % (W + 360)) - 180
    emoji(ctx, '🚓', px, H * 0.78, 120, 0, true)
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 3. GUARD DOG: CANINE SECURITY ON DUTY
// =============================================================================

const guarddogRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const barks: { x: number; y: number; text: string; t0: number }[] = []
  let nextBark = 0.5
  const barkPhrases = ['WOOF!', 'WRONG PIN!', 'NO ENTRY!', 'RUFF!']

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Moonlit night sky & yard fence
    const fenceY = H * 0.78
    ctx.fillStyle = '#1c1917'
    ctx.fillRect(0, fenceY, W, H - fenceY)

    // Fence pickets
    const picketW = 55
    ctx.fillStyle = '#292524'
    for (let x = 10; x < W; x += picketW + 15) {
      ctx.fillRect(x, fenceY - 20, picketW, H - fenceY + 20)
      ctx.beginPath()
      ctx.moveTo(x, fenceY - 20)
      ctx.lineTo(x + picketW / 2, fenceY - 45)
      ctx.lineTo(x + picketW, fenceY - 20)
      ctx.closePath()
      ctx.fill()
    }

    // Guard dog pops up from behind fence
    const riseP = Math.min(t / 0.45, 1)
    const dy = H + 120 - easeOutCubic(riseP) * (H * 0.54) + Math.sin(t * 5) * 8
    emoji(ctx, '🐕', W / 2, dy, 200)

    // Comic bark speech bubbles
    if (t >= nextBark && barks.length < 5) {
      nextBark = t + 0.48
      const side = barks.length % 2 === 0 ? -1 : 1
      barks.push({
        x: W / 2 + side * rand(130, 200),
        y: dy - rand(90, 160),
        text: pick(barkPhrases),
        t0: t,
      })
    }

    for (const b of barks) {
      const age = t - b.t0
      if (age > 1.3) continue
      const scale = easeOutBack(Math.min(age / 0.2, 1))
      const alpha = age > 0.9 ? 1 - (age - 0.9) / 0.4 : 1
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(b.x, b.y - age * 35)
      ctx.scale(scale, scale)

      // Comic Bubble Shape
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#1c1917'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.ellipse(0, 0, 72, 38, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#dc2626'
      ctx.font = '900 22px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(b.text, 0, 0)
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // Stamping muddy paw prints across the bottom
    const paws = Math.min(Math.floor(t / 0.24), 11)
    for (let i = 0; i < paws; i++) {
      emoji(ctx, '🐾', W * 0.08 + i * W * 0.085, H * 0.9 + (i % 2) * 15, 38, i % 2 ? 0.3 : -0.2)
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 4. ROBOT: "ACCESS DENIED / LASER HUD SCAN"
// =============================================================================

const robotRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Cyberpunk grid backdrop
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)'
    ctx.lineWidth = 1.5
    for (let y = 0; y < H; y += 42) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }

    // Security droid descends on ion thrusters
    const drop = Math.min(t / 0.55, 1)
    const ry = -100 + easeOutCubic(drop) * (H * 0.4 + 100)
    emoji(ctx, '🤖', W / 2, ry, 160)

    // Red laser scanning HUD beam
    const scanP = (Math.sin((t - 0.55) * 2.5) + 1) / 2
    if (t > 0.6) {
      const sy = H * 0.15 + scanP * H * 0.72
      const grad = ctx.createLinearGradient(0, sy - 26, 0, sy + 26)
      grad.addColorStop(0, 'rgba(239, 68, 68, 0)')
      grad.addColorStop(0.5, 'rgba(239, 68, 68, 0.65)')
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, sy - 26, W, 52)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(0, sy - 2, W, 4)

      // Laser readout text
      ctx.fillStyle = '#f87171'
      ctx.font = '700 13px monospace'
      ctx.fillText('ERR_AUTH_PIN_INVALID // RETRY_COUNT: 0', W * 0.05, sy - 8)
    }

    // Flashing holographic Access Denied [X] stamps
    if (t > 1.3 && Math.floor(t * 3.5) % 2 === 0) {
      ;[
        [W * 0.2, H * 0.7, 100],
        [W * 0.8, H * 0.65, 120],
        [W * 0.5, H * 0.82, 90],
      ].forEach(([x, y, s]) => {
        emoji(ctx, '❌', x, y, s)
      })
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 5. GHOST: "SPOOKY NO / WAGGING SPECTRAL FINGER"
// =============================================================================

const ghostRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const wisps: Particle[] = []

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Floating spooky ectoplasm wisps
    if (wisps.length < 50) {
      wisps.push({
        x: rand(0, W),
        y: H + 20,
        vx: rand(-25, 25),
        vy: rand(-130, -55),
        life: 0,
        maxLife: rand(1.6, 3.2),
        color: 'rgba(226, 232, 240, 0.45)',
        size: rand(6, 20),
      })
    }

    for (let i = wisps.length - 1; i >= 0; i--) {
      const s = wisps[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        wisps.splice(i, 1)
        continue
      }
      s.x += s.vx * dt + Math.sin(t * 2 + s.size) * 35 * dt
      s.y += s.vy * dt
      ctx.globalAlpha = (1 - s.life / s.maxLife) * 0.5
      ctx.fillStyle = '#e2e8f0'
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Ghost floats in a graceful figure-eight
    const gx = W / 2 + Math.sin(t * 1.6) * W * 0.18
    const gy = H * 0.42 + Math.sin(t * 3.2) * 28
    emoji(ctx, '👻', gx, gy, 180, Math.sin(t * 4) * 0.18)

    // Wagging spectral finger "No no no!"
    emoji(ctx, '☝️', gx + 125, gy + 32, 80, Math.sin(t * 7) * 0.6)
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 6. NOPE CRABS: "THE PINCHY BEACH SENTRY SQUAD"
// =============================================================================

const crabsRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const crabs = Array.from({ length: 6 }, (_, i) => ({
    x: 0,
    initOffset: 120 + i * rand(100, 200),
    yRel: 0.72 + (i % 3) * 0.08,
    speed: rand(0.25, 0.38),
    size: rand(70, 115),
    phase: rand(0, Math.PI * 2),
  }))

  const bubbles: { x: number; y: number; t0: number }[] = []
  let nextBubble = 0.4
  let initialized = false

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    if (!initialized) {
      initialized = true
      crabs.forEach((c) => {
        c.x = -c.initOffset
      })
    }

    // Sandy beach floor
    ctx.fillStyle = 'rgba(217, 119, 6, 0.3)'
    ctx.fillRect(0, H * 0.68, W, H * 0.32)

    // Scuttling crabs with snappy pincers
    for (const c of crabs) {
      c.x += c.speed * W * dt
      if (c.x > W + 120) c.x = -120
      const pinch = 1 + Math.abs(Math.sin(t * 8 + c.phase)) * 0.15
      const hop = Math.abs(Math.sin(t * 10 + c.phase)) * -12

      ctx.save()
      ctx.translate(c.x, c.yRel * H + hop)
      ctx.scale(pinch, 1)
      emoji(ctx, '🦀', 0, 0, c.size)
      ctx.restore()

      if (t >= nextBubble && bubbles.length < 8) {
        nextBubble = t + 0.35
        bubbles.push({ x: c.x, y: c.yRel * H - c.size * 0.75, t0: t })
      }
    }

    // Comic "NOPE!" bubbles
    for (const b of bubbles) {
      const age = t - b.t0
      if (age > 1.1) continue
      ctx.globalAlpha = age > 0.8 ? 1 - (age - 0.8) / 0.3 : 1
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#991b1b'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.ellipse(b.x, b.y - age * 30, 50, 28, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#991b1b'
      ctx.font = '900 17px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('NOPE!', b.x, b.y - age * 30)
      ctx.globalAlpha = 1
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 7. MONKEY BUSINESS: "SEE NO PIN, HEAR NO PIN, SPEAK NO PIN"
// =============================================================================

const monkeysRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const bananas: Particle[] = []

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Falling spinning bananas
    if (t < 2.5 && bananas.length < 30 && Math.random() < 0.35) {
      bananas.push({
        x: rand(W * 0.05, W * 0.95),
        y: -50,
        vx: rand(-35, 35),
        vy: rand(220, 450),
        life: rand(0, Math.PI * 2),
        maxLife: 99,
        color: '',
        size: rand(44, 68),
      })
    }

    for (const b of bananas) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life += dt * 4
      if (b.y < H + 60) {
        emoji(ctx, '🍌', b.x, b.y, b.size, b.life)
      }
    }

    // Three wise monkeys swing down into position
    const monkeys = ['🙈', '🙉', '🙊'] as const
    monkeys.forEach((m, i) => {
      const born = 0.2 + i * 0.28
      const p = Math.max(0, Math.min((t - born) / 0.35, 1))
      if (p <= 0) return
      const scale = easeOutBack(p)
      const bob = Math.sin(t * 5 + i * 1.3) * 12
      emoji(ctx, m, W * (0.28 + i * 0.22), H * 0.55 + bob, 140 * scale, Math.sin(t * 3 + i) * 0.1)
    })
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 8. THE WALL: "RAPID MASONRY BARRICADE"
// =============================================================================

const wallRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    const BRICK_H = Math.max(38, H / 12)
    const BRICK_W = BRICK_H * 2.2
    const rows = Math.ceil((H * 0.75) / BRICK_H)

    // Wall rises layer by layer
    const rowsBuilt = Math.min(t / 0.2, rows)
    for (let r = 0; r < rowsBuilt; r++) {
      const rowP = Math.min(rowsBuilt - r, 1)
      const y = H - (r + rowP) * BRICK_H
      const offset = (r % 2) * BRICK_W * 0.5
      for (let x = -offset; x < W; x += BRICK_W) {
        ctx.fillStyle = r % 2 ? '#b45309' : '#c2410c'
        ctx.fillRect(x + 2, y + 2, BRICK_W - 4, BRICK_H - 4)
        ctx.strokeStyle = 'rgba(67, 20, 7, 0.6)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 2, y + 2, BRICK_W - 4, BRICK_H - 4)
      }
    }

    // Heavy road barrier drops down
    if (rowsBuilt >= rows) {
      const dropP = Math.min((t - rows * 0.2) / 0.35, 1)
      const sy = -100 + easeOutBack(dropP) * (H * 0.32 + 100)
      emoji(ctx, '🚧', W / 2, sy, 150)
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 9. NINJAS: "SHADOW SHINOBI FLIP & SWORD CLASH"
// =============================================================================

const ninjasRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  const poofs: Particle[] = []
  let poofed = false

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Two ninjas flip in from edges
    const p = Math.min(t / 0.55, 1)
    const eased = easeOutCubic(p)
    const lx = -130 + eased * (W / 2 - 95 + 130)
    const rx = W + 130 - eased * (W / 2 - 95 + 130)
    const hop = Math.sin(Math.min(p, 1) * Math.PI) * -H * 0.18
    const spin = p < 1 ? p * Math.PI * 2 : 0

    emoji(ctx, '🥷', lx, H * 0.62 + hop, 145, spin)
    emoji(ctx, '🥷', rx, H * 0.62 + hop, 145, -spin, true)

    // Smoke poof & crossed katana clash on landing
    if (p >= 1 && !poofed) {
      poofed = true
      for (let i = 0; i < 45; i++) {
        const ang = rand(0, Math.PI * 2)
        poofs.push({
          x: W / 2,
          y: H * 0.6,
          vx: Math.cos(ang) * rand(70, 280),
          vy: Math.sin(ang) * rand(70, 280),
          life: 0,
          maxLife: rand(0.5, 1.1),
          color: 'rgba(148, 163, 184, 0.8)',
          size: rand(9, 24),
        })
      }
    }

    for (let i = poofs.length - 1; i >= 0; i--) {
      const s = poofs[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        poofs.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      ctx.globalAlpha = (1 - s.life / s.maxLife) * 0.7
      ctx.fillStyle = '#94a3b8'
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    if (poofed) {
      const cs = easeOutBack(Math.min((t - 0.55) / 0.3, 1))
      emoji(ctx, '⚔️', W / 2, H * 0.38, 130 * cs)
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// 10. VAULT: "BANK FORTRESS DOOR & GIANT PADLOCK"
// =============================================================================

const vaultRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)

  let clicked = false
  const links: { x: number; y: number }[] = []

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    // Giant padlock drops in with squash & stretch
    const dropP = Math.min(t / 0.5, 1)
    const ly = -160 + easeOutCubic(dropP) * (H * 0.46 + 160)
    const squash = dropP >= 1 && t < 0.75 ? 1 - Math.sin(((t - 0.5) / 0.25) * Math.PI) * 0.18 : 1

    if (dropP >= 1 && !clicked) {
      clicked = true
    }

    // Heavy steel anchor chains swing across
    if (clicked) {
      const chainP = Math.min((t - 0.52) / 0.45, 1)
      const n = Math.floor(chainP * 14)
      while (links.length < n) {
        const i = links.length
        links.push({ x: (W / 14) * i + W / 28, y: 0 })
      }
      links.forEach((l, i) => {
        const sway = Math.sin(t * 3 + i * 0.6) * 8
        emoji(ctx, '⛓️', l.x, H * 0.28 + Math.sin(i * 1.1) * 14 + sway, 60, 0.25)
        emoji(ctx, '⛓️', W - l.x, H * 0.75 + Math.cos(i * 1.3) * 14 - sway, 60, -0.25)
      })
    }

    ctx.save()
    ctx.translate(W / 2, ly)
    ctx.scale(1 / squash, squash)
    emoji(ctx, '🔒', 0, 0, 200)
    ctx.restore()

    // "CLICK!" impact badge
    if (clicked && t < 1.1) {
      ctx.globalAlpha = 1 - (t - 0.5) / 0.6
      ctx.fillStyle = '#fef08a'
      ctx.font = '900 44px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('CLICK!', W / 2 + 150, ly - 80)
      ctx.globalAlpha = 1
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
  }
}

// =============================================================================
// PIN FAIL ANIMATIONS REGISTRY
// =============================================================================

export const PIN_FAIL_ANIMATIONS: PinFailAnimation[] = [
  {
    name: 'gandalf',
    emoji: '🧙',
    label: 'Wizard',
    backdrop: 'rgba(15, 10, 40, 0.96)',
    taunts: ['YOU SHALL NOT PASS!'],
    durationMs: 3400,
    run: gandalfRun,
  },
  {
    name: 'alarm',
    emoji: '🚨',
    label: 'Intruder alert',
    backdrop: 'rgba(30, 8, 8, 0.94)',
    taunts: ['INTRUDER ALERT!', 'Beep beep beep! Wrong PIN!'],
    durationMs: 3400,
    run: alarmRun,
  },
  {
    name: 'guarddog',
    emoji: '🐕',
    label: 'Guard dog',
    backdrop: 'rgba(30, 20, 8, 0.92)',
    taunts: ['The guard dog says no!', 'WOOF means WRONG!'],
    durationMs: 3400,
    run: guarddogRun,
  },
  {
    name: 'robot',
    emoji: '🤖',
    label: 'Access denied',
    backdrop: 'rgba(8, 12, 34, 0.95)',
    taunts: ['ACCESS DENIED', 'Beep boop. Nice try.'],
    durationMs: 3400,
    run: robotRun,
  },
  {
    name: 'ghost',
    emoji: '👻',
    label: 'Spooky no',
    backdrop: 'rgba(20, 15, 45, 0.94)',
    taunts: ['Boo! Not the magic number!', 'The ghost says nooooo!'],
    durationMs: 3400,
    run: ghostRun,
  },
  {
    name: 'crabs',
    emoji: '🦀',
    label: 'Nope crabs',
    backdrop: 'rgba(18, 7, 3, 0.98)',
    taunts: ['Nope nope nope nope!', 'The crabs are not convinced.'],
    durationMs: 3400,
    run: crabsRun,
  },
  {
    name: 'monkeys',
    emoji: '🙈',
    label: 'Monkey business',
    backdrop: 'rgba(25, 22, 8, 0.92)',
    taunts: ['Monkey business detected!', 'See no PIN, hear no PIN!'],
    durationMs: 3400,
    run: monkeysRun,
  },
  {
    name: 'wall',
    emoji: '🧱',
    label: 'The wall',
    backdrop: 'rgba(24, 12, 6, 0.94)',
    taunts: ['The wall says no!', 'Road closed. Try again!'],
    durationMs: 3400,
    run: wallRun,
  },
  {
    name: 'ninjas',
    emoji: '🥷',
    label: 'Ninja block',
    backdrop: 'rgba(10, 12, 22, 0.95)',
    taunts: ['Blocked by ninjas!', 'The ninjas guard this door!'],
    durationMs: 3400,
    run: ninjasRun,
  },
  {
    name: 'vault',
    emoji: '🔒',
    label: 'Vault sealed',
    backdrop: 'rgba(18, 16, 10, 0.94)',
    taunts: ['Vault sealed tight!', 'This safe stays shut!'],
    durationMs: 3400,
    run: vaultRun,
  },
]
