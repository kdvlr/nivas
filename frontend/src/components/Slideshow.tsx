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
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 32, opacity: 1 }}
      transition={{ delay: 0.6, type: 'spring', damping: 15, stiffness: 120 }}
      className="absolute bottom-0 left-6 z-0 flex items-center gap-3 px-4.5 py-2.5 rounded-full bg-neutral-900/90 border border-white/10 text-white shadow-xl backdrop-blur-md select-none pointer-events-none"
    >
      {item.location_name && (
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-tight">
          <Icon name="location_on" className="text-sm text-rose-400" />
          <span>{item.location_name}</span>
        </div>
      )}
      {item.location_name && item.date_taken && (
        <span className="w-1 h-1 rounded-full bg-white/20" />
      )}
      {item.date_taken && (
        <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium">
          <Icon name="calendar_today" className="text-[11px] text-indigo-300" />
          <span>{formatDate(item.date_taken)}</span>
        </div>
      )}
    </motion.div>
  )
}

export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)

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

  // Advance slide every 8 seconds, paused when a full video is being viewed
  useEffect(() => {
    if (slides.length <= 1 || selectedVideo !== null) return
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % slides.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [slides.length, selectedVideo])

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
    >
      {/* Background Siri-style swirling ambient gradient */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`bg_${activeSlide.id}`}
          initial={{ opacity: 0, scale: 1.12, rotate: 0 }}
          animate={{ 
            opacity: 0.65, 
            scale: [1.12, 1.22, 1.12],
            rotate: [0, 180, 360]
          }}
          exit={{ opacity: 0 }}
          transition={{ 
            opacity: { duration: 1.8 },
            scale: { duration: 25, repeat: Infinity, ease: 'linear' },
            rotate: { duration: 40, repeat: Infinity, ease: 'linear' }
          }}
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none filter blur-[80px]"
        >
          <img
            src={bgPhotoUrl}
            alt=""
            className="w-full h-full object-cover brightness-[0.6] saturate-[1.3]"
          />
        </motion.div>
      </AnimatePresence>

      {/* Main Slideshow Frame */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={activeSlide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
          className="absolute inset-0 z-10 w-full h-full flex items-center justify-center"
        >
          {activeSlide.type === 'single' ? (
            (() => {
              const item = activeSlide.items[0]
              const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '16/9'
              
              return (
                <div className="relative flex items-center justify-center">
                  {/* Foreground: Floating Card element with rounded corners and double shadow */}
                  <motion.div
                    layoutId={`card_${activeSlide.id}`}
                    style={{ aspectRatio: aspect }}
                    initial={{ scale: 0.94 }}
                    animate={{ scale: 1.02, x: dir.x[1] / 2, y: dir.y[1] / 2 }}
                    transition={{
                      scale: { type: 'spring', damping: 22, stiffness: 95 },
                      x: { duration: 8.2, ease: 'linear' },
                      y: { duration: 8.2, ease: 'linear' }
                    }}
                    className={`max-h-[82vh] max-w-[82vw] rounded-[36px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5),0_35px_85px_-10px_rgba(0,0,0,0.85)] border-2 border-white/20 bg-neutral-950 flex items-center justify-center relative z-10 ${
                      item.type === 'video' || item.type === 'live_photo' ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    onClick={(e) => {
                      const full = item.type === 'live_photo' ? item.videoUrl : item.url
                      if ((item.type === 'video' || item.type === 'live_photo') && full) {
                        e.stopPropagation()
                        setSelectedVideo(full)
                      }
                    }}
                  >
                    {/* Ken Burns opposing parallax drift image/video inside the frame */}
                    <div className="absolute inset-0 overflow-hidden w-full h-full">
                      {item.type === 'image' && (
                        <motion.img
                          src={item.url}
                          initial={{ scale: 1.15, x: -dir.x[0] * 1.5, y: -dir.y[0] * 1.5 }}
                          animate={{ scale: 1.05, x: -dir.x[1] * 1.5, y: -dir.y[1] * 1.5 }}
                          transition={{ duration: 8.2, ease: 'linear' }}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      )}

                      {item.type === 'live_photo' && item.videoUrl && (
                        <motion.video
                          key={item.videoUrl}
                          src={item.videoUrl}
                          autoPlay
                          muted
                          playsInline
                          loop
                          initial={{ scale: 1.12, x: -dir.x[0] * 1.2, y: -dir.y[0] * 1.2 }}
                          animate={{ scale: 1.03, x: -dir.x[1] * 1.2, y: -dir.y[1] * 1.2 }}
                          transition={{ duration: 8.2, ease: 'linear' }}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      )}

                      {item.type === 'video' && (
                        <video
                          key={item.url}
                          src={item.url}
                          autoPlay
                          muted
                          playsInline
                          loop
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      )}
                    </div>

                    {/* Glass reflection bevel overlay */}
                    <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                  </motion.div>

                  {/* Dynamic Slide-out EXIF details capsule */}
                  <PhotoInfoCard item={item} />
                </div>
              )
            })()
          ) : (
            // Two vertical portrait photos side-by-side filling the screen
            <div className="w-full h-full flex gap-8 items-center justify-center p-8 relative bg-black/40">
              {activeSlide.items.map((item, idx) => {
                const isFirst = idx === 0
                const itemAspect = item.width && item.height ? `${item.width} / ${item.height}` : '3/4'
                const childDir = {
                  x: isFirst ? [dir.x[0] / 2, dir.x[1] / 2] : [-dir.x[0] / 2, -dir.x[1] / 2],
                  y: [dir.y[0] / 2, dir.y[1] / 2]
                }
                
                return (
                  <div key={item.url} className="relative flex-1 h-full max-h-[82vh] flex items-center justify-center">
                    {/* Foreground: Floating Card element with rounded corners and shadow */}
                    <motion.div
                      layoutId={`card_${item.url}`}
                      style={{ aspectRatio: itemAspect }}
                      initial={{ scale: 0.94 }}
                      animate={{ scale: 1.02, x: childDir.x[1] / 2, y: childDir.y[1] / 2 }}
                      transition={{
                        scale: { type: 'spring', damping: 22, stiffness: 95 },
                        x: { duration: 8.2, ease: 'linear' },
                        y: { duration: 8.2, ease: 'linear' }
                      }}
                      className={`h-full rounded-[24px] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5),0_25px_60px_-8px_rgba(0,0,0,0.8)] border-2 border-white/20 bg-neutral-950 flex items-center justify-center relative z-10 ${
                        item.type === 'video' || item.type === 'live_photo' ? 'cursor-pointer' : 'cursor-default'
                      }`}
                      onClick={(e) => {
                        const full = item.type === 'live_photo' ? item.videoUrl : item.url
                        if ((item.type === 'video' || item.type === 'live_photo') && full) {
                          e.stopPropagation()
                          setSelectedVideo(full)
                        }
                      }}
                    >
                      {/* Ken Burns opposing parallax drift image/video inside the frame */}
                      <div className="absolute inset-0 overflow-hidden w-full h-full">
                        {item.type === 'image' && (
                          <motion.img
                            src={item.url}
                            initial={{ scale: 1.15, x: -childDir.x[0] * 1.5, y: -childDir.y[0] * 1.5 }}
                            animate={{ scale: 1.05, x: -childDir.x[1] * 1.5, y: -childDir.y[1] * 1.5 }}
                            transition={{ duration: 8.2, ease: 'linear' }}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        )}

                        {item.type === 'live_photo' && item.videoUrl && (
                          <motion.video
                            key={item.videoUrl}
                            src={item.videoUrl}
                            autoPlay
                            muted
                            playsInline
                            loop
                            initial={{ scale: 1.12, x: -childDir.x[0] * 1.2, y: -childDir.y[0] * 1.2 }}
                            animate={{ scale: 1.03, x: -childDir.x[1] * 1.2, y: -childDir.y[1] * 1.2 }}
                            transition={{ duration: 8.2, ease: 'linear' }}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        )}

                        {item.type === 'video' && (
                          <video
                            key={item.url}
                            src={item.url}
                            autoPlay
                            muted
                            playsInline
                            loop
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        )}
                      </div>

                      {/* Glass reflection bevel overlay */}
                      <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                    </motion.div>

                    {/* Dynamic Slide-out EXIF details capsule inside column */}
                    <PhotoInfoCard item={item} />
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {selectedVideo && (
        <div
          className="fixed inset-0 z-[110] bg-black flex items-center justify-center cursor-default"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedVideo(null)
          }}
        >
          <video
            src={selectedVideo}
            controls
            autoPlay
            playsInline
            className="max-h-[92vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-6 right-6 z-[120] p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-white/10 shadow-lg cursor-pointer flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedVideo(null)
            }}
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>
      )}

      {/* Tiny instructions helper */}
      <div className="absolute bottom-6 right-6 text-white/35 text-xs font-light tracking-wider z-20 pointer-events-none">
        Tap screen to return
      </div>
    </div>
  )
}
