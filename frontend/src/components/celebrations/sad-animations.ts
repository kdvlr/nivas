/**
 * Sad chore / penalty animations: high-production, cinematic visual storytelling
 * for when a negative chore (like "Room Not Clean") is completed.
 *
 * Performance standards:
 * - Avoids layout thrashing (cached dimensions, resize listener).
 * - High-DPI retina rendering support.
 * - Pauses background frame loops on document.visibilitychange.
 */

export type SadAnimationName = 'icecream' | 'storm'

export interface SadAnimationOptions {
  title?: string
  coinsLost?: number
  animation?: SadAnimationName
}

// =============================================================================
// WEB AUDIO SYNTHESIZERS: SAD TROMBONE & ICE CREAM TRAGEDY AUDIO
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

/**
 * Story-driven Web Audio sequencer for the Ice Cream Tragedy:
 * 1. Cheerful marimba notes while licking ice cream.
 * 2. Comical descending slip-whistle when scoop falls.
 * 3. Wet SPLAT on ground impact.
 * 4. Weeping wah-wah crying chords.
 * 5. Bird flap & chirp snatch swoosh.
 * 6. Penalty gong / sting when points are removed.
 */
export function scheduleIceCreamStoryAudio(): () => void {
  if (typeof window === 'undefined') return () => {}
  try {
    if (localStorage.getItem('nivas_celebration_sound') === 'false') return () => {}
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return () => {}
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const t0 = ctx.currentTime

    // 1. Happy lick chimes (t = 0.15s, 0.4s, 0.65s)
    const chimes = [
      { f: 523.25, time: 0.15 }, // C5
      { f: 659.25, time: 0.4 },  // E5
      { f: 783.99, time: 0.65 }, // G5
    ]
    chimes.forEach((c) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(c.f, t0 + c.time)
      gain.gain.setValueAtTime(0, t0 + c.time)
      gain.gain.linearRampToValueAtTime(0.18, t0 + c.time + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + c.time + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0 + c.time)
      osc.stop(t0 + c.time + 0.25)
    })

    // 2. Slip Whistle (t = 1.6s)
    const slipOsc = ctx.createOscillator()
    const slipGain = ctx.createGain()
    slipOsc.type = 'sine'
    slipOsc.frequency.setValueAtTime(820, t0 + 1.6)
    slipOsc.frequency.exponentialRampToValueAtTime(260, t0 + 2.05)
    slipGain.gain.setValueAtTime(0, t0 + 1.6)
    slipGain.gain.linearRampToValueAtTime(0.19, t0 + 1.65)
    slipGain.gain.exponentialRampToValueAtTime(0.001, t0 + 2.1)
    slipOsc.connect(slipGain)
    slipGain.connect(ctx.destination)
    slipOsc.start(t0 + 1.6)
    slipOsc.stop(t0 + 2.15)

    // 3. Wet SPLAT! (t = 2.15s)
    const splatOsc = ctx.createOscillator()
    const splatGain = ctx.createGain()
    splatOsc.type = 'triangle'
    splatOsc.frequency.setValueAtTime(140, t0 + 2.15)
    splatOsc.frequency.exponentialRampToValueAtTime(45, t0 + 2.35)
    splatGain.gain.setValueAtTime(0, t0 + 2.15)
    splatGain.gain.linearRampToValueAtTime(0.35, t0 + 2.17)
    splatGain.gain.exponentialRampToValueAtTime(0.001, t0 + 2.45)
    splatOsc.connect(splatGain)
    splatGain.connect(ctx.destination)
    splatOsc.start(t0 + 2.15)
    splatOsc.stop(t0 + 2.5)

    // 4. Crying Wah-Wah (t = 2.5s)
    const cryNotes = [
      { f: 370, time: 2.5, dur: 0.35 },
      { f: 330, time: 2.9, dur: 0.35 },
      { f: 311, time: 3.3, dur: 0.4 },
      { f: 293, time: 3.75, dur: 1.1, bendTo: 246 },
    ]
    cryNotes.forEach((n) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(750, t0 + n.time)
      filter.Q.setValueAtTime(2.5, t0 + n.time)

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(n.f, t0 + n.time)
      if (n.bendTo) {
        osc.frequency.setValueAtTime(n.f, t0 + n.time + 0.2)
        osc.frequency.exponentialRampToValueAtTime(n.bendTo, t0 + n.time + n.dur)
      }

      gain.gain.setValueAtTime(0, t0 + n.time)
      gain.gain.linearRampToValueAtTime(0.2, t0 + n.time + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.time + n.dur)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0 + n.time)
      osc.stop(t0 + n.time + n.dur + 0.1)
    })

    // 5. Bird Swoop & Snatch (t = 4.0s - 4.35s)
    const birdOsc = ctx.createOscillator()
    const birdGain = ctx.createGain()
    birdOsc.type = 'triangle'
    birdOsc.frequency.setValueAtTime(2200, t0 + 4.0)
    birdOsc.frequency.exponentialRampToValueAtTime(3200, t0 + 4.15)
    birdOsc.frequency.exponentialRampToValueAtTime(1800, t0 + 4.35)
    birdGain.gain.setValueAtTime(0, t0 + 4.0)
    birdGain.gain.linearRampToValueAtTime(0.18, t0 + 4.1)
    birdGain.gain.exponentialRampToValueAtTime(0.001, t0 + 4.4)
    birdOsc.connect(birdGain)
    birdGain.connect(ctx.destination)
    birdOsc.start(t0 + 4.0)
    birdOsc.stop(t0 + 4.45)

    // Snatch Pop (t = 4.25s)
    const popOsc = ctx.createOscillator()
    const popGain = ctx.createGain()
    popOsc.type = 'sine'
    popOsc.frequency.setValueAtTime(650, t0 + 4.25)
    popOsc.frequency.exponentialRampToValueAtTime(120, t0 + 4.38)
    popGain.gain.setValueAtTime(0, t0 + 4.25)
    popGain.gain.linearRampToValueAtTime(0.32, t0 + 4.27)
    popGain.gain.exponentialRampToValueAtTime(0.001, t0 + 4.4)
    popOsc.connect(popGain)
    popGain.connect(ctx.destination)
    popOsc.start(t0 + 4.25)
    popOsc.stop(t0 + 4.45)

    // 6. Penalty Sting (t = 4.85s)
    const gong = ctx.createOscillator()
    const gongGain = ctx.createGain()
    gong.type = 'sine'
    gong.frequency.setValueAtTime(164.81, t0 + 4.85) // E3
    gongGain.gain.setValueAtTime(0, t0 + 4.85)
    gongGain.gain.linearRampToValueAtTime(0.24, t0 + 4.88)
    gongGain.gain.exponentialRampToValueAtTime(0.001, t0 + 6.3)
    gong.connect(gongGain)
    gongGain.connect(ctx.destination)
    gong.start(t0 + 4.85)
    gong.stop(t0 + 6.4)

    return () => {
      try {
        ctx.close()
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    console.warn('[IceCreamAudio] Unable to play audio:', e)
    return () => {}
  }
}

// =============================================================================
// ICE CREAM TRAGEDY CANVAS ANIMATION RUNNER
// =============================================================================

export function runIceCreamTragedyAnimation(
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

  // Start sound sequencer
  const stopAudio = scheduleIceCreamStoryAudio()

  // Tear particle system
  interface TearParticle {
    x: number
    y: number
    vx: number
    vy: number
    size: number
    alpha: number
  }
  const tears: TearParticle[] = []

  // Ground splash circles from tears
  interface TearSplash {
    x: number
    y: number
    r: number
    alpha: number
  }
  const tearSplashes: TearSplash[] = []

  // Splat droplets from the dropped ice cream scoop
  interface SplatDrop {
    x: number
    y: number
    vx: number
    vy: number
    r: number
    color: string
    settled: boolean
  }
  const splatDrops: SplatDrop[] = []
  let splatCreated = false

  // Sparkles during happy eating phase
  const sparkles = Array.from({ length: 12 }, () => ({
    x: 0,
    y: 0,
    r: Math.random() * 4 + 2,
    alpha: Math.random(),
    speed: Math.random() * 1.5 + 0.8,
    angle: Math.random() * Math.PI * 2,
  }))

  let lastTime = performance.now()
  const startTime = lastTime

  const loop = (now: number) => {
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now
    const elapsed = (now - startTime) / 1000

    ctx.clearRect(0, 0, width, height)

    // Layout metrics (responsive & high DPI safe)
    const cx = width / 2
    const groundY = height * 0.77
    const scale = Math.min(width / 680, height / 740, 1.25)
    const kidX = cx
    const kidY = groundY

    // 1. Atmospheric Comic Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
    bgGrad.addColorStop(0, '#0f172a')
    bgGrad.addColorStop(0.55, '#1e293b')
    bgGrad.addColorStop(0.77, '#334155')
    bgGrad.addColorStop(1, '#0f172a')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // Floor line and soft floor shadow under kid
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.beginPath()
    ctx.ellipse(kidX, groundY + 4 * scale, 95 * scale, 18 * scale, 0, 0, Math.PI * 2)
    ctx.fill()

    // 2. Compute Animation Stages & Coordinates
    // t < 1.6s: Eating bliss
    // 1.6s <= t < 2.15s: Scoop slips & falls
    // 2.15s <= t < 3.8s: Splat & arms spread crying
    // 3.8s <= t < 5.0s: Bird swoops and steals cone
    // 5.0s <= t: Defeat & penalty banner

    const isEating = elapsed < 1.6
    const isDropping = elapsed >= 1.6 && elapsed < 2.15
    const isSplatted = elapsed >= 2.15
    const isCrying = elapsed >= 2.4
    const isBirdAttacking = elapsed >= 3.8
    const birdHasCone = elapsed >= 4.25

    // Cone hand location on kid (left arm in despair or right arm in bliss)
    let coneHandX = kidX + 42 * scale
    let coneHandY = kidY - 148 * scale
    if (elapsed >= 2.3) {
      // Hands spread wide in despair: left hand holds cone out at left
      const trembling = isCrying ? Math.sin(elapsed * 32) * (2 * scale) : 0
      coneHandX = kidX - 82 * scale + trembling
      coneHandY = kidY - 140 * scale + trembling
    }

    // Scoop position
    let scoopX = coneHandX
    let scoopY = coneHandY - 26 * scale
    let scoopRot = 0

    if (isDropping) {
      const dropT = elapsed - 1.6
      if (dropT < 0.2) {
        // Wobble on cone lip
        scoopRot = Math.sin(dropT * 35) * 0.28
        scoopX = coneHandX + Math.sin(dropT * 35) * 6 * scale
      } else {
        // Free fall with gravity
        const fallT = dropT - 0.2
        scoopY = coneHandY - 26 * scale + 0.5 * 1450 * scale * fallT * fallT
        scoopX = coneHandX + fallT * 48 * scale
        scoopRot = fallT * 5.2
      }
    } else if (isSplatted) {
      scoopX = kidX + 22 * scale
      scoopY = groundY + 2 * scale
    }

    // 3. Spawn Splat Particles on Ground Hit
    if (isSplatted && !splatCreated) {
      splatCreated = true
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2
        const spd = Math.random() * 120 + 30
        splatDrops.push({
          x: scoopX,
          y: groundY - 2,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd * 0.45,
          r: Math.random() * 5 + 2,
          color: Math.random() < 0.8 ? '#f43f5e' : '#fb7185',
          settled: false,
        })
      }
    }

    // Update splat drops
    splatDrops.forEach((d) => {
      if (!d.settled) {
        d.x += d.vx * dt
        d.y += d.vy * dt
        d.vx *= 0.9
        d.vy *= 0.9
        if (Math.abs(d.vx) < 1) d.settled = true
      }
      ctx.fillStyle = d.color
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.r * scale, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw Splatted Scoop on Floor
    if (isSplatted) {
      ctx.save()
      ctx.translate(scoopX, scoopY)
      // Main squished ice cream puddle
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.ellipse(0, 0, 48 * scale, 14 * scale, 0, 0, Math.PI * 2)
      ctx.fill()

      // Lighter top reflection
      ctx.fillStyle = '#fb7185'
      ctx.beginPath()
      ctx.ellipse(-6 * scale, -2 * scale, 34 * scale, 9 * scale, 0, 0, Math.PI * 2)
      ctx.fill()

      // Fallen cherry rolling away
      ctx.fillStyle = '#9f1239'
      ctx.beginPath()
      ctx.arc(38 * scale, 2 * scale, 8 * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 2 * scale
      ctx.beginPath()
      ctx.moveTo(38 * scale, -5 * scale)
      ctx.quadraticCurveTo(46 * scale, -16 * scale, 42 * scale, -22 * scale)
      ctx.stroke()
      ctx.restore()
    }

    // 4. DRAW THE KID
    ctx.save()
    const idleBounce = isEating ? Math.sin(elapsed * 7) * (5 * scale) : 0
    const cryingShake = isCrying && elapsed < 4.8 ? Math.sin(elapsed * 38) * (2.5 * scale) : 0
    const kidBaseY = kidY + idleBounce + cryingShake

    // Kid Legs & Sneakers
    ctx.fillStyle = '#0284c7' // Blue shorts
    ctx.fillRect(kidX - 26 * scale, kidBaseY - 82 * scale, 22 * scale, 32 * scale)
    ctx.fillRect(kidX + 4 * scale, kidBaseY - 82 * scale, 22 * scale, 32 * scale)

    // Skin legs
    ctx.fillStyle = '#fed7aa'
    ctx.fillRect(kidX - 22 * scale, kidBaseY - 50 * scale, 14 * scale, 36 * scale)
    ctx.fillRect(kidX + 8 * scale, kidBaseY - 50 * scale, 14 * scale, 36 * scale)

    // Red sneakers
    ctx.fillStyle = '#e11d48'
    roundRect(ctx, kidX - 28 * scale, kidBaseY - 18 * scale, 26 * scale, 18 * scale, 6 * scale)
    ctx.fill()
    roundRect(ctx, kidX + 6 * scale, kidBaseY - 18 * scale, 26 * scale, 18 * scale, 6 * scale)
    ctx.fill()
    // White soles
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(kidX - 28 * scale, kidBaseY - 6 * scale, 26 * scale, 6 * scale)
    ctx.fillRect(kidX + 6 * scale, kidBaseY - 6 * scale, 26 * scale, 6 * scale)

    // Torso / Coral T-Shirt
    ctx.fillStyle = '#fb7185'
    roundRect(ctx, kidX - 32 * scale, kidBaseY - 150 * scale, 64 * scale, 74 * scale, 16 * scale)
    ctx.fill()
    // Cute star icon on shirt
    ctx.fillStyle = '#fef08a'
    ctx.beginPath()
    ctx.arc(kidX, kidBaseY - 116 * scale, 9 * scale, 0, Math.PI * 2)
    ctx.fill()

    // Arms & Hands
    ctx.lineWidth = 14 * scale
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#fed7aa'

    if (isEating || isDropping) {
      // Right arm holding cone near mouth
      ctx.beginPath()
      ctx.moveTo(kidX + 24 * scale, kidBaseY - 138 * scale)
      ctx.quadraticCurveTo(kidX + 44 * scale, kidBaseY - 110 * scale, coneHandX, coneHandY)
      ctx.stroke()

      // Left arm at side
      ctx.beginPath()
      ctx.moveTo(kidX - 26 * scale, kidBaseY - 138 * scale)
      ctx.lineTo(kidX - 38 * scale, kidBaseY - 90 * scale)
      ctx.stroke()
    } else {
      // SPREAD HANDS OUT WIDE IN DESPAIR!
      // Left arm stretched wide holding cone (or empty)
      ctx.beginPath()
      ctx.moveTo(kidX - 24 * scale, kidBaseY - 138 * scale)
      ctx.lineTo(coneHandX, coneHandY)
      ctx.stroke()

      // Right arm stretched wide to the other side
      const rightHandX = kidX + 88 * scale + cryingShake
      const rightHandY = kidBaseY - 140 * scale + cryingShake
      ctx.beginPath()
      ctx.moveTo(kidX + 24 * scale, kidBaseY - 138 * scale)
      ctx.lineTo(rightHandX, rightHandY)
      ctx.stroke()

      // Spread fingers on right hand
      ctx.fillStyle = '#fed7aa'
      ctx.beginPath()
      ctx.arc(rightHandX, rightHandY, 9 * scale, 0, Math.PI * 2)
      ctx.fill()
    }

    // Kid Head
    const headX = kidX
    const headY = kidBaseY - 188 * scale
    const headR = 42 * scale

    // Neck
    ctx.fillStyle = '#fed7aa'
    ctx.fillRect(headX - 10 * scale, headY + 30 * scale, 20 * scale, 18 * scale)

    // Face oval
    ctx.fillStyle = '#fed7aa'
    ctx.beginPath()
    ctx.arc(headX, headY, headR, 0, Math.PI * 2)
    ctx.fill()

    // Cute Ears
    ctx.beginPath()
    ctx.arc(headX - headR + 2 * scale, headY + 4 * scale, 9 * scale, 0, Math.PI * 2)
    ctx.arc(headX + headR - 2 * scale, headY + 4 * scale, 9 * scale, 0, Math.PI * 2)
    ctx.fill()

    // Messy Fluffy Brown Hair
    ctx.fillStyle = '#451a03'
    ctx.beginPath()
    ctx.arc(headX, headY - 10 * scale, headR + 2 * scale, Math.PI * 0.85, Math.PI * 2.15)
    ctx.fill()
    // Hair tufts
    ctx.beginPath()
    ctx.arc(headX - 18 * scale, headY - headR, 14 * scale, 0, Math.PI * 2)
    ctx.arc(headX + 4 * scale, headY - headR - 4 * scale, 16 * scale, 0, Math.PI * 2)
    ctx.arc(headX + 22 * scale, headY - headR + 2 * scale, 13 * scale, 0, Math.PI * 2)
    ctx.fill()

    // Cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.4)'
    ctx.beginPath()
    ctx.arc(headX - 22 * scale, headY + 12 * scale, 10 * scale, 0, Math.PI * 2)
    ctx.arc(headX + 22 * scale, headY + 12 * scale, 10 * scale, 0, Math.PI * 2)
    ctx.fill()

    // Eyes & Mouth based on stage
    if (isEating) {
      // Happy eyes `^ ^`
      ctx.lineWidth = 3.5 * scale
      ctx.strokeStyle = '#1e293b'
      ctx.beginPath()
      ctx.arc(headX - 16 * scale, headY - 2 * scale, 9 * scale, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(headX + 16 * scale, headY - 2 * scale, 9 * scale, Math.PI * 1.15, Math.PI * 1.85)
      ctx.stroke()

      // Smiling mouth with pink tongue licking toward cone!
      ctx.fillStyle = '#e11d48'
      ctx.beginPath()
      ctx.arc(headX + 4 * scale, headY + 16 * scale, 12 * scale, 0, Math.PI)
      ctx.fill()
      ctx.fillStyle = '#fb7185'
      ctx.beginPath()
      ctx.arc(headX + 14 * scale, headY + 18 * scale, 7 * scale, 0, Math.PI * 2)
      ctx.fill()
    } else if (isDropping) {
      // Shocked wide eyes `O O`
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(headX - 16 * scale, headY - 4 * scale, 13 * scale, 0, Math.PI * 2)
      ctx.arc(headX + 16 * scale, headY - 4 * scale, 13 * scale, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#1e293b'
      ctx.lineWidth = 2 * scale
      ctx.stroke()

      // Tiny pupils
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(headX - 16 * scale, headY - 2 * scale, 4 * scale, 0, Math.PI * 2)
      ctx.arc(headX + 16 * scale, headY - 2 * scale, 4 * scale, 0, Math.PI * 2)
      ctx.fill()

      // Shocked "O" mouth
      ctx.fillStyle = '#881337'
      ctx.beginPath()
      ctx.ellipse(headX, headY + 20 * scale, 9 * scale, 14 * scale, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Crying face `> <` and wide open wailing mouth `D:`
      ctx.lineWidth = 4 * scale
      ctx.strokeStyle = '#1e293b'

      // Left eye >
      ctx.beginPath()
      ctx.moveTo(headX - 25 * scale, headY - 12 * scale)
      ctx.lineTo(headX - 11 * scale, headY - 3 * scale)
      ctx.lineTo(headX - 25 * scale, headY + 6 * scale)
      ctx.stroke()

      // Right eye <
      ctx.beginPath()
      ctx.moveTo(headX + 25 * scale, headY - 12 * scale)
      ctx.lineTo(headX + 11 * scale, headY - 3 * scale)
      ctx.lineTo(headX + 25 * scale, headY + 6 * scale)
      ctx.stroke()

      // Wide open wailing mouth
      ctx.fillStyle = '#881337'
      ctx.beginPath()
      ctx.arc(headX, headY + 18 * scale, 16 * scale, 0, Math.PI)
      ctx.lineTo(headX - 16 * scale, headY + 18 * scale)
      ctx.fill()
      // Tongue vibrating
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.arc(headX, headY + 26 * scale, 8 * scale, Math.PI, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()

    // 5. TEAR FOUNTAIN (continuous twin jet arcs when crying)
    if (isCrying && elapsed < 5.0) {
      // Spawn new tear particles each frame
      for (let i = 0; i < 3; i++) {
        // Left eye fountain
        tears.push({
          x: headX - 18 * scale,
          y: headY - 2 * scale,
          vx: -(Math.random() * 140 + 130) * scale,
          vy: -(Math.random() * 180 + 210) * scale,
          size: (Math.random() * 5 + 3) * scale,
          alpha: 0.9,
        })
        // Right eye fountain
        tears.push({
          x: headX + 18 * scale,
          y: headY - 2 * scale,
          vx: (Math.random() * 140 + 130) * scale,
          vy: -(Math.random() * 180 + 210) * scale,
          size: (Math.random() * 5 + 3) * scale,
          alpha: 0.9,
        })
      }
    }

    // Update & draw tears
    ctx.fillStyle = '#38bdf8'
    for (let i = tears.length - 1; i >= 0; i--) {
      const p = tears[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 850 * scale * dt // gravity
      p.alpha -= dt * 0.45

      if (p.y >= groundY) {
        // Landed on floor: create splash ring
        tearSplashes.push({
          x: p.x,
          y: groundY + Math.random() * 4,
          r: 2,
          alpha: 0.7,
        })
        tears.splice(i, 1)
        continue
      }

      if (p.alpha <= 0) {
        tears.splice(i, 1)
        continue
      }

      ctx.save()
      ctx.globalAlpha = Math.max(0, p.alpha)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // Draw tear splash puddles
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 1.5 * scale
    for (let i = tearSplashes.length - 1; i >= 0; i--) {
      const s = tearSplashes[i]
      s.r += 24 * scale * dt
      s.alpha -= 1.8 * dt
      if (s.alpha <= 0) {
        tearSplashes.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.globalAlpha = Math.max(0, s.alpha)
      ctx.beginPath()
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.35, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // 6. DRAW THE WAFFLE CONE & FALLING SCOOP
    // The cone is in the kid's hand until bird steals it at t = 4.25s
    if (!birdHasCone) {
      ctx.save()
      ctx.translate(coneHandX, coneHandY)
      ctx.rotate(elapsed < 2.3 ? -0.15 : 0.2)

      // Waffle cone triangle
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.moveTo(-16 * scale, 0)
      ctx.lineTo(16 * scale, 0)
      ctx.lineTo(0, 48 * scale)
      ctx.closePath()
      ctx.fill()

      // Waffle crosshatch lines
      ctx.strokeStyle = '#b45309'
      ctx.lineWidth = 1.5 * scale
      ctx.beginPath()
      ctx.moveTo(-10 * scale, 8 * scale)
      ctx.lineTo(8 * scale, 24 * scale)
      ctx.moveTo(10 * scale, 8 * scale)
      ctx.lineTo(-8 * scale, 24 * scale)
      ctx.stroke()

      // Cone rim
      ctx.fillStyle = '#d97706'
      ctx.beginPath()
      ctx.ellipse(0, 0, 17 * scale, 5 * scale, 0, 0, Math.PI * 2)
      ctx.fill()

      // Intact scoop on cone (before drop)
      if (isEating) {
        ctx.fillStyle = '#f43f5e'
        ctx.beginPath()
        ctx.arc(0, -18 * scale, 22 * scale, 0, Math.PI * 2)
        ctx.fill()

        // Highlight & sprinkles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
        ctx.beginPath()
        ctx.arc(-7 * scale, -24 * scale, 6 * scale, 0, Math.PI * 2)
        ctx.fill()

        // Sprinkles
        const sprColors = ['#fde047', '#38bdf8', '#ffffff', '#a855f7']
        sprColors.forEach((color, idx) => {
          ctx.fillStyle = color
          ctx.fillRect((-10 + idx * 6) * scale, (-16 + (idx % 2) * 8) * scale, 4 * scale, 2.5 * scale)
        })

        // Red Cherry on top
        ctx.fillStyle = '#9f1239'
        ctx.beginPath()
        ctx.arc(0, -40 * scale, 7 * scale, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    }

    // Dropping scoop mid-air
    if (isDropping && elapsed - 1.6 >= 0.2) {
      ctx.save()
      ctx.translate(scoopX, scoopY)
      ctx.rotate(scoopRot)

      // Pink ice cream ball
      ctx.fillStyle = '#f43f5e'
      ctx.beginPath()
      ctx.arc(0, 0, 22 * scale, 0, Math.PI * 2)
      ctx.fill()

      // Drip tail
      ctx.fillStyle = '#fb7185'
      ctx.beginPath()
      ctx.arc(-6 * scale, -8 * scale, 8 * scale, 0, Math.PI * 2)
      ctx.fill()

      // Flying Cherry
      ctx.fillStyle = '#9f1239'
      ctx.beginPath()
      ctx.arc(12 * scale, -18 * scale, 6 * scale, 0, Math.PI * 2)
      ctx.fill()

      ctx.restore()
    }

    // 7. THE MISCHIEVOUS BIRD (SWOOPS & STEALS CONE)
    if (isBirdAttacking) {
      // Flight trajectory
      // Start: (width + 80, height * 0.12)
      // Dive to: (coneHandX, coneHandY) at t = 4.25
      // Exit to: (-100, height * 0.1) at t = 5.3
      let bx = 0
      let by = 0
      let bAngle = 0
      const flap = Math.sin(elapsed * 28)

      if (elapsed < 4.25) {
        // Diving phase
        const diveP = (elapsed - 3.8) / 0.45 // 0 to 1
        const startX = width + 100
        const startY = height * 0.15
        bx = startX + (coneHandX - startX) * diveP
        by = startY + (coneHandY - startY) * Math.pow(diveP, 1.4)
        bAngle = Math.atan2(coneHandY - startY, coneHandX - startX)
      } else {
        // Escape phase carrying the cone
        const escP = Math.min(1, (elapsed - 4.25) / 1.05) // 0 to 1
        const exitX = -120
        const exitY = height * 0.12
        bx = coneHandX + (exitX - coneHandX) * escP
        by = coneHandY + (exitY - coneHandY) * Math.pow(escP, 0.75) - Math.sin(escP * Math.PI) * 45 * scale
        bAngle = Math.atan2(exitY - coneHandY, exitX - coneHandX) + Math.PI
      }

      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(elapsed < 4.25 ? bAngle : -bAngle)
      const bScale = scale * 0.95

      // Bird Body (White Seagull)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(0, 0, 26 * bScale, 14 * bScale, 0, 0, Math.PI * 2)
      ctx.fill()

      // Gray wing
      ctx.fillStyle = '#64748b'
      ctx.beginPath()
      ctx.moveTo(-6 * bScale, -2 * bScale)
      ctx.lineTo(4 * bScale, (-26 + flap * 14) * bScale)
      ctx.lineTo(16 * bScale, -4 * bScale)
      ctx.closePath()
      ctx.fill()

      // Head & Eye
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(20 * bScale, -5 * bScale, 10 * bScale, 0, Math.PI * 2)
      ctx.fill()

      // Beady eye
      ctx.fillStyle = '#0f172a'
      ctx.beginPath()
      ctx.arc(22 * bScale, -7 * bScale, 2.5 * bScale, 0, Math.PI * 2)
      ctx.fill()

      // Yellow beak
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.moveTo(27 * bScale, -7 * bScale)
      ctx.lineTo(40 * bScale, -3 * bScale)
      ctx.lineTo(27 * bScale, 1 * bScale)
      ctx.closePath()
      ctx.fill()

      // If bird stole the cone, draw cone in beak!
      if (birdHasCone) {
        ctx.save()
        ctx.translate(34 * bScale, 3 * bScale)
        ctx.rotate(0.65)
        // Stolen waffle cone
        ctx.fillStyle = '#f59e0b'
        ctx.beginPath()
        ctx.moveTo(-10 * bScale, 0)
        ctx.lineTo(10 * bScale, 0)
        ctx.lineTo(0, 32 * bScale)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }

      ctx.restore()
    }

    // 8. FINAL PENALTY BANNER (Act 5: t >= 4.6s)
    // "Removed x points from your account"
    if (elapsed >= 4.6) {
      const bannerT = Math.min(1, (elapsed - 4.6) / 0.5)
      // Spring bounce entry
      const easeSpring = 1 - Math.cos(bannerT * Math.PI * 0.5)
      const targetY = Math.max(height * 0.15, 60)
      const curY = -140 + (targetY + 140) * easeSpring
      const cardW = Math.min(width * 0.92, 580)
      const cardH = 110

      ctx.save()
      ctx.translate(cx - cardW / 2, curY)

      // Glass Card Background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'
      ctx.shadowBlur = 28
      ctx.shadowOffsetY = 12
      roundRect(ctx, 0, 0, cardW, cardH, 24)
      ctx.fill()

      // Rose Glowing Border
      ctx.shadowColor = 'rgba(244, 63, 94, 0.5)'
      ctx.shadowBlur = 16
      ctx.strokeStyle = '#f43f5e'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Reset shadow for crisp text
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0

      // Top Tag: Chore Title Pill
      ctx.fillStyle = 'rgba(244, 63, 94, 0.18)'
      roundRect(ctx, cardW / 2 - 110, -14, 220, 28, 14)
      ctx.fill()
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.5)'
      ctx.lineWidth = 1.2
      ctx.stroke()

      ctx.font = '700 13px Outfit, sans-serif'
      ctx.fillStyle = '#fb7185'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`⚠️ ${choreTitle.toUpperCase()}`, cardW / 2, 0)

      // EXACT USER PHRASE: "Removed x points from your account"
      ctx.font = '800 24px Outfit, sans-serif'
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`Removed ${coinsLost} points from your account`, cardW / 2, 46)

      // Subtitle / Coins Impact Pill
      ctx.font = '700 15px Outfit, sans-serif'
      ctx.fillStyle = '#fda4af'
      ctx.fillText(`−${coinsLost} 🪙 💔   Clean up next time to get them back!`, cardW / 2, 82)

      ctx.restore()
    }

    raf = requestAnimationFrame(loop)
  }

  raf = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(raf)
    stopAudio()
    window.removeEventListener('resize', handleResize)
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
      ctx.fillText(choreTitle.toUpperCase(), cx, Math.max(cy - 120, 60))

      // Removed points text
      ctx.font = '700 22px Outfit, sans-serif'
      ctx.fillStyle = '#fca5a5'
      ctx.fillText(`Removed ${coinsLost} points from your account`, cx, height - 70)

      // Encouragement Subtitle at bottom
      ctx.font = '600 16px Outfit, sans-serif'
      ctx.fillStyle = '#cbd5e1'
      ctx.fillText('Clean it up next time to earn coins back! 💪', cx, height - 38)

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
 * Universal dispatcher for sad chore / penalty animations.
 * Runs either Ice Cream Tragedy (default) or Sad Storm.
 */
export function runSadAnimation(
  canvas: HTMLCanvasElement,
  options: SadAnimationOptions = {},
): { cleanup: () => void; durationMs: number } {
  const chosen = options.animation || 'icecream'
  if (chosen === 'storm') {
    return {
      cleanup: runSadStormAnimation(canvas, options),
      durationMs: 4400,
    }
  }

  return {
    cleanup: runIceCreamTragedyAnimation(canvas, options),
    durationMs: 6600,
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
