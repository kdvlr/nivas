import React, { useState, useRef, useCallback, useEffect } from 'react'
import confetti from 'canvas-confetti'
import { getQueryParam, isSwaraBirthday } from './sky/queryParam'
import {
  playBirthdayFanfareSound,
  stopBirthdayFanfareSound,
  playBooGiggleSound,
  playFireworkSound,
} from '../lib/useAudioChime'

interface BirthdayFanfareOverlayProps {
  seasonalDate?: Date
}

const PASTEL_COLORS = ['#f43f5e', '#ec4899', '#c084fc', '#a855f7', '#5eead4', '#fde047']

// Custom Firework Shape Generators
function getHeartShape(): confetti.Shape | 'circle' {
  if (typeof window !== 'undefined' && typeof (window as unknown as { Path2D?: unknown }).Path2D === 'function') {
    try {
      return confetti.shapeFromPath({
        path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
      })
    } catch {
      return 'circle'
    }
  }
  return 'circle'
}

function getDiamondShape(): confetti.Shape | 'star' {
  if (typeof window !== 'undefined' && typeof (window as unknown as { Path2D?: unknown }).Path2D === 'function') {
    try {
      return confetti.shapeFromPath({
        path: 'M12 0 L15 9 L24 12 L15 15 L12 24 L9 15 L0 12 L9 9 Z',
      })
    } catch {
      return 'star'
    }
  }
  return 'star'
}

export default function BirthdayFanfareOverlay({ seasonalDate }: BirthdayFanfareOverlayProps) {
  const [active, setActive] = useState(false)
  const [fading, setFading] = useState(false)
  const [theme, setTheme] = useState<'pastel' | 'midnight'>('pastel')
  const [flippedBoo, setFlippedBoo] = useState<string | null>(null)
  const [poppedBow, setPoppedBow] = useState<string | null>(null)

  const lastHourTriggeredRef = useRef<number>(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const openedAtRef = useRef<number>(0)
  const confettiPatternRef = useRef<number>(0)
  const fireworkPatternRef = useRef<number>(0)

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

  // Multi-directional Confetti (Pastel Theme)
  const handleBurstConfetti = (e: React.MouseEvent) => {
    e.stopPropagation()
    const pattern = confettiPatternRef.current % 6
    confettiPatternRef.current += 1

    switch (pattern) {
      case 0:
        // Pattern 0: Dual Bottom Corner Cannons (Angled inward)
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 75,
          startVelocity: 55,
          origin: { x: 0.05, y: 0.9 },
          colors: PASTEL_COLORS,
          disableForReducedMotion: true,
        })
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 75,
          startVelocity: 55,
          origin: { x: 0.95, y: 0.9 },
          colors: PASTEL_COLORS,
          disableForReducedMotion: true,
        })
        break

      case 1:
        // Pattern 1: Left Horizontal Wind Blast (Sweeping across from the left)
        confetti({
          particleCount: 90,
          angle: 25,
          spread: 65,
          startVelocity: 65,
          drift: 0.8,
          origin: { x: 0.0, y: 0.45 },
          colors: ['#ec4899', '#f43f5e', '#ffd700', '#38bdf8'],
          disableForReducedMotion: true,
        })
        break

      case 2:
        // Pattern 2: Right Horizontal Wind Blast (Sweeping across from the right)
        confetti({
          particleCount: 90,
          angle: 155,
          spread: 65,
          startVelocity: 65,
          drift: -0.8,
          origin: { x: 1.0, y: 0.45 },
          colors: ['#a855f7', '#c084fc', '#5eead4', '#facc15'],
          disableForReducedMotion: true,
        })
        break

      case 3:
        // Pattern 3: Bottom Geyser Fountain (Shooting straight up into the sky)
        confetti({
          particleCount: 110,
          angle: 90,
          spread: 110,
          startVelocity: 65,
          origin: { x: 0.5, y: 0.98 },
          colors: PASTEL_COLORS,
          disableForReducedMotion: true,
        })
        break

      case 4:
        // Pattern 4: Top Cascading Curtain (Rainbow Skyfall cascading down)
        confetti({
          particleCount: 45,
          angle: 270,
          spread: 70,
          startVelocity: 28,
          gravity: 1.1,
          drift: 0.3,
          origin: { x: 0.2, y: -0.05 },
          colors: PASTEL_COLORS,
          disableForReducedMotion: true,
        })
        confetti({
          particleCount: 55,
          angle: 270,
          spread: 80,
          startVelocity: 30,
          gravity: 1.1,
          origin: { x: 0.5, y: -0.05 },
          colors: PASTEL_COLORS,
          disableForReducedMotion: true,
        })
        confetti({
          particleCount: 45,
          angle: 270,
          spread: 70,
          startVelocity: 28,
          gravity: 1.1,
          drift: -0.3,
          origin: { x: 0.8, y: -0.05 },
          colors: PASTEL_COLORS,
          disableForReducedMotion: true,
        })
        break

      case 5:
      default:
        // Pattern 5: Triple Diagonal Volley (Left, Right, Center)
        confetti({
          particleCount: 60,
          angle: 70,
          spread: 65,
          origin: { x: 0.15, y: 0.85 },
          colors: ['#f43f5e', '#ffd700', '#38bdf8'],
          disableForReducedMotion: true,
        })
        setTimeout(() => {
          confetti({
            particleCount: 60,
            angle: 110,
            spread: 65,
            origin: { x: 0.85, y: 0.85 },
            colors: ['#a855f7', '#ec4899', '#5eead4'],
            disableForReducedMotion: true,
          })
        }, 120)
        setTimeout(() => {
          confetti({
            particleCount: 90,
            angle: 90,
            spread: 120,
            origin: { x: 0.5, y: 0.5 },
            colors: PASTEL_COLORS,
            disableForReducedMotion: true,
          })
        }, 240)
        break
    }
  }

  // Multi-directional & Multi-shaped Fireworks (Midnight Theme)
  const handleLaunchFireworks = (e: React.MouseEvent) => {
    e.stopPropagation()
    playFireworkSound()

    const heart = getHeartShape()
    const diamond = getDiamondShape()
    const pattern = fireworkPatternRef.current % 5
    fireworkPatternRef.current += 1

    switch (pattern) {
      case 0: {
        // Pattern 0: Rocket mortar from Left Corner -> High Starburst Peony
        // Launch streak
        confetti({
          particleCount: 16,
          angle: 58,
          spread: 12,
          startVelocity: 60,
          origin: { x: 0.08, y: 0.95 },
          colors: ['#ffe066', '#ffffff'],
          shapes: ['circle'],
          ticks: 45,
          disableForReducedMotion: true,
        })
        // Aerial shell burst at peak
        setTimeout(() => {
          confetti({
            particleCount: 95,
            spread: 360,
            startVelocity: 44,
            decay: 0.92,
            scalar: 1.25,
            origin: { x: 0.36, y: 0.28 },
            colors: ['#ffe066', '#38bdf8', '#f43f5e', '#facc15', '#ffffff'],
            shapes: ['star', diamond],
            disableForReducedMotion: true,
          })
        }, 260)
        // Secondary crackle
        setTimeout(() => {
          confetti({
            particleCount: 40,
            spread: 280,
            startVelocity: 26,
            origin: { x: 0.38, y: 0.32 },
            colors: ['#ffd700', '#ffffff'],
            shapes: ['circle'],
            disableForReducedMotion: true,
          })
        }, 420)
        break
      }

      case 1: {
        // Pattern 1: Rocket mortar from Right Corner -> Heart & Rose Peony
        confetti({
          particleCount: 16,
          angle: 122,
          spread: 12,
          startVelocity: 60,
          origin: { x: 0.92, y: 0.95 },
          colors: ['#ff69b4', '#ffffff'],
          shapes: ['circle'],
          ticks: 45,
          disableForReducedMotion: true,
        })
        setTimeout(() => {
          confetti({
            particleCount: 95,
            spread: 360,
            startVelocity: 44,
            decay: 0.92,
            scalar: 1.3,
            origin: { x: 0.64, y: 0.28 },
            colors: ['#ec4899', '#f43f5e', '#d946ef', '#ff69b4', '#fbcfe8'],
            shapes: [heart, 'circle'],
            disableForReducedMotion: true,
          })
        }, 260)
        break
      }

      case 2: {
        // Pattern 2: Dual Cross-Mortar Salvo (Left & Right intersecting in mid-air)
        // Left mortar
        confetti({
          particleCount: 14,
          angle: 65,
          spread: 10,
          startVelocity: 62,
          origin: { x: 0.12, y: 0.95 },
          colors: ['#38bdf8', '#ffffff'],
          shapes: ['circle'],
          ticks: 40,
          disableForReducedMotion: true,
        })
        // Right mortar
        setTimeout(() => {
          confetti({
            particleCount: 14,
            angle: 115,
            spread: 10,
            startVelocity: 62,
            origin: { x: 0.88, y: 0.95 },
            colors: ['#c084fc', '#ffffff'],
            shapes: ['circle'],
            ticks: 40,
            disableForReducedMotion: true,
          })
        }, 150)
        // Burst 1 (Left target)
        setTimeout(() => {
          confetti({
            particleCount: 80,
            spread: 360,
            startVelocity: 42,
            decay: 0.92,
            origin: { x: 0.32, y: 0.22 },
            colors: ['#38bdf8', '#67e8f9', '#ffd700', '#ffffff'],
            shapes: ['star', 'circle'],
            disableForReducedMotion: true,
          })
        }, 260)
        // Burst 2 (Right target)
        setTimeout(() => {
          confetti({
            particleCount: 80,
            spread: 360,
            startVelocity: 42,
            decay: 0.92,
            origin: { x: 0.68, y: 0.22 },
            colors: ['#a855f7', '#ec4899', '#f43f5e', '#fbcfe8'],
            shapes: [heart, diamond],
            disableForReducedMotion: true,
          })
        }, 410)
        break
      }

      case 3: {
        // Pattern 3: Horizon Salvo Trio (Three consecutive aerial bursts across the sky)
        // Burst Left
        confetti({
          particleCount: 75,
          spread: 360,
          startVelocity: 40,
          decay: 0.93,
          origin: { x: 0.22, y: 0.32 },
          colors: ['#4ade80', '#2dd4bf', '#fde047', '#ffffff'],
          shapes: ['star', 'square'],
          disableForReducedMotion: true,
        })
        // Burst Right
        setTimeout(() => {
          confetti({
            particleCount: 75,
            spread: 360,
            startVelocity: 40,
            decay: 0.93,
            origin: { x: 0.78, y: 0.34 },
            colors: ['#f43f5e', '#fb7185', '#ec4899', '#ffffff'],
            shapes: [heart, 'circle'],
            disableForReducedMotion: true,
          })
        }, 160)
        // Burst High Center
        setTimeout(() => {
          confetti({
            particleCount: 110,
            spread: 360,
            startVelocity: 48,
            decay: 0.91,
            scalar: 1.25,
            origin: { x: 0.50, y: 0.18 },
            colors: ['#38bdf8', '#c084fc', '#ffd700', '#f43f5e', '#ffffff'],
            shapes: ['star', diamond, 'circle'],
            disableForReducedMotion: true,
          })
        }, 320)
        break
      }

      case 4:
      default: {
        // Pattern 4: Golden Weeping Willow Skyfall (Long-lasting shimmering golden branches)
        confetti({
          particleCount: 130,
          spread: 360,
          startVelocity: 46,
          gravity: 0.55,
          decay: 0.94,
          ticks: 190,
          scalar: 1.15,
          origin: { x: 0.5, y: 0.22 },
          colors: ['#ffe066', '#fef08a', '#fbbf24', '#fef9c3', '#ffffff'],
          shapes: ['star', 'circle', diamond],
          disableForReducedMotion: true,
        })
        break
      }
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

      {/* Streamlined Bottom Controls: Confetti / Fireworks & Theme Toggle */}
      <div
        className="mt-4 sm:mt-6 flex items-center justify-center gap-3 sm:gap-4 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {isDark ? (
          <button
            type="button"
            onClick={handleLaunchFireworks}
            className="px-5 py-2.5 rounded-full font-extrabold text-xs sm:text-sm text-white shadow-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)',
              boxShadow: '0 4px 20px rgba(168, 85, 247, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
            }}
          >
            <span className="text-base sm:text-lg">🎆</span>
            <span>Launch Fireworks</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleBurstConfetti}
            className="px-5 py-2.5 rounded-full font-extrabold text-xs sm:text-sm text-white shadow-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #a855f7 100%)',
              boxShadow: '0 4px 20px rgba(244, 63, 94, 0.45), inset 0 0 12px rgba(255, 255, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
            }}
          >
            <span className="text-base sm:text-lg">🎊</span>
            <span>Burst Confetti</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm backdrop-blur-xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-lg"
          style={{
            background: isDark ? 'rgba(30, 17, 54, 0.85)' : 'rgba(255, 255, 255, 0.9)',
            color: isDark ? '#fdf4ff' : '#1e1b4b',
            border: isDark ? '1.5px solid rgba(216, 180, 254, 0.4)' : '1.5px solid rgba(244, 114, 182, 0.45)',
            boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(244, 63, 94, 0.15)',
          }}
        >
          <span className="text-base sm:text-lg">{isDark ? '🌸' : '🌙'}</span>
          <span>{isDark ? 'Pastel Theme' : 'Midnight Theme'}</span>
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