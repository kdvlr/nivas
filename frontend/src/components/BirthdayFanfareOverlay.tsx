import React, { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { getQueryParam, isSwaraBirthday } from './sky/queryParam'
import {
  playBirthdayFanfareSound,
  stopBirthdayFanfareSound,
  playBooGiggleSound,
} from '../lib/useAudioChime'

interface BirthdayFanfareOverlayProps {
  seasonalDate?: Date
}

const PASTEL_COLORS = ['#f43f5e', '#ec4899', '#c084fc', '#a855f7', '#5eead4', '#fde047']

const isTouchDevice =
  typeof window !== 'undefined' &&
  (navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 1280 ||
    /Android|webOS|iPhone|iPad|iPod|Tablet/i.test(navigator.userAgent))

// Adaptive parameters for smooth 60 FPS on Android tablets and high-DPI displays:
// - Reduce particle count to avoid saturating ARM CPU core draw calls
// - Scale flake size up (scalar: 1.18) so fewer particles look just as full and festive
// - Cap ticks to 100-110 so old particles finish cleanly before next bursts
// - Ensure zIndex: 9999 so canvas renders directly on top of modal, avoiding backdrop invalidations
const PARTICLE_SCALE = isTouchDevice ? 0.52 : 0.85
const TICK_LIMIT = isTouchDevice ? 100 : 135

function fireConfetti(opts: confetti.Options) {
  const count = Math.max(12, Math.round((opts.particleCount ?? 50) * PARTICLE_SCALE))
  return confetti({
    ...opts,
    particleCount: count,
    ticks: opts.ticks ?? TICK_LIMIT,
    scalar: (opts.scalar ?? 1.0) * (isTouchDevice ? 1.18 : 1.05),
    zIndex: 9999,
    disableForReducedMotion: true,
  })
}

export default function BirthdayFanfareOverlay({ seasonalDate }: BirthdayFanfareOverlayProps) {
  const [active, setActive] = useState(false)
  const [fading, setFading] = useState(false)
  const [flippedBoo, setFlippedBoo] = useState<string | null>(null)
  const [poppedBow, setPoppedBow] = useState<string | null>(null)

  const lastHourTriggeredRef = useRef<number>(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const openedAtRef = useRef<number>(0)
  const confettiPatternRef = useRef<number>(0)
  const lastBurstTimeRef = useRef<number>(0)

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout)
    timerRef.current = []
  }

  const fireChoreographedConfetti = useCallback(() => {
    // Stage 1: Dual corner cannons at t=0s
    fireConfetti({
      particleCount: 85,
      angle: 60,
      spread: 70,
      origin: { x: 0.06, y: 0.82 },
      colors: PASTEL_COLORS,
    })
    fireConfetti({
      particleCount: 85,
      angle: 120,
      spread: 70,
      origin: { x: 0.94, y: 0.82 },
      colors: PASTEL_COLORS,
    })

    // Stage 2: Second wave at 2.5s (Phrase 2)
    const t2 = setTimeout(() => {
      fireConfetti({
        particleCount: 75,
        spread: 85,
        origin: { x: 0.5, y: 0.35 },
        colors: ['#ffd700', '#ff69b4', '#38bdf8', '#c084fc'],
      })
    }, 2500)
    timerRef.current.push(t2)

    // Stage 3: Third wave at 5.48s (Phrase 3 high octave jump: "dear Swara!")
    const t3 = setTimeout(() => {
      fireConfetti({
        particleCount: 95,
        spread: 110,
        origin: { x: 0.5, y: 0.4 },
        colors: ['#f43f5e', '#ec4899', '#facc15', '#a855f7'],
      })
    }, 5480)
    timerRef.current.push(t3)

    // Stage 4: Grand finale blast at 9.74s (Phrase 4 finale chord)
    const t4 = setTimeout(() => {
      fireConfetti({
        particleCount: 130,
        spread: 130,
        origin: { x: 0.5, y: 0.45 },
        colors: PASTEL_COLORS,
      })
      fireConfetti({
        particleCount: 75,
        angle: 60,
        spread: 60,
        origin: { x: 0.1, y: 0.75 },
        colors: PASTEL_COLORS,
      })
      fireConfetti({
        particleCount: 75,
        angle: 120,
        spread: 60,
        origin: { x: 0.9, y: 0.75 },
        colors: PASTEL_COLORS,
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

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    fireConfetti({
      particleCount: 30,
      spread: 60,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ['#f43f5e', '#ec4899', '#facc15', '#a855f7'],
    })
  }

  const handleBowClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setPoppedBow(id)
    setTimeout(() => setPoppedBow((cur) => (cur === id ? null : cur)), 500)

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    fireConfetti({
      particleCount: 25,
      spread: 50,
      origin: {
        x: (rect.left + rect.width / 2) / window.innerWidth,
        y: (rect.top + rect.height / 2) / window.innerHeight,
      },
      colors: ['#c084fc', '#f472b6', '#5eead4', '#ffd700'],
    })
  }

  // Multi-directional Confetti Burst with rapid-tap throttle guard
  const handleBurstConfetti = (e: React.MouseEvent) => {
    e.stopPropagation()
    const now = Date.now()
    if (now - lastBurstTimeRef.current < 160) return
    lastBurstTimeRef.current = now

    const pattern = confettiPatternRef.current % 6
    confettiPatternRef.current += 1

    switch (pattern) {
      case 0:
        // Dual Bottom Corner Cannons (Angled inward)
        fireConfetti({
          particleCount: 80,
          angle: 60,
          spread: 75,
          startVelocity: 55,
          origin: { x: 0.05, y: 0.9 },
          colors: PASTEL_COLORS,
        })
        fireConfetti({
          particleCount: 80,
          angle: 120,
          spread: 75,
          startVelocity: 55,
          origin: { x: 0.95, y: 0.9 },
          colors: PASTEL_COLORS,
        })
        break

      case 1:
        // Left Horizontal Wind Blast (Sweeping across from the left)
        fireConfetti({
          particleCount: 85,
          angle: 25,
          spread: 65,
          startVelocity: 65,
          drift: 0.8,
          origin: { x: 0.0, y: 0.45 },
          colors: ['#ec4899', '#f43f5e', '#ffd700', '#38bdf8'],
        })
        break

      case 2:
        // Right Horizontal Wind Blast (Sweeping across from the right)
        fireConfetti({
          particleCount: 85,
          angle: 155,
          spread: 65,
          startVelocity: 65,
          drift: -0.8,
          origin: { x: 1.0, y: 0.45 },
          colors: ['#a855f7', '#c084fc', '#5eead4', '#facc15'],
        })
        break

      case 3:
        // Bottom Geyser Fountain (Shooting straight up into the sky)
        fireConfetti({
          particleCount: 100,
          angle: 90,
          spread: 110,
          startVelocity: 65,
          origin: { x: 0.5, y: 0.98 },
          colors: PASTEL_COLORS,
        })
        break

      case 4:
        // Top Cascading Curtain (Rainbow Skyfall cascading down)
        fireConfetti({
          particleCount: 40,
          angle: 270,
          spread: 70,
          startVelocity: 28,
          gravity: 1.1,
          drift: 0.3,
          origin: { x: 0.2, y: -0.05 },
          colors: PASTEL_COLORS,
        })
        fireConfetti({
          particleCount: 50,
          angle: 270,
          spread: 80,
          startVelocity: 30,
          gravity: 1.1,
          origin: { x: 0.5, y: -0.05 },
          colors: PASTEL_COLORS,
        })
        fireConfetti({
          particleCount: 40,
          angle: 270,
          spread: 70,
          startVelocity: 28,
          gravity: 1.1,
          drift: -0.3,
          origin: { x: 0.8, y: -0.05 },
          colors: PASTEL_COLORS,
        })
        break

      case 5:
      default:
        // Triple Diagonal Volley (Left, Right, Center)
        fireConfetti({
          particleCount: 55,
          angle: 70,
          spread: 65,
          origin: { x: 0.15, y: 0.85 },
          colors: ['#f43f5e', '#ffd700', '#38bdf8'],
        })
        setTimeout(() => {
          fireConfetti({
            particleCount: 55,
            angle: 110,
            spread: 65,
            origin: { x: 0.85, y: 0.85 },
            colors: ['#a855f7', '#ec4899', '#5eead4'],
          })
        }, 120)
        setTimeout(() => {
          fireConfetti({
            particleCount: 80,
            angle: 90,
            spread: 120,
            origin: { x: 0.5, y: 0.5 },
            colors: PASTEL_COLORS,
          })
        }, 240)
        break
    }
  }

  // Notify system when modal is open to pause background heavy canvas loops
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('modal-overlay-active', { detail: active }))
    return () => {
      window.dispatchEvent(new CustomEvent('modal-overlay-active', { detail: false }))
    }
  }, [active])

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

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-center p-3 sm:p-6 select-none cursor-pointer transition-opacity duration-500 overflow-hidden ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(255, 255, 255, 0.96) 0%, rgba(255, 240, 245, 0.97) 35%, rgba(252, 231, 243, 0.98) 70%, rgba(237, 233, 254, 0.99) 100%)',
      }}
    >
      {/* Ambient Theatrical Spotlight Cones (Hardware accelerated, zero-blur GPU light beams) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-50 z-0">
        <div
          className="absolute -top-[10vh] left-0 w-[45vw] h-[125vh] origin-top pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 15% 0%, rgba(254, 205, 211, 0.5) 0%, rgba(254, 205, 211, 0.15) 35%, transparent 70%)',
            animation: 'spotlightSweepL 6s ease-in-out infinite alternate',
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        />
        <div
          className="absolute -top-[10vh] right-0 w-[45vw] h-[125vh] origin-top pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 85% 0%, rgba(216, 180, 254, 0.5) 0%, rgba(216, 180, 254, 0.15) 35%, transparent 70%)',
            animation: 'spotlightSweepR 6s ease-in-out infinite alternate',
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        />
      </div>

      {/* Main Theatrical Banner Stage */}
      <div
        className="relative max-w-5xl w-[92vw] aspect-[2048/1142] flex items-center justify-center rounded-3xl transition-all duration-500 z-10"
        style={{
          background: 'rgba(255, 255, 255, 0.94)',
          border: '1.5px solid rgba(244, 114, 182, 0.38)',
          boxShadow: '0 25px 60px rgba(244, 63, 94, 0.18), inset 0 0 35px rgba(255, 255, 255, 0.7)',
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
            filter: 'drop-shadow(0 12px 24px rgba(216, 180, 254, 0.4))',
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            filter: 'drop-shadow(0 12px 24px rgba(216, 180, 254, 0.4))',
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            filter: 'drop-shadow(0 10px 22px rgba(244, 63, 94, 0.25))',
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            filter: 'drop-shadow(0 10px 22px rgba(168, 85, 247, 0.25))',
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            filter: 'drop-shadow(0 10px 22px rgba(94, 234, 212, 0.25))',
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            willChange: 'transform',
            transform: 'translateZ(0)',
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
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
          onClick={(e) => handleBowClick('purple_r', e)}
          title="Click!"
        />
      </div>

      {/* Confetti Option Alone */}
      <div
        className="mt-4 sm:mt-6 flex items-center justify-center z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleBurstConfetti}
          className="px-6 py-2.5 rounded-full font-extrabold text-xs sm:text-sm text-white shadow-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #a855f7 100%)',
            boxShadow: '0 4px 22px rgba(244, 63, 94, 0.45), inset 0 0 12px rgba(255, 255, 255, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.55)',
          }}
        >
          <span className="text-base sm:text-lg">🎊</span>
          <span>Burst Confetti</span>
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