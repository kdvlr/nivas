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
              const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '16/9'
              
              return (
                <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
                  {/* Background: blurred ambient frame (uses static image to optimize performance) */}
                  <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none scale-105 filter blur-[50px] opacity-75 brightness-[0.7]">
                    <motion.img
                      src={item.url}
                      initial={{ scale: 1.25, x: -dir.x[0], y: -dir.y[0] }}
                      animate={{ scale: 1.12, x: -dir.x[1], y: -dir.y[1] }}
                      transition={{ duration: 8.2, ease: 'linear' }}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Foreground: Floating Card element with rounded corners and shadow */}
                  <motion.div
                    style={{ aspectRatio: aspect }}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1.03 }}
                    transition={{ duration: 8.2, ease: 'linear' }}
                    className={`max-h-[84vh] max-w-[84vw] rounded-[32px] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.85)] border-2 border-white/15 bg-neutral-950 flex items-center justify-center relative z-10 ${
                      item.type === 'video' || item.type === 'live_photo' ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    onClick={(e) => {
                      const full = item.type === 'live_photo' ? item.videoUrl : item.url
                      if ((item.type === 'video' || item.type === 'live_photo') && full) {
                        // open the full video with sound; keep the slideshow mounted
                        e.stopPropagation()
                        setSelectedVideo(full)
                      }
                      // images (or videos without a source) fall through → onDismiss
                    }}
                  >
                    {item.type === 'image' && (
                      <img
                        src={item.url}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                    )}

                    {item.type === 'live_photo' && item.videoUrl && (
                      <video
                        key={item.videoUrl}
                        src={item.videoUrl}
                        autoPlay
                        muted
                        playsInline
                        loop
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
                  </motion.div>

                  {/* Date & Location overlay */}
                  <PhotoInfoCard item={item} />
                </div>
              )
            })()
          ) : (
            // Two vertical portrait photos side-by-side filling the screen
            <div className="w-full h-full flex gap-1 bg-black relative">
              {activeSlide.items.map((item, idx) => {
                const isFirst = idx === 0
                const itemAspect = item.width && item.height ? `${item.width} / ${item.height}` : '3/4'
                const childDir = {
                  x: isFirst ? [dir.x[0] / 2, dir.x[1] / 2] : [-dir.x[0] / 2, -dir.x[1] / 2],
                  y: [dir.y[0] / 2, dir.y[1] / 2]
                }
                
                return (
                  <div
                    key={item.url}
                    className="relative flex-1 h-full overflow-hidden bg-black flex items-center justify-center"
                  >
                    {/* Background: blurred ambient frame */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none scale-105 filter blur-[40px] opacity-70 brightness-[0.65]">
                      <motion.img
                        src={item.url}
                        initial={{ scale: 1.25, x: -childDir.x[0], y: -childDir.y[0] }}
                        animate={{ scale: 1.12, x: -childDir.x[1], y: -childDir.y[1] }}
                        transition={{ duration: 8.2, ease: 'linear' }}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Foreground: Floating Card element with rounded corners and shadow */}
                    <motion.div
                      style={{ aspectRatio: itemAspect }}
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1.03 }}
                      transition={{ duration: 8.2, ease: 'linear' }}
                      className={`max-h-[82%] max-w-[82%] rounded-[24px] overflow-hidden shadow-[0_22px_55px_rgba(0,0,0,0.8)] border-2 border-white/15 bg-neutral-950 flex items-center justify-center relative z-10 ${
                        item.type === 'video' || item.type === 'live_photo' ? 'cursor-pointer' : 'cursor-default'
                      }`}
                      onClick={(e) => {
                        const full = item.type === 'live_photo' ? item.videoUrl : item.url
                        if ((item.type === 'video' || item.type === 'live_photo') && full) {
                          // open the full video with sound; keep the slideshow mounted
                          e.stopPropagation()
                          setSelectedVideo(full)
                        }
                        // images (or videos without a source) fall through → onDismiss
                      }}
                    >
                      {item.type === 'image' && (
                        <img
                          src={item.url}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      )}

                      {item.type === 'live_photo' && item.videoUrl && (
                        <video
                          key={item.videoUrl}
                          src={item.videoUrl}
                          autoPlay
                          muted
                          playsInline
                          loop
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
                    </motion.div>

                    {/* Date & Location overlay inside each portrait mat */}
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
