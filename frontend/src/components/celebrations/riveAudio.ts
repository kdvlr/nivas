/**
 * Lightweight zero-asset Web Audio synthesizer cues for Rive WebGL2 celebrations.
 * Strictly respects the `nivas_celebration_sound === 'true'` kiosk preference.
 */

let sharedCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    if (localStorage.getItem('nivas_celebration_sound') !== 'true') return null
    if (!sharedCtx || sharedCtx.state === 'closed') {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      sharedCtx = new Ctor()
    }
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {})
    }
    return sharedCtx
  } catch {
    return null
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'triangle',
  peakGain = 0.11,
  endFreq?: number,
) {
  const t0 = ctx.currentTime + startOffset
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (endFreq) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration)
  }
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.025, duration * 0.25))
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

/** Dancing Birb: cheerful whistling chirps + bouncy marimba chord */
export function playBirbDanceCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, 880, 0.02, 0.14, 'sine', 0.12, 1320)
  tone(ctx, 1046.5, 0.18, 0.16, 'sine', 0.12, 1567.98)
  const groove = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]
  groove.forEach((f, i) => tone(ctx, f, 0.36 + i * 0.13, 0.22, 'triangle', 0.1))
}

/** Hoverboard Hero: synthwave power-up sweep + triumphant chord */
export function playHoverboardCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, 180, 0.0, 0.42, 'sawtooth', 0.08, 720)
  ;[440, 554.37, 659.25, 880].forEach((f, i) =>
    tone(ctx, f, 0.38 + i * 0.06, 0.55, 'triangle', 0.09),
  )
}

/** Rubber-Duck Safari Jeep: playful rubber-duck double squeak + adventure horn */
export function playJeepBounceCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, 980, 0.05, 0.11, 'sine', 0.11, 1280)
  tone(ctx, 1020, 0.2, 0.13, 'sine', 0.11, 1380)
  ;[392, 493.88, 587.33, 783.99].forEach((f, i) =>
    tone(ctx, f, 0.4 + i * 0.09, 0.34, 'triangle', 0.1),
  )
}

/** Happy Juice Dance: fizzy bubble pops + bright tropical triad */
export function playHappyJuiceCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  ;[520, 680, 860, 1120].forEach((f, i) =>
    tone(ctx, f, 0.03 + i * 0.07, 0.09, 'sine', 0.1, f * 1.35),
  )
  ;[587.33, 739.99, 880, 1174.66].forEach((f, i) =>
    tone(ctx, f, 0.35 + i * 0.08, 0.36, 'triangle', 0.1),
  )
}

/** Supersonic Jet Flyby: turbine whoosh + top-gun brass chord */
export function playJetFlybyCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, 130, 0.0, 0.55, 'sawtooth', 0.07, 620)
  ;[293.66, 440, 587.33, 739.99].forEach((f, i) =>
    tone(ctx, f, 0.42 + i * 0.09, 0.6, 'sawtooth', 0.07),
  )
}

/** Radiant Treasure Chest: chest latch + royal brass + shimmering gold coins */
export function playTreasureVaultCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  ;[261.63, 329.63, 392.0, 523.25].forEach((f, i) =>
    tone(ctx, f, i * 0.1, 0.5, 'sawtooth', 0.08),
  )
  const coins = [1318.5, 1567.98, 1760, 2093, 2349.3, 2637]
  coins.forEach((f, i) => tone(ctx, f, 0.45 + i * 0.065, 0.24, 'sine', 0.09))
}

/** Gizmo Bot: retro R2-style happy robot telemetry bleeps */
export function playGizmoBotCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  const bleeps = [660, 990, 784, 1175, 1319, 1568]
  bleeps.forEach((f, i) => tone(ctx, f, 0.03 + i * 0.075, 0.09, 'square', 0.06, f * 1.08))
}

/** Victory Van Road Trip: friendly double horn + upbeat major chord */
export function playRoadTripCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, 440, 0.04, 0.13, 'sawtooth', 0.08)
  tone(ctx, 554.37, 0.2, 0.22, 'sawtooth', 0.08)
  ;[329.63, 415.3, 493.88, 659.25].forEach((f, i) =>
    tone(ctx, f, 0.46 + i * 0.07, 0.45, 'triangle', 0.09),
  )
}

/** Unimpressed Coyote (Wrong PIN): classic cartoon descending wah-wah */
export function playCoyoteNopeCue(): void {
  const ctx = getCtx()
  if (!ctx) return
  tone(ctx, 392, 0.04, 0.26, 'sawtooth', 0.08, 370)
  tone(ctx, 370, 0.32, 0.26, 'sawtooth', 0.08, 349.23)
  tone(ctx, 349.23, 0.6, 0.55, 'sawtooth', 0.09, 246.94)
}
