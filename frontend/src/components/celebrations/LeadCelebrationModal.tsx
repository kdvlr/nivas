import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import Avatar from '../Avatar'

interface LeadCelebrationModalProps {
  isOpen: boolean
  personName?: string
  avatar?: string
  avatarEmoji?: string
  color?: string
  onClose: () => void
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

const FIREWORK_COLORS = [
  '#f59e0b', // amber
  '#fbbf24', // yellow gold
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#ffffff', // white
]

export default function LeadCelebrationModal({
  isOpen,
  personName = "You're",
  avatar,
  avatarEmoji,
  color = '#f59e0b',
  onClose,
}: LeadCelebrationModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (!isOpen) return

    // Immediately stop and suppress any normal chore celebration
    try {
      window.dispatchEvent(
        new CustomEvent('nivas:stop-celebration', {
          detail: { suppressDurationMs: 8000 },
        }),
      )
    } catch {}

    // 1. Trigger celebratory side cannons with canvas-confetti
    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { x: 0.15, y: 0.75 },
        colors: ['#f59e0b', '#fbbf24', '#ef4444', '#3b82f6', '#ffffff'],
        zIndex: 160,
      })
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { x: 0.85, y: 0.75 },
        colors: ['#f59e0b', '#fbbf24', '#ef4444', '#3b82f6', '#ffffff'],
        zIndex: 160,
      })
    } catch {}

    // Additional confetti burst after 1.5s
    const secondBurst = setTimeout(() => {
      try {
        confetti({
          particleCount: 90,
          spread: 100,
          origin: { x: 0.5, y: 0.35 },
          colors: ['#f59e0b', '#ffd700', '#ffffff', '#f97316'],
          zIndex: 160,
        })
      } catch {}
    }, 1500)
    timersRef.current.push(secondBurst)

    // 2. Auto-dismiss after 6.5 seconds
    const autoDismiss = setTimeout(() => {
      onClose()
    }, 6500)
    timersRef.current.push(autoDismiss)

    // 3. Canvas particle fireworks loop
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let lastTime = performance.now()
    const sparks: Spark[] = []
    const rockets: Spark[] = []
    let nextRocket = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const explode = (x: number, y: number, hueColor: string) => {
      const count = 55
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.1
        const speed = 100 + Math.random() * 280
        sparks.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 0.8 + Math.random() * 0.9,
          color: i % 3 === 0 ? '#ffffff' : hueColor,
          size: 2 + Math.random() * 2.5,
        })
      }
    }

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now

      // Semi-transparent background clear for spark motion trails
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Launch rockets periodically
      const elapsed = now / 1000
      if (elapsed >= nextRocket) {
        nextRocket = elapsed + 0.3 + Math.random() * 0.4
        const targetX = canvas.width * (0.15 + Math.random() * 0.7)
        rockets.push({
          x: targetX,
          y: canvas.height,
          vx: (Math.random() - 0.5) * 50,
          vy: -(canvas.height * (0.55 + Math.random() * 0.25)),
          life: 0,
          maxLife: 0.65 + Math.random() * 0.3,
          color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
          size: 3.5,
        })
      }

      // Update and draw rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.life += dt
        r.x += r.vx * dt
        r.y += r.vy * dt
        r.vy += 220 * dt // gravity

        // Draw rocket head
        ctx.fillStyle = r.color
        ctx.beginPath()
        ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2)
        ctx.fill()

        // Draw rocket spark tail
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.fillRect(r.x - 1, r.y + 4, 2, 8)

        if (r.life >= r.maxLife || r.vy >= -40) {
          explode(r.x, r.y, r.color)
          rockets.splice(i, 1)
        }
      }

      // Update and draw explosion sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life += dt
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.vy += 180 * dt // gravity
        s.vx *= 0.98

        const progress = s.life / s.maxLife
        const alpha = Math.max(0, 1 - progress)

        ctx.fillStyle = s.color
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * (1 - progress * 0.4), 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1.0

        if (s.life >= s.maxLife) {
          sparks.splice(i, 1)
        }
      }

      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [isOpen, onClose])

  const isSelf = personName.toLowerCase() === 'you' || personName.toLowerCase() === "you're"

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="lead-celebration-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[150] flex flex-col items-center justify-center pointer-events-auto select-none bg-black/80 backdrop-blur-md overflow-hidden cursor-pointer"
          onClick={onClose}
        >
          {/* Fullscreen fireworks canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

          {/* Modal Content */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 260 }}
          className="relative z-10 flex flex-col items-center text-center px-4 max-w-xl mx-auto pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Big Flashing #1 Gold Medal SVG */}
          <div className="relative flex items-center justify-center">
            {/* Pulsing Sunburst Rays Behind Medal */}
            <div
              className="absolute w-[360px] h-[360px] pointer-events-none opacity-40 animate-spin"
              style={{ animationDuration: '24s' }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {Array.from({ length: 16 }).map((_, i) => (
                  <path
                    key={i}
                    d="M 100 100 L 92 0 L 108 0 Z"
                    fill="url(#sunburstGrad)"
                    transform={`rotate(${i * 22.5} 100 100)`}
                  />
                ))}
                <defs>
                  <linearGradient id="sunburstGrad" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Glowing Medal Structure */}
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                filter: [
                  'drop-shadow(0 0 25px rgba(250,204,21,0.75))',
                  'drop-shadow(0 0 50px rgba(251,191,36,0.95))',
                  'drop-shadow(0 0 25px rgba(250,204,21,0.75))',
                ],
              }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
            >
              <svg width="200" height="230" viewBox="0 0 200 230" className="overflow-visible">
                <defs>
                  {/* Gold radial metallic gradient */}
                  <radialGradient id="goldRadial" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#fffbeb" />
                    <stop offset="25%" stopColor="#fef08a" />
                    <stop offset="65%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" />
                  </radialGradient>
                  {/* Ribbon gradient */}
                  <linearGradient id="ribbonBlue" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#1d4ed8" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1e40af" />
                  </linearGradient>
                  <linearGradient id="ribbonRed" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#b91c1c" />
                    <stop offset="50%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#991b1b" />
                  </linearGradient>
                </defs>

                {/* Left Ribbon */}
                <path d="M 75 70 L 45 170 L 65 160 L 85 170 L 82 85 Z" fill="url(#ribbonRed)" stroke="#7f1d1d" strokeWidth="1.5" />
                <path d="M 66 70 L 55 165 L 65 160 L 75 165 L 72 80 Z" fill="url(#ribbonBlue)" />
                <path d="M 71 70 L 64 161 L 65 160 L 66 161 L 67 80 Z" fill="#ffffff" />

                {/* Right Ribbon */}
                <path d="M 125 70 L 155 170 L 135 160 L 115 170 L 118 85 Z" fill="url(#ribbonRed)" stroke="#7f1d1d" strokeWidth="1.5" />
                <path d="M 134 70 L 145 165 L 135 160 L 125 165 L 128 80 Z" fill="url(#ribbonBlue)" />
                <path d="M 129 70 L 136 161 L 135 160 L 134 161 L 133 80 Z" fill="#ffffff" />

                {/* Top Hanger Loop */}
                <rect x="88" y="62" width="24" height="14" rx="4" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
                <rect x="93" y="66" width="14" height="6" rx="2" fill="#09090b" />

                {/* Outer Beveled Gold Rim */}
                <circle cx="100" cy="135" r="62" fill="#d97706" stroke="#78350f" strokeWidth="2.5" />
                <circle cx="100" cy="135" r="58" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />

                {/* Circular Laurel Beaded Border */}
                {Array.from({ length: 24 }).map((_, i) => {
                  const rad = (i / 24) * Math.PI * 2
                  const bx = 100 + Math.cos(rad) * 54.5
                  const by = 135 + Math.sin(rad) * 54.5
                  return <circle key={i} cx={bx} cy={by} r="1.8" fill="#fef08a" />
                })}

                {/* Inner Gold Sunken Face */}
                <circle cx="100" cy="135" r="51" fill="url(#goldRadial)" stroke="#d97706" strokeWidth="2" />

                {/* Flanking Stars */}
                <polygon
                  points="68,131 71,137 78,137 72,141 74,148 68,144 62,148 64,141 58,137 65,137"
                  fill="#fef08a"
                  stroke="#b45309"
                  strokeWidth="0.8"
                />
                <polygon
                  points="132,131 135,137 142,137 136,141 138,148 132,144 126,148 128,141 122,137 129,137"
                  fill="#fef08a"
                  stroke="#b45309"
                  strokeWidth="0.8"
                />

                {/* Big Embossed "#1" */}
                {/* 3D Drop Shadow */}
                <text
                  x="102"
                  y="152"
                  textAnchor="middle"
                  fontSize="48"
                  fontWeight="900"
                  fontFamily="Impact, Arial Black, system-ui, sans-serif"
                  fill="#78350f"
                >
                  #1
                </text>
                {/* Top Bright Emboss */}
                <text
                  x="100"
                  y="150"
                  textAnchor="middle"
                  fontSize="48"
                  fontWeight="900"
                  fontFamily="Impact, Arial Black, system-ui, sans-serif"
                  fill="#ffffff"
                  stroke="#b45309"
                  strokeWidth="2"
                  style={{ paintOrder: 'stroke fill' }}
                >
                  #1
                </text>

                {/* Laurel Leaves Under #1 */}
                <path
                  d="M 80 162 Q 100 170 120 162"
                  stroke="#b45309"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </motion.div>
          </div>

          {/* Leader Badge (Avatar + Name) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 mt-4 shadow-lg"
          >
            {avatar || avatarEmoji ? (
              <Avatar name={personName} color={color} src={avatar} emoji={avatarEmoji} size={32} />
            ) : null}
            <span className="text-xl sm:text-2xl font-black text-white tracking-wide">
              {personName}
            </span>
          </motion.div>

          {/* "YOU'RE IN THE LEAD!" Flashing Headline */}
          <motion.h1
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
            className="mt-3 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 drop-shadow-[0_4px_16px_rgba(234,179,8,0.7)]"
          >
            {isSelf ? "YOU'RE IN THE LEAD!" : `${personName.toUpperCase()} IS IN THE LEAD!`}
          </motion.h1>

          {/* Subtitle description */}
          <p className="mt-2 text-base sm:text-xl lg:text-2xl font-bold text-amber-200/90 drop-shadow">
            🥇 Moved into 1st place on the chore board!
          </p>

          {/* Dismiss button */}
          <button
            onClick={onClose}
            className="mt-6 px-8 py-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 font-black text-lg sm:text-xl shadow-xl shadow-amber-500/30 hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            Let's Go! 🎉
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
)
}
