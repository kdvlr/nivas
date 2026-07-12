/** Reward redemption animations. Each returns a cleanup function. */

export type RewardAnimationName =
  | 'fairy'
  | 'treasure'
  | 'candy'
  | 'puppies'
  | 'racecar'
  | 'dinoegg'
  | 'ufo'
  | 'dragon'
  | 'robot'
  | 'pirate'

export interface RewardAnimation {
  name: RewardAnimationName
  /** emoji + short label for the Setup preview picker */
  emoji: string
  label: string
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

/* ================================================ jewelry box fairy ======= */

interface FairySpark {
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; color: string; size: number
}

const fairyRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const cy = H / 2

  // Jewelry box dimensions
  const boxW = Math.min(W * 0.32, 340)
  const boxH = boxW * 0.5
  const boxX = cx - boxW / 2
  const boxY = cy + H * 0.06

  const sparkles: FairySpark[] = []
  const magicTrail: FairySpark[] = []
  const wandSparkColors = ['#ffd700', '#ff69b4', '#e0b0ff', '#ffffff', '#87ceeb', '#ffc0cb']
  const gemColors = ['#e040fb', '#40c4ff', '#ff5252', '#ffd740', '#69f0ae', '#7c4dff']

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // === Background shimmer ===
    const bgG = ctx.createRadialGradient(cx, cy, 60, cx, cy, W * 0.7)
    const pulse = 0.06 + 0.03 * Math.sin(t * 2)
    bgG.addColorStop(0, `rgba(147, 51, 234, ${pulse})`)
    bgG.addColorStop(0.5, `rgba(59, 130, 246, ${pulse * 0.5})`)
    bgG.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = bgG
    ctx.fillRect(0, 0, W, H)

    // === Phase timeline ===
    const lidPhase = Math.min(t / 1.0, 1)            // 0–1s: lid opens
    const fairyPhase = Math.max(0, (t - 0.6) / 1.0)  // 0.6–1.6s: fairy rises
    const wandPhase = Math.max(0, (t - 1.8) / 0.6)   // 1.8–2.4s: wand wave
    const glowPhase = Math.max(0, (t - 2.2) / 1.0)   // 2.2–3.2s: "Wish Granted"

    // === JEWELRY BOX ===
    const lidAngle = lidPhase * lidPhase * 0.85 // eased lid open (radians)

    // Box body (bottom half) — rich velvet purple with gold trim
    ctx.save()
    // Shadow under box
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(cx, boxY + boxH + 8, boxW * 0.52, 14, 0, 0, Math.PI * 2)
    ctx.fill()

    // Box body
    const bodyGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH)
    bodyGrad.addColorStop(0, '#7b2d8e')
    bodyGrad.addColorStop(0.5, '#5b1a6e')
    bodyGrad.addColorStop(1, '#3d0e4e')
    ctx.fillStyle = bodyGrad
    roundRect(ctx, boxX, boxY, boxW, boxH, 10)
    ctx.fill()

    // Gold trim lines on box
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 2.5
    roundRect(ctx, boxX + 6, boxY + 6, boxW - 12, boxH - 12, 6)
    ctx.stroke()

    // Center gem on box
    ctx.fillStyle = pick(gemColors)
    ctx.beginPath()
    ctx.arc(cx, boxY + boxH * 0.5, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 2
    ctx.stroke()

    // Inner glow from open box
    if (lidPhase > 0.3) {
      const glowA = Math.min((lidPhase - 0.3) / 0.7, 1) * 0.5
      const innerGlow = ctx.createRadialGradient(cx, boxY, 20, cx, boxY - 60, boxW * 0.6)
      innerGlow.addColorStop(0, `rgba(255, 215, 0, ${glowA})`)
      innerGlow.addColorStop(0.5, `rgba(255, 182, 255, ${glowA * 0.4})`)
      innerGlow.addColorStop(1, 'rgba(255, 215, 0, 0)')
      ctx.fillStyle = innerGlow
      ctx.fillRect(boxX - 40, boxY - 120, boxW + 80, 130)
    }

    // Box lid — pivots from the back edge
    ctx.save()
    ctx.translate(boxX, boxY)
    ctx.rotate(-lidAngle)
    const lidGrad = ctx.createLinearGradient(0, -boxH * 0.35, 0, 0)
    lidGrad.addColorStop(0, '#9b3ab8')
    lidGrad.addColorStop(1, '#6d2085')
    ctx.fillStyle = lidGrad
    roundRect(ctx, 0, -boxH * 0.35, boxW, boxH * 0.35, 10)
    ctx.fill()
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 2.5
    roundRect(ctx, 6, -boxH * 0.35 + 6, boxW - 12, boxH * 0.35 - 12, 6)
    ctx.stroke()
    ctx.restore()

    ctx.restore()

    // === FAIRY ===
    if (fairyPhase > 0) {
      const fp = Math.min(fairyPhase, 1)
      const eased = 1 - Math.pow(1 - fp, 3) // ease-out cubic
      const fairyY = boxY - 30 - eased * (H * 0.28)
      const fairyX = cx + Math.sin(t * 1.8) * 25
      const fairyScale = 0.5 + eased * 0.5

      // Glow around fairy
      ctx.save()
      const fairyGlow = ctx.createRadialGradient(fairyX, fairyY, 10, fairyX, fairyY, 80)
      fairyGlow.addColorStop(0, `rgba(255, 215, 0, ${0.3 * fp})`)
      fairyGlow.addColorStop(1, 'rgba(255, 215, 0, 0)')
      ctx.fillStyle = fairyGlow
      ctx.fillRect(fairyX - 100, fairyY - 100, 200, 200)
      ctx.restore()

      // Fairy emoji
      ctx.save()
      ctx.translate(fairyX, fairyY)
      ctx.fillStyle = '#ffffff'; ctx.font = `${100 * fairyScale}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🧚', 0, 0)
      ctx.restore()

      // Sparkle trail from fairy
      if (Math.random() < 0.6) {
        sparkles.push({
          x: fairyX + rand(-30, 30), y: fairyY + rand(-15, 30),
          vx: rand(-60, 60), vy: rand(-40, 80),
          life: 0, maxLife: rand(0.5, 1.2),
          color: pick(wandSparkColors), size: rand(2, 5),
        })
      }

      // === WAND WAVE ===
      if (wandPhase > 0) {
        const wp = Math.min(wandPhase, 1)
        // Wand position — sweeps in an arc from fairy's right hand
        const wandAngle = -0.8 + wp * Math.PI * 1.2
        const wandLen = 70
        const wandTipX = fairyX + 45 + Math.cos(wandAngle) * wandLen
        const wandTipY = fairyY - 10 + Math.sin(wandAngle) * wandLen

        // Wand stick
        ctx.save()
        ctx.strokeStyle = '#ffd700'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(fairyX + 45, fairyY - 10)
        ctx.lineTo(wandTipX, wandTipY)
        ctx.stroke()

        // Wand star tip
        ctx.fillStyle = '#ffffff'; ctx.font = '28px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('⭐', wandTipX, wandTipY)
        ctx.restore()

        // Magic trail from wand tip
        for (let i = 0; i < 3; i++) {
          magicTrail.push({
            x: wandTipX + rand(-8, 8), y: wandTipY + rand(-8, 8),
            vx: rand(-100, 100), vy: rand(-120, 20),
            life: 0, maxLife: rand(0.4, 1.0),
            color: pick(wandSparkColors), size: rand(2, 6),
          })
        }
      }
    }

    // === "WISH GRANTED" text ===
    if (glowPhase > 0) {
      const gp = Math.min(glowPhase, 1)
      const scale = 0.3 + gp * 0.7
      const bounce = gp < 1 ? 1 + Math.sin(gp * Math.PI) * 0.15 : 1
      ctx.save()
      ctx.globalAlpha = gp
      ctx.translate(cx, H * 0.18)
      ctx.scale(scale * bounce, scale * bounce)
      ctx.font = 'bold 56px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      // Text glow
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 30
      ctx.fillStyle = '#ffd700'
      ctx.fillText('✨ Wish Granted! ✨', 0, 0)
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      ctx.restore()
    }

    // === Render sparkles ===
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i]
      s.life += dt
      if (s.life >= s.maxLife) { sparkles.splice(i, 1); continue }
      s.x += s.vx * dt; s.y += s.vy * dt
      s.vy += 60 * dt
      const a = 1 - s.life / s.maxLife
      ctx.globalAlpha = a
      ctx.fillStyle = s.color
      // 4-point twinkle
      const r = s.size * (0.7 + 0.4 * Math.sin(t * 10 + s.x))
      ctx.beginPath()
      ctx.moveTo(s.x, s.y - r * 2)
      ctx.quadraticCurveTo(s.x, s.y, s.x + r * 2, s.y)
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 2)
      ctx.quadraticCurveTo(s.x, s.y, s.x - r * 2, s.y)
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // === Render magic trail ===
    for (let i = magicTrail.length - 1; i >= 0; i--) {
      const s = magicTrail[i]
      s.life += dt
      if (s.life >= s.maxLife) { magicTrail.splice(i, 1); continue }
      s.x += s.vx * dt; s.y += s.vy * dt
      const a = 1 - s.life / s.maxLife
      ctx.globalAlpha = a * 0.9
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * a + 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

/* ============================================ treasure chest ============= */

const treasureRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const chestY = H * 0.62
  const coins: FairySpark[] = []
  const gems: { x: number; y: number; vx: number; vy: number; rot: number; vr: number; emoji: string; size: number }[] = []
  const rays: number[] = Array.from({ length: 9 }, (_, i) => i)

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    const lidPhase = Math.min(Math.max(t - 0.3, 0) / 0.7, 1) // 0.3–1s lid opens
    const burstPhase = Math.max(0, t - 0.9)

    // light rays fanning out of the chest once open
    if (lidPhase > 0.5) {
      const a = Math.min((lidPhase - 0.5) / 0.5, 1) * 0.35
      ctx.save()
      ctx.translate(cx, chestY - 20)
      for (const i of rays) {
        const ang = -Math.PI / 2 + (i - 4) * 0.22 + Math.sin(t * 1.5) * 0.03
        const grad = ctx.createLinearGradient(0, 0, Math.cos(ang) * H * 0.7, Math.sin(ang) * H * 0.7)
        grad.addColorStop(0, `rgba(255, 215, 0, ${a})`)
        grad.addColorStop(1, 'rgba(255, 215, 0, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(ang - 0.05) * H * 0.75, Math.sin(ang - 0.05) * H * 0.75)
        ctx.lineTo(Math.cos(ang + 0.05) * H * 0.75, Math.sin(ang + 0.05) * H * 0.75)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // fountain of coins
    if (burstPhase > 0 && burstPhase < 2.4 && coins.length < 220) {
      for (let i = 0; i < 6; i++) {
        coins.push({
          x: cx + rand(-40, 40), y: chestY - 30,
          vx: rand(-360, 360), vy: rand(-780, -420),
          life: 0, maxLife: rand(1.6, 2.6),
          color: pick(['#ffd700', '#ffca28', '#ffe082']), size: rand(7, 13),
        })
      }
    }
    // a few big gems fly out early
    if (burstPhase > 0 && burstPhase < 0.4 && gems.length < 8 && Math.random() < 0.5) {
      gems.push({
        x: cx, y: chestY - 30, vx: rand(-260, 260), vy: rand(-700, -450),
        rot: 0, vr: rand(-4, 4), emoji: pick(['💎', '👑', '💍', '⭐']), size: rand(42, 64),
      })
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]
      c.life += dt
      if (c.life >= c.maxLife) { coins.splice(i, 1); continue }
      c.x += c.vx * dt; c.y += c.vy * dt
      c.vy += 900 * dt
      if (c.y > H - 14 && c.vy > 0) c.vy *= -0.45 // bounce on the floor
      const squash = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + c.size)) // spinning coin
      ctx.fillStyle = c.color
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.size * squash, c.size, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#b8860b'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    for (const g of gems) {
      g.x += g.vx * dt; g.y += g.vy * dt; g.vy += 700 * dt; g.rot += g.vr * dt
      ctx.save()
      ctx.translate(g.x, g.y)
      ctx.rotate(g.rot)
      ctx.fillStyle = '#ffffff'; ctx.font = `${g.size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(g.emoji, 0, 0)
      ctx.restore()
    }

    // chest body
    const chestW = Math.min(W * 0.28, 300)
    const chestH = chestW * 0.55
    const chestX = cx - chestW / 2
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(cx, chestY + chestH + 6, chestW * 0.55, 12, 0, 0, Math.PI * 2)
    ctx.fill()
    const wood = ctx.createLinearGradient(0, chestY, 0, chestY + chestH)
    wood.addColorStop(0, '#8d5524')
    wood.addColorStop(1, '#5b3310')
    ctx.fillStyle = wood
    roundRect(ctx, chestX, chestY, chestW, chestH, 10)
    ctx.fill()
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 4
    roundRect(ctx, chestX, chestY, chestW, chestH, 10)
    ctx.stroke()
    ctx.fillStyle = '#ffd700'
    ctx.fillRect(cx - 12, chestY + chestH * 0.28, 24, 30) // lock plate

    // lid pivoting open backwards
    ctx.save()
    ctx.translate(chestX, chestY)
    ctx.rotate(-lidPhase * 1.9)
    const lidG = ctx.createLinearGradient(0, -chestH * 0.45, 0, 0)
    lidG.addColorStop(0, '#a0622d')
    lidG.addColorStop(1, '#6d3f14')
    ctx.fillStyle = lidG
    roundRect(ctx, 0, -chestH * 0.45, chestW, chestH * 0.45, 12)
    ctx.fill()
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 4
    roundRect(ctx, 0, -chestH * 0.45, chestW, chestH * 0.45, 12)
    ctx.stroke()
    ctx.restore()
  })
}

/* ============================================ sweet treats rain ========== */

const candyRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const treats: { x: number; y: number; vy: number; vx: number; rot: number; vr: number; emoji: string; size: number; landed: number }[] = []
  const sprinkles: FairySpark[] = []
  const emojis = ['🍦', '🍭', '🧁', '🍩', '🍪', '🍬', '🍫', '🎂']

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // pastel candy-shop wash
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(255, 183, 222, 0.12)')
    g.addColorStop(1, 'rgba(186, 230, 253, 0.10)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // falling treats
    if (t < 3 && treats.length < 40 && Math.random() < 0.45) {
      treats.push({
        x: rand(W * 0.04, W * 0.96), y: -60,
        vy: rand(260, 520), vx: rand(-30, 30),
        rot: rand(0, Math.PI * 2), vr: rand(-2.5, 2.5),
        emoji: pick(emojis), size: rand(48, 88), landed: 0,
      })
    }
    // sprinkle confetti dust
    if (sprinkles.length < 140) {
      for (let i = 0; i < 3; i++)
        sprinkles.push({
          x: rand(0, W), y: rand(-10, H), vx: rand(-20, 20), vy: rand(60, 140),
          life: 0, maxLife: rand(0.8, 1.8),
          color: pick(['#f472b6', '#a78bfa', '#38bdf8', '#fbbf24', '#34d399']), size: rand(2, 5),
        })
    }
    for (let i = sprinkles.length - 1; i >= 0; i--) {
      const s = sprinkles[i]
      s.life += dt
      if (s.life >= s.maxLife) { sprinkles.splice(i, 1); continue }
      s.x += s.vx * dt; s.y += s.vy * dt
      ctx.globalAlpha = 1 - s.life / s.maxLife
      ctx.fillStyle = s.color
      ctx.fillRect(s.x, s.y, s.size, s.size * 2.2)
      ctx.globalAlpha = 1
    }

    const floor = H - 50
    for (const tr of treats) {
      if (tr.landed === 0) {
        tr.y += tr.vy * dt
        tr.x += tr.vx * dt
        tr.rot += tr.vr * dt
        if (tr.y >= floor) {
          tr.y = floor
          tr.landed = t
        }
      }
      // squishy bounce when landing
      let scaleY = 1
      if (tr.landed > 0) {
        const since = t - tr.landed
        scaleY = since < 0.35 ? 1 - Math.sin((since / 0.35) * Math.PI) * 0.25 : 1
        tr.rot *= 1 - 4 * dt // settle upright-ish
      }
      ctx.save()
      ctx.translate(tr.x, tr.y)
      ctx.rotate(tr.landed ? tr.rot : tr.rot)
      ctx.scale(1, scaleY)
      ctx.fillStyle = '#ffffff'; ctx.font = `${tr.size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(tr.emoji, 0, 0)
      ctx.restore()
    }
  })
}

/* ============================================ puppy party ================ */

const puppiesRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const ground = H * 0.82
  const pups = Array.from({ length: 6 }, (_, i) => ({
    x: W + 120 + i * rand(120, 260),
    speed: rand(W * 0.18, W * 0.28), // slowed down slightly
    hop: rand(2.6, 3.6),
    phase: rand(0, Math.PI * 2),
    emoji: pick(['🐶', '🐕', '🐩', '🦮', '🐕‍🦺']),
    size: rand(72, 110),
  }))
  const hearts: FairySpark[] = []
  const balls = Array.from({ length: 3 }, () => ({
    x: rand(W * 0.2, W * 0.8), y: -40, vy: rand(150, 260), vx: rand(-60, 60),
    emoji: pick(['🎾', '🦴', '🥏']), size: rand(38, 52),
  }))

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // grassy hill
    ctx.fillStyle = 'rgba(134, 239, 172, 0.35)'
    ctx.beginPath()
    ctx.moveTo(0, H)
    ctx.quadraticCurveTo(W / 2, ground - 40, W, H)
    ctx.closePath()
    ctx.fill()

    // bouncing toys
    for (const b of balls) {
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.vy += 720 * dt
      if (b.y > ground && b.vy > 0) b.vy *= -0.75
      if (b.x < 30 || b.x > W - 30) b.vx *= -1
      ctx.fillStyle = '#ffffff'; ctx.font = `${b.size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(b.emoji, b.x, b.y)
    }

    // parade of hopping puppies (right to left)
    for (const p of pups) {
      p.x -= p.speed * dt
      if (p.x < -140) p.x = W + 140
      const hop = Math.abs(Math.sin(t * p.hop + p.phase)) * 46
      const y = ground - hop
      const tilt = Math.sin(t * p.hop + p.phase) * 0.12
      ctx.save()
      ctx.translate(p.x, y)
      ctx.scale(1, 1) // facing left is default for these emojis usually, or we flip if they face right
      ctx.rotate(tilt)
      ctx.fillStyle = '#ffffff'; ctx.font = `${p.size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.emoji, 0, 0)
      ctx.restore()
      // hearts pop off the pups
      if (Math.random() < 0.06) {
        hearts.push({
          x: p.x + rand(-20, 20), y: y - p.size * 0.5,
          vx: rand(-40, 40), vy: rand(-160, -80),
          life: 0, maxLife: rand(0.8, 1.6),
          color: pick(['💖', '💕', '❤️', '🩷']) as string, size: rand(20, 34),
        })
      }
    }

    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]
      h.life += dt
      if (h.life >= h.maxLife) { hearts.splice(i, 1); continue }
      h.x += h.vx * dt
      h.y += h.vy * dt
      ctx.globalAlpha = 1 - h.life / h.maxLife
      ctx.fillStyle = '#ffffff'; ctx.font = `${h.size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(h.color, h.x, h.y)
      ctx.globalAlpha = 1
    }
  })
}

/* ============================================ victory-lap race car ======= */

const racecarRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const roadY = H * 0.62
  const roadH = H * 0.2
  const flames: FairySpark[] = []
  const confetti: FairySpark[] = []
  const speedLines: { x: number; y: number; len: number; life: number }[] = []
  let confettiFired = false
  let dashOffset = 0

  // three passes, each closer & bigger, then a skid-stop in the middle
  const passes = [
    { t0: 0.0, t1: 1.5, dir: 1, y: roadY + roadH * 0.25, size: 70 },
    { t0: 1.6, t1: 3.0, dir: -1, y: roadY + roadH * 0.55, size: 100 },
    { t0: 3.1, t1: 4.5, dir: 1, y: roadY + roadH * 0.85, size: 140 },
  ]

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // twilight sky + cheering crowd strip
    const sky = ctx.createLinearGradient(0, 0, 0, roadY)
    sky.addColorStop(0, 'rgba(56, 130, 246, 0.25)')
    sky.addColorStop(1, 'rgba(251, 146, 60, 0.3)')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, roadY)
    ctx.fillStyle = '#ffffff'; ctx.font = '30px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    for (let i = 0; i < 14; i++) {
      const bounce = Math.abs(Math.sin(t * 4 + i)) * 10 // slowed bounce
      ctx.fillText(i % 2 ? '🙌' : '🎉', (i + 0.3) * (W / 14), roadY - 18 - bounce)
    }

    // road with scrolling center dashes
    ctx.fillStyle = 'rgba(51, 65, 85, 0.85)'
    ctx.fillRect(0, roadY, W, roadH)
    dashOffset = (dashOffset + dt * 450) % 80 // slowed from 900
    ctx.fillStyle = '#fde047'
    for (let x = -80 + dashOffset; x < W; x += 80) {
      ctx.fillRect(x, roadY + roadH / 2 - 3, 42, 6)
    }

    // find the active pass (or the finale)
    let carX = W / 2
    let carY = roadY + roadH * 0.55
    let carSize = 150
    let dir = 1
    let moving = false
    for (const p of passes) {
      if (t >= p.t0 && t < p.t1) {
        const prog = (t - p.t0) / (p.t1 - p.t0)
        carX = p.dir === 1 ? -150 + prog * (W + 300) : W + 150 - prog * (W + 300)
        carY = p.y
        carSize = p.size
        dir = p.dir
        moving = true
      }
    }
    const finale = t >= 4.5
    if (finale) {
      // skid to a stop in the middle
      const prog = Math.min((t - 4.5) / 0.8, 1)
      const ease = 1 - Math.pow(1 - prog, 3)
      carX = -150 + ease * (W / 2 + 150)
      carY = roadY + roadH * 0.85
      carSize = 150
      dir = 1
      moving = prog < 1

      if (prog >= 1 && !confettiFired) {
        confettiFired = true
        for (let i = 0; i < 130; i++) {
          const ang = rand(-Math.PI, 0)
          const speed = rand(150, 480) // slowed confetti
          confetti.push({
            x: carX, y: carY - 40,
            vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
            life: 0, maxLife: rand(1.0, 1.8),
            color: pick(['#fde047', '#f87171', '#4ade80', '#38bdf8', '#f472b6', '#ffffff']),
            size: rand(4, 8),
          })
        }
      }
      // waving checkered flags + trophy
      ctx.save()
      ctx.translate(W / 2 - 130, roadY - 60)
      ctx.rotate(Math.sin(t * 7) * 0.2)
      ctx.fillStyle = '#ffffff'; ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
      ctx.fillText('🏁', 0, 0)
      ctx.restore()
      ctx.save()
      ctx.translate(W / 2 + 130, roadY - 60)
      ctx.rotate(-Math.sin(t * 7) * 0.2)
      ctx.fillStyle = '#ffffff'; ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
      ctx.fillText('🏁', 0, 0)
      ctx.restore()
      if (prog >= 1) {
        const pop = Math.min((t - 5.1) / 0.6, 1) // delayed and slowed
        const bounce = pop < 1 ? 1 + Math.sin(pop * Math.PI) * 0.3 : 1
        ctx.save()
        ctx.translate(W / 2, roadY - 130)
        ctx.scale(pop * bounce, pop * bounce)
        ctx.fillStyle = '#ffffff'; ctx.font = '96px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('🏆', 0, 0)
        ctx.restore()
      }
    }

    // nitro flames + speed lines while moving
    if (moving) {
      for (let i = 0; i < 5; i++) {
        flames.push({
          x: carX - dir * carSize * 0.6, y: carY + rand(-6, 10),
          vx: -dir * rand(300, 620), vy: rand(-40, 40),
          life: 0, maxLife: rand(0.15, 0.4),
          color: pick(['#fbbf24', '#fb923c', '#f87171', '#fde047']), size: rand(5, 13),
        })
      }
      if (Math.random() < 0.8) {
        speedLines.push({ x: carX - dir * carSize, y: carY + rand(-carSize * 0.5, carSize * 0.3), len: rand(60, 160) * dir, life: 0.3 })
      }
    }
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const s = speedLines[i]
      s.life -= dt
      if (s.life <= 0) { speedLines.splice(i, 1); continue }
      ctx.globalAlpha = s.life * 2.5
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(s.x - s.len, s.y)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i]
      f.life += dt
      if (f.life >= f.maxLife) { flames.splice(i, 1); continue }
      f.x += f.vx * dt
      f.y += f.vy * dt
      const a = 1 - f.life / f.maxLife
      ctx.globalAlpha = a
      ctx.fillStyle = f.color
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * a + 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // the car (emoji faces left by default — flip when driving right)
    ctx.save()
    ctx.translate(carX, carY)
    if (dir === 1) ctx.scale(-1, 1)
    if (moving) ctx.translate(rand(-2, 2), rand(-1.5, 1.5))
    ctx.fillStyle = '#ffffff'; ctx.font = `${carSize}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🏎️', 0, 0)
    ctx.restore()

    // confetti
    for (let i = confetti.length - 1; i >= 0; i--) {
      const c = confetti[i]
      c.life += dt
      if (c.life >= c.maxLife) { confetti.splice(i, 1); continue }
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.vy += 500 * dt
      ctx.globalAlpha = 1 - c.life / c.maxLife
      ctx.fillStyle = c.color
      ctx.save()
      ctx.translate(c.x, c.y)
      ctx.rotate(t * 6 + c.size)
      ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2)
      ctx.restore()
      ctx.globalAlpha = 1
    }
  })
}

/* ============================================ hatching dino egg ========== */

const dinoEggRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const eggY = H * 0.58
  const eggR = Math.min(W, H) * 0.14
  const shellBits: { x: number; y: number; vx: number; vy: number; rot: number; vr: number; size: number }[] = []
  const leaves: FairySpark[] = []
  let burst = false

  // 0–2.2s: egg wobbles harder and harder, cracks appear
  // 2.2s: POP — shell flies, baby dino springs up
  const hatchT = 2.2

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // jungle backdrop
    ctx.fillStyle = '#ffffff'; ctx.font = '60px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🌴', W * 0.12, H * 0.75)
    ctx.fillText('🌴', W * 0.88, H * 0.72)
    ctx.fillStyle = '#ffffff'; ctx.font = '44px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.fillText('🌿', W * 0.22, H * 0.82)
    ctx.fillText('🌿', W * 0.78, H * 0.84)

    // nest
    ctx.fillStyle = '#8d6e63'
    ctx.beginPath()
    ctx.ellipse(cx, eggY + eggR * 0.9, eggR * 1.5, eggR * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6d4c41'
    ctx.beginPath()
    ctx.ellipse(cx, eggY + eggR * 0.82, eggR * 1.2, eggR * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()

    if (t < hatchT) {
      // wobble builds up in pulses
      const intensity = t / hatchT
      const wobble = Math.sin(t * 14) * 0.18 * intensity * Math.abs(Math.sin(t * 2.2))
      ctx.save()
      ctx.translate(cx, eggY + eggR)
      ctx.rotate(wobble)
      ctx.translate(0, -eggR)

      // egg
      const eggGrad = ctx.createLinearGradient(0, -eggR, 0, eggR)
      eggGrad.addColorStop(0, '#fefce8')
      eggGrad.addColorStop(1, '#d9f99d')
      ctx.fillStyle = eggGrad
      ctx.beginPath()
      ctx.ellipse(0, 0, eggR * 0.78, eggR, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#a3b18a'
      ctx.lineWidth = 3
      ctx.stroke()
      // spots
      ctx.fillStyle = 'rgba(132, 204, 22, 0.4)'
      for (const [sx, sy, sr] of [[-0.3, -0.4, 0.14], [0.32, -0.1, 0.11], [-0.15, 0.42, 0.16], [0.25, 0.5, 0.09]] as const) {
        ctx.beginPath()
        ctx.arc(sx * eggR, sy * eggR, sr * eggR, 0, Math.PI * 2)
        ctx.fill()
      }
      // cracks spread as hatching nears
      const crackP = Math.max(0, (t - 0.8) / (hatchT - 0.8))
      if (crackP > 0) {
        ctx.strokeStyle = '#57534e'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(0, -eggR * 0.9)
        const segs = Math.ceil(crackP * 6)
        let px = 0
        let py = -eggR * 0.9
        for (let i = 1; i <= segs; i++) {
          px += (i % 2 ? 1 : -1) * eggR * 0.16
          py += eggR * 0.24
          ctx.lineTo(px, py)
        }
        ctx.stroke()
        if (crackP > 0.55) {
          ctx.beginPath()
          ctx.moveTo(-eggR * 0.5, 0)
          ctx.lineTo(-eggR * 0.2, eggR * 0.18)
          ctx.lineTo(-eggR * 0.35, eggR * 0.42)
          ctx.stroke()
        }
      }
      ctx.restore()

      // question sparkles above the egg
      if (Math.random() < 0.12) {
        leaves.push({
          x: cx + rand(-eggR, eggR), y: eggY - eggR * 1.4,
          vx: rand(-20, 20), vy: rand(-60, -20),
          life: 0, maxLife: rand(0.6, 1.2),
          color: pick(['#fde047', '#ffffff', '#bef264']), size: rand(2, 5),
        })
      }
    } else {
      // HATCHED!
      if (!burst) {
        burst = true
        for (let i = 0; i < 14; i++) {
          const ang = rand(-Math.PI, 0)
          shellBits.push({
            x: cx + rand(-eggR * 0.5, eggR * 0.5), y: eggY,
            vx: Math.cos(ang) * rand(150, 420), vy: Math.sin(ang) * rand(250, 560),
            rot: rand(0, Math.PI * 2), vr: rand(-8, 8), size: rand(14, 34),
          })
        }
        for (let i = 0; i < 40; i++) {
          const ang = rand(-Math.PI, 0)
          leaves.push({
            x: cx, y: eggY,
            vx: Math.cos(ang) * rand(100, 380), vy: Math.sin(ang) * rand(150, 450),
            life: 0, maxLife: rand(0.8, 1.6),
            color: pick(['#bef264', '#fde047', '#86efac', '#fefce8']), size: rand(3, 7),
          })
        }
      }

      // baby dino springs up with a bounce
      const since = t - hatchT
      const popP = Math.min(since / 0.5, 1)
      const overshoot = popP < 1 ? 1 + Math.sin(popP * Math.PI) * 0.35 : 1
      const bob = since > 0.5 ? Math.sin(since * 5) * 8 : 0
      ctx.save()
      ctx.translate(cx, eggY - eggR * 0.3 + bob)
      ctx.scale(popP * overshoot, popP * overshoot)
      ctx.fillStyle = '#ffffff'; ctx.font = `${eggR * 2}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🦕', 0, 0)
      ctx.restore()

      // broken shell halves resting in the nest
      ctx.fillStyle = '#fefce8'
      ctx.beginPath()
      ctx.ellipse(cx - eggR * 0.55, eggY + eggR * 0.55, eggR * 0.42, eggR * 0.3, -0.3, 0, Math.PI, true)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx + eggR * 0.55, eggY + eggR * 0.55, eggR * 0.42, eggR * 0.3, 0.3, 0, Math.PI, true)
      ctx.fill()
    }

    // flying shell bits
    for (let i = shellBits.length - 1; i >= 0; i--) {
      const b = shellBits[i]
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.vy += 900 * dt
      b.rot += b.vr * dt
      if (b.y > H + 60) { shellBits.splice(i, 1); continue }
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.rot)
      ctx.fillStyle = '#fefce8'
      ctx.strokeStyle = '#a3b18a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-b.size / 2, 0)
      ctx.lineTo(0, -b.size / 2)
      ctx.lineTo(b.size / 2, 0)
      ctx.lineTo(0, b.size / 3)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    // confetti sparks
    for (let i = leaves.length - 1; i >= 0; i--) {
      const s = leaves[i]
      s.life += dt
      if (s.life >= s.maxLife) { leaves.splice(i, 1); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 300 * dt
      ctx.globalAlpha = 1 - s.life / s.maxLife
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  })
}

/* ============================================ UFO gift delivery ========== */

const ufoRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const cx = W / 2
  const hoverY = H * 0.22
  const groundY = H * 0.78
  const stars = Array.from({ length: 70 }, () => ({
    x: rand(0, W), y: rand(0, H * 0.75), s: rand(1, 3), tw: rand(0, Math.PI * 2),
  }))
  const sparks: FairySpark[] = []
  let popped = false

  // 0–1s: UFO zips in.  1–2.6s: beam on, gift floats down.
  // 2.6–3.2s: gift lands + bounces, beam off.  3.4s: gift pops open, UFO zooms away.
  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    for (const st of stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + st.tw))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(st.x, st.y, st.s, st.s)
    }
    ctx.globalAlpha = 1

    // moon ground
    ctx.fillStyle = 'rgba(148, 163, 184, 0.3)'
    ctx.beginPath()
    ctx.moveTo(0, H)
    ctx.quadraticCurveTo(W / 2, groundY - 30, W, H)
    ctx.closePath()
    ctx.fill()

    // UFO position
    const arriveP = Math.min(t / 1.0, 1)
    const arriveEase = 1 - Math.pow(1 - arriveP, 3)
    const leaving = t > 3.6
    let ufoX = -180 + arriveEase * (cx + 180)
    let ufoY = hoverY + Math.sin(t * 3) * 8
    if (leaving) {
      const lp = (t - 3.6) / 0.5
      ufoX = cx + lp * lp * (W * 0.7 + 200)
      ufoY = hoverY - lp * lp * H * 0.3
    }

    const beamOn = t > 1.0 && t < 3.1
    if (beamOn) {
      // tractor beam cone with animated shimmer bands
      const beamA = Math.min((t - 1.0) / 0.3, 1) * (t > 2.85 ? 1 - (t - 2.85) / 0.25 : 1)
      const beamGrad = ctx.createLinearGradient(0, ufoY, 0, groundY)
      beamGrad.addColorStop(0, `rgba(134, 239, 172, ${0.55 * beamA})`)
      beamGrad.addColorStop(1, `rgba(134, 239, 172, ${0.08 * beamA})`)
      ctx.fillStyle = beamGrad
      ctx.beginPath()
      ctx.moveTo(ufoX - 30, ufoY + 20)
      ctx.lineTo(ufoX + 30, ufoY + 20)
      ctx.lineTo(ufoX + 110, groundY)
      ctx.lineTo(ufoX - 110, groundY)
      ctx.closePath()
      ctx.fill()
      // shimmer rings sliding down the beam
      for (let i = 0; i < 4; i++) {
        const ringP = ((t * 0.6 + i / 4) % 1)
        const ry = ufoY + 20 + ringP * (groundY - ufoY - 20)
        const rw = 30 + ringP * 80
        ctx.strokeStyle = `rgba(220, 252, 231, ${0.5 * beamA * (1 - ringP)})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.ellipse(ufoX, ry, rw, rw * 0.18, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // the gift, floating down the beam
    if (t > 1.2 && !popped) {
      const dropP = Math.min((t - 1.2) / 1.5, 1)
      const ease = dropP * dropP * (3 - 2 * dropP)
      let giftY = ufoY + 60 + ease * (groundY - ufoY - 100)
      // landing bounce
      if (dropP >= 1) {
        const since = t - 2.7
        if (since > 0 && since < 0.4) giftY -= Math.sin((since / 0.4) * Math.PI) * 18
      }
      const spin = dropP < 1 ? t * 2.5 : 0
      ctx.save()
      ctx.translate(cx, giftY)
      ctx.rotate(Math.sin(spin) * 0.3)
      ctx.fillStyle = '#ffffff'; ctx.font = '80px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🎁', 0, 0)
      ctx.restore()
      if (t > 3.4) {
        popped = true
        for (let i = 0; i < 50; i++) {
          const ang = rand(-Math.PI, 0)
          sparks.push({
            x: cx, y: groundY - 50,
            vx: Math.cos(ang) * rand(120, 420), vy: Math.sin(ang) * rand(180, 520),
            life: 0, maxLife: rand(0.7, 1.4),
            color: pick(['#86efac', '#fde047', '#93c5fd', '#f9a8d4', '#ffffff']), size: rand(3, 6),
          })
        }
      }
    }
    // opened gift with prize
    if (popped) {
      ctx.fillStyle = '#ffffff'; ctx.font = '80px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🎉', cx, groundY - 46)
      const since = t - 3.4
      const rise = Math.min(since / 0.5, 1)
      ctx.fillStyle = '#ffffff'; ctx.font = `${40 + rise * 30}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.fillText('⭐', cx, groundY - 90 - rise * 60)
    }

    // the UFO itself (drawn after beam so it sits on top)
    ctx.save()
    ctx.translate(ufoX, ufoY)
    ctx.rotate(Math.sin(t * 3) * 0.05)
    ctx.fillStyle = '#ffffff'; ctx.font = '110px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🛸', 0, 0)
    ctx.restore()

    // celebration sparks
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
  })
}

/* ============================================ rainbow dragon flyby ======= */

const DRAGON_FIRE = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa']

const dragonRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const fire: FairySpark[] = []
  const coins: FairySpark[] = []

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // castle in the corner for fantasy vibes
    ctx.fillStyle = '#ffffff'; ctx.font = '90px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🏰', W * 0.88, H * 0.85)

    // dragon swoops in a big lazy sine, twice across
    const lap = 2.2
    const dir = Math.floor(t / lap) % 2 === 0 ? 1 : -1
    const p = (t % lap) / lap
    const x = dir === 1 ? -170 + p * (W + 340) : W + 170 - p * (W + 340)
    const y = H * 0.35 + Math.sin(p * Math.PI * 2 + t) * H * 0.16
    const flap = Math.sin(t * 8) * 0.12

    // rainbow fire breath streams out ahead of the dragon
    for (let i = 0; i < 7; i++) {
      fire.push({
        x: x + dir * rand(60, 100), y: y + rand(0, 30),
        vx: dir * rand(200, 480) + rand(-40, 40), vy: rand(-60, 120),
        life: 0, maxLife: rand(0.5, 1.1),
        color: pick(DRAGON_FIRE), size: rand(5, 12),
      })
    }
    // occasional gold coins tumble from its claws
    if (Math.random() < 0.2) {
      coins.push({
        x: x + rand(-30, 30), y: y + 40,
        vx: rand(-60, 60), vy: rand(20, 120),
        life: 0, maxLife: rand(1.2, 2.2),
        color: '#ffd700', size: rand(7, 12),
      })
    }

    for (let i = fire.length - 1; i >= 0; i--) {
      const f = fire[i]
      f.life += dt
      if (f.life >= f.maxLife) { fire.splice(i, 1); continue }
      f.x += f.vx * dt
      f.y += f.vy * dt
      f.vy += 60 * dt
      const a = 1 - f.life / f.maxLife
      ctx.globalAlpha = a * 0.9
      ctx.fillStyle = f.color
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size * a + 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]
      c.life += dt
      if (c.life >= c.maxLife) { coins.splice(i, 1); continue }
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.vy += 500 * dt
      if (c.y > H - 20 && c.vy > 0) c.vy *= -0.5
      const squash = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + c.size))
      ctx.globalAlpha = 1 - c.life / c.maxLife
      ctx.fillStyle = c.color
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.size * squash, c.size, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#b8860b'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // the dragon (emoji faces left; flip when flying right)
    ctx.save()
    ctx.translate(x, y)
    if (dir === 1) ctx.scale(-1, 1)
    ctx.rotate(flap)
    ctx.fillStyle = '#ffffff'; ctx.font = '150px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('🐉', 0, 0)
    ctx.restore()
  })
}

/* ============================================ robot disco party ========== */

const robotRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const floorY = H * 0.8
  const bots = [
    { x: W * 0.25, size: 110, beat: 4, phase: 0 },
    { x: W * 0.5, size: 140, beat: 4, phase: Math.PI / 2 },
    { x: W * 0.75, size: 110, beat: 4, phase: Math.PI },
  ]
  const notes: { x: number; y: number; vy: number; wobble: number; emoji: string; size: number }[] = []
  const beamColors = ['#f472b6', '#38bdf8', '#fde047', '#4ade80', '#a78bfa']

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // sweeping spotlight beams from the top corners
    for (let i = 0; i < 4; i++) {
      const originX = i < 2 ? 0 : W
      const sweep = Math.sin(t * 1.4 + i * 1.7) * 0.5
      const ang = (i < 2 ? 0.9 : Math.PI - 0.9) + sweep * (i < 2 ? 1 : -1)
      const grad = ctx.createLinearGradient(originX, 0, originX + Math.cos(ang) * H, Math.sin(ang) * H)
      grad.addColorStop(0, `${beamColors[i % beamColors.length]}55`)
      grad.addColorStop(1, `${beamColors[i % beamColors.length]}00`)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(originX, 0)
      ctx.lineTo(originX + Math.cos(ang - 0.09) * H * 1.4, Math.sin(ang - 0.09) * H * 1.4)
      ctx.lineTo(originX + Math.cos(ang + 0.09) * H * 1.4, Math.sin(ang + 0.09) * H * 1.4)
      ctx.closePath()
      ctx.fill()
    }

    // disco ball
    const ballR = 44
    const ballY = 70
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(W / 2, 0)
    ctx.lineTo(W / 2, ballY - ballR)
    ctx.stroke()
    const ballGrad = ctx.createRadialGradient(W / 2 - 12, ballY - 12, 6, W / 2, ballY, ballR)
    ballGrad.addColorStop(0, '#f8fafc')
    ballGrad.addColorStop(1, '#94a3b8')
    ctx.fillStyle = ballGrad
    ctx.beginPath()
    ctx.arc(W / 2, ballY, ballR, 0, Math.PI * 2)
    ctx.fill()
    // glints spinning around the ball
    for (let i = 0; i < 8; i++) {
      const ga = t * 2 + (i / 8) * Math.PI * 2
      const gx = W / 2 + Math.cos(ga) * ballR * 0.75
      const gy = ballY + Math.sin(ga) * ballR * 0.35
      ctx.fillStyle = pick(beamColors)
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 8 + i)
      ctx.fillRect(gx - 3, gy - 3, 6, 6)
      ctx.globalAlpha = 1
    }

    // checkerboard dance floor, tiles flashing on the beat
    const tiles = 8
    const tileW = W / tiles
    const tileH = (H - floorY) / 2
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < tiles; c++) {
        const flash = (Math.floor(t * 4) + r + c) % beamColors.length
        ctx.globalAlpha = 0.22 + 0.12 * Math.sin(t * 8 + c + r)
        ctx.fillStyle = beamColors[flash]
        ctx.fillRect(c * tileW, floorY + r * tileH, tileW - 2, tileH - 2)
        ctx.globalAlpha = 1
      }
    }

    // dancing robots: bounce, tilt, and spin on the beat
    for (const b of bots) {
      const bounce = Math.abs(Math.sin(t * b.beat + b.phase)) * 34
      const tilt = Math.sin(t * b.beat * 0.5 + b.phase) * 0.22
      const spinBeat = Math.floor((t + b.phase) / 2) % 4 === 3
      ctx.save()
      ctx.translate(b.x, floorY - b.size * 0.45 - bounce)
      ctx.rotate(spinBeat ? ((t % 2) / 2) * Math.PI * 2 : tilt)
      ctx.fillStyle = '#ffffff'; ctx.font = `${b.size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🤖', 0, 0)
      ctx.restore()
    }

    // floating music notes
    if (notes.length < 14 && Math.random() < 0.2) {
      notes.push({
        x: rand(W * 0.1, W * 0.9), y: floorY,
        vy: rand(-140, -70), wobble: rand(0, Math.PI * 2),
        emoji: pick(['🎵', '🎶', '🪩', '✨']), size: rand(28, 48),
      })
    }
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i]
      n.y += n.vy * dt
      n.x += Math.sin(t * 3 + n.wobble) * 40 * dt
      if (n.y < -60) { notes.splice(i, 1); continue }
      ctx.fillStyle = '#ffffff'; ctx.font = `${n.size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(n.emoji, n.x, n.y)
    }
  })
}

/* ============================================ pirate treasure ship ======= */

const pirateRun = (canvas: HTMLCanvasElement) => {
  const ctx = fit(canvas)
  const W = canvas.width
  const H = canvas.height
  const seaY = H * 0.68
  const booty: FairySpark[] = []
  const smoke: FairySpark[] = []
  const fired: number[] = []
  let nextShot = 1.0

  return loop((dt, t) => {
    ctx.clearRect(0, 0, W, H)

    // island with palm + buried X
    ctx.fillStyle = 'rgba(253, 224, 71, 0.5)'
    ctx.beginPath()
    ctx.ellipse(W * 0.85, seaY + 24, 130, 34, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'; ctx.font = '70px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🌴', W * 0.88, seaY - 12)
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    const xx = W * 0.8
    const xy = seaY + 20
    ctx.beginPath()
    ctx.moveTo(xx - 14, xy - 14); ctx.lineTo(xx + 14, xy + 14)
    ctx.moveTo(xx + 14, xy - 14); ctx.lineTo(xx - 14, xy + 14)
    ctx.stroke()

    // parrot escort loops overhead
    const px = W * 0.5 + Math.sin(t * 1.2) * W * 0.3
    const py = H * 0.18 + Math.sin(t * 2.6) * 26
    ctx.save()
    ctx.translate(px, py)
    if (Math.cos(t * 1.2) > 0) ctx.scale(-1, 1)
    ctx.fillStyle = '#ffffff'; ctx.font = '54px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🦜', 0, 0)
    ctx.restore()

    // ship sails in from the left, rocking on the waves
    const sailP = Math.min(t / 2.0, 1)
    const ease = sailP * sailP * (3 - 2 * sailP)
    const shipX = -180 + ease * (W * 0.38 + 180)
    const bob = Math.sin(t * 1.8) * 10
    const rock = Math.sin(t * 1.8 + 0.6) * 0.06

    ctx.save()
    ctx.translate(shipX, seaY - 30 + bob)
    ctx.rotate(rock)
    ctx.fillStyle = '#ffffff'; ctx.font = '150px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('⛵', 0, 0)
    ctx.fillStyle = '#ffffff'; ctx.font = '44px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif'
    ctx.fillText('🏴‍☠️', 8, -86)
    ctx.restore()

    // cannon fire! arcs of coins + gems toward the island
    if (t >= nextShot && t < 3.9 && sailP >= 1) {
      nextShot = t + 0.9
      fired.push(t)
      for (let i = 0; i < 22; i++) {
        booty.push({
          x: shipX + 60, y: seaY - 60 + bob,
          vx: rand(220, 480), vy: rand(-620, -380),
          life: 0, maxLife: rand(1.4, 2.2),
          color: pick(['#ffd700', '#ffca28', '#e040fb', '#40c4ff', '#ff5252']), size: rand(6, 12),
        })
      }
      for (let i = 0; i < 8; i++) {
        smoke.push({
          x: shipX + 70, y: seaY - 55 + bob,
          vx: rand(30, 90), vy: rand(-60, -10),
          life: 0, maxLife: rand(0.5, 1.1),
          color: pick(['#e2e8f0', '#cbd5e1', '#f8fafc']), size: rand(8, 18),
        })
      }
    }
    // muzzle flash
    const lastShot = fired[fired.length - 1]
    if (lastShot !== undefined && t - lastShot < 0.12) {
      ctx.fillStyle = '#fde047'
      ctx.beginPath()
      ctx.arc(shipX + 70, seaY - 55 + bob, 22 * (1 - (t - lastShot) / 0.12), 0, Math.PI * 2)
      ctx.fill()
    }

    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]
      s.life += dt
      if (s.life >= s.maxLife) { smoke.splice(i, 1); continue }
      s.x += s.vx * dt
      s.y += s.vy * dt
      ctx.globalAlpha = (1 - s.life / s.maxLife) * 0.6
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * (1 + s.life), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    for (let i = booty.length - 1; i >= 0; i--) {
      const c = booty[i]
      c.life += dt
      if (c.life >= c.maxLife) { booty.splice(i, 1); continue }
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.vy += 800 * dt
      if (c.y > seaY + 20 && c.vy > 0) c.vy *= -0.4 // splash-bounce on the island/sea
      const squash = 0.4 + 0.6 * Math.abs(Math.sin(t * 7 + c.size))
      ctx.globalAlpha = Math.min(1, 2 * (1 - c.life / c.maxLife))
      ctx.fillStyle = c.color
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.size * squash, c.size, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // rolling waves (drawn last so ship sits "in" the water)
    for (let band = 0; band < 3; band++) {
      const wy = seaY + band * ((H - seaY) / 3)
      ctx.fillStyle = `rgba(56, 189, 248, ${0.35 + band * 0.15})`
      ctx.beginPath()
      ctx.moveTo(0, H)
      ctx.lineTo(0, wy)
      for (let x = 0; x <= W; x += 24) {
        ctx.lineTo(x, wy + Math.sin(x / 60 + t * (2 + band * 0.6)) * 9)
      }
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fill()
    }
  })
}

/* ============================================== registry ================= */

export const REWARD_ANIMATIONS: RewardAnimation[] = [
  {
    name: 'fairy',
    emoji: '🧚',
    label: 'Fairy wish',
    backdrop: 'rgba(30, 10, 60, 0.98)',
    praise: ['Wish granted!', 'Magic is real!', 'You earned this!'],
    run: fairyRun,
  },
  {
    name: 'treasure',
    emoji: '💰',
    label: 'Treasure chest',
    backdrop: 'rgba(20, 12, 45, 0.98)',
    praise: ['Treasure unlocked!', 'You struck gold!', 'Riches for royalty!'],
    run: treasureRun,
  },
  {
    name: 'candy',
    emoji: '🍭',
    label: 'Sweet treats',
    backdrop: 'rgba(80, 30, 70, 0.98)',
    praise: ['Sweet reward!', 'Treat yourself!', 'How sweet it is!'],
    run: candyRun,
  },
  {
    name: 'puppies',
    emoji: '🐶',
    label: 'Puppy party',
    backdrop: 'rgba(15, 60, 45, 0.98)',
    praise: ['Puppy party!', 'Pawsome job!', 'You earned all the love!'],
    run: puppiesRun,
  },
  {
    name: 'racecar',
    emoji: '🏎️',
    label: 'Victory lap',
    backdrop: 'rgba(15, 23, 42, 0.98)',
    praise: ['Victory lap!', 'Vroom vroom, champ!', 'Pole position!'],
    run: racecarRun,
  },
  {
    name: 'dinoegg',
    emoji: '🦕',
    label: 'Dino egg',
    backdrop: 'rgba(22, 46, 18, 0.98)',
    praise: ['A baby dino hatched!', 'RAWR-some reward!', 'Dino-mite!'],
    run: dinoEggRun,
  },
  {
    name: 'ufo',
    emoji: '🛸',
    label: 'UFO delivery',
    backdrop: 'rgba(6, 10, 34, 0.98)',
    praise: ['Special delivery from space!', 'The aliens approve!', 'Out of this world!'],
    run: ufoRun,
  },
  {
    name: 'dragon',
    emoji: '🐉',
    label: 'Dragon',
    backdrop: 'rgba(40, 18, 60, 0.98)',
    praise: ['Dragon-approved!', 'Legendary!', 'Rainbow fire for you!'],
    run: dragonRun,
  },
  {
    name: 'robot',
    emoji: '🤖',
    label: 'Robot party',
    backdrop: 'rgba(10, 12, 32, 0.98)',
    praise: ['Robot dance party!', 'Beep boop, you rock!', 'Maximum awesome detected!'],
    run: robotRun,
  },
  {
    name: 'pirate',
    emoji: '🏴‍☠️',
    label: 'Pirate treasure',
    backdrop: 'rgba(7, 30, 55, 0.98)',
    praise: ['Ahoy, treasure earned!', 'Shiver me timbers!', 'X marks YOUR spot!'],
    run: pirateRun,
  },
]
