/**
 * Balloon Cannon Chores Celebration Animation
 * Canvas 2D Chore Completion Animation (~7.5 seconds)
 *
 * Sequence:
 * 1. Cannon on the left aims & fires magical glowing projectiles across parabolic arcs.
 * 2. Projectiles strike the chore papers hanging on the clothesline.
 * 3. Upon impact, the chore paper's checkbox transforms into a green checkmark [✔],
 *    inflates into a glossy 3D helium balloon, and floats skyward into the clouds.
 * 4. A golden celebratory pun ribbon drops down with confetti:
 *    "CHORES ARE BLOWN AWAY!"
 */

export const V_W = 1280
export const V_H = 720
export const TOTAL_DURATION = 7.5

// =============================================================================
// EASING & MATH UTILITIES
// =============================================================================

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const phase = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1)

const easeOutBounce = (t: number) => {
  const n1 = 7.5625, d1 = 2.75
  let tt = t
  if (tt < 1 / d1) return n1 * tt * tt
  if (tt < 2 / d1) return n1 * (tt -= 1.5 / d1) * tt + 0.75
  if (tt < 2.5 / d1) return n1 * (tt -= 2.25 / d1) * tt + 0.9375
  return n1 * (tt -= 2.625 / d1) * tt + 0.984375
}

const easeOutElastic = (x: number) => {
  const c4 = (2 * Math.PI) / 3
  return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
}

// =============================================================================
// SCENE DATA & CONFIGURATION
// =============================================================================

const CANNON_PIVOT_X = 185
const CANNON_PIVOT_Y = 530
const CANNON_ANGLE = -0.46 // ~26 degrees up
const CANNON_LENGTH = 160
const MUZZLE_X = CANNON_PIVOT_X + Math.cos(CANNON_ANGLE) * CANNON_LENGTH
const MUZZLE_Y = CANNON_PIVOT_Y + Math.sin(CANNON_ANGLE) * CANNON_LENGTH

interface ChoreData {
  id: number
  title: string
  icon: string
  fireTime: number
  impactTime: number
  x: number
  y: number
  color: string
  colorLight: string
  colorDark: string
  knotColor: string
  balloonScale: number
}

const CHORES: ChoreData[] = [
  {
    id: 0,
    title: 'Make Bed',
    icon: '🛏️',
    fireTime: 0.9,
    impactTime: 1.45,
    x: 690,
    y: 280,
    color: '#ef4444',
    colorLight: '#fca5a5',
    colorDark: '#991b1b',
    knotColor: '#b91c1c',
    balloonScale: 1.05,
  },
  {
    id: 1,
    title: 'Homework',
    icon: '📚',
    fireTime: 1.5,
    impactTime: 2.05,
    x: 820,
    y: 230,
    color: '#f59e0b',
    colorLight: '#fde68a',
    colorDark: '#b45309',
    knotColor: '#d97706',
    balloonScale: 1.12,
  },
  {
    id: 2,
    title: 'Wash Dishes',
    icon: '🍽️',
    fireTime: 2.1,
    impactTime: 2.65,
    x: 950,
    y: 290,
    color: '#0ea5e9',
    colorLight: '#bae6fd',
    colorDark: '#0369a1',
    knotColor: '#0284c7',
    balloonScale: 1.08,
  },
  {
    id: 3,
    title: 'Clean Room',
    icon: '🧹',
    fireTime: 2.7,
    impactTime: 3.25,
    x: 1080,
    y: 240,
    color: '#a855f7',
    colorLight: '#f3e8ff',
    colorDark: '#7e22ce',
    knotColor: '#9333ea',
    balloonScale: 1.15,
  },
]

const CLOUDS = [
  { x: 140, y: 120, s: 0.85, speed: 12 },
  { x: 490, y: 80, s: 1.1, speed: 8 },
  { x: 880, y: 140, s: 0.95, speed: 14 },
  { x: 1180, y: 90, s: 0.75, speed: 10 },
]

const CONFETTI_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#facc15']

// =============================================================================
// DRAWING ROUTINES
// =============================================================================

function drawBackground(ctx: CanvasRenderingContext2D, t: number) {
  // Cheerful sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, V_H)
  skyGrad.addColorStop(0, '#38bdf8')
  skyGrad.addColorStop(0.55, '#bae6fd')
  skyGrad.addColorStop(1, '#fef08a')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, V_W, V_H)

  // Sun rays
  ctx.save()
  ctx.translate(140, 100)
  ctx.rotate(t * 0.08)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  for (let i = 0; i < 12; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, 600, (i * Math.PI) / 6, (i * Math.PI) / 6 + 0.22)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // Sun circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(140, 100, 55, 0, Math.PI * 2)
  ctx.fillStyle = '#fef08a'
  ctx.shadowColor = '#fde047'
  ctx.shadowBlur = 35
  ctx.fill()
  ctx.restore()

  // Drifting clouds
  for (const cl of CLOUDS) {
    const curX = ((cl.x + t * cl.speed) % (V_W + 240)) - 120
    drawCloud(ctx, curX, cl.y, cl.s)
  }

  // Rolling green meadow hills
  drawHills(ctx)
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
  ctx.beginPath()
  ctx.arc(0, 0, 36, 0, Math.PI * 2)
  ctx.arc(32, -12, 30, 0, Math.PI * 2)
  ctx.arc(70, 0, 34, 0, Math.PI * 2)
  ctx.arc(38, 14, 28, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawHills(ctx: CanvasRenderingContext2D) {
  // Distant hill
  ctx.fillStyle = '#86efac'
  ctx.beginPath()
  ctx.moveTo(0, 520)
  ctx.bezierCurveTo(320, 480, 580, 560, 920, 500)
  ctx.bezierCurveTo(1080, 470, 1200, 510, V_W, 515)
  ctx.lineTo(V_W, V_H)
  ctx.lineTo(0, V_H)
  ctx.closePath()
  ctx.fill()

  // Near hill
  ctx.fillStyle = '#4ade80'
  ctx.beginPath()
  ctx.moveTo(0, 580)
  ctx.bezierCurveTo(240, 540, 540, 600, 800, 550)
  ctx.bezierCurveTo(1020, 510, 1180, 560, V_W, 550)
  ctx.lineTo(V_W, V_H)
  ctx.lineTo(0, V_H)
  ctx.closePath()
  ctx.fill()

  // Foreground grass base
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.moveTo(0, 630)
  ctx.bezierCurveTo(340, 610, 720, 640, V_W, 615)
  ctx.lineTo(V_W, V_H)
  ctx.lineTo(0, V_H)
  ctx.closePath()
  ctx.fill()
}

function drawCannon(ctx: CanvasRenderingContext2D, t: number) {
  // Recoil calculation: fires at each chore's fireTime
  let recoil = 0
  for (const ch of CHORES) {
    if (t >= ch.fireTime && t < ch.fireTime + 0.35) {
      const p = (t - ch.fireTime) / 0.35
      recoil = Math.max(recoil, (1 - p) * Math.sin(p * Math.PI))
    }
  }

  ctx.save()
  ctx.translate(CANNON_PIVOT_X, CANNON_PIVOT_Y)

  // Shadow underneath
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
  ctx.beginPath()
  ctx.ellipse(-20, 60, 110, 24, 0, 0, Math.PI * 2)
  ctx.fill()

  // Recoil translation for barrel
  const recoilDist = recoil * 24
  const barrelX = -Math.cos(CANNON_ANGLE) * recoilDist
  const barrelY = -Math.sin(CANNON_ANGLE) * recoilDist

  // 1. CANNON BARREL
  ctx.save()
  ctx.translate(barrelX, barrelY)
  ctx.rotate(CANNON_ANGLE)

  // Barrel squash on recoil
  if (recoil > 0) {
    ctx.scale(1 - recoil * 0.15, 1 + recoil * 0.18)
  }

  // Main barrel cylinder
  const bGrad = ctx.createLinearGradient(0, -38, 0, 38)
  bGrad.addColorStop(0, '#334155')
  bGrad.addColorStop(0.35, '#64748b')
  bGrad.addColorStop(0.7, '#1e293b')
  bGrad.addColorStop(1, '#0f172a')

  ctx.fillStyle = bGrad
  ctx.beginPath()
  ctx.roundRect(-45, -34, CANNON_LENGTH + 20, 68, 8)
  ctx.fill()

  // Golden decorative trim rings
  ctx.fillStyle = '#f59e0b'
  ctx.fillRect(10, -36, 14, 72)
  ctx.fillRect(80, -36, 14, 72)

  // Muzzle rim (front flared lip)
  const mGrad = ctx.createLinearGradient(0, -42, 0, 42)
  mGrad.addColorStop(0, '#fbbf24')
  mGrad.addColorStop(0.5, '#d97706')
  mGrad.addColorStop(1, '#78350f')
  ctx.fillStyle = mGrad
  ctx.beginPath()
  ctx.roundRect(CANNON_LENGTH - 15, -42, 30, 84, 8)
  ctx.fill()

  // Muzzle dark bore hole
  ctx.fillStyle = '#090d16'
  ctx.beginPath()
  ctx.ellipse(CANNON_LENGTH + 14, 0, 9, 36, 0, 0, Math.PI * 2)
  ctx.fill()

  // Breech sphere (back knob)
  ctx.beginPath()
  ctx.arc(-42, 0, 32, 0, Math.PI * 2)
  ctx.fillStyle = '#1e293b'
  ctx.fill()
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 4
  ctx.stroke()

  // Fuse rope at the back
  ctx.strokeStyle = '#d97706'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(-42, -26)
  ctx.quadraticCurveTo(-60, -48, -48, -62)
  ctx.stroke()

  // Burning spark on fuse before final shot
  if (t < 2.8) {
    ctx.fillStyle = '#fef08a'
    ctx.beginPath()
    const sparkR = 7 + Math.sin(t * 35) * 3
    ctx.arc(-48, -62, sparkR, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#f97316'
    ctx.beginPath()
    ctx.arc(-48 + Math.cos(t * 20) * 6, -62 + Math.sin(t * 20) * 6, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore() // end barrel

  // 2. WOODEN CARRIAGE / MOUNT
  ctx.fillStyle = '#78350f'
  ctx.beginPath()
  ctx.moveTo(-75, 45)
  ctx.lineTo(25, 45)
  ctx.lineTo(15, -10)
  ctx.lineTo(-45, -10)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#451a03'
  ctx.lineWidth = 3
  ctx.stroke()

  // Carriage metal brackets
  ctx.fillStyle = '#475569'
  ctx.fillRect(-50, -5, 12, 50)
  ctx.fillRect(5, -5, 12, 50)

  // 3. ARTILLERY WHEEL
  ctx.save()
  ctx.translate(-25, 30)

  // Outer rim
  ctx.beginPath()
  ctx.arc(0, 0, 48, 0, Math.PI * 2)
  ctx.fillStyle = '#92400e'
  ctx.fill()
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 7
  ctx.stroke()

  // Wheel spokes
  ctx.strokeStyle = '#78350f'
  ctx.lineWidth = 5
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44)
    ctx.stroke()
  }

  // Golden center hub
  ctx.beginPath()
  ctx.arc(0, 0, 16, 0, Math.PI * 2)
  ctx.fillStyle = '#f59e0b'
  ctx.fill()
  ctx.strokeStyle = '#78350f'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#1e293b'
  ctx.fill()

  ctx.restore() // end wheel
  ctx.restore() // end cannon pivot

  // 4. MUZZLE FLASH & SMOKE PUFFS
  for (const ch of CHORES) {
    if (t >= ch.fireTime && t < ch.fireTime + 0.35) {
      const p = (t - ch.fireTime) / 0.35
      drawMuzzleBlast(ctx, MUZZLE_X, MUZZLE_Y, p)
    }
  }
}

function drawMuzzleBlast(ctx: CanvasRenderingContext2D, mx: number, my: number, p: number) {
  ctx.save()
  ctx.translate(mx, my)
  ctx.rotate(CANNON_ANGLE)

  if (p < 0.35) {
    const fp = p / 0.35
    const scale = (1 - fp) * 1.5
    ctx.save()
    ctx.scale(scale, scale)
    ctx.fillStyle = '#fef08a'
    ctx.shadowColor = '#f59e0b'
    ctx.shadowBlur = 40
    ctx.beginPath()
    for (let i = 0; i < 12; i++) {
      const r = i % 2 === 0 ? 60 : 25
      const a = (i * Math.PI) / 6
      ctx.lineTo(Math.cos(a) * r + 30, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // Expanding smoke puffs
  const smokeAlpha = (1 - p) * 0.75
  ctx.fillStyle = `rgba(241, 245, 249, ${smokeAlpha})`
  const dist = p * 75
  ctx.beginPath()
  ctx.arc(dist + 20, 0, 22 + p * 28, 0, Math.PI * 2)
  ctx.arc(dist + 10, -18, 16 + p * 20, 0, Math.PI * 2)
  ctx.arc(dist + 10, 18, 16 + p * 20, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawProjectiles(ctx: CanvasRenderingContext2D, t: number) {
  for (const ch of CHORES) {
    if (t >= ch.fireTime && t < ch.impactTime) {
      const p = phase(t, ch.fireTime, ch.impactTime)
      const startX = MUZZLE_X
      const startY = MUZZLE_Y
      const targetX = ch.x
      const targetY = ch.y

      // Parabolic arc upward
      const curX = lerp(startX, targetX, p)
      const baseLinearY = lerp(startY, targetY, p)
      const arcOffset = -Math.sin(p * Math.PI) * 110
      const curY = baseLinearY + arcOffset

      // Trail of star particles
      for (let k = 1; k <= 5; k++) {
        const tp = Math.max(0, p - k * 0.04)
        const tx = lerp(startX, targetX, tp)
        const ty = lerp(startY, targetY, tp) - Math.sin(tp * Math.PI) * 110
        const alpha = (1 - k / 6) * 0.7
        ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`
        ctx.beginPath()
        ctx.arc(tx, ty, 6 - k * 0.8, 0, Math.PI * 2)
        ctx.fill()
      }

      // Projectile body: Glowing magical cannon orb
      ctx.save()
      ctx.translate(curX, curY)

      // Glow halo
      const radGlow = ctx.createRadialGradient(0, 0, 4, 0, 0, 28)
      radGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
      radGlow.addColorStop(0.3, ch.colorLight)
      radGlow.addColorStop(0.7, ch.color)
      radGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = radGlow
      ctx.beginPath()
      ctx.arc(0, 0, 28, 0, Math.PI * 2)
      ctx.fill()

      // Core cannonball
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(0, 0, 11, 0, Math.PI * 2)
      ctx.fill()

      // Spinning spark stars
      ctx.rotate(t * 15)
      ctx.fillStyle = ch.colorLight
      for (let s = 0; s < 4; s++) {
        const sa = (s * Math.PI) / 2
        ctx.beginPath()
        ctx.arc(Math.cos(sa) * 16, Math.sin(sa) * 16, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }
  }
}

function drawChoreBoardAndItems(ctx: CanvasRenderingContext2D, t: number) {
  drawClotheslineAndHeader(ctx)

  for (const ch of CHORES) {
    if (t < ch.impactTime) {
      drawChorePaper(ctx, ch, t)
    } else {
      drawBalloonChore(ctx, ch, t)
    }
  }
}

function drawClotheslineAndHeader(ctx: CanvasRenderingContext2D) {
  ctx.save()

  // Overhead wooden title plaque
  const boardW = 540
  const boardH = 50
  const boardX = 880 - boardW / 2
  const boardY = 120

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.beginPath()
  ctx.roundRect(boardX + 4, boardY + 6, boardW, boardH, 12)
  ctx.fill()

  // Wood plank
  const wGrad = ctx.createLinearGradient(0, boardY, 0, boardY + boardH)
  wGrad.addColorStop(0, '#b45309')
  wGrad.addColorStop(0.5, '#78350f')
  wGrad.addColorStop(1, '#451a03')
  ctx.fillStyle = wGrad
  ctx.beginPath()
  ctx.roundRect(boardX, boardY, boardW, boardH, 12)
  ctx.fill()
  ctx.strokeStyle = '#fef3c7'
  ctx.lineWidth = 3
  ctx.stroke()

  // Plaque nails
  ctx.fillStyle = '#fde68a'
  ctx.beginPath()
  ctx.arc(boardX + 16, boardY + boardH / 2, 4, 0, Math.PI * 2)
  ctx.arc(boardX + boardW - 16, boardY + boardH / 2, 4, 0, Math.PI * 2)
  ctx.fill()

  // Plaque text
  ctx.fillStyle = '#fef3c7'
  ctx.font = '900 22px ui-rounded, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = 4
  ctx.fillText("📋 TODAY'S TO-DO CHORES", boardX + boardW / 2, boardY + boardH / 2 + 1)
  ctx.shadowBlur = 0

  // Hanging ropes holding the line
  ctx.strokeStyle = '#92400e'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(630, 0)
  ctx.lineTo(650, 200)
  ctx.moveTo(1140, 0)
  ctx.lineTo(1120, 200)
  ctx.stroke()

  // Main sagging clothesline
  ctx.beginPath()
  ctx.moveTo(640, 200)
  ctx.quadraticCurveTo(880, 240, 1130, 200)
  ctx.stroke()

  ctx.restore()
}

function drawChorePaper(ctx: CanvasRenderingContext2D, ch: ChoreData, t: number) {
  ctx.save()
  const sway = Math.sin(t * 3.5 + ch.id * 1.8) * 0.05
  ctx.translate(ch.x, ch.y)
  ctx.rotate(sway)

  // Peg / clip at top
  ctx.fillStyle = '#b45309'
  ctx.fillRect(-6, -65, 12, 18)

  // Paper drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
  ctx.beginPath()
  ctx.roundRect(-46, -46, 100, 115, 6)
  ctx.fill()

  // Parchment paper sheet
  ctx.fillStyle = '#fffdf7'
  ctx.beginPath()
  ctx.roundRect(-50, -50, 100, 115, 6)
  ctx.fill()
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Paper notebook horizontal lines
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  for (let l = -20; l <= 45; l += 15) {
    ctx.beginPath()
    ctx.moveTo(-42, l)
    ctx.lineTo(42, l)
    ctx.stroke()
  }

  // Red notebook margin line
  ctx.strokeStyle = '#fca5a5'
  ctx.beginPath()
  ctx.moveTo(-26, -45)
  ctx.lineTo(-26, 60)
  ctx.stroke()

  // Icon & Chore text
  ctx.font = '28px serif'
  ctx.textAlign = 'center'
  ctx.fillText(ch.icon, 0, -18)

  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 12px ui-rounded, sans-serif'
  ctx.fillText(ch.title, 0, 15)

  // Unchecked square checkbox on the chore paper
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 2.5
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(-13, 24, 26, 26, 5)
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}

function drawBalloonChore(ctx: CanvasRenderingContext2D, ch: ChoreData, t: number) {
  const dt = t - ch.impactTime

  // 1. IMPACT STARBURST (first 0.35s)
  if (dt < 0.35) {
    const ip = dt / 0.35
    ctx.save()
    ctx.translate(ch.x, ch.y)
    ctx.scale(1 + ip * 0.8, 1 + ip * 0.8)
    ctx.fillStyle = `rgba(254, 240, 138, ${1 - ip})`
    ctx.beginPath()
    for (let i = 0; i < 16; i++) {
      const r = i % 2 === 0 ? 55 : 20
      const a = (i * Math.PI) / 8
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  // 2. BALLOON GROWTH & ASCENT
  const inflP = clamp(dt / 0.45, 0, 1)
  const inflScale = easeOutElastic(inflP)

  const floatDelay = 0.2
  const floatTime = Math.max(0, dt - floatDelay)
  const floatDist = Math.pow(floatTime, 1.45) * 115
  const curY = ch.y - floatDist

  const sway = Math.sin(dt * 3.5 + ch.id * 2) * (14 + floatTime * 8)
  const curX = ch.x + sway
  const tilt = Math.sin(dt * 3.5 + ch.id * 2) * 0.12

  ctx.save()
  ctx.translate(curX, curY)
  ctx.rotate(tilt)
  ctx.scale(inflScale * ch.balloonScale, inflScale * ch.balloonScale)

  // --- BALLOON STRING ---
  ctx.save()
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.75)'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(0, 58)
  const strWave = Math.sin(dt * 6) * 12
  ctx.bezierCurveTo(strWave, 85, -strWave, 115, strWave * 0.5, 145)
  ctx.stroke()
  ctx.restore()

  // --- BALLOON KNOT ---
  ctx.fillStyle = ch.knotColor
  ctx.beginPath()
  ctx.moveTo(-8, 54)
  ctx.lineTo(8, 54)
  ctx.lineTo(0, 62)
  ctx.closePath()
  ctx.fill()

  // --- BALLOON BODY ---
  ctx.beginPath()
  ctx.moveTo(0, 56)
  ctx.bezierCurveTo(42, 52, 54, 20, 52, -12)
  ctx.bezierCurveTo(50, -52, 28, -68, 0, -68)
  ctx.bezierCurveTo(-28, -68, -50, -52, -52, -12)
  ctx.bezierCurveTo(-54, 20, -42, 52, 0, 56)
  ctx.closePath()

  // 3D Depth gradient
  const bGrad = ctx.createRadialGradient(-18, -26, 6, 0, 0, 68)
  bGrad.addColorStop(0, ch.colorLight)
  bGrad.addColorStop(0.55, ch.color)
  bGrad.addColorStop(1, ch.colorDark)
  ctx.fillStyle = bGrad
  ctx.fill()

  // Glossy specular highlight crescent
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(-22, -32, 14, 26, -0.4, 0, Math.PI * 2)
  ctx.fill()

  // Soft secondary reflection
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.beginPath()
  ctx.ellipse(26, 20, 8, 16, 0.5, 0, Math.PI * 2)
  ctx.fill()

  // Chore icon
  ctx.font = '26px serif'
  ctx.textAlign = 'center'
  ctx.fillText(ch.icon, 0, -8)

  // Chore title
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 13px ui-rounded, sans-serif'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 4
  ctx.fillText(ch.title, 0, 14)
  ctx.shadowBlur = 0

  // Square checkbox stamped into a green checkmark [✔]
  ctx.save()
  ctx.translate(0, 34)
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.roundRect(-12, -12, 24, 24, 5)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-5, 0)
  ctx.lineTo(-1, 4)
  ctx.lineTo(6, -4)
  ctx.stroke()
  ctx.restore()

  ctx.restore()
}

function drawCelebrationBanner(ctx: CanvasRenderingContext2D, t: number) {
  const bannerStartTime = 4.6
  if (t < bannerStartTime) return

  const dt = t - bannerStartTime
  const dropP = clamp(dt / 0.6, 0, 1)
  const bannerY = lerp(-220, 175, easeOutBounce(dropP))

  // Confetti shower
  drawConfettiShower(ctx, t, bannerStartTime)

  ctx.save()
  ctx.translate(V_W / 2, bannerY)

  // Gentle joyful wobble
  const wobble = Math.sin(dt * 4) * Math.max(0, 1 - dt * 0.3) * 0.04
  ctx.rotate(wobble)

  // Ribbon background drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.roundRect(-440 + 8, -55 + 10, 880, 110, 24)
  ctx.fill()

  // Main Ribbon Banner Box
  const ribGrad = ctx.createLinearGradient(0, -55, 0, 55)
  ribGrad.addColorStop(0, '#fef08a')
  ribGrad.addColorStop(0.25, '#fef9c3')
  ribGrad.addColorStop(0.8, '#fde047')
  ribGrad.addColorStop(1, '#eab308')

  ctx.fillStyle = ribGrad
  ctx.beginPath()
  ctx.roundRect(-440, -55, 880, 110, 24)
  ctx.fill()

  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 5
  ctx.stroke()

  // Golden outer outline
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 2.5
  ctx.stroke()

  // Decorative edge sparkles and balloons
  ctx.font = '30px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✨', -385, -12)
  ctx.fillText('🎈', -385, 20)
  ctx.fillText('✨', 385, -12)
  ctx.fillText('🎈', 385, 20)

  // Main Pun Headline: "CHORES ARE BLOWN AWAY!"
  ctx.fillStyle = '#1e1b4b'
  ctx.font = '900 56px ui-rounded, "Arial Rounded MT Bold", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(245, 158, 11, 0.45)'
  ctx.shadowBlur = 14
  ctx.fillText('CHORES ARE BLOWN AWAY!', 0, 4)
  ctx.shadowBlur = 0

  ctx.restore()
}

function drawConfettiShower(ctx: CanvasRenderingContext2D, t: number, startTime: number) {
  const dt = t - startTime
  ctx.save()
  for (let i = 0; i < 75; i++) {
    const seed = i * 137.5
    const speed = 160 + (i % 5) * 45
    const cx = (seed + i * 37) % V_W
    const cy = ((dt * speed + i * 45) % (V_H + 100)) - 50
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const rot = dt * 5 + i
    const sz = 8 + (i % 4) * 3

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    ctx.fillStyle = color
    ctx.fillRect(-sz / 2, -sz / 4, sz, sz / 2)
    ctx.restore()
  }
  ctx.restore()
}

function renderScene(ctx: CanvasRenderingContext2D, t: number) {
  drawBackground(ctx, t)
  drawChoreBoardAndItems(ctx, t)
  drawCannon(ctx, t)
  drawProjectiles(ctx, t)
  drawCelebrationBanner(ctx, t)
}

// =============================================================================
// RUNNER ENTRY POINT
// =============================================================================

export const balloonCannonRun = (canvas: HTMLCanvasElement): (() => void) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let rafId = 0
  const startTime = performance.now()

  const loop = (now: number) => {
    const t = (now - startTime) / 1000

    const dpr = window.devicePixelRatio || 1
    const cw = canvas.clientWidth
    const ch = canvas.clientHeight
    const targetW = Math.floor(cw * dpr)
    const targetH = Math.floor(ch * dpr)

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }

    const scale = Math.min(targetW / V_W, targetH / V_H)
    const offsetX = (targetW - V_W * scale) / 2
    const offsetY = (targetH - V_H * scale) / 2

    ctx.save()
    ctx.clearRect(0, 0, targetW, targetH)
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)

    renderScene(ctx, t)

    ctx.restore()

    if (t < TOTAL_DURATION) {
      rafId = requestAnimationFrame(loop)
    }
  }

  rafId = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(rafId)
  }
}
