/**
 * Web Audio API synthesizer for soft notification chimes and timer alarms.
 * Works without external MP3 files and across mobile/tablet browsers.
 */

import { isSwaraBirthday } from '../components/sky/queryParam'

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

// Proactive user-gesture unlock for tablet / kiosk browsers
if (typeof window !== 'undefined') {
  let unlocked = false
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      if (!unlocked) {
        // Prime the hardware audio output DAC on mobile / Android WebView
        const buffer = ctx.createBuffer(1, 1, 22050)
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        source.start(0)
        unlocked = true
      }
    } catch {
      // ignore
    }
  }
  window.addEventListener('pointerdown', unlockAudio, { passive: true })
  window.addEventListener('touchstart', unlockAudio, { passive: true })
  window.addEventListener('click', unlockAudio, { passive: true })
}

export function playChime(type: 'gentle' | 'reminder' | 'alarm' = 'reminder') {
  try {
    if (type !== 'alarm' && isSwaraBirthday()) {
      playBirthdayFanfareSound()
      return
    }

    const ctx = getAudioContext()
    const doPlay = () => {
      const now = ctx.currentTime + 0.03

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
      masterGain.gain.setValueAtTime(0.35, now)
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + (type === 'reminder' ? 1.4 : 1.0))
      masterGain.connect(ctx.destination)

      // Gentle 2-tone or 3-tone arpeggio (C5 -> E5 -> G5)
      const notes = type === 'reminder' ? [523.25, 659.25, 783.99] : [523.25, 659.25]
      const stepDuration = 0.15

      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator()
        const noteGain = ctx.createGain()

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + index * stepDuration)

        noteGain.gain.setValueAtTime(0, now + index * stepDuration)
        noteGain.gain.linearRampToValueAtTime(0.45, now + index * stepDuration + 0.02)
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + index * stepDuration + 0.6)

        osc.connect(noteGain)
        noteGain.connect(masterGain)

        osc.start(now + index * stepDuration)
        osc.stop(now + index * stepDuration + 0.7)
      })
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(doPlay).catch(doPlay)
    } else {
      doPlay()
    }
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

let activeFanfareStop: (() => void) | null = null

/** Stop any actively playing birthday fanfare sound */
export function stopBirthdayFanfareSound() {
  if (activeFanfareStop) {
    try {
      activeFanfareStop()
    } catch {
      // ignore
    }
    activeFanfareStop = null
  }
}

/** Triumphant synthesized "Happy Birthday to You" celebratory tune */
export function playBirthdayFanfareSound(): () => void {
  stopBirthdayFanfareSound()

  try {
    const ctx = getAudioContext()
    const activeOscs: (OscillatorNode | GainNode)[] = []

    const startSchedule = () => {
      // Schedule slightly in future to prevent audio thread starvation / missed first note
      const now = ctx.currentTime + 0.06

      const masterGain = ctx.createGain()
      masterGain.gain.setValueAtTime(0.85, now)
      masterGain.connect(ctx.destination)

      // Frequencies in G Major
      const D4 = 293.66
      const E4 = 329.63
      const Fs4 = 369.99
      const G4 = 392.00
      const A4 = 440.00
      const B4 = 493.88
      const C5 = 523.25
      const D5 = 587.33
      const G5 = 783.99

      // Full 4-phrase "Happy Birthday to You" melody with festive chords
      const melody: Array<{ f: number; t: number; d: number; chord?: number[] }> = [
        // Phrase 1: "Happy Birthday to you"
        { f: D4, t: 0.00, d: 0.22 },
        { f: D4, t: 0.28, d: 0.16 },
        { f: E4, t: 0.48, d: 0.38 },
        { f: D4, t: 0.90, d: 0.38 },
        { f: G4, t: 1.32, d: 0.38 },
        { f: Fs4, t: 1.74, d: 0.70, chord: [D4] },

        // Phrase 2: "Happy Birthday to you"
        { f: D4, t: 2.50, d: 0.22 },
        { f: D4, t: 2.78, d: 0.16 },
        { f: E4, t: 2.98, d: 0.38 },
        { f: D4, t: 3.40, d: 0.38 },
        { f: A4, t: 3.82, d: 0.38 },
        { f: G4, t: 4.24, d: 0.70, chord: [D4] },

        // Phrase 3: "Happy Birthday dear Swara"
        { f: D4, t: 5.00, d: 0.22 },
        { f: D4, t: 5.28, d: 0.16 },
        { f: D5, t: 5.48, d: 0.44, chord: [G4, B4] }, // High triumphant octave jump
        { f: B4, t: 5.96, d: 0.38 },
        { f: G4, t: 6.38, d: 0.38 },
        { f: Fs4, t: 6.80, d: 0.38 },
        { f: E4, t: 7.22, d: 0.70, chord: [C5] },

        // Phrase 4: "Happy Birthday to you!"
        { f: C5, t: 7.98, d: 0.22 },
        { f: C5, t: 8.26, d: 0.16 },
        { f: B4, t: 8.46, d: 0.38 },
        { f: G4, t: 8.88, d: 0.38 },
        { f: A4, t: 9.30, d: 0.40 },
        { f: G4, t: 9.74, d: 1.40, chord: [B4, D5, G5] }, // Grand resolution chord
      ]

      const playTone = (freq: number, time: number, dur: number, gainLevel: number) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()

        // Warm acoustic chime timbre: triangle fundamental
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, time)

        g.gain.setValueAtTime(0, time)
        g.gain.linearRampToValueAtTime(gainLevel * 0.75, time + 0.015)
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur)

        osc.connect(g)
        g.connect(masterGain)

        osc.start(time)
        osc.stop(time + dur + 0.05)
        activeOscs.push(osc)

        // Crystalline overtone shimmer (octave higher sine for bright tablet projection)
        const shimmer = ctx.createOscillator()
        const shimmerGain = ctx.createGain()
        shimmer.type = 'sine'
        shimmer.frequency.setValueAtTime(freq * 2, time)

        shimmerGain.gain.setValueAtTime(0, time)
        shimmerGain.gain.linearRampToValueAtTime(gainLevel * 0.40, time + 0.01)
        shimmerGain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.75)

        shimmer.connect(shimmerGain)
        shimmerGain.connect(masterGain)

        shimmer.start(time)
        shimmer.stop(time + dur * 0.75 + 0.05)
        activeOscs.push(shimmer)
      }

      melody.forEach((item) => {
        playTone(item.f, now + item.t, item.d, 0.55)
        if (item.chord) {
          item.chord.forEach((chordFreq) => {
            playTone(chordFreq, now + item.t, item.d * 1.15, 0.28)
          })
        }
      })

      const stopFn = () => {
        try {
          masterGain.gain.cancelScheduledValues(ctx.currentTime)
          masterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.08)
          setTimeout(() => {
            activeOscs.forEach((node) => {
              try {
                if ('stop' in node) (node as OscillatorNode).stop()
                node.disconnect()
              } catch {
                // already stopped
              }
            })
          }, 100)
        } catch {
          // ignore
        }
      }

      activeFanfareStop = stopFn
    }

    if (ctx.state === 'suspended') {
      ctx.resume().then(startSchedule).catch(startSchedule)
    } else {
      startSchedule()
    }

    return () => stopBirthdayFanfareSound()
  } catch (e) {
    console.warn('[AudioChime] Birthday fanfare audio error:', e)
    return () => {}
  }
}

export function playBooGiggleSound() {
  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1046.5, now) // C6
    osc.frequency.exponentialRampToValueAtTime(1567.98, now + 0.15) // G6
    g.gain.setValueAtTime(0.3, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.28)
  } catch (e) {
    console.warn('[AudioChime] Boo giggle error:', e)
  }
}

