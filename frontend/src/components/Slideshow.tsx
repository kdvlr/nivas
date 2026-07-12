import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon'

interface MediaItem {
  url: string
  videoUrl?: string
  type: 'image' | 'video' | 'live_photo'
  name: string
  orientation?: 'portrait' | 'landscape'
  width?: number
  height?: number
  date_taken?: string | null
  location_name?: string | null
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

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch (e) {
    return ''
  }
}

// Sub-component to render the details overlay on a frame
const PhotoInfoCard = ({ item }: { item: MediaItem }) => {
  if (!item.location_name && !item.date_taken) return null

  return (
    <div className="absolute bottom-4 left-4 right-4 p-4.5 rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 text-white z-20 flex flex-col gap-0.5 select-none pointer-events-none max-w-sm shadow-xl animate-fadeIn">
      {item.location_name && (
        <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
          <Icon name="location_on" className="text-base text-rose-400 animate-pulse" />
          <span>{item.location_name}</span>
        </div>
      )}
      {item.date_taken && (
        <div className="flex items-center gap-1.5 text-sm text-white/90 font-medium">
          <Icon name="calendar_today" className="text-xs text-indigo-300" />
          <span>{formatDate(item.date_taken)}</span>
        </div>
      )}
    </div>
  )
}

export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)

  // Parse items into slides (landscape/video singly, or portrait files paired side-by-side)
  const slides = useMemo(() => {
    const list = [...photos]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }

    const result: Slide[] = []
    const used = new Set<string>()

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (used.has(item.url)) continue

      const isPortrait = item.orientation === 'portrait'

      if (isPortrait) {
        let partner: MediaItem | null = null
        for (let j = i + 1; j < list.length; j++) {
          const nextItem = list[j]
          const isNextPortrait = nextItem.orientation === 'portrait'
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

  // Ambient backdrop source photo
  const bgPhotoUrl = activeSlide.items[0].url

  return (
    <div
      className="fixed inset-0 z-[100] bg-black overflow-hidden cursor-none select-none"
      onClick={onDismiss}
      onTouchStart={onDismiss}
    >
      {/* Main Slideshow Frame */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeSlide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
          className="absolute inset-0 z-10 w-full h-full"
        >
          {activeSlide.type === 'single' ? (
            (() => {
              const item = activeSlide.items[0]
              
              return (
                <div className="w-full h-full relative">
                  {item.type === 'image' && (
                    <motion.img
                      src={item.url}
                      initial={{ scale: 1.01, x: dir.x[0], y: dir.y[0] }}
                      animate={{ scale: 1.08, x: dir.x[1], y: dir.y[1] }}
                      transition={{ duration: 8.2, ease: 'linear' }}
                      className="w-full h-full object-cover object-top"
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
                      className="w-full h-full object-cover object-top"
                    />
                  )}

                  {item.type === 'video' && (
                    <video
                      src={item.url}
                      autoPlay
                      muted
                      playsInline
                      loop
                      className="w-full h-full object-cover object-top"
                    />
                  )}

                  {/* Date & Location overlay */}
                  <PhotoInfoCard item={item} />
                </div>
              )
            })()
          ) : (
            // Two vertical portrait photos side-by-side filling the screen
            <div className="w-full h-full flex gap-0.5 bg-black relative">
              {activeSlide.items.map((item, idx) => {
                const isFirst = idx === 0
                const childDir = {
                  x: isFirst ? [dir.x[0] / 2, dir.x[1] / 2] : [-dir.x[0] / 2, -dir.x[1] / 2],
                  y: [dir.y[0] / 2, dir.y[1] / 2]
                }
                
                return (
                  <div
                    key={item.url}
                    className="relative flex-1 h-full overflow-hidden bg-neutral-900"
                  >
                    {item.type === 'image' && (
                      <motion.img
                        src={item.url}
                        initial={{ scale: 1.01, x: childDir.x[0], y: childDir.y[0] }}
                        animate={{ scale: 1.08, x: childDir.x[1], y: childDir.y[1] }}
                        transition={{ duration: 8.2, ease: 'linear' }}
                        className="w-full h-full object-cover object-top"
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
                        className="w-full h-full object-cover object-top"
                      />
                    )}

                    {item.type === 'video' && (
                      <video
                        src={item.url}
                        autoPlay
                        muted
                        playsInline
                        loop
                        className="w-full h-full object-cover object-top"
                      />
                    )}

                    {/* Date & Location overlay inside each portrait mat */}
                    <PhotoInfoCard item={item} />
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
