import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MediaItem {
  url: string
  videoUrl?: string
  type: 'image' | 'video' | 'live_photo'
  name: string
  orientation?: 'portrait' | 'landscape'
  width?: number
  height?: number
}

interface Slide {
  id: string
  type: 'single' | 'pair'
  items: MediaItem[]
}

interface SlideshowProps {
  photos: MediaItem[]
  onDismiss: () => void
}

export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)

  // Parse shuffled items into slides (single landscape/video, or pair of two portrait files)
  const slides = useMemo(() => {
    const list = [...photos]
    // 1. Shuffle the source photos
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }

    const result: Slide[] = []
    const used = new Set<string>()

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (used.has(item.url)) continue

      const isPortrait = item.orientation === 'portrait' && (item.type === 'image' || item.type === 'live_photo')

      if (isPortrait) {
        // Find next unused portrait item
        let partner: MediaItem | null = null
        for (let j = i + 1; j < list.length; j++) {
          const nextItem = list[j]
          const isNextPortrait = nextItem.orientation === 'portrait' && (nextItem.type === 'image' || nextItem.type === 'live_photo')
          if (isNextPortrait && !used.has(nextItem.url)) {
            partner = nextItem
            break
          }
        }

        if (partner) {
          result.push({
            id: `${item.url}_${partner.url}`,
            type: 'pair',
            items: [item, partner]
          })
          used.add(item.url)
          used.add(partner.url)
        } else {
          result.push({
            id: item.url,
            type: 'single',
            items: [item]
          })
          used.add(item.url)
        }
      } else {
        result.push({
          id: item.url,
          type: 'single',
          items: [item]
        })
        used.add(item.url)
      }
    }
    return result
  }, [photos])

  // Advance slide every 8 seconds
  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % slides.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null

  const activeSlide = slides[currentIdx]

  // Shared Ken Burns motion parameters
  const panDirections = [
    { x: [0, -10], y: [0, -6] },
    { x: [0, 10], y: [0, 6] },
    { x: [0, -6], y: [0, 10] },
    { x: [0, 6], y: [0, -10] },
  ]
  const dir = panDirections[currentIdx % panDirections.length]

  // Background ambient photo to blur
  const bgPhotoUrl = activeSlide.items[0].url

  return (
    <div
      className="fixed inset-0 z-[100] bg-neutral-980 overflow-hidden cursor-none select-none flex items-center justify-center"
      onClick={onDismiss}
      onTouchStart={onDismiss}
    >
      {/* Blurred background image for premium ambient glow */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg_${activeSlide.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.22 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.0 }}
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        >
          <img
            src={bgPhotoUrl}
            alt=""
            className="w-full h-full object-cover filter blur-[80px] scale-[1.15] brightness-75"
          />
        </motion.div>
      </AnimatePresence>

      {/* Dark overlay to ensure contrast and premium feel */}
      <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />

      {/* Main Slideshow Frame */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeSlide.id}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
          className="z-10 flex items-center justify-center"
        >
          {activeSlide.type === 'single' ? (
            // Landscape or Single Portrait wrapped in a frame
            (() => {
              const item = activeSlide.items[0]
              const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '16/9'
              
              return (
                <div
                  style={{ aspectRatio: aspect }}
                  className="max-h-[82vh] max-w-[82vw] rounded-[36px] overflow-hidden border-[12px] border-neutral-900/90 dark:border-neutral-950/90 bg-neutral-950 shadow-[0_30px_70px_rgba(0,0,0,0.85)] relative"
                >
                  {item.type === 'image' && (
                    <motion.img
                      src={item.url}
                      initial={{ scale: 1.01, x: dir.x[0], y: dir.y[0] }}
                      animate={{ scale: 1.08, x: dir.x[1], y: dir.y[1] }}
                      transition={{ duration: 8.2, ease: 'linear' }}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {item.type === 'live_photo' && item.videoUrl && (
                    <motion.video
                      src={item.videoUrl}
                      autoPlay
                      muted
                      playsInline
                      loop
                      initial={{ scale: 1.01, x: dir.x[0], y: dir.y[0] }}
                      animate={{ scale: 1.06, x: dir.x[1], y: dir.y[1] }}
                      transition={{ duration: 8.2, ease: 'linear' }}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {item.type === 'video' && (
                    <video
                      src={item.url}
                      autoPlay
                      muted
                      playsInline
                      loop
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )
            })()
          ) : (
            // Two vertical portrait photos side-by-side inside a single frame
            <div
              className="max-h-[82vh] max-w-[82vw] aspect-[4/3] sm:aspect-[1.5] md:aspect-[1.6] rounded-[36px] overflow-hidden border-[12px] border-neutral-900/90 dark:border-neutral-950/90 bg-neutral-950/95 shadow-[0_30px_70px_rgba(0,0,0,0.85)] flex gap-4 p-4 relative"
            >
              {activeSlide.items.map((item, idx) => {
                const isFirst = idx === 0
                // Slightly different offset directions for each side of the pair
                const childDir = {
                  x: isFirst ? [dir.x[0] / 2, dir.x[1] / 2] : [-dir.x[0] / 2, -dir.x[1] / 2],
                  y: [dir.y[0] / 2, dir.y[1] / 2]
                }
                
                return (
                  <div
                    key={item.url}
                    className="relative flex-1 h-full rounded-2xl overflow-hidden bg-neutral-900"
                  >
                    {item.type === 'image' && (
                      <motion.img
                        src={item.url}
                        initial={{ scale: 1.01, x: childDir.x[0], y: childDir.y[0] }}
                        animate={{ scale: 1.08, x: childDir.x[1], y: childDir.y[1] }}
                        transition={{ duration: 8.2, ease: 'linear' }}
                        className="w-full h-full object-cover"
                      />
                    )}

                    {item.type === 'live_photo' && item.videoUrl && (
                      <motion.video
                        src={item.videoUrl}
                        autoPlay
                        muted
                        playsInline
                        loop
                        initial={{ scale: 1.01, x: childDir.x[0], y: childDir.y[0] }}
                        animate={{ scale: 1.06, x: childDir.x[1], y: childDir.y[1] }}
                        transition={{ duration: 8.2, ease: 'linear' }}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Tiny instructions helper */}
      <div className="absolute bottom-6 right-6 text-white/35 text-xs font-light tracking-wider z-20 pointer-events-none">
        Tap screen to return
      </div>
    </div>
  )
}
