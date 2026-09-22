/**
 * Wrecking Ball Chores Demolition Celebration Animation
 * Canvas 2D Chore Completion Animation (~7.5 seconds)
 *
 * Sequence:
 * 1. Intact 6-story building with bold vertical letters: C · H · O · R · E · S
 *    Heavy construction crane on right with wrecking ball held in tension.
 * 2. Powerful forward swing across an accelerating pendulum arc.
 * 3. Smash impact right into building wall at middle stories with shockwave,
 *    starburst flash, screen shake, and wall fractures.
 * 4. Building collapses into tumbling rubble, letters cascade down, and
 *    billowing dust clouds rise. Ball recoils with damped oscillation.
 * 5. Industrial hazard-striped "CHORES DEMOLISHED" construction banner drops
 *    down with bounce easing and confetti shower.
 */

export const V_W = 1280
export const V_H = 720
export const TOTAL_DURATION = 7.5
const GROUND_Y = 590

// =============================================================================
// EASING & MATH UTILITIES
// =============================================================================

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const phase = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1)

const easeOutBounce = (t: number) => {
  const n1 = 7.5625
  const d1 = 2.75
  let tt = t
  if (tt < 1 / d1) return n1 * tt * tt
  if (tt < 2 / d1) return n1 * (tt -= 1.5 / d1) * tt + 0.75
  if (tt < 2.5 / d1) return n1 * (tt -= 2.25 / d1) * tt + 0.9375
  return n1 * (tt -= 2.625 / d1) * tt + 0.984375
}

const easeInCubic = (t: number) => t * t * t

// =============================================================================
// SCENE DATA & CONFIGURATION
// =============================================================================

// Building Specs
const BLDG_X = 420 // Center X
const BLDG_W = 220 // Total Width (left wall at 310, right wall at 530)
const FLOOR_H = 68 // Height per story (6 stories = 408px)
const BLDG_BOTTOM = GROUND_Y
const BLDG_TOP = BLDG_BOTTOM - FLOOR_H * 6 // ~182

interface FloorInfo {
  id: number
  letter: string
  yOffset: number
  color: string
}

// 6 Letters stacked vertically: C at top (floor 5), S at bottom (floor 0)
const FLOORS: FloorInfo[] = [
  { id: 5, letter: 'C', yOffset: 0, color: '#f87171' }, // Top
  { id: 4, letter: 'H', yOffset: 1, color: '#fb923c' },
  { id: 3, letter: 'O', yOffset: 2, color: '#facc15' },
  { id: 2, letter: 'R', yOffset: 3, color: '#4ade80' },
  { id: 1, letter: 'E', yOffset: 4, color: '#38bdf8' },
  { id: 0, letter: 'S', yOffset: 5, color: '#a78bfa' }, // Bottom
]

// Crane & Wrecking Ball Specs
const CRANE_X = 1040
const CRANE_BASE_Y = GROUND_Y
const PIVOT_X = 850 // Crane Boom Tip Pivot Point
const PIVOT_Y = 90
const CABLE_LENGTH = 430
const BALL_RADIUS = 46

// Swing Timings:
// 0.0s - 1.1s: Tension pull-back (angle ~49 deg to the right)
// 1.1s - 2.0s: Powerful forward swing towards left building!
// 2.0s: Impact! Ball smashes into building wall at x = 530
// 2.0s - 3.5s: Recoil, dampening oscillation
const SWING_START_TIME = 1.1
const IMPACT_TIME = 2.0

interface DebrisBlock {
  id: number
  floor: number
  w: number
  h: number
  color: string
  vx: number
  vy: number
  rotSpeed: number
  groundOffset: number
}

// Debris fragments generated deterministically
const DEBRIS_BLOCKS: DebrisBlock[] = []
for (let i = 0; i < 45; i++) {
  const seed = i * 49.33
  DEBRIS_BLOCKS.push({
    id: i,
    floor: i % 6,
    w: 18 + (i % 5) * 8,
    h: 14 + (i % 4) * 6,
    color: i % 3 === 0 ? '#cbd5e1' : i % 3 === 1 ? '#94a3b8' : '#64748b',
    vx: -180 + ((seed * 13) % 360),
    vy: -220 - ((seed * 17) % 280),
    rotSpeed: -8 + ((seed * 7) % 16),
    groundOffset: -8 + ((seed * 11) % 16),
  })
}

// Clouds
const CLOUDS = [
  { x: 120, y: 90, s: 0.9, speed: 8 },
  { x: 520, y: 70, s: 1.15, speed: 6 },
  { x: 920, y: 110, s: 0.85, speed: 10 },
  { x: 1200, y: 80, s: 0.75, speed: 7 },
]

// =============================================================================
// DRAWING ROUTINES
// =============================================================================

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.82)'
  ctx.beginPath()
  ctx.arc(0, 0, 36, 0, Math.PI * 2)
  ctx.arc(32, -12, 30, 0, Math.PI * 2)
  ctx.arc(70, 0, 34, 0, Math.PI * 2)
  ctx.arc(38, 14, 28, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawTrafficCone(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  // Base
  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.roundRect(-14, -4, 28, 6, 2)
  ctx.fill()
  // Orange cone body
  ctx.beginPath()
  ctx.moveTo(-10, -4)
  ctx.lineTo(0, -32)
  ctx.lineTo(10, -4)
  ctx.closePath()
  ctx.fill()
  // White reflective stripes
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-6, -18, 12, 4)
  ctx.fillRect(-4, -25, 8, 3)
  ctx.restore()
}

function drawBarricade(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  // Legs
  ctx.fillStyle = '#64748b'
  ctx.fillRect(-35, -45, 6, 45)
  ctx.fillRect(29, -45, 6, 45)
  // Board with hazard stripes
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(-42, -45, 84, 18, 3)
  ctx.clip()
  ctx.fillStyle = '#eab308'
  ctx.fillRect(-42, -45, 84, 18)
  ctx.fillStyle = '#0f172a'
  for (let i = -60; i < 60; i += 20) {
    ctx.beginPath()
    ctx.moveTo(i, -45)
    ctx.lineTo(i + 14, -45)
    ctx.lineTo(i + 4, -27)
    ctx.lineTo(i - 10, -27)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
  ctx.restore()
}

function drawGroundDetails(ctx: CanvasRenderingContext2D) {
  const conePositions = [120, 210, 640, 750, 1180]
  for (const cx of conePositions) {
    drawTrafficCone(ctx, cx, GROUND_Y)
  }
  drawBarricade(ctx, 160, GROUND_Y)
}

function drawBackground(ctx: CanvasRenderingContext2D, t: number) {
  // Sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, V_H)
  skyGrad.addColorStop(0, '#38bdf8')
  skyGrad.addColorStop(0.5, '#93c5fd')
  skyGrad.addColorStop(0.85, '#fed7aa')
  skyGrad.addColorStop(1, '#ffedd5')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, V_W, V_H)

  // Sun
  ctx.save()
  ctx.beginPath()
  ctx.arc(220, 110, 48, 0, Math.PI * 2)
  ctx.fillStyle = '#fef08a'
  ctx.shadowColor = '#fde047'
  ctx.shadowBlur = 30
  ctx.fill()
  ctx.restore()

  // Distant City Skyline
  ctx.fillStyle = '#93c5fd'
  ctx.beginPath()
  ctx.rect(40, 430, 90, 160)
  ctx.rect(150, 390, 70, 200)
  ctx.rect(240, 450, 80, 140)
  ctx.rect(640, 420, 110, 170)
  ctx.rect(770, 400, 85, 190)
  ctx.rect(880, 460, 95, 130)
  ctx.fill()

  // Clouds
  for (const cl of CLOUDS) {
    const cx = ((cl.x + t * cl.speed) % (V_W + 240)) - 120
    drawCloud(ctx, cx, cl.y, cl.s)
  }

  // Ground: Construction Site Foundation
  const gGrad = ctx.createLinearGradient(0, GROUND_Y, 0, V_H)
  gGrad.addColorStop(0, '#475569')
  gGrad.addColorStop(0.08, '#334155')
  gGrad.addColorStop(1, '#1e293b')
  ctx.fillStyle = gGrad
  ctx.fillRect(0, GROUND_Y, V_W, V_H - GROUND_Y)

  // Yellow Ground Safety Line
  ctx.fillStyle = '#eab308'
  ctx.fillRect(0, GROUND_Y, V_W, 6)

  drawGroundDetails(ctx)
}

function drawFloorLetterTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  letter: string,
  color: string,
  scale: number,
  rot: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.scale(scale, scale)

  // Letter Tile Box
  const boxW = 56
  const boxH = 50
  ctx.fillStyle = '#1e293b'
  ctx.beginPath()
  ctx.roundRect(-boxW / 2 + 2, -boxH / 2 + 3, boxW, boxH, 8)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fill()

  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 8)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.stroke()

  // Letter Glyph
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 36px ui-rounded, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = color
  ctx.shadowBlur = 10
  ctx.fillText(letter, 0, 2)
  ctx.shadowBlur = 0

  ctx.restore()
}

function drawIntactBuilding(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save()
  const bLeft = BLDG_X - BLDG_W / 2

  // Drop shadow on ground
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  ctx.beginPath()
  ctx.ellipse(BLDG_X, GROUND_Y + 4, BLDG_W * 0.65, 14, 0, 0, Math.PI * 2)
  ctx.fill()

  // Main Building Body Block
  const bGrad = ctx.createLinearGradient(bLeft, 0, bLeft + BLDG_W, 0)
  bGrad.addColorStop(0, '#e2e8f0')
  bGrad.addColorStop(0.2, '#f8fafc')
  bGrad.addColorStop(0.7, '#cbd5e1')
  bGrad.addColorStop(1, '#94a3b8')
  ctx.fillStyle = bGrad
  ctx.beginPath()
  ctx.roundRect(bLeft, BLDG_TOP, BLDG_W, FLOOR_H * 6, 8)
  ctx.fill()
  ctx.strokeStyle = '#475569'
  ctx.lineWidth = 3
  ctx.stroke()

  // Roof Antenna
  ctx.strokeStyle = '#64748b'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(BLDG_X, BLDG_TOP)
  ctx.lineTo(BLDG_X, BLDG_TOP - 36)
  ctx.stroke()
  // Beacon light
  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.arc(BLDG_X, BLDG_TOP - 36, 5 + Math.sin(t * 10) * 1.5, 0, Math.PI * 2)
  ctx.fill()

  // Floors with vertical letters
  for (const fl of FLOORS) {
    const fy = BLDG_TOP + fl.yOffset * FLOOR_H

    // Story divider ledge
    ctx.fillStyle = '#64748b'
    ctx.fillRect(bLeft - 4, fy, BLDG_W + 8, 4)

    // Windows
    ctx.fillStyle = '#0284c7'
    ctx.fillRect(bLeft + 16, fy + 14, 30, 40)
    ctx.fillRect(bLeft + BLDG_W - 46, fy + 14, 30, 40)

    // Window shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.fillRect(bLeft + 18, fy + 16, 12, 36)
    ctx.fillRect(bLeft + BLDG_W - 44, fy + 16, 12, 36)

    // Center Letter Tile
    drawFloorLetterTile(ctx, BLDG_X, fy + FLOOR_H / 2, fl.letter, fl.color, 1.0, 0)
  }

  ctx.restore()
}

function drawDemolitionDust(ctx: CanvasRenderingContext2D, dt: number) {
  if (dt <= 0) return
  const dustAlpha = clamp(1 - (dt - 0.2) / 2.6, 0, 0.85)
  if (dustAlpha <= 0) return

  ctx.save()
  const pCount = 14
  for (let i = 0; i < pCount; i++) {
    const seed = i * 27.8
    const dx = BLDG_X - 160 + ((seed * 19) % 320)
    const expand = Math.min(dt * 90, 140)
    const dy = GROUND_Y - 15 - expand * 0.45 - ((seed * 11) % 40)
    const radius = 25 + expand * 0.65

    ctx.fillStyle = `rgba(226, 232, 240, ${dustAlpha * 0.55})`
    ctx.beginPath()
    ctx.arc(dx, dy, radius, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = `rgba(203, 213, 225, ${dustAlpha * 0.75})`
    ctx.beginPath()
    ctx.arc(dx + 12, dy - 8, radius * 0.75, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawCollapsingBuilding(ctx: CanvasRenderingContext2D, dt: number) {
  ctx.save()

  // Fracture cracks propagating inward from right wall impact point (530, 386)
  if (dt < 0.4) {
    const cp = dt / 0.4
    ctx.save()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 5 * (1 - cp)
    ctx.beginPath()
    ctx.moveTo(BLDG_X + BLDG_W / 2, BLDG_TOP + 3 * FLOOR_H)
    ctx.lineTo(BLDG_X + 20, BLDG_TOP + 3 * FLOOR_H - 10)
    ctx.lineTo(BLDG_X - 20, BLDG_TOP + 2 * FLOOR_H)
    ctx.lineTo(BLDG_X - 60, BLDG_TOP + FLOOR_H)
    ctx.moveTo(BLDG_X + 20, BLDG_TOP + 3 * FLOOR_H - 10)
    ctx.lineTo(BLDG_X + 10, BLDG_TOP + 5 * FLOOR_H)
    ctx.stroke()
    ctx.restore()
  }

  // Debris blocks scattering and falling
  for (const deb of DEBRIS_BLOCKS) {
    const fallT = dt
    const curX = BLDG_X + deb.vx * fallT * 0.7
    const gravity = 480
    const curY = BLDG_TOP + deb.floor * FLOOR_H + deb.vy * fallT * 0.5 + 0.5 * gravity * fallT * fallT
    const finalY = GROUND_Y - deb.h / 2 + deb.groundOffset

    const renderY = Math.min(curY, finalY)
    const rot = deb.rotSpeed * Math.min(fallT, 1.2)

    ctx.save()
    ctx.translate(curX, renderY)
    ctx.rotate(rot)
    ctx.fillStyle = deb.color
    ctx.beginPath()
    ctx.roundRect(-deb.w / 2, -deb.h / 2, deb.w, deb.h, 3)
    ctx.fill()
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  // Collapsing floor tiles with letters tumbling down
  for (const fl of FLOORS) {
    const origY = BLDG_TOP + fl.yOffset * FLOOR_H + FLOOR_H / 2
    const delay = Math.abs(fl.id - 3) * 0.08
    const localT = Math.max(0, dt - delay)

    const gravity = 550
    const fallDist = 0.5 * gravity * localT * localT
    const lateralDrift = Math.sin(fl.id * 1.5) * (localT * 85)
    const targetGround = GROUND_Y - 26 + (fl.id % 3) * 8

    const curY = Math.min(origY + fallDist, targetGround)
    const curX = BLDG_X + lateralDrift
    const rot = (fl.id % 2 === 0 ? 1 : -1) * Math.min(localT * 4, 1.8)

    drawFloorLetterTile(ctx, curX, curY, fl.letter, fl.color, 1.0, rot)
  }

  drawDemolitionDust(ctx, dt)

  ctx.restore()
}

function drawBuilding(ctx: CanvasRenderingContext2D, t: number) {
  const isPostImpact = t >= IMPACT_TIME
  const dt = Math.max(0, t - IMPACT_TIME)

  if (!isPostImpact) {
    drawIntactBuilding(ctx, t)
  } else {
    drawCollapsingBuilding(ctx, dt)
  }
}

function drawCraneStructure(ctx: CanvasRenderingContext2D) {
  ctx.save()

  // Base & crawler tracks
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect(CRANE_X - 65, CRANE_BASE_Y - 35, 130, 35, 8)
  ctx.fill()

  // Yellow Cab
  ctx.fillStyle = '#f59e0b'
  ctx.beginPath()
  ctx.roundRect(CRANE_X - 45, CRANE_BASE_Y - 95, 90, 65, 8)
  ctx.fill()
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 3
  ctx.stroke()

  // Cab Windows
  ctx.fillStyle = '#0284c7'
  ctx.fillRect(CRANE_X - 35, CRANE_BASE_Y - 85, 35, 30)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.fillRect(CRANE_X - 32, CRANE_BASE_Y - 82, 10, 24)

  // Counterweight
  ctx.fillStyle = '#334155'
  ctx.fillRect(CRANE_X + 25, CRANE_BASE_Y - 80, 35, 45)

  // Lattice Boom Jib
  const boomBaseX = CRANE_X - 15
  const boomBaseY = CRANE_BASE_Y - 85

  ctx.strokeStyle = '#eab308'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(boomBaseX, boomBaseY)
  ctx.lineTo(PIVOT_X, PIVOT_Y)
  ctx.stroke()

  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(boomBaseX - 12, boomBaseY + 18)
  ctx.lineTo(PIVOT_X + 12, PIVOT_Y + 16)
  ctx.stroke()

  // Lattice Cross Bracing
  ctx.strokeStyle = '#ca8a04'
  ctx.lineWidth = 2.5
  const steps = 8
  for (let i = 0; i < steps; i++) {
    const p1 = i / steps
    const p2 = (i + 1) / steps
    const x1 = lerp(boomBaseX, PIVOT_X, p1)
    const y1 = lerp(boomBaseY, PIVOT_Y, p1)
    const x2 = lerp(boomBaseX - 12, PIVOT_X + 12, p2)
    const y2 = lerp(boomBaseY + 18, PIVOT_Y + 16, p2)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  // Boom Tip Pulley Sheave
  ctx.beginPath()
  ctx.arc(PIVOT_X, PIVOT_Y, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#0f172a'
  ctx.fill()
  ctx.strokeStyle = '#eab308'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.restore()
}

function drawWreckingBall(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)

  // Drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.beginPath()
  ctx.ellipse(0, GROUND_Y - y + 10, BALL_RADIUS * 0.9, 14, 0, 0, Math.PI * 2)
  ctx.fill()

  // Shackle
  ctx.fillStyle = '#334155'
  ctx.beginPath()
  ctx.roundRect(-10, -BALL_RADIUS - 16, 20, 20, 4)
  ctx.fill()
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 2
  ctx.stroke()

  // Heavy Cast Iron Sphere
  const bGrad = ctx.createRadialGradient(-14, -16, 4, 0, 0, BALL_RADIUS)
  bGrad.addColorStop(0, '#94a3b8')
  bGrad.addColorStop(0.35, '#475569')
  bGrad.addColorStop(0.8, '#1e293b')
  bGrad.addColorStop(1, '#090d16')
  ctx.fillStyle = bGrad
  ctx.beginPath()
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2)
  ctx.fill()

  // Outline
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 3.5
  ctx.stroke()

  // Equatorial seam
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(0, 0, BALL_RADIUS - 2, BALL_RADIUS * 0.35, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Specular sheen
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.beginPath()
  ctx.ellipse(-16, -18, 12, 7, -0.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawImpactBurst(ctx: CanvasRenderingContext2D, x: number, y: number, p: number) {
  ctx.save()
  ctx.translate(x, y)

  // Expanding shockwave
  const ringR = p * 120
  ctx.strokeStyle = `rgba(254, 240, 138, ${1 - p})`
  ctx.lineWidth = 6 * (1 - p)
  ctx.beginPath()
  ctx.arc(0, 0, ringR, 0, Math.PI * 2)
  ctx.stroke()

  // Starburst
  ctx.fillStyle = `rgba(255, 255, 255, ${1 - p})`
  ctx.beginPath()
  for (let i = 0; i < 12; i++) {
    const r = i % 2 === 0 ? 65 * (1 - p * 0.5) : 22 * (1 - p * 0.5)
    const a = (i * Math.PI) / 6
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  ctx.closePath()
  ctx.fill()

  // Sparks
  for (let s = 0; s < 16; s++) {
    const sa = (s * Math.PI) / 8 + p * 2
    const sDist = p * 110 + (s % 4) * 15
    const sx = Math.cos(sa) * sDist
    const sy = Math.sin(sa) * sDist
    ctx.fillStyle = s % 2 === 0 ? '#fbbf24' : '#ef4444'
    ctx.beginPath()
    ctx.arc(sx, sy, 3.5 * (1 - p), 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

function drawCraneAndWreckingBall(ctx: CanvasRenderingContext2D, t: number) {
  drawCraneStructure(ctx)

  // Pendulum Angle Calculation
  let angle = 0

  if (t < SWING_START_TIME) {
    angle = 0.85 // Pulled back high to the right
  } else if (t < IMPACT_TIME) {
    const p = phase(t, SWING_START_TIME, IMPACT_TIME)
    const swingP = easeInCubic(p)
    angle = lerp(0.85, -0.82, swingP) // Accelerating swing to wall impact point
  } else {
    // Post-impact damped oscillation
    const dt = t - IMPACT_TIME
    const decay = Math.exp(-dt * 1.5)
    const rebound = 0.45 * Math.sin(dt * 4.5)
    angle = -0.82 * Math.exp(-dt * 3.5) + rebound * decay
  }

  const ballX = PIVOT_X + Math.sin(angle) * CABLE_LENGTH
  const ballY = PIVOT_Y + Math.cos(angle) * CABLE_LENGTH

  // Cable
  ctx.save()
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(PIVOT_X, PIVOT_Y)
  ctx.lineTo(ballX, ballY)
  ctx.stroke()

  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(PIVOT_X, PIVOT_Y)
  ctx.lineTo(ballX, ballY)
  ctx.stroke()
  ctx.restore()

  // Motion blur streak
  if (t > 1.35 && t < 2.15) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.lineWidth = 3
    ctx.beginPath()
    const prevAngle = angle + 0.18
    const px = PIVOT_X + Math.sin(prevAngle) * CABLE_LENGTH
    const py = PIVOT_Y + Math.cos(prevAngle) * CABLE_LENGTH
    ctx.moveTo(px, py)
    ctx.quadraticCurveTo((px + ballX) / 2 + 10, (py + ballY) / 2 - 10, ballX, ballY)
    ctx.stroke()
    ctx.restore()
  }

  drawWreckingBall(ctx, ballX, ballY)

  // Impact Flash & Sparks
  if (t >= IMPACT_TIME && t < IMPACT_TIME + 0.45) {
    const ip = (t - IMPACT_TIME) / 0.45
    drawImpactBurst(ctx, ballX - 15, ballY, ip)
  }
}

function drawHazardStripeBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  offset: number,
) {
  ctx.save()
  ctx.fillStyle = '#eab308'
  ctx.fillRect(x, y, w, h)

  ctx.fillStyle = '#0f172a'
  const stripeW = 22
  const shift = (offset * 20) % (stripeW * 2)
  for (let px = x - stripeW * 2; px < x + w + stripeW * 2; px += stripeW * 2) {
    ctx.beginPath()
    ctx.moveTo(px + shift, y)
    ctx.lineTo(px + stripeW + shift, y)
    ctx.lineTo(px + stripeW - 14 + shift, y + h)
    ctx.lineTo(px - 14 + shift, y + h)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

const CONFETTI_COLORS = ['#f59e0b', '#eab308', '#ef4444', '#38bdf8', '#22c55e', '#ffffff']
function drawConstructionConfetti(ctx: CanvasRenderingContext2D, t: number, startTime: number) {
  const dt = t - startTime
  ctx.save()
  for (let i = 0; i < 70; i++) {
    const seed = i * 131.7
    const speed = 150 + (i % 6) * 35
    const cx = (seed + i * 41) % V_W
    const cy = ((dt * speed + i * 40) % (V_H + 80)) - 40
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const rot = dt * 4 + i
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

function drawDemolishedBanner(ctx: CanvasRenderingContext2D, t: number) {
  const bannerStartTime = 4.2
  if (t < bannerStartTime) return

  const dt = t - bannerStartTime
  const dropP = clamp(dt / 0.65, 0, 1)
  const bannerY = lerp(-220, 190, easeOutBounce(dropP))

  drawConstructionConfetti(ctx, t, bannerStartTime)

  ctx.save()
  ctx.translate(V_W / 2, bannerY)

  const wobble = Math.sin(dt * 4.5) * Math.max(0, 1 - dt * 0.35) * 0.035
  ctx.rotate(wobble)

  const bannerW = 860
  const bannerH = 120

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.beginPath()
  ctx.roundRect(-bannerW / 2 + 8, -bannerH / 2 + 10, bannerW, bannerH, 18)
  ctx.fill()

  // Clipped Main Body
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 18)
  ctx.clip()

  ctx.fillStyle = '#0f172a'
  ctx.fillRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH)

  const stripeH = 22
  drawHazardStripeBar(ctx, -bannerW / 2, -bannerH / 2, bannerW, stripeH, dt)
  drawHazardStripeBar(ctx, -bannerW / 2, bannerH / 2 - stripeH, bannerW, stripeH, -dt)

  ctx.restore()

  // Border
  ctx.strokeStyle = '#eab308'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.roundRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 18)
  ctx.stroke()

  // Rivets
  const rivetOffsets = [
    [-bannerW / 2 + 18, -bannerH / 2 + 18],
    [bannerW / 2 - 18, -bannerH / 2 + 18],
    [-bannerW / 2 + 18, bannerH / 2 - 18],
    [bannerW / 2 - 18, bannerH / 2 - 18],
  ]
  for (const [rx, ry] of rivetOffsets) {
    ctx.fillStyle = '#94a3b8'
    ctx.beginPath()
    ctx.arc(rx, ry, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Safety Emojis
  ctx.font = '36px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('⛑️', -bannerW / 2 + 65, 0)
  ctx.fillText('⛑️', bannerW / 2 - 65, 0)

  // Headline: "CHORES DEMOLISHED"
  ctx.save()
  ctx.font = '900 62px ui-rounded, "Arial Rounded MT Bold", Impact, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#78350f'
  ctx.fillText('CHORES DEMOLISHED', 0, 4)

  ctx.fillStyle = '#fef08a'
  ctx.shadowColor = 'rgba(234, 179, 8, 0.75)'
  ctx.shadowBlur = 18
  ctx.fillText('CHORES DEMOLISHED', 0, 0)
  ctx.restore()

  ctx.restore()
}

function renderScene(ctx: CanvasRenderingContext2D, t: number) {
  ctx.save()

  // Impact Screen Shake
  if (t >= IMPACT_TIME && t < IMPACT_TIME + 0.4) {
    const sp = 1 - (t - IMPACT_TIME) / 0.4
    const shakeX = Math.sin(t * 70) * 8 * sp
    const shakeY = Math.cos(t * 85) * 6 * sp
    ctx.translate(shakeX, shakeY)
  }

  drawBackground(ctx, t)
  drawBuilding(ctx, t)
  drawCraneAndWreckingBall(ctx, t)
  drawDemolishedBanner(ctx, t)

  ctx.restore()
}

// =============================================================================
// RUNNER ENTRY POINT
// =============================================================================

export const wreckingBallRun = (canvas: HTMLCanvasElement): (() => void) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  let rafId = 0
  const startTime = performance.now()

  // Cache dimensions to avoid layout thrashing in loop
  let targetW = 0
  let targetH = 0
  let scale = 1
  let offsetX = 0
  let offsetY = 0

  const updateSize = () => {
    const dpr = window.devicePixelRatio || 1
    const cw = canvas.clientWidth || window.innerWidth
    const ch = canvas.clientHeight || window.innerHeight
    targetW = Math.floor(cw * dpr)
    targetH = Math.floor(ch * dpr)

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
    }

    scale = Math.min(targetW / V_W, targetH / V_H)
    offsetX = (targetW - V_W * scale) / 2
    offsetY = (targetH - V_H * scale) / 2
  }

  updateSize()
  window.addEventListener('resize', updateSize)

  const loop = (now: number) => {
    const t = (now - startTime) / 1000

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
    window.removeEventListener('resize', updateSize)
    cancelAnimationFrame(rafId)
  }
}
