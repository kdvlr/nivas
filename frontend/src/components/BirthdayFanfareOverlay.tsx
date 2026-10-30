import React, { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { getQueryParam, isSwaraBirthday } from './sky/queryParam'
import { playBirthdayFanfareSound, stopBirthdayFanfareSound, playBooGiggleSound } from '../lib/useAudioChime'

interface BirthdayFanfareOverlayProps {
  seasonalDate?: Date
}

const PASTEL_COLORS = ['#f43f5e', '#ec4899', '#c084fc', '#a855f7', '#5eead4', '#fde047']

export default function BirthdayFanfareOverlay({ seasonalDate }: BirthdayFanfareOverlayProps) {
  const [active, setActive] = useState(false)
  const [fading, setFading] = useState(false)
  const [theme, setTheme] = useState<'pastel' | 'midnight'>('pastel')
  const [flippedBoo, setFlippedBoo] = useState<string | null>(null)
  const [poppedBow, setPoppedBow] = useState<string | null>(null)

  const lastHourTriggeredRef = useRef<number>(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const openedAtRef = useRef<number>(0)

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
  }

  const fireChoreographedConfetti = useCallback(() => {
    // Stage 1: Dual corner cannons at t=0s
    confetti({
      particleCount: 85,
      angle: 60,
      spread: 70,
      origin: { x: 0.06, y: 0.82 },
      colors: PASTEL_COLORS,
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 85,
      angle: 120,
      spread: 70,
      origin: { x: 0.94, y: 0.82 },
      colors: PASTEL_COLORS,
      disableForReducedMotion: true,
    })

    // Stage 2: Second wave at 2.5s (Phrase 2)
    const t2 = setTimeout(() => {
      confetti({
        particleCount: 75,
        spread: 85,
        origin: { x: 0.5, y: 0.35 },
        colors: ['#ffd700', '#ff69b4', '#38bdf8', '#c084fc'],
        disableForReducedMotion: true,
      })
    }, 2500)
    timerRef.current.push(t2)

    // Stage 3: Third wave at 5.48s (Phrase 3 high octave jump: "dear Swara!")
    const t3 = setTimeout(() => {
      confetti({
        particleCount: 95,
        spread: 110,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#f43f5e', '#ec4899', '#facc15', '#a855f7'],
        disableForReducedMotion: true,
      })
    }, 5480)
    timerRef.current.push(t3)

    // Stage 4: Grand finale blast at 9.74s (Phrase 4 finale chord)
    const t4 = setTimeout(() => {
      confetti({
        particleCount: 130,
        spread: 130,
        origin: { x: 0.5, y: 0.45 },
        colors: PASTEL_COLORS,
        disableForReducedMotion: true,
      })
      confetti({
        particleCount: 75,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.75 },
        colors: PASTEL_COLORS,
        disableForReducedMotion: true,
      })
      confetti({
        particleCount: 75,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.75 },
        colors: PASTEL_COLORS,
        disableForReducedMotion: true,
      })
    }, 9740)
    timerRef.current.push(t4)
  }, [])

  const trigger = useCallback(() => {
    clearTimers()
    openedAtRef.current = Date.now()
    setFading(false)
    setActive(true)
    playBirthdayFanfareSound()
    fireChoreographedConfetti()

    const isFreeze = getQueryParam('fanfare') === 'freeze'
    if (isFreeze) return

    // Auto dismiss after song completes at ~11.8s (fading over 600ms)
    timerRef.current.push(
      setTimeout(() => setFading(true), 11800),
      setTimeout(() => {
        setActive(false)
        setFading(false)
      }, 12400),
    )
  }, [fireChoreographedConfetti])

  const dismiss = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (Date.now() - openedAtRef.current < 750) return
    stopBirthdayFanfareSound()
    clearTimers()
    setFading(true)
    setTimeout(() => {
      setActive(false)
      setFading(false)
    }, 350)
  }

  const handleBooClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    playBooGiggleSound()
    setFlippedBoo(id)
    setTimeout(() => setFlippedBoo((cur) => (cur === id ? null : cur)), 750)

    // Sparkle burst around the boo
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    confetti({
      particleCount: 30,
      spread: 60,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ['#f43f5e', '#ec4899', '#facc15', '#a855f7'],
      disableForReducedMotion: true,
    })
  }

  const handleBowClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPoppedBow(id)
    setTimeout(() => setPoppedBow((cur) => (cur === id ? null : cur)), 500)

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    confetti({
      particleCount: 25,
      spread: 50,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ['#c084fc', '#f472b6', '#5eead4', '#ffd700'],
      disableForReducedMotion: true,
    })
  }

  const handleBurstConfetti = (e: React.MouseEvent) => {
    e.stopPropagation()
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: PASTEL_COLORS,
      disableForReducedMotion: true,
    })
  }

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation()
    clearTimers()
    openedAtRef.current = Date.now()
    playBirthdayFanfareSound()
    fireChoreographedConfetti()

    if (getQueryParam('fanfare') !== 'freeze') {
      timerRef.current.push(
        setTimeout(() => setFading(true), 11800),
        setTimeout(() => {
          setActive(false)
          setFading(false)
        }, 12400),
      )
    }
  }

  const toggleTheme = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTheme((prev) => (prev === 'pastel' ? 'midnight' : 'pastel'))
  }

  useEffect(() => {
    const handleCustom = () => trigger()
    window.addEventListener('trigger-birthday-fanfare', handleCustom)

    if (getQueryParam('fanfare') === '1' || getQueryParam('fanfare') === 'freeze') {
      trigger()
    }

    // Hourly trigger on Swara's birthday
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

  const isDark = theme === 'midnight'

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-center p-3 sm:p-6 select-none cursor-pointer transition-opacity duration-500 overflow-hidden ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{
        background: isDark
          ? 'radial-gradient(ellipse at 50% 40%, rgba(46, 16, 101, 0.96) 0%, rgba(30, 17, 54, 0.98) 45%, rgba(15, 7, 40, 0.99) 85%, rgba(5, 2, 18, 1) 100%)'
          : 'radial-gradient(ellipse at 50% 40%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 240, 245, 0.97) 35%, rgba(252, 231, 243, 0.98) 70%, rgba(237, 233, 254, 0.99) 100%)',
        transition: 'background 0.6s ease',
      }}
    >
      {/* Ambient Theatrical Spotlight Cones */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50 z-0">
        <div
          className="absolute -top-[10vh] left-0 w-[45vw] h-[125vh] origin-top blur-3xl"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(244, 114, 182, 0.3) 0%, transparent 70%)'
              : 'linear-gradient(135deg, rgba(254, 205, 211, 0.55) 0%, transparent 70%)',
            animation: 'spotlightSweepL 6s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute -top-[10vh] right-0 w-[45vw] h-[125vh] origin-top blur-3xl"
          style={{
            background: isDark
              ? 'linear-gradient(-135deg, rgba(168, 85, 247, 0.3) 0%, transparent 70%)'
              : 'linear-gradient(-135deg, rgba(216, 180, 254, 0.55) 0%, transparent 70%)',
            animation: 'spotlightSweepR 6s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Main Theatrical Banner Stage */}
      <div
        className="relative max-w-5xl w-[92vw] aspect-[2048/1142] flex items-center justify-center rounded-3xl backdrop-blur-2xl transition-all duration-500 z-10"
        style={{
          background: isDark ? 'rgba(26, 14, 48, 0.88)' : 'rgba(255, 255, 255, 0.85)',
          border: isDark ? '1.5px solid rgba(216, 180, 254, 0.35)' : '1.5px solid rgba(244, 114, 182, 0.38)',
          boxShadow: isDark
            ? '0 25px 60px rgba(0, 0, 0, 0.6), inset 0 0 35px rgba(168, 85, 247, 0.15)'
            : '0 25px 60px rgba(244, 63, 94, 0.18), inset 0 0 35px rgba(255, 255, 255, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Crown Accent */}
        <div
          className="absolute -top-7 sm:-top-9 left-1/2 -translate-x-1/2 text-4xl sm:text-5xl filter drop-shadow-[0_4px_14px_rgba(250,204,21,0.65)] z-20 pointer-events-none"
          style={{ animation: 'crownBounce 2s ease-in-out infinite' }}
        >
          👑
        </div>

        {/* 100% Pristine Isolated Banner Typography Layer */}
        <img
          src="/boos_assets/banner_typography_perfect.png"
          alt="Happy Birthday Swara!"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10 select-none"
          style={{
            filter: isDark ? 'drop-shadow(0 2px 14px rgba(244, 114, 182, 0.35))' : 'none',
          }}
        />

        {/* Corner Giant Ribbon Bows */}
        <img
          src="/boos_assets/bow_top_left.png"
          alt="Pink Polka Dot Bow"
          className={`absolute pointer-events-auto cursor-pointer z-20 select-none ${
            poppedBow === 'top_left' ? 'scale-125' : ''
          }`}
          style={{
            width: '18.5%',
            top: '2.2%',
            left: '3.4%',
            transformOrigin: 'top left',
            animation: 'ribbonSwayLeft 5.5s ease-in-out infinite',
            filter: isDark
              ? 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5))'
              : 'drop-shadow(0 12px 24px rgba(216, 180, 254, 0.4))',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onClick={(e) => handleBowClick('top_left', e)}
          title="Tap to pop confetti!"
        />

        <img
          src="/boos_assets/bow_top_right.png"
          alt="Purple Silk Bow"
          className={`absolute pointer-events-auto cursor-pointer z-20 select-none ${
            poppedBow === 'top_right' ? 'scale-125' : ''
          }`}
          style={{
            width: '19%',
            top: '2.2%',
            right: '3.6%',
            transformOrigin: 'top right',
            animation: 'ribbonSwayRight 5.8s ease-in-out infinite',
            filter: isDark
              ? 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5))'
              : 'drop-shadow(0 12px 24px rgba(216, 180, 254, 0.4))',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onClick={(e) => handleBowClick('top_right', e)}
          title="Tap to pop confetti!"
        />

        {/* Living Boo Left (Waving Boo with Pink Bow) */}
        <img
          src="/boos_assets/boo_left.png"
          alt="Boo Left"
          className={`absolute pointer-events-auto cursor-pointer z-20 select-none ${
            flippedBoo === 'left' ? 'boo-flipped' : ''
          }`}
          style={{
            width: '16.5%',
            left: '9.8%',
            top: '47.7%',
            animation: flippedBoo === 'left' ? 'booFlip 0.75s ease-out' : 'booWanderLeft 4.6s ease-in-out infinite',
            filter: isDark
              ? 'drop-shadow(0 10px 22px rgba(244, 63, 94, 0.35)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.25))'
              : 'drop-shadow(0 10px 22px rgba(244, 63, 94, 0.25))',
          }}
          onClick={(e) => handleBooClick('left', e)}
          title="Tap me to giggle & flip!"
        />

        {/* Living Boo Center (Celebratory Jumping Boo with Purple Bow) */}
        <img
          src="/boos_assets/boo_center.png"
          alt="Boo Center"
          className={`absolute pointer-events-auto cursor-pointer z-20 select-none ${
            flippedBoo === 'center' ? 'boo-flipped' : ''
          }`}
          style={{
            width: '13.8%',
            left: '44.5%',
            top: '71.5%',
            animation: flippedBoo === 'center' ? 'booFlip 0.75s ease-out' : 'booCelebrateCenter 3.8s ease-in-out infinite',
            filter: isDark
              ? 'drop-shadow(0 10px 22px rgba(168, 85, 247, 0.4)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.25))'
              : 'drop-shadow(0 10px 22px rgba(168, 85, 247, 0.25))',
          }}
          onClick={(e) => handleBooClick('center', e)}
          title="Tap me to jump high!"
        />

        {/* Living Boo Right (Shy Blushing Boo with Mint Bow) */}
        <img
          src="/boos_assets/boo_right.png"
          alt="Boo Right"
          className={`absolute pointer-events-auto cursor-pointer z-20 select-none ${
            flippedBoo === 'right' ? 'boo-flipped' : ''
          }`}
          style={{
            width: '14.5%',
            right: '9.9%',
            top: '55.4%',
            animation: flippedBoo === 'right' ? 'booFlip 0.75s ease-out' : 'booWanderRight 4.9s ease-in-out infinite',
            filter: isDark
              ? 'drop-shadow(0 10px 22px rgba(94, 234, 212, 0.35)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.25))'
              : 'drop-shadow(0 10px 22px rgba(94, 234, 212, 0.25))',
          }}
          onClick={(e) => handleBooClick('right', e)}
          title="Tap me to wave & spin!"
        />

        {/* Floating Interactive Mini Bows */}
        <img
          src="/boos_assets/mini_bow_mint_left.png"
          alt="Mint Bow"
          className="absolute pointer-events-auto cursor-pointer z-20 select-none"
          style={{
            width: '6.2%',
            left: '3.2%',
            top: '46%',
            animation: 'miniFloatA 4.2s ease-in-out infinite',
            filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12))',
          }}
          onClick={(e) => handleBowClick('mint_l', e)}
          title="Click!"
        />
        <img
          src="/boos_assets/mini_bow_purple_bottom_left.png"
          alt="Purple Bow"
          className="absolute pointer-events-auto cursor-pointer z-20 select-none"
          style={{
            width: '8.5%',
            left: '5.6%',
            top: '80.5%',
            animation: 'miniFloatB 4.8s ease-in-out infinite',
            filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12))',
          }}
          onClick={(e) => handleBowClick('purple_bl', e)}
          title="Click!"
        />
        <img
          src="/boos_assets/mini_bow_purple_bottom_mid.png"
          alt="Purple Bow"
          className="absolute pointer-events-auto cursor-pointer z-20 select-none"
          style={{
            width: '6.8%',
            left: '26.8%',
            top: '85.5%',
            animation: 'miniFloatA 5.1s ease-in-out infinite',
            filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12))',
          }}
          onClick={(e) => handleBowClick('purple_bmid', e)}
          title="Click!"
        />
        <img
          src="/boos_assets/mini_bow_pink_bottom.png"
          alt="Pink Bow"
          className="absolute pointer-events-auto cursor-pointer z-20 select-none"
          style={{
            width: '8.5%',
            right: '28.5%',
            top: '84.5%',
            animation: 'miniFloatB 4.6s ease-in-out infinite',
            filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12))',
          }}
          onClick={(e) => handleBowClick('pink_bottom', e)}
          title="Click!"
        />
        <img
          src="/boos_assets/mini_bow_purple_right.png"
          alt="Purple Bow"
          className="absolute pointer-events-auto cursor-pointer z-20 select-none"
          style={{
            width: '6%',
            right: '4.8%',
            top: '47%',
            animation: 'miniFloatA 4.4s ease-in-out infinite',
            filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.12))',
          }}
          onClick={(e) => handleBowClick('purple_r', e)}
          title="Click!"
        />
      </div>

      {/* Interactive HUD Action Bar */}
      <div
        className="mt-4 sm:mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-3 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleReplay}
          className="px-4 py-2 rounded-full font-bold text-xs sm:text-sm text-white shadow-lg transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
            boxShadow: '0 4px 16px rgba(236, 72, 153, 0.4)',
          }}
        >
          <span>🎉</span> <span>Replay Fanfare & Music</span>
        </button>

        <button
          type="button"
          onClick={handleBurstConfetti}
          className="px-4 py-2 rounded-full font-bold text-xs sm:text-sm backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
            color: isDark ? '#fdf4ff' : '#1e1b4b',
            border: isDark ? '1px solid rgba(216, 180, 254, 0.3)' : '1px solid rgba(244, 114, 182, 0.4)',
          }}
        >
          <span>🎊</span> <span>Burst Confetti</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="px-4 py-2 rounded-full font-bold text-xs sm:text-sm backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.85)',
            color: isDark ? '#fdf4ff' : '#1e1b4b',
            border: isDark ? '1px solid rgba(216, 180, 254, 0.3)' : '1px solid rgba(244, 114, 182, 0.4)',
          }}
        >
          <span>🎨</span> <span>{isDark ? 'Pastel Theme' : 'Midnight Theme'}</span>
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="px-4 py-2 rounded-full font-bold text-xs sm:text-sm backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.6)',
            color: isDark ? '#e2e8f0' : '#475569',
            border: '1px solid rgba(148, 163, 184, 0.25)',
          }}
        >
          <span>✨</span> <span>Tap anywhere to close</span>
        </button>
      </div>

      <style>{`
        @keyframes booWanderLeft {
          0% { transform: translateY(0px) rotate(0deg) scale(1); }
          35% { transform: translateY(-16px) rotate(-3.5deg) scale(1.02); }
          70% { transform: translateY(8px) rotate(2deg) scale(0.99); }
          100% { transform: translateY(0px) rotate(0deg) scale(1); }
        }

        @keyframes booCelebrateCenter {
          0% { transform: translateY(0px) scale(1); }
          30% { transform: translateY(-24px) scale(1.06) rotate(-1.5deg); }
          60% { transform: translateY(6px) scale(0.97) rotate(1.5deg); }
          85% { transform: translateY(-10px) scale(1.02); }
          100% { transform: translateY(0px) scale(1); }
        }

        @keyframes booWanderRight {
          0% { transform: translateY(0px) rotate(0deg) scale(1); }
          30% { transform: translateY(-18px) rotate(3deg) scale(1.03); }
          70% { transform: translateY(10px) rotate(-2deg) scale(0.98); }
          100% { transform: translateY(0px) rotate(0deg) scale(1); }
        }

        @keyframes ribbonSwayLeft {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(3.5deg) scale(1.02); }
          100% { transform: rotate(0deg) scale(1); }
        }

        @keyframes ribbonSwayRight {
          0% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(-3.5deg) scale(1.02); }
          100% { transform: rotate(0deg) scale(1); }
        }

        @keyframes miniFloatA {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(8deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        @keyframes miniFloatB {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-14px) rotate(-9deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }

        @keyframes crownBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.1); }
        }

        @keyframes booFlip {
          0% { transform: scale(1) rotate(0deg); }
          50% { transform: translateY(-40px) scale(1.2) rotate(180deg); }
          100% { transform: scale(1) rotate(360deg); }
        }

        @keyframes spotlightSweepL {
          0% { transform: rotate(-8deg) scaleX(0.9); }
          100% { transform: rotate(10deg) scaleX(1.1); }
        }

        @keyframes spotlightSweepR {
          0% { transform: rotate(8deg) scaleX(0.9); }
          100% { transform: rotate(-10deg) scaleX(1.1); }
        }
      `}</style>
    </div>
  )
}