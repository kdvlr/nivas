/** Wrong-PIN animations: playful "access denied" moments for kids. */

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
  /** emoji + short label for the Setup preview picker */
  emoji: string
  label: string
  backdrop: string
  taunts: string[]
  run: (canvas: HTMLCanvasElement) => () => void
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

function loop(draw: (dt: number, t: number) => void): () => void {
  let raf = 0
  let last = performance.now()
  const start = last
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    draw(dt, (now - start) / 1000)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}

function fit(canvas: HTMLCanvasElement) {
  canvas.width = canvas.clientWidth
  canvas.height = canvas.clientHeight
  return canvas.getContext('2d')!
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
  ctx.rotate(rot)
  ctx.font = `${size}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(glyph, 0, 0)
  ctx.restore()
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

/* ------------------------------------------------ gandalf ---------------- */

const gandalfRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const rings: { r: number; a: number }[] = []
  const sparks: Spark[] = []
  let slammed = false

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // rocky bridge floor
    ctx.fillStyle = 'rgba(80, 70, 90, 0.6)'
    ctx.fillRect(0, H * 0.82, W, H * 0.18)

    // wizard rises from below, then slams the staff at ~1s
    const rise = Math.min(t / 0.7, 1)
    const eased = 1 - Math.pow(1 - rise, 3)
    const wy = H * 0.95 - eased * H * 0.28
    const slamP = Math.max(0, Math.min((t - 0.9) / 0.25, 1))
    // screen shake right after the slam
    const shake = t > 1.1 && t < 1.7 ? rand(-6, 6) : 0

    ctx.save()
    ctx.translate(shake, shake * 0.6)

    // shockwave rings from the staff point
    if (slamP >= 1 && !slammed) {
      slammed = true
      rings.push({ r: 10, a: 1 }, { r: 60, a: 0.8 })
      for (let i = 0; i < 50; i++) {
        const ang = rand(-Math.PI, 0)
        sparks.push({
          x: W / 2 + 70, y: H * 0.8,
          vx: Math.cos(ang) * rand(100, 500), vy: Math.sin(ang) * rand(80, 420),
          life: 0, maxLife: rand(0.5, 1.2),
          color: pick(['#ffffff', '#bfdbfe', '#fef9c3']), size: rand(2, 5),
        })
      }
    }
    for (const ring of rings) {
      ring.r += 700 * dt
      ring.a = Math.max(0, ring.a - dt * 0.9)
      ctx.strokeStyle = `rgba(219, 234, 254, ${ring.a})`
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.arc(W / 2 + 70, H * 0.8, ring.r, 0, Math.PI * 2)
      ctx.stroke()
    }

    // cracks in the bridge
    if (slammed) {
      ctx.strokeStyle = 'rgba(240, 240, 255, 0.55)'
      ctx.lineWidth = 2.5
      for (let i = 0; i < 5; i++) {
        const ang = -0.5 + i * 0.28
        ctx.beginPath()
        ctx.moveTo(W / 2 + 70, H * 0.82)
        ctx.lineTo(W / 2 + 70 + Math.cos(ang) * 130, H * 0.82 + Math.abs(Math.sin(ang)) * 60)
        ctx.stroke()
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.life += dt
      if (s.life >= s.maxLife) { sparks.splice(i, 1); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 500 * dt
      ctx.globalAlpha = 1 - s.life / s.maxLife
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // staff (raised, then slammed down) + wizard
    const staffLift = (1 - slamP) * 60
    ctx.strokeStyle = '#d6bfa2'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(W / 2 + 70, H * 0.8 - staffLift)
    ctx.lineTo(W / 2 + 46, wy - 60 - staffLift * 0.4)
    ctx.stroke()
    // glowing staff tip
    const glow = slammed ? 0.9 : 0.5 + 0.3 * Math.sin(t * 8)
    ctx.fillStyle = `rgba(191, 219, 254, ${glow})`
    ctx.beginPath()
    ctx.arc(W / 2 + 46, wy - 64 - staffLift * 0.4, 12, 0, Math.PI * 2)
    ctx.fill()
    emoji(ctx, '🧙', W / 2, wy, 150)

    ctx.restore()
  })
}

/* ------------------------------------------------ alarm ------------------ */

const alarmRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height

  return loop((_dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // pulsing red wash
    ctx.fillStyle = `rgba(220, 38, 38, ${0.12 + 0.14 * Math.abs(Math.sin(t * 5))})`
    ctx.fillRect(0, 0, W, H)

    // two rotating searchlight beams
    for (const [cx, dir] of [[W * 0.2, 1], [W * 0.8, -1]] as const) {
      const ang = t * 2.2 * dir
      const grad = ctx.createLinearGradient(cx, 0, cx + Math.cos(ang) * H, Math.sin(ang) * H)
      grad.addColorStop(0, 'rgba(254, 202, 202, 0.45)')
      grad.addColorStop(1, 'rgba(254, 202, 202, 0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(cx, 0)
      ctx.lineTo(cx + Math.cos(ang - 0.14) * H * 1.6, Math.sin(ang - 0.14) * H * 1.6)
      ctx.lineTo(cx + Math.cos(ang + 0.14) * H * 1.6, Math.sin(ang + 0.14) * H * 1.6)
      ctx.closePath()
      ctx.fill()
    }

    // bouncing sirens
    const bounce = Math.abs(Math.sin(t * 6)) * 26
    emoji(ctx, '🚨', W * 0.18, H * 0.24 - bounce, 90, Math.sin(t * 6) * 0.2)
    emoji(ctx, '🚨', W * 0.82, H * 0.24 - bounce, 90, -Math.sin(t * 6) * 0.2)

    // patrolling police car
    const px = ((t * W * 0.45) % (W + 300)) - 150
    emoji(ctx, '🚓', px, H * 0.8, 100, 0, true)
  })
}

/* ------------------------------------------------ guard dog -------------- */

const guarddogRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const barks: { x: number; y: number; t0: number }[] = []
  let nextBark = 0.6

  return loop((_dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // dog pops up from the bottom and bobs
    const rise = Math.min(t / 0.5, 1)
    const eased = 1 - Math.pow(1 - rise, 3)
    const dy = H + 120 - eased * (H * 0.55) + Math.sin(t * 5) * 8
    emoji(ctx, '🐕', W / 2, dy, 190)

    // bark bubbles fly out alternately left/right
    if (t >= nextBark && barks.length < 6) {
      nextBark = t + 0.45
      const side = barks.length % 2 === 0 ? -1 : 1
      barks.push({ x: W / 2 + side * rand(120, 180), y: dy - rand(90, 160), t0: t })
    }
    for (const b of barks) {
      const age = t - b.t0
      if (age > 1.4) continue
      const scale = Math.min(age / 0.15, 1)
      const alpha = age > 1 ? 1 - (age - 1) / 0.4 : 1
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(b.x, b.y - age * 30)
      ctx.scale(scale, scale)
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(0, 0, 62, 34, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#0f172a'
      ctx.font = '900 22px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('WOOF!', 0, 0)
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // paw prints stamping across the bottom
    const paws = Math.min(Math.floor(t / 0.3), 10)
    for (let i = 0; i < paws; i++) {
      emoji(ctx, '🐾', W * 0.08 + i * W * 0.09, H * 0.92 + (i % 2) * 14, 34, i % 2 ? 0.3 : -0.2)
    }
  })
}

/* ------------------------------------------------ robot ------------------ */

const robotRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height

  return loop((_dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // robot descends
    const drop = Math.min(t / 0.6, 1)
    const ry = -100 + (1 - Math.pow(1 - drop, 3)) * (H * 0.4 + 100)
    emoji(ctx, '🤖', W / 2, ry, 150)

    // laser scan sweeps down then back up
    const scanP = (Math.sin((t - 0.6) * 2.2) + 1) / 2
    if (t > 0.7) {
      const sy = H * 0.15 + scanP * H * 0.7
      const grad = ctx.createLinearGradient(0, sy - 22, 0, sy + 22)
      grad.addColorStop(0, 'rgba(239, 68, 68, 0)')
      grad.addColorStop(0.5, 'rgba(239, 68, 68, 0.55)')
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, sy - 22, W, 44)
      ctx.fillStyle = '#ef4444'
      ctx.fillRect(0, sy - 1.5, W, 3)
    }

    // big blinking X stamps
    if (t > 1.4 && Math.floor(t * 3) % 2 === 0) {
      for (const [x, y, s] of [[W * 0.2, H * 0.7, 90], [W * 0.8, H * 0.65, 110], [W * 0.5, H * 0.82, 80]] as const) {
        emoji(ctx, '❌', x, y, s)
      }
    }
  })
}

/* ------------------------------------------------ ghost ------------------ */

const ghostRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const wisps: Spark[] = []

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // drifting spooky wisps
    if (wisps.length < 40) {
      wisps.push({
        x: rand(0, W), y: H + 20, vx: rand(-20, 20), vy: rand(-120, -50),
        life: 0, maxLife: rand(1.5, 3), color: 'rgba(226, 232, 240, 0.5)', size: rand(6, 16),
      })
    }
    for (let i = wisps.length - 1; i >= 0; i--) {
      const s2 = wisps[i]
      s2.life += dt
      if (s2.life >= s2.maxLife) { wisps.splice(i, 1); continue }
      s2.x += s2.vx * dt + Math.sin(t * 2 + s2.size) * 30 * dt
      s2.y += s2.vy * dt
      ctx.globalAlpha = (1 - s2.life / s2.maxLife) * 0.5
      ctx.fillStyle = '#e2e8f0'
      ctx.beginPath()
      ctx.arc(s2.x, s2.y, s2.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // ghost floats in a figure-eight, wagging side to side
    const gx = W / 2 + Math.sin(t * 1.6) * W * 0.18
    const gy = H * 0.42 + Math.sin(t * 3.2) * 26
    emoji(ctx, '👻', gx, gy, 170, Math.sin(t * 4) * 0.18)

    // wagging finger (index finger emoji swinging like "no no no")
    emoji(ctx, '☝️', gx + 120, gy + 30, 70, Math.sin(t * 7) * 0.6)
  })
}

/* ------------------------------------------------ crabs ------------------ */

const crabsRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const crabs = Array.from({ length: 6 }, (_, i) => ({
    x: -100 - i * rand(90, 180),
    y: H * (0.72 + (i % 3) * 0.09),
    speed: rand(W * 0.25, W * 0.4),
    size: rand(64, 110),
    phase: rand(0, Math.PI * 2),
  }))
  const bubbles: { x: number; y: number; t0: number }[] = []
  let nextBubble = 0.5

  return loop((_dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // sandy floor
    ctx.fillStyle = 'rgba(250, 204, 21, 0.15)'
    ctx.fillRect(0, H * 0.68, W, H * 0.32)

    for (const c of crabs) {
      c.x += c.speed * _dt
      if (c.x > W + 120) c.x = -120
      // sideways scuttle wobble + snappy pinch (scale pulse)
      const pinch = 1 + Math.abs(Math.sin(t * 8 + c.phase)) * 0.12
      ctx.save()
      ctx.translate(c.x, c.y + Math.abs(Math.sin(t * 10 + c.phase)) * -10)
      ctx.scale(pinch, 1)
      ctx.font = `${c.size}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🦀', 0, 0)
      ctx.restore()

      if (t >= nextBubble && bubbles.length < 8) {
        nextBubble = t + 0.35
        bubbles.push({ x: c.x, y: c.y - c.size * 0.8, t0: t })
      }
    }

    for (const b of bubbles) {
      const age = t - b.t0
      if (age > 1.1) continue
      ctx.globalAlpha = age > 0.8 ? 1 - (age - 0.8) / 0.3 : 1
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = '#7f1d1d'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.ellipse(b.x, b.y - age * 26, 44, 24, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#7f1d1d'
      ctx.font = '900 16px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('NOPE!', b.x, b.y - age * 26)
      ctx.globalAlpha = 1
    }
  })
}

/* ------------------------------------------------ monkeys ---------------- */

const monkeysRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const bananas: Spark[] = []

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // bananas rain down, spinning
    if (t < 2.4 && bananas.length < 26 && Math.random() < 0.3) {
      bananas.push({
        x: rand(W * 0.05, W * 0.95), y: -50, vx: rand(-30, 30), vy: rand(200, 420),
        life: rand(0, Math.PI * 2), maxLife: 99, color: '', size: rand(38, 62),
      })
    }
    for (const b of bananas) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.life += dt * 4
      if (b.y < H + 60) emoji(ctx, '🍌', b.x, b.y, b.size, b.life)
    }

    // the three wise monkeys pop up one by one, bouncing
    const monkeys = ['🙈', '🙉', '🙊'] as const
    monkeys.forEach((m, i) => {
      const born = 0.25 + i * 0.3
      const p = Math.max(0, Math.min((t - born) / 0.35, 1))
      if (p <= 0) return
      const overshoot = 1 + Math.sin(Math.min(p, 1) * Math.PI) * 0.25
      const bob = Math.sin(t * 5 + i * 1.3) * 12
      emoji(ctx, m, W * (0.28 + i * 0.22), H * 0.55 + bob, 130 * p * overshoot, Math.sin(t * 3 + i) * 0.1)
    })
  })
}

/* ------------------------------------------------ wall ------------------- */

const wallRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const BRICK_H = Math.max(34, H / 12)
  const BRICK_W = BRICK_H * 2.2
  const rows = Math.ceil((H * 0.75) / BRICK_H)

  return loop((_dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // wall rises row by row from the bottom
    const rowsBuilt = Math.min(t / 0.22, rows)
    for (let r = 0; r < rowsBuilt; r++) {
      const rowP = Math.min(rowsBuilt - r, 1)
      const y = H - (r + rowP) * BRICK_H
      const offset = (r % 2) * BRICK_W * 0.5
      for (let x = -offset; x < W; x += BRICK_W) {
        ctx.fillStyle = r % 2 ? '#b45309' : '#c2632e'
        ctx.fillRect(x + 2, y + 2, BRICK_W - 4, BRICK_H - 4)
        ctx.strokeStyle = 'rgba(69, 26, 3, 0.5)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 2, y + 2, BRICK_W - 4, BRICK_H - 4)
      }
    }

    // construction sign drops in once the wall tops out
    if (rowsBuilt >= rows) {
      const dropP = Math.min((t - rows * 0.22) / 0.4, 1)
      const sy = -100 + (1 - Math.pow(1 - dropP, 3)) * (H * 0.3 + 100)
      emoji(ctx, '🚧', W / 2, sy, 140, dropP < 1 ? Math.sin(t * 10) * 0.1 : 0)
    }
  })
}

/* ------------------------------------------------ ninjas ----------------- */

const ninjasRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const poofs: Spark[] = []
  let poofed = false

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // two ninjas flip in from the sides and meet centre
    const p = Math.min(t / 0.55, 1)
    const eased = 1 - Math.pow(1 - p, 3)
    const lx = -120 + eased * (W / 2 - 90 + 120)
    const rx = W + 120 - eased * (W / 2 - 90 + 120)
    const hop = Math.sin(Math.min(p, 1) * Math.PI) * -H * 0.18
    const spin = p < 1 ? p * Math.PI * 2 : 0
    emoji(ctx, '🥷', lx, H * 0.62 + hop, 140, spin)
    emoji(ctx, '🥷', rx, H * 0.62 + hop, 140, -spin, true)

    // smoke poof + crossed swords on landing
    if (p >= 1 && !poofed) {
      poofed = true
      for (let i = 0; i < 40; i++) {
        const ang = rand(0, Math.PI * 2)
        poofs.push({
          x: W / 2, y: H * 0.6, vx: Math.cos(ang) * rand(60, 260), vy: Math.sin(ang) * rand(60, 260),
          life: 0, maxLife: rand(0.5, 1.1), color: 'rgba(148, 163, 184, 0.8)', size: rand(8, 22),
        })
      }
    }
    for (let i = poofs.length - 1; i >= 0; i--) {
      const s = poofs[i]
      s.life += dt
      if (s.life >= s.maxLife) { poofs.splice(i, 1); continue }
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
      const cs = 1 + Math.sin(Math.min((t - 0.55) / 0.3, 1) * Math.PI) * 0.25
      emoji(ctx, '⚔️', W / 2, H * 0.38, 120 * cs)
    }
  })
}

/* ------------------------------------------------ vault ------------------ */

const vaultRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  let clicked = false
  const links: { x: number; y: number }[] = []

  return loop((_dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // padlock drops in and lands with a squash
    const dropP = Math.min(t / 0.5, 1)
    const ly = -150 + (1 - Math.pow(1 - dropP, 3)) * (H * 0.45 + 150)
    const squash = dropP >= 1 && t < 0.75 ? 1 - Math.sin(((t - 0.5) / 0.25) * Math.PI) * 0.15 : 1
    if (dropP >= 1 && !clicked) clicked = true

    // chains swing across after the lock lands
    if (clicked) {
      const chainP = Math.min((t - 0.55) / 0.5, 1)
      const n = Math.floor(chainP * 14)
      while (links.length < n) {
        const i = links.length
        links.push({ x: (W / 14) * i + W / 28, y: 0 })
      }
      links.forEach((l, i) => {
        const sway = Math.sin(t * 3 + i * 0.6) * 8
        emoji(ctx, '⛓️', l.x, H * 0.28 + Math.sin(i * 1.1) * 14 + sway, 54, 0.25)
        emoji(ctx, '⛓️', W - l.x, H * 0.75 + Math.cos(i * 1.3) * 14 - sway, 54, -0.25)
      })
    }

    ctx.save()
    ctx.translate(W / 2, ly)
    ctx.scale(1 / squash, squash)
    ctx.font = '190px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🔒', 0, 0)
    ctx.restore()

    // "CLICK!" flash on landing
    if (clicked && t < 1.1) {
      ctx.globalAlpha = 1 - (t - 0.5) / 0.6
      ctx.fillStyle = '#fef9c3'
      ctx.font = '900 40px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('CLICK!', W / 2 + 140, ly - 80)
      ctx.globalAlpha = 1
    }
  })
}

/* ------------------------------------------------ registry --------------- */

export const PIN_FAIL_ANIMATIONS: PinFailAnimation[] = [
  {
    name: 'gandalf',
    emoji: '🧙',
    label: 'Wizard',
    backdrop: 'rgba(15, 10, 40, 0.9)',
    taunts: ['YOU SHALL NOT PASS!'],
    run: gandalfRun,
  },
  {
    name: 'alarm',
    emoji: '🚨',
    label: 'Intruder alert',
    backdrop: 'rgba(30, 8, 8, 0.88)',
    taunts: ['INTRUDER ALERT!', 'Beep beep beep! Wrong PIN!'],
    run: alarmRun,
  },
  {
    name: 'guarddog',
    emoji: '🐕',
    label: 'Guard dog',
    backdrop: 'rgba(30, 20, 8, 0.85)',
    taunts: ['The guard dog says no!', 'WOOF means WRONG!'],
    run: guarddogRun,
  },
  {
    name: 'robot',
    emoji: '🤖',
    label: 'Access denied',
    backdrop: 'rgba(8, 12, 34, 0.9)',
    taunts: ['ACCESS DENIED', 'Beep boop. Nice try.'],
    run: robotRun,
  },
  {
    name: 'ghost',
    emoji: '👻',
    label: 'Spooky no',
    backdrop: 'rgba(20, 15, 45, 0.88)',
    taunts: ['Boo! Not the magic number!', 'The ghost says nooooo!'],
    run: ghostRun,
  },
  {
    name: 'crabs',
    emoji: '🦀',
    label: 'Nope crabs',
    backdrop: 'rgba(35, 15, 10, 0.85)',
    taunts: ['Nope nope nope nope!', 'The crabs are not convinced.'],
    run: crabsRun,
  },
  {
    name: 'monkeys',
    emoji: '🙈',
    label: 'Monkey business',
    backdrop: 'rgba(25, 22, 8, 0.85)',
    taunts: ['Monkey business detected!', 'See no PIN, hear no PIN!'],
    run: monkeysRun,
  },
  {
    name: 'wall',
    emoji: '🧱',
    label: 'The wall',
    backdrop: 'rgba(24, 12, 6, 0.88)',
    taunts: ['The wall says no!', 'Road closed. Try again!'],
    run: wallRun,
  },
  {
    name: 'ninjas',
    emoji: '🥷',
    label: 'Ninja block',
    backdrop: 'rgba(10, 12, 22, 0.9)',
    taunts: ['Blocked by ninjas!', 'The ninjas guard this door!'],
    run: ninjasRun,
  },
  {
    name: 'vault',
    emoji: '🔒',
    label: 'Vault sealed',
    backdrop: 'rgba(18, 16, 10, 0.88)',
    taunts: ['Vault sealed tight!', 'This safe stays shut!'],
    run: vaultRun,
  },
]
