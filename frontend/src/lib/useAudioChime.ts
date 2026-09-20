/**
 * Web Audio API synthesizer for soft notification chimes and timer alarms.
 * Works without external MP3 files and across mobile/tablet browsers.
 */

let audioCtx: AudioContext | null = null
let alarmInterval: ReturnType<typeof setInterval> | null = null

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

export function startAlarmSound() {
  stopAlarmSound()
  playChime('alarm')
  alarmInterval = setInterval(() => {
    playChime('alarm')
  }, 1800)
}

export function stopAlarmSound() {
  if (alarmInterval) {
    clearInterval(alarmInterval)
    alarmInterval = null
  }
}
