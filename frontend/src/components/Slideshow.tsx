import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MediaItem {
  url: string
  videoUrl?: string
  type: 'image' | 'video' | 'live_photo'
  name: string
}

interface SlideshowProps {
  photos: MediaItem[]
  onDismiss: () => void
}

export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)

  // Shuffle media list on mount
  const shuffled = useMemo(() => {
    const list = [...photos]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }, [photos])

  // Advance slide every 6 seconds
  useEffect(() => {
    if (shuffled.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % shuffled.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [shuffled.length])

  if (shuffled.length === 0) return null

  const active = shuffled[currentIdx]

  // Alternate pan and zoom directions for Ken Burns effects
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
          key={active.url}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black"
        >
          {active.type === 'image' && (
            <motion.img
              src={active.url}
              initial={{ scale: 1.02, x: dir.x[0], y: dir.y[0] }}
              animate={{ scale: 1.10, x: dir.x[1], y: dir.y[1] }}
              transition={{ duration: 6.2, ease: 'linear' }}
              className="w-full h-full object-cover"
            />
          )}

          {active.type === 'live_photo' && active.videoUrl && (
            <motion.video
              src={active.videoUrl}
              autoPlay
              muted
              playsInline
              loop
              initial={{ scale: 1.02, x: dir.x[0], y: dir.y[0] }}
              animate={{ scale: 1.08, x: dir.x[1], y: dir.y[1] }}
              transition={{ duration: 6.2, ease: 'linear' }}
              className="w-full h-full object-cover"
            />
          )}

          {active.type === 'video' && (
            <video
              src={active.url}
              autoPlay
              muted
              playsInline
              loop
              className="w-full h-full object-contain"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Subtle ambient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20 pointer-events-none" />

      {/* Tiny instructions helper */}
      <div className="absolute bottom-6 right-6 text-white/40 text-xs font-light tracking-wider pointer-events-none">
        Tap screen to return
      </div>
    </div>
  )
}
