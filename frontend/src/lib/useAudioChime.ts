/**
 * Web Audio API synthesizer for soft notification chimes.
 * Works without external MP3 files and across mobile/tablet browsers.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playChime(type: 'gentle' | 'reminder' = 'reminder') {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

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
