/** Five fullscreen canvas celebrations. Each returns a cleanup function. */

import confetti from 'canvas-confetti'

export type CelebrationName =
  | 'confetti'
  | 'fireworks'
  | 'rocket'
  | 'flowers'
  | 'sparkle'
  | 'unicorn'
  | 'superhero'
  | 'bubbles'
  | 'dino'
  | 'hyperspace'

export interface Celebration {
  name: CelebrationName
  /** emoji + short label for the Setup preview picker */
  emoji: string
  label: string
  /** backdrop css for the overlay while it plays */
  backdrop: string
  praise: string[]
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

/* ---------------------------------------------------------------- confetti */

const confettiRun = (canvas: HTMLCanvasElement) => {
  const shoot = confetti.create(canvas, { resize: true, useWorker: false })
  const defaults = { ticks: 220, gravity: 1.1, scalar: 1.6, startVelocity: 65 }
  shoot({ ...defaults, particleCount: 220, spread: 100, origin: { x: 0.5, y: 0.7 } })
  const t1 = setTimeout(
    () => shoot({ ...defaults, particleCount: 130, spread: 120, angle: 60, origin: { x: 0, y: 0.9 } }),
    280,
  )
  const t2 = setTimeout(
    () => shoot({ ...defaults, particleCount: 130, spread: 120, angle: 120, origin: { x: 1, y: 0.9 } }),
    520,
  )
  const t3 = setTimeout(
    () => shoot({ ...defaults, particleCount: 180, spread: 160, origin: { x: 0.5, y: 0.4 } }),
    900,
  )
  return () => {
    ;[t1, t2, t3].forEach(clearTimeout)
    shoot.reset()
  }
}

/* --------------------------------------------------------------- fireworks */

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

const fireworksRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const colors = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ff6e40', '#ffffff']
  const sparks: Spark[] = []
  const rockets: Spark[] = []
  let nextLaunch = 0

  const explode = (x: number, y: number) => {
    const color = pick(colors)
    const color2 = pick(colors)
    const n = 90
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + rand(-0.05, 0.05)
      const speed = rand(120, 420)
      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: rand(0.9, 1.7),
        color: i % 2 ? color : color2,
        size: rand(2, 4),
      })
    }
  }

  return loop((dt, t) => {
    ctx.fillStyle = 'rgba(10, 8, 30, 0.22)'
    ctx.fillRect(0, 0, W, H)

    if (t < 3.2 && t >= nextLaunch) {
      nextLaunch = t + rand(0.25, 0.55)
      rockets.push({
        x: rand(W * 0.15, W * 0.85),
        y: H,
        vx: rand(-40, 40),
        vy: rand(-H * 0.72, -H * 0.55),
        life: 0,
        maxLife: rand(0.7, 1),
        color: '#fff8dc',
        size: 3,
      })
    }

    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]
      r.life += dt
      r.x += r.vx * dt
      r.y += r.vy * dt
      r.vy += 160 * dt
      ctx.fillStyle = r.color
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2)
      ctx.fill()
      if (r.life >= r.maxLife) {
        explode(r.x, r.y)
        rockets.splice(i, 1)
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        sparks.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 220 * dt
      s.vx *= 1 - 0.9 * dt
      s.vy *= 1 - 0.4 * dt
      const alpha = 1 - s.life / s.maxLife
      ctx.globalAlpha = alpha
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * alpha + 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
}

/* ------------------------------------------------------------------ rocket */

const rocketRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const flames: Spark[] = []
  const stars = Array.from({ length: 60 }, () => ({
    x: rand(0, W),
    y: rand(0, H),
    s: rand(1, 3),
    tw: rand(0, Math.PI * 2),
  }))

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // starfield twinkle
    for (const st of stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + st.tw))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(st.x, st.y, st.s, st.s)
    }
    ctx.globalAlpha = 1

    // rocket path: hold + accelerate up with slight sway
    const progress = Math.min(t / 3.2, 1)
    const eased = progress * progress * (3 - 2 * progress)
    const shake = t < 0.8 ? rand(-3, 3) : 0
    const x = W / 2 + Math.sin(t * 2.2) * 30 * eased + shake
    const y = H * 0.82 - eased * (H * 1.1)

    // exhaust
    for (let i = 0; i < (t < 0.8 ? 4 : 10); i++) {
      flames.push({
        x: x + rand(-14, 14),
        y: y + 70,
        vx: rand(-50, 50),
        vy: rand(180, 420),
        life: 0,
        maxLife: rand(0.4, 1.0),
        color: pick(['#ffb300', '#ff6d00', '#ff3d00', '#ffd54f', '#bdbdbd']),
        size: rand(4, 11),
      })
    }
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i]
      f.life += dt
      if (f.life >= f.maxLife) {
        flames.splice(i, 1)
        continue
      }
      f.x += f.vx * dt
      f.y += f.vy * dt
      const a = 1 - f.life / f.maxLife
      ctx.globalAlpha = a * 0.9
      ctx.fillStyle = f.color
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * a + 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // the rocket itself (emoji points up-right; rotate to point up)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-Math.PI / 4)
    ctx.font = '110px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🚀', 0, 0)
    ctx.restore()
  })
}

/* ----------------------------------------------------------------- flowers */

interface Flower {
  x: number
  base: number
  height: number
  bloomAt: number
  emoji: string
  sway: number
  size: number
}

const flowersRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const emojis = ['🌸', '🌷', '🌻', '🌼', '🌺', '🌹']
  const flowers: Flower[] = Array.from({ length: 18 }, (_, i) => ({
    x: (W / 18) * i + rand(10, 60),
    base: H + 10,
    height: rand(H * 0.15, H * 0.45),
    bloomAt: rand(0, 1.6),
    emoji: pick(emojis),
    sway: rand(0, Math.PI * 2),
    size: rand(52, 96),
  }))
  const petals: Spark[] = []

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // drifting petals in the air
    if (petals.length < 50 && Math.random() < 0.35) {
      petals.push({
        x: rand(0, W),
        y: -20,
        vx: rand(-30, 30),
        vy: rand(40, 110),
        life: 0,
        maxLife: rand(4, 8),
        color: pick(['#f8bbd0', '#f48fb1', '#fce4ec', '#e1bee7']),
        size: rand(4, 9),
      })
    }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i]
      p.life += dt
      p.x += (p.vx + Math.sin(t * 2 + p.size) * 40) * dt
      p.y += p.vy * dt
      if (p.life > p.maxLife || p.y > H + 20) {
        petals.splice(i, 1)
        continue
      }
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, t + p.size, 0, Math.PI * 2)
      ctx.fill()
    }

    for (const f of flowers) {
      const grow = Math.max(0, Math.min((t - f.bloomAt) / 1.1, 1))
      if (grow <= 0) continue
      const stemH = f.height * grow
      const swayX = Math.sin(t * 1.5 + f.sway) * 6 * grow
      // stem
      ctx.strokeStyle = '#2e7d32'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(f.x, f.base)
      ctx.quadraticCurveTo(f.x, f.base - stemH * 0.6, f.x + swayX, f.base - stemH)
      ctx.stroke()
      // leaf
      if (grow > 0.4) {
        ctx.fillStyle = '#43a047'
        ctx.beginPath()
        ctx.ellipse(f.x + 12, f.base - stemH * 0.5, 14, 6, -0.6, 0, Math.PI * 2)
        ctx.fill()
      }
      // bloom pops with a bounce at the end of growth
      const bloomP = Math.max(0, (grow - 0.55) / 0.45)
      if (bloomP > 0) {
        const bounce = bloomP < 1 ? 1 + Math.sin(bloomP * Math.PI) * 0.25 : 1
        ctx.font = `${f.size * bloomP * bounce}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(f.emoji, f.x + swayX, f.base - stemH - (f.size * bloomP) / 3)
      }
    }
  })
}

/* --------------------------------------------- pixie-dust princess sparkle */

interface Floaty {
  x: number
  y: number
  vy: number
  emoji: string
  size: number
  wobble: number
  spin: number
}

const sparkleRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const glitter: Spark[] = []
  const floaties: Floaty[] = []
  const glitterColors = ['#ff80ab', '#ea80fc', '#b388ff', '#ffd700', '#ffffff', '#f8bbd0']
  const floatEmojis = ['💖', '💕', '🦋', '👑', '✨', '🌟', '🎀', '🧚']

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // soft radial shimmer wash
    const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W / 2)
    const pulse = 0.10 + 0.05 * Math.sin(t * 3)
    g.addColorStop(0, `rgba(255, 182, 222, ${pulse})`)
    g.addColorStop(1, 'rgba(179, 136, 255, 0.03)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // rising hearts / butterflies / crowns
    if (t < 3 && floaties.length < 26 && Math.random() < 0.32) {
      floaties.push({
        x: rand(W * 0.05, W * 0.95),
        y: H + 60,
        vy: rand(-260, -140),
        emoji: pick(floatEmojis),
        size: rand(38, 92),
        wobble: rand(0, Math.PI * 2),
        spin: rand(-0.6, 0.6),
      })
    }
    for (let i = floaties.length - 1; i >= 0; i--) {
      const f = floaties[i]
      f.y += f.vy * dt
      f.x += Math.sin(t * 2.5 + f.wobble) * 60 * dt
      if (f.y < -80) {
        floaties.splice(i, 1)
        continue
      }
      // glitter trail behind each floaty
      if (Math.random() < 0.5)
        glitter.push({
          x: f.x + rand(-12, 12),
          y: f.y + rand(0, 20),
          vx: rand(-25, 25),
          vy: rand(10, 60),
          life: 0,
          maxLife: rand(0.5, 1.3),
          color: pick(glitterColors),
          size: rand(1.5, 4),
        })
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(Math.sin(t * 2 + f.wobble) * 0.25 * f.spin)
      ctx.font = `${f.size}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(f.emoji, 0, 0)
      ctx.restore()
    }

    // ambient pixie dust drifting down
    if (glitter.length < 260) {
      for (let i = 0; i < 4; i++)
        glitter.push({
          x: rand(0, W),
          y: rand(-10, H),
          vx: rand(-15, 15),
          vy: rand(20, 70),
          life: 0,
          maxLife: rand(0.6, 1.6),
          color: pick(glitterColors),
          size: rand(1, 3.5),
        })
    }
    for (let i = glitter.length - 1; i >= 0; i--) {
      const s = glitter[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        glitter.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      const a = 1 - s.life / s.maxLife
      ctx.globalAlpha = a
      ctx.fillStyle = s.color
      // 4-point twinkle
      ctx.beginPath()
      const r = s.size * (0.7 + 0.5 * Math.sin(t * 8 + s.x))
      ctx.moveTo(s.x, s.y - r * 2)
      ctx.quadraticCurveTo(s.x, s.y, s.x + r * 2, s.y)
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 2)
      ctx.quadraticCurveTo(s.x, s.y, s.x - r * 2, s.y)
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
}

/* ------------------------------------------------------- unicorn rainbow */

const RAINBOW = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa']

const unicornRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const stars: Spark[] = []
  const trail: { x: number; y: number; t: number }[] = []

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // unicorn gallops in a gentle arc across the screen (loops around)
    const lap = 3.4
    const p = (t % lap) / lap
    const x = -160 + p * (W + 320)
    const y = H * 0.45 + Math.sin(p * Math.PI) * -H * 0.12 + Math.sin(t * 9) * 12
    trail.push({ x, y: y + 26, t })
    while (trail.length > 90) trail.shift()

    // rainbow ribbon trail
    for (let band = 0; band < RAINBOW.length; band++) {
      ctx.beginPath()
      let started = false
      for (const pt of trail) {
        const age = t - pt.t
        if (age > 1.6) continue
        const yy = pt.y + band * 10 - 25 + Math.sin(pt.x / 60) * 4
        if (!started) {
          ctx.moveTo(pt.x, yy)
          started = true
        } else ctx.lineTo(pt.x, yy)
      }
      ctx.strokeStyle = RAINBOW[band]
      ctx.globalAlpha = 0.8
      ctx.lineWidth = 9
      ctx.lineCap = 'round'
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // star sparkles falling off the trail
    if (stars.length < 90) {
      stars.push({
        x: x + rand(-70, -20), y: y + rand(-20, 30),
        vx: rand(-40, 40), vy: rand(20, 120),
        life: 0, maxLife: rand(0.6, 1.4),
        color: pick(['#fff', '#fde68a', '#f9a8d4', '#c4b5fd']), size: rand(2, 5),
      })
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i]
      s.life += dt
      if (s.life >= s.maxLife) { stars.splice(i, 1); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      const a = 1 - s.life / s.maxLife
      ctx.globalAlpha = a
      ctx.fillStyle = s.color
      const r = s.size * (0.8 + 0.5 * Math.sin(t * 9 + s.x))
      ctx.beginPath()
      ctx.moveTo(s.x, s.y - r * 2)
      ctx.quadraticCurveTo(s.x, s.y, s.x + r * 2, s.y)
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 2)
      ctx.quadraticCurveTo(s.x, s.y, s.x - r * 2, s.y)
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // the unicorn (flip so it faces its direction of travel)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(-1, 1)
    ctx.rotate(Math.sin(t * 9) * 0.06)
    ctx.font = '130px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🦄', 0, 0)
    ctx.restore()
  })
}

/* ------------------------------------------------------- superhero flight */

const superheroRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const whoosh: Spark[] = []
  const bursts: { x: number; y: number; t0: number; word: string; color: string }[] = []
  const clouds = Array.from({ length: 5 }, () => ({
    x: rand(0, W), y: rand(H * 0.1, H * 0.7), s: rand(50, 90),
  }))
  let nextBurst = 0.7

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // drifting clouds
    for (const c of clouds) {
      c.x -= 60 * dt
      if (c.x < -120) c.x = W + 120
      ctx.globalAlpha = 0.5
      ctx.font = `${c.s}px serif`
      ctx.textAlign = 'center'
      ctx.fillText('☁️', c.x, c.y)
      ctx.globalAlpha = 1
    }

    // hero swoops in a sine path, twice across
    const lap = 2.1
    const dir = Math.floor(t / lap) % 2 === 0 ? 1 : -1
    const p = (t % lap) / lap
    const x = dir === 1 ? -140 + p * (W + 280) : W + 140 - p * (W + 280)
    const y = H * 0.4 + Math.sin(p * Math.PI * 2) * H * 0.18

    // speed lines behind the hero
    for (let i = 0; i < 4; i++) {
      whoosh.push({
        x: x - dir * rand(50, 90), y: y + rand(-34, 34),
        vx: -dir * rand(500, 800), vy: rand(-20, 20),
        life: 0, maxLife: rand(0.25, 0.5),
        color: pick(['#facc15', '#f87171', '#60a5fa', '#ffffff']), size: rand(2, 4),
      })
    }
    for (let i = whoosh.length - 1; i >= 0; i--) {
      const s = whoosh[i]
      s.life += dt
      if (s.life >= s.maxLife) { whoosh.splice(i, 1); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      const a = 1 - s.life / s.maxLife
      ctx.globalAlpha = a * 0.85
      ctx.strokeStyle = s.color
      ctx.lineWidth = s.size
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(s.x - s.vx * 0.05, s.y)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // comic-book bursts along the way
    if (t >= nextBurst && bursts.length < 5) {
      nextBurst = t + rand(0.5, 0.9)
      bursts.push({
        x: x + rand(-40, 40), y: y + rand(-80, 80), t0: t,
        word: pick(['POW!', 'ZOOM!', 'WOW!', 'BAM!']),
        color: pick(['#facc15', '#f97316', '#38bdf8', '#f472b6']),
      })
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]
      const age = t - b.t0
      if (age > 1.1) { bursts.splice(i, 1); continue }
      const scale = age < 0.2 ? age / 0.2 : 1
      const alpha = age > 0.8 ? 1 - (age - 0.8) / 0.3 : 1
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.scale(scale, scale)
      ctx.rotate(-0.1)
      ctx.globalAlpha = alpha
      // starburst
      ctx.fillStyle = b.color
      ctx.beginPath()
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2
        const r = k % 2 === 0 ? 66 : 38
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r)
      }
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#1e1b4b'
      ctx.font = '900 26px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(b.word, 0, 0)
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // the hero
    ctx.save()
    ctx.translate(x, y)
    if (dir === -1) ctx.scale(-1, 1)
    ctx.rotate(0.5)
    ctx.font = '120px serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🦸', 0, 0)
    ctx.restore()
  })
}

/* ----------------------------------------------------------- bubble pop */

interface Bubble {
  x: number
  y: number
  r: number
  vy: number
  wobble: number
  hue: number
  popT: number // 0 = alive; otherwise time it popped
  emoji: string
}

const bubblesRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const bubbles: Bubble[] = []
  const drops: Spark[] = []

  const pop = (b: Bubble, t: number) => {
    b.popT = t
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2
      drops.push({
        x: b.x + Math.cos(ang) * b.r * 0.7, y: b.y + Math.sin(ang) * b.r * 0.7,
        vx: Math.cos(ang) * rand(120, 260), vy: Math.sin(ang) * rand(120, 260),
        life: 0, maxLife: rand(0.3, 0.6),
        color: `hsla(${b.hue}, 90%, 75%, 1)`, size: rand(2, 4),
      })
    }
  }

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    if (t < 3 && bubbles.length < 26 && Math.random() < 0.35) {
      bubbles.push({
        x: rand(W * 0.05, W * 0.95), y: H + 60,
        r: rand(30, 95), vy: rand(-220, -110),
        wobble: rand(0, Math.PI * 2), hue: rand(160, 330),
        popT: 0, emoji: Math.random() < 0.3 ? pick(['🐠', '⭐', '🌈', '🐟', '🦀', '🐙']) : '',
      })
    }

    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]
      if (b.popT > 0) {
        if (t - b.popT > 0.1) bubbles.splice(i, 1)
        continue
      }
      b.y += b.vy * dt
      b.x += Math.sin(t * 2 + b.wobble) * 50 * dt
      // pop near the top, or randomly
      if (b.y < H * 0.12 || (b.y < H * 0.7 && Math.random() < 0.004)) pop(b, t)
      if (b.y < -100) { bubbles.splice(i, 1); continue }

      // iridescent soap film
      const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r)
      g.addColorStop(0, 'rgba(255,255,255,0.75)')
      g.addColorStop(0.55, `hsla(${b.hue}, 90%, 78%, 0.28)`)
      g.addColorStop(0.9, `hsla(${(b.hue + 80) % 360}, 90%, 70%, 0.4)`)
      g.addColorStop(1, 'rgba(255,255,255,0.65)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fill()
      // shine
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.ellipse(b.x - b.r * 0.4, b.y - b.r * 0.45, b.r * 0.16, b.r * 0.09, -0.7, 0, Math.PI * 2)
      ctx.fill()
      // little surprise riding inside some bubbles
      if (b.emoji) {
        ctx.font = `${b.r * 0.9}px serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.emoji, b.x, b.y + b.r * 0.05)
      }
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]
      d.life += dt
      if (d.life >= d.maxLife) { drops.splice(i, 1); continue }
      d.x += d.vx * dt
      d.y += d.vy * dt
      d.vy += 400 * dt
      ctx.globalAlpha = 1 - d.life / d.maxLife
      ctx.fillStyle = d.color
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
}

/* ----------------------------------------------------------- dino stampede */

const dinoRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const ground = H * 0.8
  const dust: Spark[] = []
  const roars: { x: number; y: number; t0: number }[] = []
  // the big T-rex leads, smaller pals follow
  const herd = [
    { emoji: '🦖', size: 170, x: W + 120, speed: W * 0.3, stomp: 5.5, phase: 0 },
    { emoji: '🦕', size: 130, x: W + 420, speed: W * 0.28, stomp: 5, phase: 1.4 },
    { emoji: '🦖', size: 100, x: W + 680, speed: W * 0.32, stomp: 6.5, phase: 2.6 },
    { emoji: '🦕', size: 80, x: W + 900, speed: W * 0.3, stomp: 7, phase: 0.7 },
  ]
  const volcanoX = W * 0.82
  let nextRoar = 0.5

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // stomp shake: the whole prehistoric world trembles
    const bigDino = herd[0]
    const stompBeat = Math.abs(Math.sin(t * bigDino.stomp))
    const shake = bigDino.x > -200 && bigDino.x < W + 200 ? (1 - stompBeat) * 5 : 0
    ctx.save()
    ctx.translate(rand(-shake, shake), rand(-shake, shake))

    // volcano puffing in the distance
    ctx.font = '150px serif'
    ctx.textAlign = 'center'
    ctx.fillText('🌋', volcanoX, ground - 30)
    if (Math.random() < 0.25) {
      dust.push({
        x: volcanoX + rand(-16, 16), y: ground - 165,
        vx: rand(-25, 25), vy: rand(-90, -40),
        life: 0, maxLife: rand(1, 2.2),
        color: pick(['#ff7043', '#ffab40', '#9e9e9e', '#757575']), size: rand(6, 14),
      })
    }

    // jungle floor
    ctx.fillStyle = 'rgba(76, 175, 80, 0.35)'
    ctx.fillRect(0, ground + 20, W, H - ground)
    ctx.font = '44px serif'
    for (let i = 0; i < 7; i++) ctx.fillText('🌿', ((i + 0.5) * W) / 7, ground + 46)

    // the stampede (right to left, hopping on the stomp beat)
    for (const d of herd) {
      d.x -= d.speed * dt
      if (d.x < -220) d.x = W + rand(120, 320)
      const hop = Math.abs(Math.sin(t * d.stomp + d.phase)) * d.size * 0.16
      const y = ground - d.size * 0.32 - hop
      // dust kicks up on each landing
      if (hop < d.size * 0.02 && Math.random() < 0.7) {
        for (let i = 0; i < 3; i++)
          dust.push({
            x: d.x + rand(-d.size * 0.4, d.size * 0.4), y: ground + 8,
            vx: rand(-90, 90), vy: rand(-120, -30),
            life: 0, maxLife: rand(0.4, 0.9),
            color: pick(['#d7ccc8', '#bcaaa4', '#efebe9']), size: rand(4, 10),
          })
      }
      ctx.save()
      ctx.translate(d.x, y)
      ctx.rotate(Math.sin(t * d.stomp + d.phase) * 0.07)
      ctx.font = `${d.size}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(d.emoji, 0, 0)
      ctx.restore()
    }

    // comic "RAWR!" bursts
    if (t >= nextRoar && t < 3.2) {
      nextRoar = t + rand(0.8, 1.2)
      roars.push({ x: bigDino.x + rand(-30, 60), y: ground - bigDino.size * 0.8, t0: t })
    }
    for (let i = roars.length - 1; i >= 0; i--) {
      const r = roars[i]
      const age = t - r.t0
      if (age > 1.1) { roars.splice(i, 1); continue }
      const scale = age < 0.2 ? age / 0.2 : 1
      const alpha = age > 0.8 ? 1 - (age - 0.8) / 0.3 : 1
      ctx.save()
      ctx.translate(r.x, r.y)
      ctx.scale(scale, scale)
      ctx.rotate(0.12)
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#84cc16'
      ctx.beginPath()
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2
        const rr = k % 2 === 0 ? 70 : 42
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr)
      }
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#14532d'
      ctx.font = '900 28px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('RAWR!', 0, 0)
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // dust + smoke particles
    for (let i = dust.length - 1; i >= 0; i--) {
      const s = dust[i]
      s.life += dt
      if (s.life >= s.maxLife) { dust.splice(i, 1); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy -= 20 * dt // dust drifts upward
      const a = 1 - s.life / s.maxLife
      ctx.globalAlpha = a * 0.7
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * (1 + s.life), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    ctx.restore()
  })
}

/* -------------------------------------------------------- hyperspace jump */

interface WarpStar {
  angle: number
  dist: number
  speed: number
  hue: number
}

const hyperspaceRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const cy = H / 2
  const maxR = Math.hypot(cx, cy)
  const stars: WarpStar[] = Array.from({ length: 240 }, () => ({
    angle: rand(0, Math.PI * 2),
    dist: rand(10, maxR),
    speed: rand(20, 60),
    hue: rand(180, 260),
  }))

  // 0–1.2s: engines charge (ship rumbles, stars drift)
  // 1.2–2.6s: WARP — stars streak into lines, ship blasts forward
  // 2.6s+: white flash, ship gone, stars settle
  return loop((dt, t) => {
    ctx.fillStyle = 'rgba(4, 6, 26, 0.45)'
    ctx.fillRect(0, 0, W, H)

    const charging = t < 1.2
    const warping = t >= 1.2 && t < 2.6
    const warpP = warping ? Math.min((t - 1.2) / 0.7, 1) : 0

    // starfield: radial warp streaks
    for (const s of stars) {
      const boost = charging ? 1 : warping ? 1 + warpP * 55 : 6
      const prev = s.dist
      s.dist += s.speed * boost * dt
      if (s.dist > maxR) {
        s.dist = rand(5, 40)
        s.angle = rand(0, Math.PI * 2)
      }
      const x1 = cx + Math.cos(s.angle) * prev
      const y1 = cy + Math.sin(s.angle) * prev
      const x2 = cx + Math.cos(s.angle) * s.dist
      const y2 = cy + Math.sin(s.angle) * s.dist
      const brightness = 0.35 + 0.65 * (s.dist / maxR)
      ctx.strokeStyle = warping
        ? `hsla(${s.hue}, 90%, ${60 + warpP * 30}%, ${brightness})`
        : `rgba(255, 255, 255, ${brightness})`
      ctx.lineWidth = warping ? 1.5 + warpP * 2.5 : 1.6
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    // the ship
    if (t < 2.75) {
      let shipX = cx
      let shipY = cy + H * 0.08
      let shipScale = 1
      if (charging) {
        // rumbling on the launch pad of space
        const rumble = t / 1.2
        shipX += rand(-4, 4) * rumble
        shipY += rand(-4, 4) * rumble
        shipScale = 1 + Math.sin(t * 10) * 0.03 * rumble
      } else {
        // stretch forward and shrink into the distance
        const p = (t - 1.2) / 1.55
        shipY -= p * p * H * 0.1
        shipScale = 1 - p * 0.75
      }
      // engine glow builds while charging
      const glowR = charging ? 30 + (t / 1.2) * 70 : 100
      const glow = ctx.createRadialGradient(shipX, shipY, 5, shipX, shipY, glowR)
      glow.addColorStop(0, `rgba(96, 165, 250, ${charging ? 0.5 * (t / 1.2) : 0.6})`)
      glow.addColorStop(1, 'rgba(96, 165, 250, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(shipX - glowR, shipY - glowR, glowR * 2, glowR * 2)

      ctx.save()
      ctx.translate(shipX, shipY)
      ctx.scale(shipScale, shipScale)
      ctx.font = '130px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🛸', 0, 0)
      ctx.restore()
    }

    // the jump flash
    if (t >= 2.55 && t < 3.0) {
      const f = 1 - Math.abs((t - 2.75) / 0.22)
      if (f > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${f * 0.85})`
        ctx.fillRect(0, 0, W, H)
      }
    }
  })
}

/* ---------------------------------------------------------------- registry */

export const CELEBRATIONS: Celebration[] = [
  {
    name: 'confetti',
    emoji: '🎊',
    label: 'Confetti',
    backdrop: 'rgba(15, 23, 42, 0.35)',
    praise: ['Nailed it!', 'Boom! Done!', 'You did it!'],
    run: confettiRun,
  },
  {
    name: 'fireworks',
    emoji: '🎆',
    label: 'Fireworks',
    backdrop: 'rgba(6, 4, 26, 0.88)',
    praise: ['Spectacular!', 'What a star!', 'Incredible!'],
    run: fireworksRun,
  },
  {
    name: 'rocket',
    emoji: '🚀',
    label: 'Rocket',
    backdrop: 'rgba(9, 12, 40, 0.9)',
    praise: ['To the moon!', 'Blast off!', 'Out of this world!'],
    run: rocketRun,
  },
  {
    name: 'flowers',
    emoji: '🌸',
    label: 'Flowers',
    backdrop: 'rgba(236, 253, 245, 0.82)',
    praise: ['Bloomin’ brilliant!', 'Fresh as a daisy!', 'You made it grow!'],
    run: flowersRun,
  },
  {
    name: 'sparkle',
    emoji: '🧚',
    label: 'Sparkle',
    backdrop: 'rgba(74, 20, 89, 0.55)',
    praise: ['Simply magical!', 'Sparkle on, royalty!', 'Absolutely enchanting!'],
    run: sparkleRun,
  },
  {
    name: 'unicorn',
    emoji: '🦄',
    label: 'Unicorn',
    backdrop: 'rgba(49, 16, 84, 0.6)',
    praise: ['Un-BE-lievable!', 'Rainbow power!', 'Magically done!'],
    run: unicornRun,
  },
  {
    name: 'superhero',
    emoji: '🦸',
    label: 'Superhero',
    backdrop: 'rgba(12, 30, 70, 0.75)',
    praise: ['Super job!', 'Hero of the day!', 'Up, up and DONE!'],
    run: superheroRun,
  },
  {
    name: 'bubbles',
    emoji: '🫧',
    label: 'Bubbles',
    backdrop: 'rgba(8, 47, 73, 0.55)',
    praise: ['Pop-tastic!', 'Bubbling with pride!', 'You crushed it!'],
    run: bubblesRun,
  },
  {
    name: 'dino',
    emoji: '🦕',
    label: 'Dino stomp',
    backdrop: 'rgba(20, 40, 16, 0.8)',
    praise: ['ROAR-some job!', 'Dino-mite!', 'Stomp, stomp, HOORAY!'],
    run: dinoRun,
  },
  {
    name: 'hyperspace',
    emoji: '🌌',
    label: 'Hyperspace',
    backdrop: 'rgba(2, 4, 20, 0.94)',
    praise: ['Warp speed ahead!', 'Light-speed legend!', 'To infinity… and DONE!'],
    run: hyperspaceRun,
  },
]
