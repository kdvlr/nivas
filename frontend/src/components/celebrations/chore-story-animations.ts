/**
 * Chore Story Celebrations Engine
 * 20 Distinct Narrative Canvas 2D Celebrations (~7.6 seconds each)
 */

import type { Celebration } from './animations'

export const V_W = 1280
export const V_H = 720

// =============================================================================
// EASING & MATH UTILITIES
// =============================================================================

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const easeOutQuad = (t: number) => t * (2 - t)
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
export const easeOutBack = (t: number, s = 1.7) => {
  const t1 = t - 1
  return t1 * t1 * ((s + 1) * t1 + s) + 1
}
export const easeOutBounce = (t: number) => {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
  return n1 * (t -= 2.625 / d1) * t + 0.984375
}

// =============================================================================
// PROCEDURAL AUDIO SYNTHESIS (Web Audio API)
// =============================================================================

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem('nivas_celebration_sound') === 'true'
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('nivas_celebration_sound', enabled ? 'true' : 'false')
}

export class StorySoundFX {
  private ctx: AudioContext | null = null
  private lastTriggers: Record<string, boolean> = {}

  init(): void {
    if (!isSoundEnabled()) return
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AC) this.ctx = new AC()
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  tone(freq: number, dur = 0.15, type: OscillatorType = 'sine', gainVal = 0.25): void {
    if (!isSoundEnabled() || !this.ctx) return
    try {
      const now = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const g = this.ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, now)
      g.gain.setValueAtTime(gainVal, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + dur)
      osc.connect(g)
      g.connect(this.ctx.destination)
      osc.start(now)
      osc.stop(now + dur)
    } catch {
      // Audio autoplay policy catch
    }
  }

  chord(freqs: number[], dur = 0.7): void {
    freqs.forEach((f) => this.tone(f, dur, 'triangle', 0.2 / freqs.length))
  }

  noise(dur = 0.2, gainVal = 0.25, highpass = 500): void {
    if (!isSoundEnabled() || !this.ctx) return
    try {
      const now = this.ctx.currentTime
      const bufferSize = Math.floor(this.ctx.sampleRate * dur)
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4))
      }
      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'highpass'
      filter.frequency.value = highpass
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(gainVal, now)
      g.gain.exponentialRampToValueAtTime(0.001, now + dur)
      src.connect(filter)
      filter.connect(g)
      g.connect(this.ctx.destination)
      src.start(now)
    } catch {
      // Audio context cleanup safe
    }
  }

  playSlash(pitch = 380): void {
    this.tone(pitch, 0.12, 'sawtooth', 0.15)
    this.noise(0.08, 0.18, 1200)
  }

  playImpact(): void {
    this.tone(90, 0.25, 'sine', 0.4)
    this.noise(0.12, 0.3, 180)
  }

  playFanfare(): void {
    // Joyful pentatonic fanfare: D5, F#5, A5, D6
    this.chord([587.33, 739.99, 880.0, 1174.66], 0.9)
  }

  playWhoosh(): void {
    this.tone(200, 0.3, 'sine', 0.12)
  }

  reset(): void {
    this.lastTriggers = {}
  }

  triggerOnce(key: string, fn: () => void): void {
    if (!this.lastTriggers[key]) {
      this.lastTriggers[key] = true
      fn()
    }
  }

  destroy(): void {
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {})
    }
    this.ctx = null
    this.lastTriggers = {}
  }
}

// =============================================================================
// COMMON DRAWING PRIMITIVES
// =============================================================================

export function drawCheckmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  strokeW = 4,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.lineWidth = strokeW
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-size * 0.38, 0)
  ctx.lineTo(-size * 0.08, size * 0.35)
  ctx.lineTo(size * 0.45, -size * 0.38)
  ctx.stroke()
  ctx.restore()
}

export function drawTaskTiles(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  t: number,
  theme: { cardBg?: string; border?: string } = {},
): void {
  const isComplete = t >= 4.3
  const flipAnim = t >= 3.8 && t < 4.3 ? (t - 3.8) / 0.5 : isComplete ? 1 : 0
  const tiles = ['✓', '✓', '✓', isComplete ? '✓' : '□']

  ctx.save()
  ctx.translate(x, y)

  const tileW = 54
  const tileGap = 16
  const totalW = 4 * tileW + 3 * tileGap
  const startX = -totalW / 2 + tileW / 2

  // Backing pill bar
  ctx.fillStyle = theme.cardBg || 'rgba(15, 23, 42, 0.9)'
  ctx.strokeStyle = theme.border || 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(-totalW / 2 - 16, -tileW / 2 - 10, totalW + 32, tileW + 20, 16)
  ctx.fill()
  ctx.stroke()

  tiles.forEach((sym, idx) => {
    const tx = startX + idx * (tileW + tileGap)
    ctx.save()
    ctx.translate(tx, 0)

    if (idx === 3 && flipAnim > 0 && flipAnim < 1) {
      ctx.scale(1, Math.cos(flipAnim * Math.PI))
    }

    if (idx === 3 && !isComplete) {
      // Pulsing empty red square (0.0-1.0s and during action)
      const pulse = Math.sin(t * 8) * 0.25 + 0.75
      ctx.fillStyle = `rgba(239, 68, 68, ${0.15 * pulse})`
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.85 * pulse})`
      ctx.lineWidth = 2.5
    } else {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.18)'
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2.5
    }

    ctx.beginPath()
    ctx.roundRect(-tileW / 2, -tileW / 2, tileW, tileW, 10)
    ctx.fill()
    ctx.stroke()

    if (sym === '✓') {
      drawCheckmark(ctx, 0, 0, 24, '#22c55e', 3.5)
    } else {
      ctx.fillStyle = '#ef4444'
      ctx.font = 'bold 24px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('□', 0, -1)
    }
    ctx.restore()
  })

  ctx.restore()
}

export function drawCelebrationMessage(
  ctx: CanvasRenderingContext2D,
  t: number,
  mainText: string,
  subText: string,
  colorTheme: {
    ribbonBg?: string
    textGrad1?: string
    textGrad2?: string
    textGrad3?: string
    subColor?: string
  } = {},
): void {
  if (t < 4.3 || t >= 6.8) return

  const enterProg = clamp((t - 4.3) / 0.45, 0, 1)
  const scale = easeOutBack(enterProg, 2.0)

  ctx.save()
  ctx.translate(V_W / 2, 290)
  ctx.scale(scale, scale)

  // Banner ribbon backdrop
  const ribbonGrad = ctx.createLinearGradient(-420, 0, 420, 0)
  ribbonGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
  ribbonGrad.addColorStop(0.2, colorTheme.ribbonBg || 'rgba(15, 23, 42, 0.96)')
  ribbonGrad.addColorStop(0.8, colorTheme.ribbonBg || 'rgba(15, 23, 42, 0.96)')
  ribbonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.fillStyle = ribbonGrad
  ctx.beginPath()
  ctx.roundRect(-420, -85, 840, 170, 26)
  ctx.fill()

  // Main banner text (e.g. "HI-YAH!")
  ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Bold dark stroke for room readability
  ctx.strokeStyle = '#020617'
  ctx.lineWidth = 14
  ctx.lineJoin = 'round'
  ctx.strokeText(mainText, 0, -22)

  // Gradient fill
  const grad = ctx.createLinearGradient(0, -60, 0, 20)
  grad.addColorStop(0, colorTheme.textGrad1 || '#ffffff')
  grad.addColorStop(0.5, colorTheme.textGrad2 || '#67e8f9')
  grad.addColorStop(1, colorTheme.textGrad3 || '#06b6d4')
  ctx.fillStyle = grad
  ctx.fillText(mainText, 0, -22)

  // Subtitle (e.g. "CHORES COMPLETE!")
  if (t >= 4.7) {
    const subProg = clamp((t - 4.7) / 0.35, 0, 1)
    const subScale = easeOutBounce(subProg)

    ctx.save()
    ctx.translate(0, 42)
    ctx.scale(subScale, subScale)

    ctx.font = '900 28px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.strokeStyle = '#020617'
    ctx.lineWidth = 8
    ctx.strokeText(subText, 0, 0)

    ctx.fillStyle = colorTheme.subColor || '#22c55e'
    ctx.fillText(subText, 0, 0)
    ctx.restore()
  }

  ctx.restore()
}

export function drawConfetti(
  ctx: CanvasRenderingContext2D,
  t: number,
  startT: number,
  count = 45,
  colors = ['#facc15', '#38bdf8', '#22c55e', '#ec4899', '#ffffff'],
): void {
  if (t < startT || t >= 6.8) return
  const elapsed = t - startT
  ctx.save()
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0
    const originX = fromLeft ? 80 : V_W - 80
    const originY = V_H - 100
    const angle = fromLeft ? -(0.35 + (i * 0.04) % 0.4) * Math.PI : -(0.65 - (i * 0.04) % 0.4) * Math.PI
    const speed = 380 + (i * 29) % 280
    const x = originX + Math.cos(angle) * (speed * elapsed)
    const y = originY + Math.sin(angle) * (speed * elapsed) + 0.5 * 360 * elapsed * elapsed
    const rot = elapsed * (4 + (i % 6))

    if (y < V_H + 40) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rot)
      ctx.fillStyle = colors[i % colors.length]
      ctx.fillRect(-6, -6, 12, 12)
      ctx.restore()
    }
  }
  ctx.restore()
}

export function drawWipe(
  ctx: CanvasRenderingContext2D,
  t: number,
  type = 'smoke',
  color = '#090d16',
): void {
  if (t < 6.8) return
  const wipeProg = clamp((t - 6.8) / 0.8, 0, 1)
  const scale = easeInOutCubic(wipeProg)

  ctx.save()
  if (type === 'smoke') {
    // Expanding circular smoke puff wipe
    const maxR = Math.hypot(V_W, V_H) * 0.75
    const r = scale * maxR
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(V_W / 2, V_H / 2, r, 0, Math.PI * 2)
    ctx.fill()

    // Soft cloudy outer puffs
    const puffCount = 8
    for (let i = 0; i < puffCount; i++) {
      const angle = (i / puffCount) * Math.PI * 2
      const px = V_W / 2 + Math.cos(angle) * (r * 0.85)
      const py = V_H / 2 + Math.sin(angle) * (r * 0.85)
      ctx.beginPath()
      ctx.arc(px, py, r * 0.35, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    const maxR = Math.hypot(V_W, V_H)
    ctx.beginPath()
    ctx.arc(V_W / 2, V_H / 2, scale * maxR, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()
}

// =============================================================================
// SCENE 1: NINJA CHORE CHOP
// =============================================================================

export function drawNinjaScene(
  ctx: CanvasRenderingContext2D,
  t: number,
  sound: StorySoundFX,
  reducedMotion = false,
): void {
  const actualT = reducedMotion ? 5.8 : t

  // 1. Background: Moonlit dojo training room with deep indigo walls
  const bgGrad = ctx.createLinearGradient(0, 0, 0, V_H)
  bgGrad.addColorStop(0, '#090d1a')
  bgGrad.addColorStop(0.65, '#13192f')
  bgGrad.addColorStop(1, '#1e1b4b')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, V_W, V_H)

  // Giant glowing moon in the sky window
  ctx.save()
  ctx.beginPath()
  ctx.arc(V_W / 2 + 220, 170, 95, 0, Math.PI * 2)
  ctx.fillStyle = '#fef08a'
  ctx.shadowColor = '#fde047'
  ctx.shadowBlur = 40
  ctx.fill()
  ctx.restore()

  // Tatami mat floor & wooden dojo framing
  ctx.fillStyle = '#1c1917'
  ctx.fillRect(0, V_H - 120, V_W, 120)
  // Floor mat line accents
  ctx.strokeStyle = '#292524'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(0, V_H - 60)
  ctx.lineTo(V_W, V_H - 60)
  ctx.moveTo(V_W / 3, V_H - 120)
  ctx.lineTo(V_W / 3, V_H)
  ctx.moveTo((2 * V_W) / 3, V_H - 120)
  ctx.lineTo((2 * V_W) / 3, V_H)
  ctx.stroke()

  // Dojo red pillars
  ctx.fillStyle = '#7f1d1d'
  ctx.fillRect(70, 0, 36, V_H - 120)
  ctx.fillRect(V_W - 106, 0, 36, V_H - 120)
  ctx.fillStyle = '#450a0a'
  ctx.fillRect(66, 40, 44, 16)
  ctx.fillRect(V_W - 110, 40, 44, 16)

  // Hanging glowing paper lanterns
  const lanternGlow = actualT >= 5.5 ? 1.6 : 1.0
  ;[
    { x: 180, y: 130 },
    { x: V_W - 200, y: 130 },
  ].forEach((pos, idx) => {
    ctx.save()
    // Soft swinging
    const swing = Math.sin(actualT * 2 + idx) * 0.04
    ctx.translate(pos.x, 0)
    ctx.rotate(swing)

    // Lantern cord
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(0, pos.y - 40)
    ctx.stroke()

    // Lantern body
    ctx.save()
    ctx.translate(0, pos.y)
    ctx.fillStyle = '#dc2626'
    ctx.shadowColor = '#f97316'
    ctx.shadowBlur = 24 * lanternGlow
    ctx.beginPath()
    ctx.roundRect(-24, -36, 48, 72, 14)
    ctx.fill()

    // Golden inner band
    ctx.fillStyle = '#fde047'
    ctx.fillRect(-24, -8, 48, 16)
    ctx.restore()
    ctx.restore()
  })

  // Bamboo training stalks
  const bambooCut = actualT >= 2.4
  const cutShift = bambooCut ? Math.min((actualT - 2.4) * 85, 45) : 0
  ctx.fillStyle = '#15803d'
  // Left bamboo
  ctx.fillRect(260, bambooCut ? 240 + cutShift : 180, 22, bambooCut ? 360 - cutShift : 420)
  if (bambooCut) {
    ctx.save()
    ctx.translate(260 - cutShift * 0.8, 180 - cutShift * 0.3)
    ctx.rotate(-cutShift * 0.015)
    ctx.fillRect(0, 0, 22, 60)
    ctx.restore()
  }
  // Right bamboo
  ctx.fillRect(V_W - 282, bambooCut ? 240 + cutShift : 180, 22, bambooCut ? 360 - cutShift : 420)
  if (bambooCut) {
    ctx.save()
    ctx.translate(V_W - 282 + cutShift * 0.8, 180 - cutShift * 0.3)
    ctx.rotate(cutShift * 0.015)
    ctx.fillRect(0, 0, 22, 60)
    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // 0.0–1.0s: The Challenge Appears (Dropping parchment, anxious tremor)
  // ---------------------------------------------------------------------------
  let parchY = 85
  let parchShake = 0
  if (actualT < 1.0) {
    const dropProg = clamp(actualT / 0.7, 0, 1)
    parchY = lerp(-80, 85, easeOutBounce(dropProg))
    if (actualT > 0.6) {
      // Anxious parchment tremor
      parchShake = Math.sin(actualT * 35) * 3
    }
  }

  // ---------------------------------------------------------------------------
  // 3.5–4.5s: The Chore Breaks Apart (Four fluttering pieces)
  // 4.5–5.5s: Checkmark Transformation (Giant glowing checkmark)
  // ---------------------------------------------------------------------------
  if (actualT < 3.5) {
    ctx.save()
    ctx.translate(parchShake, 0)
    drawTaskTiles(ctx, V_W / 2, parchY, actualT, {
      cardBg: 'rgba(28, 25, 23, 0.95)',
      border: '#f59e0b',
    })
    ctx.restore()
  } else if (actualT < 4.5) {
    // Four pieces scattering and rotating toward center
    const pProg = (actualT - 3.5) / 1.0
    const spread = Math.sin(pProg * Math.PI) * 70
    const rot = pProg * 0.8
    ctx.save()
    ctx.translate(V_W / 2, 85)

    const pieces = [
      { x: -90 - spread, y: -spread * 0.4, r: -rot, sym: '✓' },
      { x: -30 - spread * 0.3, y: spread * 0.3, r: rot * 0.7, sym: '✓' },
      { x: 30 + spread * 0.3, y: -spread * 0.3, r: -rot * 0.7, sym: '✓' },
      { x: 90 + spread, y: spread * 0.4, r: rot, sym: '✓' },
    ]

    pieces.forEach((p) => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = 'rgba(28, 25, 23, 0.92)'
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(-24, -24, 48, 48, 8)
      ctx.fill()
      ctx.stroke()
      drawCheckmark(ctx, 0, 0, 22, '#22c55e', 3)
      ctx.restore()
    })
    ctx.restore()
  } else {
    // 4.5–7.0s: Enormous glowing Checkmark + completed task row
    const chkProg = clamp((actualT - 4.5) / 0.5, 0, 1)
    const chkScale = easeOutBack(chkProg, 1.8)

    ctx.save()
    ctx.translate(V_W / 2, 105)
    ctx.scale(chkScale, chkScale)

    // Golden / Cyan backglow
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 32
    drawCheckmark(ctx, 0, -10, 80, '#38bdf8', 12)
    drawCheckmark(ctx, 0, -10, 76, '#ffffff', 6)

    // Completed task row beneath it
    ctx.restore()
    drawTaskTiles(ctx, V_W / 2, 145, actualT, {
      cardBg: 'rgba(28, 25, 23, 0.95)',
      border: '#22c55e',
    })
  }

  // ---------------------------------------------------------------------------
  // NINJA CHARACTER & ACTIONS
  // ---------------------------------------------------------------------------
  ctx.save()
  let ninjaX = V_W / 2
  let ninjaY = 480
  let ninjaRot = 0
  let swordDrawn = false
  let victoryPose = false
  let bowPose = false

  if (actualT < 1.0) {
    // Edge observation
    ninjaX = 140
    ninjaY = V_H - 180
  } else if (actualT < 2.0) {
    // 1.0–2.0s: Somersault in from left
    const leapP = (actualT - 1.0) / 1.0
    ninjaX = lerp(140, V_W / 2, leapP)
    // Parabolic jump arc with full 360 somersault
    const arc = Math.sin(leapP * Math.PI) * 160
    ninjaY = lerp(V_H - 180, 480, leapP) - arc
    ninjaRot = leapP * Math.PI * 2
    swordDrawn = leapP > 0.7
  } else if (actualT < 3.5) {
    // 2.0–3.5s: Precision Chops
    ninjaX = V_W / 2
    ninjaY = 480
    swordDrawn = true
  } else if (actualT < 6.8) {
    // 5.5–6.8s: Victory Stance & Sheathing
    ninjaX = V_W / 2 - 120
    ninjaY = 480
    victoryPose = true
  } else {
    // 6.8–7.6s: Polite ninja bow
    ninjaX = V_W / 2 - 120
    ninjaY = 480
    bowPose = true
  }

  ctx.translate(ninjaX, ninjaY)
  ctx.rotate(ninjaRot)

  // Ninja Body (Friendly rounded silhouette)
  ctx.fillStyle = '#0f172a'

  // Torso
  ctx.beginPath()
  ctx.roundRect(-22, -42, 44, 56, 12)
  ctx.fill()

  // Head
  ctx.beginPath()
  ctx.arc(0, -66, 26, 0, Math.PI * 2)
  ctx.fill()

  // Red Ninja Headband & flutter tail
  ctx.fillStyle = '#dc2626'
  ctx.beginPath()
  ctx.roundRect(-24, -76, 48, 12, 4)
  ctx.fill()
  // Fluttering tails
  const flutter = Math.sin(actualT * 14) * 10
  ctx.beginPath()
  ctx.moveTo(-24, -70)
  ctx.lineTo(-54 + flutter, -74 + Math.cos(actualT * 10) * 8)
  ctx.lineTo(-48, -62)
  ctx.lineTo(-24, -66)
  ctx.fill()

  // Ninja Eyes (Expressive, white with determined pupils)
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(-14, -70, 10, 6, 3)
  ctx.roundRect(4, -70, 10, 6, 3)
  ctx.fill()
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.arc(-8, -67, 2.5, 0, Math.PI * 2)
  ctx.arc(10, -67, 2.5, 0, Math.PI * 2)
  ctx.fill()

  // Legs / Feet
  ctx.fillStyle = '#0f172a'
  if (bowPose) {
    // Bowing posture
    ctx.fillRect(-18, 14, 14, 40)
    ctx.fillRect(4, 14, 14, 40)
  } else if (victoryPose) {
    // Wide triumphant stance
    ctx.fillRect(-28, 14, 16, 42)
    ctx.fillRect(12, 14, 16, 42)
  } else {
    // Crouched stance
    ctx.fillRect(-22, 14, 16, 42)
    ctx.fillRect(6, 14, 16, 42)
  }

  // Red sash belt
  ctx.fillStyle = '#dc2626'
  ctx.fillRect(-22, 4, 44, 10)

  // Katana & Sheath
  if (swordDrawn) {
    ctx.save()
    // Glowing cyan katana blade
    ctx.strokeStyle = '#38bdf8'
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 20
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(20, -10)
    ctx.lineTo(80, -70)
    ctx.stroke()
    // Katana hilt & gold guard
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(14, -4)
    ctx.lineTo(26, -16)
    ctx.stroke()
    ctx.restore()
  } else if (victoryPose) {
    // Peace sign hand & sheathed sword
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.arc(32, -30, 8, 0, Math.PI * 2)
    ctx.fill()
    // Sheath on back
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(-28, -50)
    ctx.lineTo(-4, 20)
    ctx.stroke()
  }

  ctx.restore()

  // ---------------------------------------------------------------------------
  // 2.0–3.5s: Three Precision Chops (Slashing Arcs & SFX)
  // ---------------------------------------------------------------------------
  // Strike 1: 2.0–2.5s (Horizontal Cyan Slash)
  if (actualT >= 2.0 && actualT < 2.5) {
    sound.triggerOnce('slash1', () => sound.playSlash(440))
    const sp = (actualT - 2.0) / 0.5
    ctx.save()
    ctx.strokeStyle = '#22d3ee'
    ctx.shadowColor = '#22d3ee'
    ctx.shadowBlur = 24
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(V_W / 2 - 240, 360)
    ctx.lineTo(V_W / 2 - 240 + sp * 480, 360)
    ctx.stroke()
    ctx.restore()
  }

  // Strike 2: 2.5–3.0s (Diagonal Golden Slash)
  if (actualT >= 2.5 && actualT < 3.0) {
    sound.triggerOnce('slash2', () => sound.playSlash(580))
    const sp = (actualT - 2.5) / 0.5
    ctx.save()
    ctx.strokeStyle = '#facc15'
    ctx.shadowColor = '#facc15'
    ctx.shadowBlur = 24
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(V_W / 2 - 180, 220)
    ctx.lineTo(V_W / 2 - 180 + sp * 360, 220 + sp * 280)
    ctx.stroke()
    ctx.restore()
  }

  // Strike 3: 3.0–3.5s (Downward Checkmark Slash)
  if (actualT >= 3.0 && actualT < 3.5) {
    sound.triggerOnce('slash3', () => sound.playSlash(720))
    const sp = (actualT - 3.0) / 0.5
    ctx.save()
    ctx.strokeStyle = '#38bdf8'
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 28
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(V_W / 2 - 80, 280)
    ctx.lineTo(V_W / 2 - 80 + sp * 60, 280 + sp * 80)
    ctx.lineTo(V_W / 2 - 20 + sp * 140, 360 - sp * 140)
    ctx.stroke()
    ctx.restore()
  }

  // ---------------------------------------------------------------------------
  // 5.5–7.0s: Celebration Spectacle, Fanfare & Message
  // ---------------------------------------------------------------------------
  if (actualT >= 4.3) {
    sound.triggerOnce('fanfare', () => {
      sound.playImpact()
      setTimeout(() => sound.playFanfare(), 80)
    })
  }

  // Two smoke puffs bursting into stars around the ninja
  if (actualT >= 5.3 && actualT < 6.8) {
    ;[
      { x: V_W / 2 - 200, y: 460 },
      { x: V_W / 2 - 40, y: 460 },
    ].forEach((pos, idx) => {
      const puffT = actualT - 5.3
      const pr = Math.min(puffT * 40, 28)
      ctx.save()
      ctx.fillStyle = 'rgba(241, 245, 249, 0.65)'
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, pr, 0, Math.PI * 2)
      ctx.arc(pos.x - 12, pos.y - 8, pr * 0.7, 0, Math.PI * 2)
      ctx.arc(pos.x + 12, pos.y - 8, pr * 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    })
  }

  // Paper-star confetti
  drawConfetti(ctx, actualT, 5.0, 55, [
    '#38bdf8',
    '#facc15',
    '#22c55e',
    '#dc2626',
    '#ffffff',
  ])

  // Celebration Banner: "HI-YAH! CHORES COMPLETE!"
  drawCelebrationMessage(
    ctx,
    actualT,
    'HI-YAH!',
    'CHORES COMPLETE!',
    {
      ribbonBg: 'rgba(15, 23, 42, 0.96)',
      textGrad1: '#ffffff',
      textGrad2: '#38bdf8',
      textGrad3: '#0284c7',
      subColor: '#34d399',
    },
  )

  // ---------------------------------------------------------------------------
  // 6.8–7.6s: Reset Wipe & Bow
  // ---------------------------------------------------------------------------
  if (actualT >= 6.8) {
    sound.triggerOnce('wipe', () => sound.playWhoosh())
    drawWipe(ctx, actualT, 'smoke', '#090d16')
  }
}

// =============================================================================
// SHARED CHORE SCENE PLAYER (Reusable Engine)
// =============================================================================

export class ChoreScenePlayer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private rafId = 0
  private startTime = 0
  private pausedAt = 0
  private isPaused = false
  private sound = new StorySoundFX()
  private sceneFn: (ctx: CanvasRenderingContext2D, t: number, sound: StorySoundFX, reducedMotion?: boolean) => void

  constructor(
    canvas: HTMLCanvasElement,
    sceneFn: (ctx: CanvasRenderingContext2D, t: number, sound: StorySoundFX, reducedMotion?: boolean) => void,
  ) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.sceneFn = sceneFn
    this.sound.init()
  }

  play(): void {
    if (this.isPaused) {
      this.startTime += performance.now() - this.pausedAt
      this.isPaused = false
    } else {
      this.startTime = performance.now()
    }
    this.loop()
  }

  pause(): void {
    if (this.isPaused) return
    this.isPaused = true
    this.pausedAt = performance.now()
    cancelAnimationFrame(this.rafId)
  }

  replay(): void {
    this.isPaused = false
    this.startTime = performance.now()
    this.sound.reset()
    this.loop()
  }

  private loop = (): void => {
    const now = performance.now()
    const t = (now - this.startTime) / 1000

    // Virtual scaling to 1280x720 keeping aspect ratio
    const dpr = window.devicePixelRatio || 1
    const cw = this.canvas.clientWidth
    const ch = this.canvas.clientHeight
    if (this.canvas.width !== Math.floor(cw * dpr) || this.canvas.height !== Math.floor(ch * dpr)) {
      this.canvas.width = Math.floor(cw * dpr)
      this.canvas.height = Math.floor(ch * dpr)
    }

    const scale = Math.min((cw * dpr) / V_W, (ch * dpr) / V_H)
    const offsetX = ((cw * dpr) - V_W * scale) / 2
    const offsetY = ((ch * dpr) - V_H * scale) / 2

    this.ctx.save()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.translate(offsetX, offsetY)
    this.ctx.scale(scale, scale)

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    this.sceneFn(this.ctx, t, this.sound, reducedMotion)
    this.ctx.restore()

    if (t < 7.6) {
      this.rafId = requestAnimationFrame(this.loop)
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId)
    this.sound.destroy()
  }
}

// =============================================================================
// REGISTRY: EXPORT CHORE CELEBRATIONS
// =============================================================================

export const CHORE_STORY_CELEBRATIONS: Celebration[] = [
  {
    name: 'ninja',
    emoji: '🥷',
    label: 'Ninja Chore Chop',
    backdrop: '#090d16',
    durationMs: 7600,
    praise: ['HI-YAH! CHORES COMPLETE!'],
    run: (canvas: HTMLCanvasElement) => {
      const player = new ChoreScenePlayer(canvas, drawNinjaScene)
      player.play()
      return () => player.destroy()
    },
  },
]
