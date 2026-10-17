/**
 * Reward redemption animations with Web Audio synthesized sound effects
 * and kiosk-optimized canvas rendering.
 *
 * Each animation adheres to:
 * - MD3 typography and modern visual styling.
 * - Loop pausing on document visibility change (preventing background battery/GPU drain).
 * - Avoidance of layout thrashing (cached canvas dimensions, resize listener).
 * - Web Audio API sound effects strictly gated by `nivas_celebration_sound` toggle.
 */

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
  durationMs?: number
  hideHtmlPraise?: boolean
  iframeSrc?: string
  run?: (canvas: HTMLCanvasElement) => () => void
}

// =============================================================================
// AUDIO ENGINE (Synthesized with Web Audio API, Zero Assets Required)
// =============================================================================

class RewardAudio {
  private ctx: AudioContext | null = null

  isEnabled(): boolean {
    try {
      if (typeof window === 'undefined') return false
      return localStorage.getItem('nivas_celebration_sound') === 'true'
    } catch {
      return false
    }
  }

  private init(): AudioContext | null {
    if (!this.isEnabled()) return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  close() {
    if (this.ctx) {
      try {
        this.ctx.close().catch(() => {})
      } catch {}
      this.ctx = null
    }
  }

  /** Fairy: magical ascending harp/glockenspiel arpeggio & fairy shimmer */
  playFairy() {
    const ctx = this.init()
    if (!ctx) return
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98] // C5 to G6
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.08
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, start)
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, start + 0.4)

      gain.gain.setValueAtTime(0.001, start)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.45)
    })
  }

  /** Treasure: chest latch click, triumphant brass fanfare, and cascading coin clinks */
  playTreasure() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime

    // Brass triad fanfare: C4, E4, G4, C5
    const brass = [261.63, 329.63, 392.0, 523.25]
    brass.forEach((f, i) => {
      const t = now + i * 0.11
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(f, t)

      gain.gain.setValueAtTime(0.001, t)
      gain.gain.linearRampToValueAtTime(0.1, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    })

    // Cascading gold coins
    const coinTimes = [0.45, 0.52, 0.6, 0.68, 0.76, 0.85, 0.95, 1.05]
    const coinFreqs = [1960, 2349, 2793, 3135, 3520, 2637, 3135, 3951]
    coinTimes.forEach((dt, i) => {
      const t = now + dt
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(coinFreqs[i % coinFreqs.length], t)

      gain.gain.setValueAtTime(0.07, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.22)
    })
  }

  /** Candy: upbeat bouncy marimba bubbles and sweet pops */
  playCandy() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime
    const notes = [440, 554.37, 659.25, 880, 1108.73]
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.12
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + 0.28)

      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.28)
    })
  }

  /** Puppies: cheerful yips, boing hops, and warm happy chord */
  playPuppies() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime
    // Playful upward boings
    ;[0, 0.22, 0.44].forEach((dt, i) => {
      const t = now + dt
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320 + i * 80, t)
      osc.frequency.exponentialRampToValueAtTime(680 + i * 100, t + 0.16)

      gain.gain.setValueAtTime(0.14, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.2)
    })

    // Cheerful resolution chord
    ;[523.25, 659.25, 783.99].forEach((f) => {
      const t = now + 0.65
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, t)
      gain.gain.setValueAtTime(0.08, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.6)
    })
  }

  /** Racecar: roaring engine rev, Doppler flyby, skid-stop and victory fanfare */
  playRacecar() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime

    // Engine rev sweep
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(75, now)
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.8)
    osc.frequency.exponentialRampToValueAtTime(140, now + 1.2)

    gain.gain.setValueAtTime(0.07, now)
    gain.gain.linearRampToValueAtTime(0.14, now + 0.7)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 1.3)

    // Skid screech
    const screechTime = now + 1.6
    const sOsc = ctx.createOscillator()
    const sGain = ctx.createGain()
    sOsc.type = 'triangle'
    sOsc.frequency.setValueAtTime(880, screechTime)
    sOsc.frequency.exponentialRampToValueAtTime(300, screechTime + 0.4)
    sGain.gain.setValueAtTime(0.09, screechTime)
    sGain.gain.exponentialRampToValueAtTime(0.001, screechTime + 0.45)
    sOsc.connect(sGain)
    sGain.connect(ctx.destination)
    sOsc.start(screechTime)
    sOsc.stop(screechTime + 0.45)

    // Fanfare
    const fanfareNotes = [587.33, 739.99, 880, 1174.66]
    fanfareNotes.forEach((f, i) => {
      const t = now + 2.2 + i * 0.1
      const fOsc = ctx.createOscillator()
      const fGain = ctx.createGain()
      fOsc.type = 'sawtooth'
      fOsc.frequency.setValueAtTime(f, t)
      fGain.gain.setValueAtTime(0.08, t)
      fGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
      fOsc.connect(fGain)
      fGain.connect(ctx.destination)
      fOsc.start(t)
      fOsc.stop(t + 0.45)
    })
  }

  /** Dino Egg: egg tapping crack, shell shatter pop, baby dino triumph chirp */
  playDinoEgg() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime

    // Egg taps
    ;[0.3, 0.7, 1.1, 1.5, 1.8].forEach((dt, i) => {
      const t = now + dt
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(700 + i * 90, t)
      gain.gain.setValueAtTime(0.1, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.08)
    })

    // Shell Shatter Pop at 2.1s
    const popTime = now + 2.1
    const popOsc = ctx.createOscillator()
    const popGain = ctx.createGain()
    popOsc.type = 'sine'
    popOsc.frequency.setValueAtTime(350, popTime)
    popOsc.frequency.exponentialRampToValueAtTime(80, popTime + 0.18)
    popGain.gain.setValueAtTime(0.2, popTime)
    popGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.22)
    popOsc.connect(popGain)
    popGain.connect(ctx.destination)
    popOsc.start(popTime)
    popOsc.stop(popTime + 0.22)

    // Baby Dino Roar / Chirp
    ;[440, 659.25, 880].forEach((f, i) => {
      const t = now + 2.4 + i * 0.12
      const dOsc = ctx.createOscillator()
      const dGain = ctx.createGain()
      dOsc.type = 'triangle'
      dOsc.frequency.setValueAtTime(f, t)
      dOsc.frequency.exponentialRampToValueAtTime(f * 1.15, t + 0.3)
      dGain.gain.setValueAtTime(0.12, t)
      dGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      dOsc.connect(dGain)
      dGain.connect(ctx.destination)
      dOsc.start(t)
      dOsc.stop(t + 0.35)
    })
  }

  /** UFO: sci-fi synth pulses, tractor beam shimmer, cosmic gift pop & warp woosh */
  playUfo() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime

    // UFO beam hum
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 1.2)
    osc.frequency.exponentialRampToValueAtTime(520, now + 2.4)
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.08, now + 0.3)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 2.8)

    // Cosmic Pop at 2.6s
    const popTime = now + 2.6
    ;[523.25, 783.99, 1046.5, 1567.98].forEach((f, idx) => {
      const t = popTime + idx * 0.08
      const pOsc = ctx.createOscillator()
      const pGain = ctx.createGain()
      pOsc.type = 'triangle'
      pOsc.frequency.setValueAtTime(f, t)
      pGain.gain.setValueAtTime(0.12, t)
      pGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      pOsc.connect(pGain)
      pGain.connect(ctx.destination)
      pOsc.start(t)
      pOsc.stop(t + 0.4)
    })
  }

  /** Dragon: wing flap swoosh, roaring fire crackle, and dragon hoard fanfare */
  playDragon() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime

    // Wing swoosh (low resonant sweep)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.6)
    osc.frequency.exponentialRampToValueAtTime(80, now + 1.2)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 1.3)

    // Fire breath sweep at 1.4s
    const fTime = now + 1.4
    const fOsc = ctx.createOscillator()
    const fGain = ctx.createGain()
    fOsc.type = 'sawtooth'
    fOsc.frequency.setValueAtTime(220, fTime)
    fOsc.frequency.exponentialRampToValueAtTime(660, fTime + 0.8)
    fGain.gain.setValueAtTime(0.09, fTime)
    fGain.gain.exponentialRampToValueAtTime(0.001, fTime + 1.0)
    fOsc.connect(fGain)
    fGain.connect(ctx.destination)
    fOsc.start(fTime)
    fOsc.stop(fTime + 1.0)

    // Heroic Gold Fanfare
    ;[392.0, 493.88, 587.33, 783.99].forEach((f, i) => {
      const t = now + 2.5 + i * 0.1
      const gOsc = ctx.createOscillator()
      const gGain = ctx.createGain()
      gOsc.type = 'triangle'
      gOsc.frequency.setValueAtTime(f, t)
      gGain.gain.setValueAtTime(0.12, t)
      gGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      gOsc.connect(gGain)
      gGain.connect(ctx.destination)
      gOsc.start(t)
      gOsc.stop(t + 0.5)
    })
  }

  /** Robot: 8-bit disco arpeggio, robot vocal chirp, and funky dance party synth */
  playRobot() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime

    // 8-bit chiptune arpeggio
    const arp = [261.63, 311.13, 392.0, 466.16, 523.25, 622.25, 783.99, 1046.5]
    arp.forEach((freq, idx) => {
      const t = now + idx * 0.08
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0.06, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.14)
    })

    // Funky disco beat at 0.9s
    ;[0.9, 1.35, 1.8, 2.25].forEach((dt) => {
      const t = now + dt
      const kOsc = ctx.createOscillator()
      const kGain = ctx.createGain()
      kOsc.type = 'sine'
      kOsc.frequency.setValueAtTime(150, t)
      kOsc.frequency.exponentialRampToValueAtTime(45, t + 0.15)
      kGain.gain.setValueAtTime(0.18, t)
      kGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
      kOsc.connect(kGain)
      kGain.connect(ctx.destination)
      kOsc.start(t)
      kOsc.stop(t + 0.18)
    })
  }

  /** Pirate: sea shanty accordion triad, cannon BOOM, and splashing dubloons */
  playPirate() {
    const ctx = this.init()
    if (!ctx) return
    const now = ctx.currentTime

    // Sea shanty accordion chord
    ;[293.66, 369.99, 440.0].forEach((f) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(f, now)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.9)
    })

    // Cannon blast BOOM at 1.0s
    const bTime = now + 1.0
    const bOsc = ctx.createOscillator()
    const bGain = ctx.createGain()
    bOsc.type = 'sine'
    bOsc.frequency.setValueAtTime(120, bTime)
    bOsc.frequency.exponentialRampToValueAtTime(35, bTime + 0.4)
    bGain.gain.setValueAtTime(0.24, bTime)
    bGain.gain.exponentialRampToValueAtTime(0.001, bTime + 0.45)
    bOsc.connect(bGain)
    bGain.connect(ctx.destination)
    bOsc.start(bTime)
    bOsc.stop(bTime + 0.45)

    // Tumbling dubloons
    ;[1.4, 1.55, 1.7, 1.88, 2.05].forEach((dt, i) => {
      const t = now + dt
      const cOsc = ctx.createOscillator()
      const cGain = ctx.createGain()
      cOsc.type = 'sine'
      cOsc.frequency.setValueAtTime(2000 + i * 250, t)
      cGain.gain.setValueAtTime(0.07, t)
      cGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
      cOsc.connect(cGain)
      cGain.connect(ctx.destination)
      cOsc.start(t)
      cOsc.stop(t + 0.16)
    })
  }
}

// =============================================================================
// MATH & CANVAS UTILITIES (KIOSK & MD3 COMPLIANT)
// =============================================================================

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const clamp = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max)
const phase = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
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

/**
 * Setup canvas dimensions with DPI scaling and resize caching
 * to strictly prevent layout thrashing inside frame loops.
 */
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

/**
 * Kiosk loop manager: automatically pauses requestAnimationFrame
 * when document is hidden (loop pausing rule).
 */
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

const drawEmoji = (
  ctx: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  size: number,
  rotation = 0,
) => {
  ctx.save()
  ctx.translate(x, y)
  if (rotation !== 0) ctx.rotate(rotation)
  ctx.font = `${size}px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`
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

// =============================================================================
// 1. FAIRY WISH (Jewelry Box, Wand Arc, Starburst & "Wish Granted!")
// =============================================================================

const fairyRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const sparkles: Spark[] = []
  const magicTrail: Spark[] = []
  const wandSparkColors = ['#ffd700', '#ff69b4', '#e0b0ff', '#ffffff', '#87ceeb', '#ffc0cb']
  const gemColors = ['#e040fb', '#40c4ff', '#ff5252', '#ffd740', '#69f0ae', '#7c4dff']

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2
    const cy = H / 2

    // Background cosmic radiance
    const bgG = ctx.createRadialGradient(cx, cy, 50, cx, cy, W * 0.7)
    const pulse = 0.08 + 0.04 * Math.sin(t * 2.5)
    bgG.addColorStop(0, `rgba(168, 85, 247, ${pulse * 1.5})`)
    bgG.addColorStop(0.5, `rgba(59, 130, 246, ${pulse * 0.7})`)
    bgG.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = bgG
    ctx.fillRect(0, 0, W, H)

    const boxW = Math.min(W * 0.32, 340)
    const boxH = boxW * 0.5
    const boxX = cx - boxW / 2
    const boxY = cy + H * 0.06

    const lidPhase = Math.min(t / 1.0, 1)
    const fairyPhase = Math.max(0, (t - 0.6) / 1.0)
    const wandPhase = Math.max(0, (t - 1.8) / 0.6)
    const glowPhase = Math.max(0, (t - 2.2) / 1.0)

    if (t >= 1.6 && !audioPlayed) {
      audioPlayed = true
      audio.playFairy()
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
    ctx.beginPath()
    ctx.ellipse(cx, boxY + boxH + 8, boxW * 0.55, 14, 0, 0, Math.PI * 2)
    ctx.fill()

    // Jewelry box body
    const bodyG = ctx.createLinearGradient(0, boxY, 0, boxY + boxH)
    bodyG.addColorStop(0, '#581c87')
    bodyG.addColorStop(0.5, '#3b0764')
    bodyG.addColorStop(1, '#2e1065')
    ctx.fillStyle = bodyG
    roundRect(ctx, boxX, boxY, boxW, boxH, 12)
    ctx.fill()

    // Velvet interior glow
    if (lidPhase > 0.1) {
      const vG = ctx.createLinearGradient(0, boxY, 0, boxY + boxH * 0.35)
      vG.addColorStop(0, 'rgba(236, 72, 153, 0.6)')
      vG.addColorStop(1, 'rgba(88, 28, 135, 0.2)')
      ctx.fillStyle = vG
      roundRect(ctx, boxX + 8, boxY + 6, boxW - 16, boxH * 0.35, 8)
      ctx.fill()
    }

    // Gold trim
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    roundRect(ctx, boxX, boxY, boxW, boxH, 12)
    ctx.stroke()

    // Lock plate
    ctx.fillStyle = '#f59e0b'
    roundRect(ctx, cx - 14, boxY + boxH * 0.25, 28, 24, 4)
    ctx.fill()
    ctx.fillStyle = '#ffd700'
    ctx.beginPath()
    ctx.arc(cx, boxY + boxH * 0.25 + 9, 4, 0, Math.PI * 2)
    ctx.fill()

    // Hinged Lid opening backward
    ctx.save()
    ctx.translate(cx, boxY)
    const lidAngle = -easeOutCubic(lidPhase) * 1.8
    ctx.rotate(lidAngle)
    const lidH = boxH * 0.35
    const lidG = ctx.createLinearGradient(0, -lidH, 0, 0)
    lidG.addColorStop(0, '#7e22ce')
    lidG.addColorStop(1, '#581c87')
    ctx.fillStyle = lidG
    roundRect(ctx, -boxW / 2, -lidH, boxW, lidH, 10)
    ctx.fill()
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 3
    roundRect(ctx, -boxW / 2, -lidH, boxW, lidH, 10)
    ctx.stroke()
    ctx.restore()

    // Fairy character rising out of the box
    if (fairyPhase > 0) {
      const fp = Math.min(fairyPhase, 1)
      const riseEase = easeOutCubic(fp)
      const fairyY = boxY - riseEase * (H * 0.32) + Math.sin(t * 3) * 8
      const spinAngle = Math.sin(t * 2) * 0.08

      // Gossamer wings fluttering
      const wingFlutter = Math.sin(t * 16) * 0.35
      ctx.save()
      ctx.translate(cx, fairyY)
      ctx.rotate(spinAngle)

      // Left wing
      ctx.save()
      ctx.scale(Math.cos(wingFlutter), 1)
      ctx.fillStyle = 'rgba(232, 121, 249, 0.45)'
      ctx.beginPath()
      ctx.ellipse(-38, -16, 36, 18, -0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#f472b6'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      // Right wing
      ctx.save()
      ctx.scale(Math.cos(wingFlutter), 1)
      ctx.fillStyle = 'rgba(232, 121, 249, 0.45)'
      ctx.beginPath()
      ctx.ellipse(38, -16, 36, 18, 0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#f472b6'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()

      // Fairy emoji character
      drawEmoji(ctx, '🧚', 0, 0, Math.min(95, W * 0.18))
      ctx.restore()

      // Magic wand waving starburst
      if (wandPhase > 0) {
        const wp = Math.min(wandPhase, 1)
        const wandTipX = cx + 55 + Math.cos(wp * Math.PI * 2) * 45
        const wandTipY = fairyY - 30 + Math.sin(wp * Math.PI * 2) * 35

        drawEmoji(ctx, '🪄', wandTipX, wandTipY, 38, wp * 2)

        if (Math.random() < 0.8) {
          magicTrail.push({
            x: wandTipX + rand(-6, 6),
            y: wandTipY + rand(-6, 6),
            vx: rand(-80, 80),
            vy: rand(-90, 40),
            life: 0,
            maxLife: rand(0.5, 1.1),
            color: pick(wandSparkColors),
            size: rand(3, 7),
          })
        }
      }
    }

    // "Wish Granted!" glowing banner
    if (glowPhase > 0) {
      const gp = Math.min(glowPhase, 1)
      const scale = easeOutBack(gp)
      ctx.save()
      ctx.globalAlpha = gp
      ctx.translate(cx, H * 0.16)
      ctx.scale(scale, scale)
      ctx.font = '900 clamp(32px, 5vw, 56px) system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 28
      ctx.fillStyle = '#ffd700'
      ctx.fillText('✨ WISH GRANTED! ✨', 0, 0)
      ctx.restore()
    }

    // Render magic particles
    for (let i = magicTrail.length - 1; i >= 0; i--) {
      const s = magicTrail[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        magicTrail.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      const a = 1 - s.life / s.maxLife
      ctx.globalAlpha = a
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * a + 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 2. TREASURE CHEST (Oak Chest, God-Rays, Exploding Gold Coins & Gems)
// =============================================================================

const treasureRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const coins: Spark[] = []
  const gems: {
    x: number
    y: number
    vx: number
    vy: number
    rot: number
    vr: number
    emoji: string
    size: number
  }[] = []
  const rays = Array.from({ length: 11 }, (_, i) => i)

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2
    const chestY = H * 0.64
    const chestW = Math.min(W * 0.32, 340)
    const chestH = chestW * 0.54
    const chestX = cx - chestW / 2

    const lidPhase = clamp((t - 0.3) / 0.7)
    const burstPhase = Math.max(0, t - 0.8)

    if (t >= 0.7 && !audioPlayed) {
      audioPlayed = true
      audio.playTreasure()
    }

    // God-rays emanating from open chest
    if (lidPhase > 0.4) {
      const a = Math.min((lidPhase - 0.4) / 0.6, 1) * 0.4
      ctx.save()
      ctx.translate(cx, chestY - 15)
      for (const i of rays) {
        const ang = -Math.PI / 2 + (i - 5) * 0.2 + Math.sin(t * 1.5 + i) * 0.04
        const grad = ctx.createLinearGradient(0, 0, Math.cos(ang) * H * 0.8, Math.sin(ang) * H * 0.8)
        grad.addColorStop(0, `rgba(255, 215, 0, ${a})`)
        grad.addColorStop(1, 'rgba(255, 215, 0, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(Math.cos(ang - 0.06) * H * 0.85, Math.sin(ang - 0.06) * H * 0.85)
        ctx.lineTo(Math.cos(ang + 0.06) * H * 0.85, Math.sin(ang + 0.06) * H * 0.85)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
    }

    // Erupting fountain of gold coins
    if (burstPhase > 0 && burstPhase < 2.5 && coins.length < 240) {
      for (let i = 0; i < 7; i++) {
        coins.push({
          x: cx + rand(-45, 45),
          y: chestY - 20,
          vx: rand(-380, 380),
          vy: rand(-820, -420),
          life: 0,
          maxLife: rand(1.8, 2.8),
          color: pick(['#ffd700', '#facc15', '#fde047', '#eab308']),
          size: rand(8, 14),
        })
      }
    }

    // Big gleaming gems burst early
    if (burstPhase > 0 && burstPhase < 0.5 && gems.length < 9 && Math.random() < 0.6) {
      gems.push({
        x: cx,
        y: chestY - 20,
        vx: rand(-280, 280),
        vy: rand(-740, -450),
        rot: 0,
        vr: rand(-5, 5),
        emoji: pick(['💎', '👑', '💍', '⭐', '🏆']),
        size: rand(44, 68),
      })
    }

    // Update & draw coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]
      c.life += dt
      if (c.life >= c.maxLife) {
        coins.splice(i, 1)
        continue
      }
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.vy += 950 * dt
      if (c.y > H - 18 && c.vy > 0) c.vy *= -0.45 // ground bounce
      const squash = 0.35 + 0.65 * Math.abs(Math.sin(t * 7 + c.size))
      ctx.fillStyle = c.color
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.size * squash, c.size, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#b45309'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Update & draw gems
    for (const g of gems) {
      g.x += g.vx * dt
      g.y += g.vy * dt
      g.vy += 750 * dt
      g.rot += g.vr * dt
      drawEmoji(ctx, g.emoji, g.x, g.y, g.size, g.rot)
    }

    // Chest shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.beginPath()
    ctx.ellipse(cx, chestY + chestH + 6, chestW * 0.55, 14, 0, 0, Math.PI * 2)
    ctx.fill()

    // Chest base
    const wood = ctx.createLinearGradient(0, chestY, 0, chestY + chestH)
    wood.addColorStop(0, '#854d0e')
    wood.addColorStop(1, '#451a03')
    ctx.fillStyle = wood
    roundRect(ctx, chestX, chestY, chestW, chestH, 12)
    ctx.fill()

    // Golden reinforcing straps
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 4
    roundRect(ctx, chestX, chestY, chestW, chestH, 12)
    ctx.stroke()
    ctx.fillStyle = '#fbbf24'
    roundRect(ctx, cx - 14, chestY + chestH * 0.28, 28, 30, 4)
    ctx.fill()

    // Hinged Lid swinging open backwards
    ctx.save()
    ctx.translate(chestX, chestY)
    ctx.rotate(-lidPhase * 2.0)
    const lidG = ctx.createLinearGradient(0, -chestH * 0.45, 0, 0)
    lidG.addColorStop(0, '#a16207')
    lidG.addColorStop(1, '#713f12')
    ctx.fillStyle = lidG
    roundRect(ctx, 0, -chestH * 0.45, chestW, chestH * 0.45, 14)
    ctx.fill()
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 4
    roundRect(ctx, 0, -chestH * 0.45, chestW, chestH * 0.45, 14)
    ctx.stroke()
    ctx.restore()
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 3. CANDY RAIN (Sweet Confectionery, Squishy Physics & Sprinkle Confetti)
// =============================================================================

const candyRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const treats: {
    x: number
    y: number
    vy: number
    vx: number
    rot: number
    vr: number
    emoji: string
    size: number
    landed: number
  }[] = []
  const sprinkles: Spark[] = []
  const emojis = ['🍦', '🍭', '🧁', '🍩', '🍪', '🍬', '🍫', '🎂']

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    if (t >= 0.5 && !audioPlayed) {
      audioPlayed = true
      audio.playCandy()
    }

    // Candy gradient background wash
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, 'rgba(244, 114, 182, 0.22)')
    g.addColorStop(1, 'rgba(56, 189, 248, 0.15)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    // Spawn falling treats
    if (t < 3.2 && treats.length < 42 && Math.random() < 0.45) {
      treats.push({
        x: rand(W * 0.05, W * 0.95),
        y: -60,
        vy: rand(280, 540),
        vx: rand(-35, 35),
        rot: rand(0, Math.PI * 2),
        vr: rand(-3, 3),
        emoji: pick(emojis),
        size: rand(52, 92),
        landed: 0,
      })
    }

    // Sprinkle confetti particles
    if (sprinkles.length < 150) {
      for (let i = 0; i < 3; i++) {
        sprinkles.push({
          x: rand(0, W),
          y: rand(-10, H),
          vx: rand(-20, 20),
          vy: rand(70, 160),
          life: 0,
          maxLife: rand(1.0, 2.0),
          color: pick(['#f472b6', '#a78bfa', '#38bdf8', '#fbbf24', '#34d399', '#f87171']),
          size: rand(3, 6),
        })
      }
    }

    for (let i = sprinkles.length - 1; i >= 0; i--) {
      const s = sprinkles[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        sprinkles.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      ctx.globalAlpha = 1 - s.life / s.maxLife
      ctx.fillStyle = s.color
      ctx.fillRect(s.x, s.y, s.size, s.size * 2.4)
      ctx.globalAlpha = 1
    }

    const floor = H - 55
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

      // Squishy spring bounce upon landing
      let scaleY = 1
      if (tr.landed > 0) {
        const since = t - tr.landed
        scaleY = since < 0.35 ? 1 - Math.sin((since / 0.35) * Math.PI) * 0.28 : 1
        tr.rot *= 1 - 4 * dt
      }

      ctx.save()
      ctx.translate(tr.x, tr.y)
      ctx.scale(1, scaleY)
      drawEmoji(ctx, tr.emoji, 0, 0, tr.size, tr.rot)
      ctx.restore()
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 4. PUPPY PARTY (Rolling Hills, Bouncing Pups, Flying Toys & Hearts)
// =============================================================================

const puppiesRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const pups = Array.from({ length: 6 }, (_, i) => ({
    x: 0,
    initOffset: 140 + i * rand(140, 270),
    speed: rand(0.18, 0.28),
    hop: rand(2.8, 3.8),
    phase: rand(0, Math.PI * 2),
    emoji: pick(['🐶', '🐕', '🐩', '🦮', '🐕‍🦺']),
    size: rand(78, 115),
  }))

  const hearts: Spark[] = []
  const balls = Array.from({ length: 3 }, () => ({
    x: rand(0.2, 0.8),
    y: -40,
    vy: rand(160, 280),
    vx: rand(-60, 60),
    emoji: pick(['🎾', '🦴', '🥏']),
    size: rand(40, 56),
  }))

  let initialized = false

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const ground = H * 0.82

    if (!initialized) {
      initialized = true
      pups.forEach((p) => {
        p.x = W + p.initOffset
      })
    }

    if (t >= 0.4 && !audioPlayed) {
      audioPlayed = true
      audio.playPuppies()
    }

    // Meadow Hill
    const meadowGrad = ctx.createLinearGradient(0, ground - 40, 0, H)
    meadowGrad.addColorStop(0, '#86efac')
    meadowGrad.addColorStop(1, '#22c55e')
    ctx.fillStyle = meadowGrad
    ctx.beginPath()
    ctx.moveTo(0, H)
    ctx.quadraticCurveTo(W / 2, ground - 50, W, H)
    ctx.closePath()
    ctx.fill()

    // Bouncing toys
    for (const b of balls) {
      const bx = b.x * W
      b.y += b.vy * dt
      b.vy += 760 * dt
      if (b.y > ground && b.vy > 0) b.vy *= -0.75
      drawEmoji(ctx, b.emoji, bx, b.y, b.size)
    }

    // Hopping puppies parade
    for (const p of pups) {
      p.x -= p.speed * W * dt
      if (p.x < -160) p.x = W + 160
      const hop = Math.abs(Math.sin(t * p.hop + p.phase)) * 48
      const y = ground - hop
      const tilt = Math.sin(t * p.hop + p.phase) * 0.14

      drawEmoji(ctx, p.emoji, p.x, y, p.size, tilt)

      if (Math.random() < 0.08) {
        hearts.push({
          x: p.x + rand(-20, 20),
          y: y - p.size * 0.45,
          vx: rand(-40, 40),
          vy: rand(-170, -80),
          life: 0,
          maxLife: rand(0.9, 1.7),
          color: pick(['💖', '💕', '❤️', '🩷']) as string,
          size: rand(22, 36),
        })
      }
    }

    // Floating hearts
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]
      h.life += dt
      if (h.life >= h.maxLife) {
        hearts.splice(i, 1)
        continue
      }
      h.x += h.vx * dt
      h.y += h.vy * dt
      ctx.globalAlpha = 1 - h.life / h.maxLife
      drawEmoji(ctx, h.color, h.x, h.y, h.size)
      ctx.globalAlpha = 1
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 5. VICTORY LAP (High-Speed Passes, Drifting Skid-Stop, Golden Trophy)
// =============================================================================

const racecarRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const flames: Spark[] = []
  let dashOffset = 0

  const passes = [
    { t0: 0.0, t1: 1.4, dir: 1, yRel: 0.25, size: 75 },
    { t0: 1.5, t1: 2.8, dir: -1, yRel: 0.55, size: 105 },
    { t0: 2.9, t1: 4.5, dir: 1, yRel: 0.85, size: 145 },
  ]

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const roadY = H * 0.62
    const roadH = H * 0.22

    if (t >= 0.2 && !audioPlayed) {
      audioPlayed = true
      audio.playRacecar()
    }

    // Twilight sky & cheering crowd
    const sky = ctx.createLinearGradient(0, 0, 0, roadY)
    sky.addColorStop(0, '#1e3a8a')
    sky.addColorStop(1, '#ea580c')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, W, roadY)

    for (let i = 0; i < 14; i++) {
      const bounce = Math.abs(Math.sin(t * 4 + i)) * 10
      drawEmoji(ctx, i % 2 ? '🙌' : '🎉', (i + 0.3) * (W / 14), roadY - 18 - bounce, 30)
    }

    // Roadway with center stripes
    ctx.fillStyle = '#1e293b'
    ctx.fillRect(0, roadY, W, roadH)
    dashOffset = (dashOffset + dt * 500) % 80
    ctx.fillStyle = '#fde047'
    for (let x = -80 + dashOffset; x < W; x += 80) {
      ctx.fillRect(x, roadY + roadH / 2 - 4, 44, 8)
    }

    let carX = W / 2
    let carY = roadY + roadH * 0.55
    let carSize = 150
    let dir = 1

    for (const p of passes) {
      if (t >= p.t0 && t < p.t1) {
        const prog = (t - p.t0) / (p.t1 - p.t0)
        carX = p.dir === 1 ? -160 + prog * (W + 320) : W + 160 - prog * (W + 320)
        carY = roadY + roadH * p.yRel
        carSize = p.size
        dir = p.dir

        // Turbo flame exhaust
        if (Math.random() < 0.6) {
          flames.push({
            x: carX - dir * carSize * 0.45,
            y: carY + 8,
            vx: -dir * rand(120, 240),
            vy: rand(-30, 30),
            life: 0,
            maxLife: rand(0.3, 0.7),
            color: pick(['#f97316', '#ef4444', '#facc15']),
            size: rand(6, 14),
          })
        }
      }
    }

    // Finale skid-stop in the center
    if (t >= 3.6) {
      const prog = Math.min((t - 3.6) / 0.8, 1)
      const ease = easeOutCubic(prog)
      carX = -160 + ease * (W / 2 + 160)
      carY = roadY + roadH * 0.8
      carSize = 150
      dir = 1

      // Drifting tire smoke
      if (prog < 0.95 && Math.random() < 0.7) {
        flames.push({
          x: carX - 40 + rand(-20, 20),
          y: carY + 20,
          vx: rand(-40, 40),
          vy: rand(-50, -20),
          life: 0,
          maxLife: rand(0.5, 1.0),
          color: '#e2e8f0',
          size: rand(10, 24),
        })
      }

      // Winner's Trophy
      const trophyPop = Math.min((t - 3.8) / 0.5, 1)
      if (trophyPop > 0) {
        const scale = easeOutBack(trophyPop)
        ctx.save()
        ctx.translate(W / 2, roadY - 70)
        ctx.scale(scale, scale)
        drawEmoji(ctx, '🏆', 0, 0, 85)
        ctx.restore()
      }
    }

    // Draw flames & smoke
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i]
      f.life += dt
      if (f.life >= f.maxLife) {
        flames.splice(i, 1)
        continue
      }
      f.x += f.vx * dt
      f.y += f.vy * dt
      ctx.globalAlpha = 1 - f.life / f.maxLife
      ctx.fillStyle = f.color
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Draw sports car
    ctx.save()
    ctx.translate(carX, carY)
    if (dir === -1) ctx.scale(-1, 1)
    drawEmoji(ctx, '🏎️', 0, 0, carSize)
    ctx.restore()
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 6. DINO EGG (Prehistoric Nest, Jagged Cracks, Exploding Shell & Baby Dino)
// =============================================================================

const dinoEggRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const shellBits: {
    x: number
    y: number
    vx: number
    vy: number
    rot: number
    vr: number
    size: number
  }[] = []
  const leaves: Spark[] = []
  let burst = false
  const hatchT = 2.1

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2
    const eggY = H * 0.6
    const eggR = Math.min(W, H) * 0.15

    if (t >= 0.2 && !audioPlayed) {
      audioPlayed = true
      audio.playDinoEgg()
    }

    // Jungle trees
    drawEmoji(ctx, '🌴', W * 0.12, H * 0.74, 75)
    drawEmoji(ctx, '🌴', W * 0.88, H * 0.72, 75)
    drawEmoji(ctx, '🌿', W * 0.22, H * 0.82, 50)
    drawEmoji(ctx, '🌿', W * 0.78, H * 0.84, 50)

    // Twig & moss nest
    ctx.fillStyle = '#8d6e63'
    ctx.beginPath()
    ctx.ellipse(cx, eggY + eggR * 0.9, eggR * 1.5, eggR * 0.45, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6d4c41'
    ctx.beginPath()
    ctx.ellipse(cx, eggY + eggR * 0.82, eggR * 1.2, eggR * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()

    if (t < hatchT) {
      const wobble = Math.sin(t * 16) * 0.16 * (t / hatchT)
      ctx.save()
      ctx.translate(cx, eggY + eggR)
      ctx.rotate(wobble)
      ctx.translate(0, -eggR)

      // Dinosaur egg
      const eggGrad = ctx.createLinearGradient(0, -eggR, 0, eggR)
      eggGrad.addColorStop(0, '#fefce8')
      eggGrad.addColorStop(1, '#d9f99d')
      ctx.fillStyle = eggGrad
      ctx.beginPath()
      ctx.ellipse(0, 0, eggR * 0.78, eggR, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#a3b18a'
      ctx.lineWidth = 4
      ctx.stroke()

      // Spots
      ctx.fillStyle = 'rgba(132, 204, 22, 0.4)'
      ;[
        [-0.3, -0.4, 0.14],
        [0.32, -0.1, 0.11],
        [-0.15, 0.42, 0.16],
      ].forEach(([sx, sy, sr]) => {
        ctx.beginPath()
        ctx.arc(sx * eggR, sy * eggR, sr * eggR, 0, Math.PI * 2)
        ctx.fill()
      })

      // Growing cracks
      const crackP = Math.max(0, (t - 0.7) / (hatchT - 0.7))
      if (crackP > 0) {
        ctx.strokeStyle = '#57534e'
        ctx.lineWidth = 3
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
      }
      ctx.restore()
    } else {
      // Hatched!
      if (!burst) {
        burst = true
        for (let i = 0; i < 16; i++) {
          const ang = rand(-Math.PI, 0)
          shellBits.push({
            x: cx + rand(-eggR * 0.5, eggR * 0.5),
            y: eggY,
            vx: Math.cos(ang) * rand(160, 440),
            vy: Math.sin(ang) * rand(260, 580),
            rot: rand(0, Math.PI * 2),
            vr: rand(-8, 8),
            size: rand(16, 36),
          })
        }
      }

      // Adorable baby dinosaur springs up
      const since = t - hatchT
      const popP = Math.min(since / 0.5, 1)
      const overshoot = easeOutBack(popP)
      const bob = since > 0.5 ? Math.sin(since * 5) * 8 : 0

      ctx.save()
      ctx.translate(cx, eggY - eggR * 0.35 + bob)
      ctx.scale(overshoot, overshoot)
      drawEmoji(ctx, '🦕', 0, 0, eggR * 2.2)
      ctx.restore()

      // Broken shells
      ctx.fillStyle = '#fefce8'
      ctx.beginPath()
      ctx.ellipse(cx - eggR * 0.55, eggY + eggR * 0.55, eggR * 0.42, eggR * 0.3, -0.3, 0, Math.PI, true)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx + eggR * 0.55, eggY + eggR * 0.55, eggR * 0.42, eggR * 0.3, 0.3, 0, Math.PI, true)
      ctx.fill()
    }

    // Flying shell shards
    for (let i = shellBits.length - 1; i >= 0; i--) {
      const b = shellBits[i]
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.vy += 900 * dt
      b.rot += b.vr * dt
      if (b.y > H + 60) {
        shellBits.splice(i, 1)
        continue
      }
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
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 7. UFO DELIVERY (Starry Nebula, Tractor Beam, Mystery Gift & Warp Woosh)
// =============================================================================

const ufoRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.75,
    s: rand(1.5, 3.5),
    tw: rand(0, Math.PI * 2),
  }))
  const sparks: Spark[] = []
  let popped = false

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2
    const hoverY = H * 0.22
    const groundY = H * 0.8

    if (t >= 0.2 && !audioPlayed) {
      audioPlayed = true
      audio.playUfo()
    }

    // Starry space
    for (const st of stars) {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + st.tw))
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(st.x * W, st.y * H, st.s, st.s)
    }
    ctx.globalAlpha = 1

    // Moon surface
    ctx.fillStyle = 'rgba(148, 163, 184, 0.28)'
    ctx.beginPath()
    ctx.moveTo(0, H)
    ctx.quadraticCurveTo(W / 2, groundY - 30, W, H)
    ctx.closePath()
    ctx.fill()

    // UFO flight
    const arriveP = Math.min(t / 1.0, 1)
    const arriveEase = easeOutCubic(arriveP)
    const leaving = t > 3.6
    let ufoX = -180 + arriveEase * (cx + 180)
    let ufoY = hoverY + Math.sin(t * 3) * 8
    if (leaving) {
      const lp = (t - 3.6) / 0.5
      ufoX = cx + lp * lp * (W * 0.7 + 200)
      ufoY = hoverY - lp * lp * H * 0.3
    }

    // Glowing tractor beam
    const beamOn = t > 1.0 && t < 3.2
    if (beamOn) {
      const beamA = Math.min((t - 1.0) / 0.3, 1) * (t > 2.9 ? 1 - (t - 2.9) / 0.3 : 1)
      const beamGrad = ctx.createLinearGradient(0, ufoY, 0, groundY)
      beamGrad.addColorStop(0, `rgba(134, 239, 172, ${0.55 * beamA})`)
      beamGrad.addColorStop(1, `rgba(134, 239, 172, ${0.08 * beamA})`)
      ctx.fillStyle = beamGrad
      ctx.beginPath()
      ctx.moveTo(ufoX - 35, ufoY + 22)
      ctx.lineTo(ufoX + 35, ufoY + 22)
      ctx.lineTo(ufoX + 120, groundY)
      ctx.lineTo(ufoX - 120, groundY)
      ctx.closePath()
      ctx.fill()
    }

    // Mystery Gift floating down
    if (t > 1.2 && !popped) {
      const dropP = Math.min((t - 1.2) / 1.4, 1)
      const ease = dropP * dropP * (3 - 2 * dropP)
      const giftY = ufoY + 60 + ease * (groundY - ufoY - 100)
      drawEmoji(ctx, '🎁', cx, giftY, 80, Math.sin(t * 3) * 0.2)

      if (t > 2.6) {
        popped = true
        for (let i = 0; i < 55; i++) {
          const ang = rand(-Math.PI, 0)
          sparks.push({
            x: cx,
            y: groundY - 50,
            vx: Math.cos(ang) * rand(140, 440),
            vy: Math.sin(ang) * rand(190, 540),
            life: 0,
            maxLife: rand(0.8, 1.5),
            color: pick(['#86efac', '#fde047', '#93c5fd', '#f472b6', '#ffffff']),
            size: rand(3, 7),
          })
        }
      }
    }

    // Exploded mystery reward
    if (popped) {
      drawEmoji(ctx, '🎉', cx, groundY - 45, 80)
      const rise = Math.min((t - 2.6) / 0.6, 1)
      drawEmoji(ctx, '⭐', cx, groundY - 90 - rise * 60, 45 + rise * 35)
    }

    // Flying Saucer
    drawEmoji(ctx, '🛸', ufoX, ufoY, 115, Math.sin(t * 3) * 0.06)

    // Sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        sparks.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.vy += 520 * dt
      ctx.globalAlpha = 1 - s.life / s.maxLife
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 8. RAINBOW DRAGON (Majestic Flight, Billowing Rainbow Fire & Golden Coins)
// =============================================================================

const DRAGON_FIRE = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#a78bfa']

const dragonRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const fire: Spark[] = []
  const coins: Spark[] = []

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)

    if (t >= 0.3 && !audioPlayed) {
      audioPlayed = true
      audio.playDragon()
    }

    // Castle in background
    drawEmoji(ctx, '🏰', W * 0.88, H * 0.84, 95)

    const lap = 2.2
    const dir = Math.floor(t / lap) % 2 === 0 ? 1 : -1
    const p = (t % lap) / lap
    const x = dir === 1 ? -180 + p * (W + 360) : W + 180 - p * (W + 360)
    const y = H * 0.36 + Math.sin(p * Math.PI * 2 + t) * H * 0.16
    const flap = Math.sin(t * 8) * 0.14

    // Torrent of rainbow fire
    for (let i = 0; i < 7; i++) {
      fire.push({
        x: x + dir * rand(60, 100),
        y: y + rand(0, 30),
        vx: dir * rand(220, 500) + rand(-40, 40),
        vy: rand(-60, 120),
        life: 0,
        maxLife: rand(0.5, 1.2),
        color: pick(DRAGON_FIRE),
        size: rand(5, 13),
      })
    }

    // Gold coins tumbling from claws
    if (Math.random() < 0.22) {
      coins.push({
        x: x + rand(-30, 30),
        y: y + 40,
        vx: rand(-60, 60),
        vy: rand(20, 130),
        life: 0,
        maxLife: rand(1.3, 2.3),
        color: '#ffd700',
        size: rand(8, 13),
      })
    }

    // Draw fire
    for (let i = fire.length - 1; i >= 0; i--) {
      const f = fire[i]
      f.life += dt
      if (f.life >= f.maxLife) {
        fire.splice(i, 1)
        continue
      }
      f.x += f.vx * dt
      f.y += f.vy * dt
      ctx.globalAlpha = 1 - f.life / f.maxLife
      ctx.fillStyle = f.color
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Draw coins
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]
      c.life += dt
      if (c.life >= c.maxLife) {
        coins.splice(i, 1)
        continue
      }
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.vy += 520 * dt
      if (c.y > H - 20 && c.vy > 0) c.vy *= -0.5
      const squash = 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + c.size))
      ctx.globalAlpha = 1 - c.life / c.maxLife
      ctx.fillStyle = c.color
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.size * squash, c.size, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Draw Dragon
    ctx.save()
    ctx.translate(x, y)
    if (dir === 1) ctx.scale(-1, 1)
    drawEmoji(ctx, '🐉', 0, 0, 155, flap)
    ctx.restore()
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 9. ROBOT DISCO PARTY (Neon Equalizer, Mirror Disco Ball & Dancing Robots)
// =============================================================================

const robotRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const notes: { x: number; y: number; vy: number; wobble: number; emoji: string; size: number }[] = []
  const beamColors = ['#f472b6', '#38bdf8', '#fde047', '#4ade80', '#a78bfa']

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const floorY = H * 0.78

    if (t >= 0.2 && !audioPlayed) {
      audioPlayed = true
      audio.playRobot()
    }

    // Neon equalizer spectrum bars on sides
    for (let i = 0; i < 12; i++) {
      const barH = 30 + Math.abs(Math.sin(t * 8 + i * 0.7)) * 140
      ctx.fillStyle = pick(beamColors)
      ctx.globalAlpha = 0.45
      ctx.fillRect(20 + i * 16, floorY - barH, 12, barH)
      ctx.fillRect(W - 20 - (i + 1) * 16, floorY - barH, 12, barH)
      ctx.globalAlpha = 1
    }

    // Disco Ball
    const ballR = 46
    const ballY = 72
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

    // Disco ball mirror sparkles
    for (let i = 0; i < 8; i++) {
      const ga = t * 2.5 + (i / 8) * Math.PI * 2
      const gx = W / 2 + Math.cos(ga) * ballR * 0.75
      const gy = ballY + Math.sin(ga) * ballR * 0.35
      ctx.fillStyle = pick(beamColors)
      ctx.fillRect(gx - 3, gy - 3, 6, 6)
    }

    // Neon Dance Floor
    const tiles = 8
    const tileW = W / tiles
    const tileH = (H - floorY) / 2
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < tiles; c++) {
        const flash = (Math.floor(t * 4) + r + c) % beamColors.length
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 8 + c + r)
        ctx.fillStyle = beamColors[flash]
        ctx.fillRect(c * tileW, floorY + r * tileH, tileW - 2, tileH - 2)
        ctx.globalAlpha = 1
      }
    }

    // 3 Dancing Robots
    const bots = [
      { x: W * 0.26, size: 110, beat: 4, phase: 0 },
      { x: W * 0.5, size: 145, beat: 4, phase: Math.PI / 2 },
      { x: W * 0.74, size: 110, beat: 4, phase: Math.PI },
    ]

    for (const b of bots) {
      const bounce = Math.abs(Math.sin(t * b.beat + b.phase)) * 36
      const tilt = Math.sin(t * b.beat * 0.5 + b.phase) * 0.24
      drawEmoji(ctx, '🤖', b.x, floorY - b.size * 0.45 - bounce, b.size, tilt)
    }

    // Floating Music Notes
    if (notes.length < 15 && Math.random() < 0.25) {
      notes.push({
        x: rand(W * 0.15, W * 0.85),
        y: floorY,
        vy: rand(-150, -75),
        wobble: rand(0, Math.PI * 2),
        emoji: pick(['🎵', '🎶', '🪩', '✨']),
        size: rand(30, 50),
      })
    }

    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i]
      n.y += n.vy * dt
      n.x += Math.sin(t * 3 + n.wobble) * 40 * dt
      if (n.y < -60) {
        notes.splice(i, 1)
        continue
      }
      drawEmoji(ctx, n.emoji, n.x, n.y, n.size)
    }
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// 10. PIRATE TREASURE (Caribbean Waves, Galleon Cannons, Gold Dubloons)
// =============================================================================

const pirateRun = (canvas: HTMLCanvasElement) => {
  const { ctx, getSize, cleanup: canvasCleanup } = setupCanvas(canvas)
  const audio = new RewardAudio()
  let audioPlayed = false

  const booty: Spark[] = []
  const smoke: Spark[] = []

  const stopLoop = loop((dt, t, W, H) => {
    ctx.clearRect(0, 0, W, H)
    const seaY = H * 0.68

    if (t >= 0.4 && !audioPlayed) {
      audioPlayed = true
      audio.playPirate()
    }

    // Tropical island with palm & X
    ctx.fillStyle = 'rgba(253, 224, 71, 0.45)'
    ctx.beginPath()
    ctx.ellipse(W * 0.85, seaY + 24, 140, 36, 0, 0, Math.PI * 2)
    ctx.fill()
    drawEmoji(ctx, '🌴', W * 0.88, seaY - 12, 75)

    // Red X marks the spot
    ctx.strokeStyle = '#dc2626'
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    const xx = W * 0.8
    const xy = seaY + 22
    ctx.beginPath()
    ctx.moveTo(xx - 14, xy - 14)
    ctx.lineTo(xx + 14, xy + 14)
    ctx.moveTo(xx + 14, xy - 14)
    ctx.lineTo(xx - 14, xy + 14)
    ctx.stroke()

    // Pirate Ship sailing in
    const sailP = Math.min(t / 2.0, 1)
    const shipX = -180 + easeOutCubic(sailP) * (W * 0.38 + 180)
    const bob = Math.sin(t * 2) * 10
    const rock = Math.sin(t * 2 + 0.6) * 0.06

    ctx.save()
    ctx.translate(shipX, seaY - 30 + bob)
    ctx.rotate(rock)
    drawEmoji(ctx, '⛵', 0, 0, 155)
    drawEmoji(ctx, '🏴‍☠️', 8, -88, 46)
    ctx.restore()

    // Cannon fire bursts at 1.0s
    if (t >= 1.0 && t < 1.15) {
      for (let i = 0; i < 24; i++) {
        booty.push({
          x: shipX + 60,
          y: seaY - 60 + bob,
          vx: rand(240, 500),
          vy: rand(-640, -400),
          life: 0,
          maxLife: rand(1.5, 2.3),
          color: pick(['#ffd700', '#facc15', '#f43f5e', '#38bdf8']),
          size: rand(7, 13),
        })
      }
      for (let i = 0; i < 8; i++) {
        smoke.push({
          x: shipX + 70,
          y: seaY - 55 + bob,
          vx: rand(30, 90),
          vy: rand(-60, -10),
          life: 0,
          maxLife: rand(0.5, 1.1),
          color: '#e2e8f0',
          size: rand(8, 20),
        })
      }
    }

    // Draw smoke
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i]
      s.life += dt
      if (s.life >= s.maxLife) {
        smoke.splice(i, 1)
        continue
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      ctx.globalAlpha = (1 - s.life / s.maxLife) * 0.6
      ctx.fillStyle = s.color
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.size * (1 + s.life), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // Draw booty (gold dubloons & gems)
    for (let i = booty.length - 1; i >= 0; i--) {
      const c = booty[i]
      c.life += dt
      if (c.life >= c.maxLife) {
        booty.splice(i, 1)
        continue
      }
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.vy += 850 * dt
      if (c.y > seaY + 20 && c.vy > 0) c.vy *= -0.4
      const squash = 0.4 + 0.6 * Math.abs(Math.sin(t * 7 + c.size))
      ctx.fillStyle = c.color
      ctx.beginPath()
      ctx.ellipse(c.x, c.y, c.size * squash, c.size, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // Rolling turquoise ocean waves
    for (let band = 0; band < 3; band++) {
      const wy = seaY + band * ((H - seaY) / 3)
      ctx.fillStyle = `rgba(56, 189, 248, ${0.35 + band * 0.18})`
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
  }, getSize)

  return () => {
    stopLoop()
    canvasCleanup()
    audio.close()
  }
}

// =============================================================================
// REWARD ANIMATIONS REGISTRY
// =============================================================================

export const REWARD_ANIMATIONS: RewardAnimation[] = [
  {
    name: 'fairy',
    emoji: '🧚',
    label: 'Fairy wish',
    backdrop: 'rgba(30, 10, 60, 0.98)',
    praise: ['Wish granted!', 'Magic is real!', 'You earned this!'],
    durationMs: 4800,
    hideHtmlPraise: true, // fairy animation renders its own glowing "WISH GRANTED!" banner
    run: fairyRun,
  },
  {
    name: 'treasure',
    emoji: '💰',
    label: 'Treasure chest',
    backdrop: 'rgba(20, 12, 45, 0.98)',
    praise: ['Treasure unlocked!', 'You struck gold!', 'Riches for royalty!'],
    durationMs: 4800,
    run: treasureRun,
  },
  {
    name: 'candy',
    emoji: '🍭',
    label: 'Sweet treats',
    backdrop: 'rgba(80, 30, 70, 0.98)',
    praise: ['Sweet reward!', 'Treat yourself!', 'How sweet it is!'],
    durationMs: 4800,
    run: candyRun,
  },
  {
    name: 'puppies',
    emoji: '🐶',
    label: 'Puppy party',
    backdrop: 'rgba(15, 60, 45, 0.98)',
    praise: ['Puppy party!', 'Pawsome job!', 'You earned all the love!'],
    durationMs: 4800,
    run: puppiesRun,
  },
  {
    name: 'racecar',
    emoji: '🏎️',
    label: 'Victory lap',
    backdrop: 'rgba(15, 23, 42, 0.98)',
    praise: ['Victory lap!', 'Vroom vroom, champ!', 'Pole position!'],
    durationMs: 4800,
    run: racecarRun,
  },
  {
    name: 'dinoegg',
    emoji: '🦕',
    label: 'Dino egg',
    backdrop: 'rgba(22, 46, 18, 0.98)',
    praise: ['A baby dino hatched!', 'RAWR-some reward!', 'Dino-mite!'],
    durationMs: 4800,
    run: dinoEggRun,
  },
  {
    name: 'ufo',
    emoji: '🛸',
    label: 'UFO delivery',
    backdrop: 'rgba(6, 10, 34, 0.98)',
    praise: ['Special delivery from space!', 'The aliens approve!', 'Out of this world!'],
    durationMs: 4800,
    run: ufoRun,
  },
  {
    name: 'dragon',
    emoji: '🐉',
    label: 'Dragon',
    backdrop: 'rgba(40, 18, 60, 0.98)',
    praise: ['Dragon-approved!', 'Legendary!', 'Rainbow fire for you!'],
    durationMs: 4800,
    run: dragonRun,
  },
  {
    name: 'robot',
    emoji: '🤖',
    label: 'Robot party',
    backdrop: 'rgba(10, 12, 32, 0.98)',
    praise: ['Robot dance party!', 'Beep boop, you rock!', 'Maximum awesome detected!'],
    durationMs: 4800,
    run: robotRun,
  },
  {
    name: 'pirate',
    emoji: '🏴‍☠️',
    label: 'Pirate treasure',
    backdrop: 'rgba(7, 30, 55, 0.98)',
    praise: ['Ahoy, treasure earned!', 'Shiver me timbers!', 'X marks YOUR spot!'],
    durationMs: 4800,
    run: pirateRun,
  },
]
