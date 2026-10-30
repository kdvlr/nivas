import React, { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { getQueryParam, isSwaraBirthday } from './sky/queryParam'
import { playBirthdayFanfareSound, stopBirthdayFanfareSound } from '../lib/useAudioChime'

interface BirthdayFanfareOverlayProps {
  seasonalDate?: Date
}

export default function BirthdayFanfareOverlay({ seasonalDate }: BirthdayFanfareOverlayProps) {
  const [active, setActive] = useState(false)
  const [fading, setFading] = useState(false)
  const lastHourTriggeredRef = useRef<number>(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
  }

  const trigger = useCallback(() => {
    clearTimers()
    setFading(false)
    setActive(true)
    playBirthdayFanfareSound()

    // Dual corner confetti cannons
    confetti({
      particleCount: 95,
      angle: 60,
      spread: 75,
      origin: { x: 0.08, y: 0.85 },
      colors: ['#f43f5e', '#ec4899', '#facc15', '#38bdf8', '#a855f7'],
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 95,
      angle: 120,
      spread: 75,
      origin: { x: 0.92, y: 0.85 },
      colors: ['#f43f5e', '#ec4899', '#facc15', '#38bdf8', '#a855f7'],
      disableForReducedMotion: true,
    })

    // Second wave burst at 2.5s (Phrase 2)
    const secondWave = setTimeout(() => {
      confetti({
        particleCount: 75,
        spread: 90,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#ffd700', '#ff69b4', '#00ffff', '#ff1493'],
        disableForReducedMotion: true,
      })
    }, 2500)
    timerRef.current.push(secondWave)

    // Third wave burst at 5.48s (Phrase 3 high octave jump: "Happy Birthday dear Swara!")
    const thirdWave = setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 100,
        origin: { x: 0.5, y: 0.35 },
        colors: ['#f43f5e', '#facc15', '#a855f7', '#38bdf8'],
        disableForReducedMotion: true,
      })
    }, 5480)
    timerRef.current.push(thirdWave)

    // Fourth grand wave burst at 9.74s (Phrase 4 finale chord: "Happy Birthday to you!")
    const fourthWave = setTimeout(() => {
      confetti({
        particleCount: 110,
        spread: 120,
        origin: { x: 0.5, y: 0.45 },
        colors: ['#ffd700', '#ec4899', '#38bdf8', '#facc15', '#f43f5e'],
        disableForReducedMotion: true,
      })
    }, 9740)
    timerRef.current.push(fourthWave)

    const isFreeze = getQueryParam('fanfare') === 'freeze'
    if (isFreeze) return

    // Auto dismiss after song completes at ~11.8s (with 0.6s fade)
    timerRef.current.push(
      setTimeout(() => setFading(true), 11800),
      setTimeout(() => {
        setActive(false)
        setFading(false)
      }, 12400),
    )
  }, [])

  const dismiss = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    stopBirthdayFanfareSound()
    clearTimers()
    setFading(true)
    setTimeout(() => {
      setActive(false)
      setFading(false)
    }, 350)
  }

  useEffect(() => {
    const handleCustom = () => trigger()
    window.addEventListener('trigger-birthday-fanfare', handleCustom)

    if (getQueryParam('fanfare') === '1' || getQueryParam('fanfare') === 'freeze') {
      trigger()
    }

    // Hourly check on Swara's birthday
    const interval = setInterval(() => {
      const now = new Date()
      const isBday = isSwaraBirthday(now)
      if (isBday && now.getMinutes() === 0 && now.getHours() !== lastHourTriggeredRef.current) {
        lastHourTriggeredRef.current = now.getHours()
        trigger()
      }
    }, 15_000)

    return () => {
      window.removeEventListener('trigger-birthday-fanfare', handleCustom)
      clearInterval(interval)
      clearTimers()
      stopBirthdayFanfareSound()
    }
  }, [trigger, seasonalDate])

  if (!active) return null

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[120] flex items-center justify-center p-4 select-none cursor-pointer transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 40%, rgba(55, 12, 75, 0.9) 0%, rgba(12, 6, 25, 0.96) 100%)',
      }}
    >
      {/* Sweeping Theatrical Spotlight Cones */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
        <div
          className="absolute -bottom-10 left-10 w-96 h-[120vh] origin-bottom-left"
          style={{
            background: 'linear-gradient(65deg, rgba(254, 240, 138, 0.45) 0%, rgba(250, 204, 21, 0.15) 45%, transparent 75%)',
            animation: 'spotlightSweepL 4s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute -bottom-10 right-10 w-96 h-[120vh] origin-bottom-right"
          style={{
            background: 'linear-gradient(-65deg, rgba(244, 114, 182, 0.45) 0%, rgba(236, 72, 153, 0.15) 45%, transparent 75%)',
            animation: 'spotlightSweepR 4s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Main Hero Card Stage */}
      <div
        className="relative max-w-xl w-full flex flex-col items-center text-center p-8 sm:p-12 rounded-3xl backdrop-blur-2xl bg-slate-950/90 dark:bg-slate-950/95 border border-amber-300/30 shadow-[0_25px_60px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Crowned Giant Numeral 9 */}
        <div className="relative flex flex-col items-center justify-center mb-2 select-none">
          {/* Sparkling Tiara Crown perched atop the "9" */}
          <div className="text-4xl sm:text-5xl -mb-3 filter drop-shadow-[0_4px_12px_rgba(250,204,21,0.7)] animate-bounce z-10">
            👑
          </div>
          {/* Giant 3D Sculpted Golden "9" */}
          <div
            className="text-8xl sm:text-9xl font-black tabular-nums tracking-tighter leading-none"
            style={{
              background: 'linear-gradient(180deg, #fffbeb 0%, #fef08a 25%, #facc15 50%, #eab308 75%, #b45309 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              WebkitTextStroke: '2px rgba(255, 255, 255, 0.95)',
              filter: 'drop-shadow(0 8px 24px rgba(250,204,21,0.55)) drop-shadow(0 4px 6px rgba(120,53,15,0.9))',
            }}
          >
            9
          </div>
        </div>

        {/* Milestone Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500/30 via-purple-500/30 to-amber-500/30 border border-amber-300/40 text-amber-200 text-xs sm:text-sm font-extrabold uppercase tracking-widest mb-3 shadow-lg">
          <span>🎂</span>
          <span>9 Years of Magic & Smiles</span>
          <span>✨</span>
        </div>

        {/* Happy Birthday Subhead */}
        <h2 className="text-xl sm:text-2xl font-black text-amber-100 tracking-wider uppercase mb-1">
          HAPPY 9TH BIRTHDAY
        </h2>

        {/* Big Hero Gradient Name */}
        <h1
          className="text-5xl sm:text-7xl font-black tracking-tight mb-4"
          style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fde047 30%, #f43f5e 75%, #ec4899 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 4px 18px rgba(244,63,94,0.6))',
          }}
        >
          SWARA!
        </h1>

        {/* Heartfelt Wish */}
        <p className="text-sm sm:text-base font-semibold text-pink-100/90 max-w-md leading-relaxed mb-6">
          May your special day be packed with joy, laughter, gymnastics triumphs, sweet treats, and wonderful adventures!
        </p>

        {/* Tap to continue button */}
        <button
          type="button"
          onClick={dismiss}
          className="px-6 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm tracking-wide transition-all border border-white/40 cursor-pointer shadow-md"
        >
          Tap anywhere to close ✨
        </button>
      </div>

      <style>{`
        @keyframes spotlightSweepL {
          0% { transform: rotate(-10deg); }
          100% { transform: rotate(18deg); }
        }
        @keyframes spotlightSweepR {
          0% { transform: rotate(10deg); }
          100% { transform: rotate(-18deg); }
        }
      `}</style>
    </div>
  )
}
