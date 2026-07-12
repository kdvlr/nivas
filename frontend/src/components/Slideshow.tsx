import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface SlideshowProps {
  photos: string[]
  onDismiss: () => void
}

export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)

  // Shuffle the local copy of photo paths on mount
  const shuffled = useMemo(() => {
    const list = [...photos]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }, [photos])

  // Advance photo every 6 seconds
  useEffect(() => {
    if (shuffled.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % shuffled.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [shuffled.length])

  if (shuffled.length === 0) return null

  const activePhoto = shuffled[currentIdx]

  // Alternate pan and zoom directions based on index for a dynamic Ken Burns effect
  const panDirections = [
    { x: [0, -15], y: [0, -10] },
    { x: [0, 15], y: [0, 10] },
    { x: [0, -10], y: [0, 15] },
    { x: [0, 10], y: [0, -15] },
  ]
  const dir = panDirections[currentIdx % panDirections.length]

  return (
    <div
      className="fixed inset-0 z-[100] bg-black overflow-hidden cursor-none select-none"
      onClick={onDismiss}
      onTouchStart={onDismiss}
    >
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activePhoto}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black"
        >
          <motion.img
            src={activePhoto}
            initial={{ scale: 1.02, x: dir.x[0], y: dir.y[0] }}
            animate={{ scale: 1.10, x: dir.x[1], y: dir.y[1] }}
            transition={{ duration: 6.2, ease: 'linear' }}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Subtle ambient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20 pointer-events-none" />

      {/* Tiny instructions helper (only visible briefly on start or hover) */}
      <div className="absolute bottom-6 right-6 text-white/40 text-xs font-light tracking-wider pointer-events-none">
        Tap screen to return
      </div>
    </div>
  )
}
