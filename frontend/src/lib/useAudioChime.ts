/**
 * Web Audio API synthesizer for soft notification chimes and timer alarms.
 * Works without external MP3 files and across mobile/tablet browsers.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playChime(type: 'gentle' | 'reminder' | 'alarm' = 'reminder') {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    if (type === 'alarm') {
      // Upbeat 4-pulse timer alarm: (A5 -> A5 -> C6 -> C6)
      const alarmBeeps = [880, 880, 1046.5, 1046.5]
      const beepDuration = 0.08
      const beepGap = 0.12

      alarmBeeps.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now + index * beepGap)

        gain.gain.setValueAtTime(0, now + index * beepGap)
        gain.gain.linearRampToValueAtTime(0.4, now + index * beepGap + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * beepGap + beepDuration)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + index * beepGap)
        osc.stop(now + index * beepGap + beepDuration + 0.05)
      })
      return
    }

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.2, now)
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + (type === 'reminder' ? 1.2 : 0.8))
    masterGain.connect(ctx.destination)

    // Gentle 2-tone or 3-tone arpeggio (C5 -> E5 -> G5)
    const notes = type === 'reminder' ? [523.25, 659.25, 783.99] : [523.25, 659.25]
    const stepDuration = 0.15

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator()
      const noteGain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + index * stepDuration)

      noteGain.gain.setValueAtTime(0, now + index * stepDuration)
      noteGain.gain.linearRampToValueAtTime(0.3, now + index * stepDuration + 0.02)
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + index * stepDuration + 0.5)

      osc.connect(noteGain)
      noteGain.connect(masterGain)

      osc.start(now + index * stepDuration)
      osc.stop(now + index * stepDuration + 0.6)
    })
  } catch (e) {
    console.warn('[AudioChime] Unable to play chime:', e)
  }
}

/** Soft synthesized balloon pop with a high cheerful sparkle */
export function playBalloonPopSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // 1. Quick downward frequency sweep (poof / pop)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.08)

    gain.gain.setValueAtTime(0.32, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.1)

    // 2. High sparkle chime
    const sparkle = ctx.createOscillator()
    const sparkleGain = ctx.createGain()
    sparkle.type = 'sine'
    sparkle.frequency.setValueAtTime(1046.5, now + 0.03) // C6
    sparkle.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12) // E6

    sparkleGain.gain.setValueAtTime(0.18, now + 0.03)
    sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    sparkle.connect(sparkleGain)
    sparkleGain.connect(ctx.destination)

    sparkle.start(now + 0.03)
    sparkle.stop(now + 0.28)
  } catch (e) {
    console.warn('[AudioChime] Balloon pop audio error:', e)
  }
}

/** Triumphant birthday arpeggio fanfare flourish */
export function playBirthdayFanfareSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.26, now)
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 2.6)
    masterGain.connect(ctx.destination)

    // Upbeat celebratory melody arpeggio: C5 -> E5 -> G5 -> C6 -> E6
    const notes = [
      { f: 523.25, t: 0.0, d: 0.2 },   // C5
      { f: 659.25, t: 0.14, d: 0.2 },  // E5
      { f: 783.99, t: 0.28, d: 0.22 }, // G5
      { f: 1046.5, t: 0.44, d: 0.38 }, // C6
      { f: 1318.5, t: 0.72, d: 0.85 }, // E6 chord flourish
    ]

    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(f, now + t)

      g.gain.setValueAtTime(0, now + t)
      g.gain.linearRampToValueAtTime(0.32, now + t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, now + t + d)

      osc.connect(g)
      g.connect(masterGain)

      osc.start(now + t)
      osc.stop(now + t + d + 0.05)
    })
  } catch (e) {
    console.warn('[AudioChime] Birthday fanfare audio error:', e)
  }
}
