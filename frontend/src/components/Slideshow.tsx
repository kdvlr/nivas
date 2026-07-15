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

// Details format helper


export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [isPortraitViewport, setIsPortraitViewport] = useState(() => {
    return window.innerHeight > window.innerWidth
  })

  useEffect(() => {
    const handleResize = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const albumBgStyle = {
    backgroundColor: '#161413',
    backgroundImage: `
      linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px),
      linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px)
    `,
    backgroundSize: '24px 24px'
  }



  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden cursor-none select-none transition-all duration-700 flex items-center justify-center"
      style={albumBgStyle}
      onClick={onDismiss}
    >
      {/* Style A: Dappled sunlight pattern overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.09] bg-gradient-to-br from-white via-transparent to-black mix-blend-overlay" />

      {/* Main Slideshow Frame */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`album_${activeSlide.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, zIndex: 10 }}
          exit={{ opacity: 0.99, zIndex: 20 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
          className="absolute inset-0 z-10 w-full h-full flex items-center justify-center"
        >
              {activeSlide.type === 'single' || isPortraitViewport ? (
                (() => {
                  const item = activeSlide.items[0]
                  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '16/9'
                  const rotation = [2.2, -3.1, 1.4, -2.3, 3.2, -1.6][currentIdx % 6]
                  
                  // Stable deterministic seed based on activeSlide.id to select exit directions and angle tilts
                  const seed = activeSlide.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
                  
                  // Drift starting and targeting offsets (larger values for a sweep across the screen)
                  const xStart = -dir.x[1] * 25; 
                  const yStart = -dir.y[1] * 25;
                  const xTarget = dir.x[1] * 25;
                  const yTarget = dir.y[1] * 25;
                  const targetRot = rotation + (seed % 2 === 0 ? 4 : -4);
                  
                  const xKeys = [xStart, xStart + (xTarget - xStart)*0.35 + 10, xStart + (xTarget - xStart)*0.65 - 10, xTarget];
                  const yKeys = [yStart, yStart + (yTarget - yStart)*0.35 - 10, yStart + (yTarget - yStart)*0.65 + 10, yTarget];
                  const rotKeys = [rotation, rotation + (targetRot - rotation)*0.4, rotation + (targetRot - rotation)*0.8, targetRot];

                  // Exit continues the momentum
                  let exitX: string | number = 0
                  let exitY: string | number = 0
                  if (Math.abs(dir.x[1]) >= Math.abs(dir.y[1])) {
                    exitX = dir.x[1] > 0 ? '120vw' : '-120vw';
                  } else {
                    exitY = dir.y[1] > 0 ? '120vh' : '-120vh';
                  }

                  const exitDir = (seed % 2 === 0) ? 1 : -1
                  const exitAngle = targetRot + (exitDir * 20)
                  
                  return (
                    <div className="relative flex items-center justify-center">
                      <motion.div
                        initial={{ scale: 0.35, opacity: 0, filter: 'blur(8px)', x: xStart, y: yStart, rotate: rotation }}
                        animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', x: xKeys, y: yKeys, rotate: rotKeys }}
                        exit={{
                          scale: 2.2,
                          x: exitX,
                          y: exitY,
                          rotate: exitAngle,
                          opacity: 0,
                          transition: { duration: 1.2, ease: 'easeIn' }
                        }}
                        transition={{
                          scale: { type: 'spring', damping: 22, stiffness: 60 },
                          filter: { duration: 0.6 },
                          opacity: { duration: 0.6 },
                          x: { duration: 8.2, ease: 'easeInOut' },
                          y: { duration: 8.2, ease: 'easeInOut' },
                          rotate: { duration: 8.2, ease: 'easeInOut' }
                        }}
                        className="bg-[#faf8f5] p-3.5 pb-4 rounded-[4px] shadow-[0_4px_10px_rgba(0,0,0,0.35),0_30px_70px_rgba(0,0,0,0.55)] border border-neutral-200/50 flex flex-col items-center relative z-20 pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          const full = item.type === 'live_photo' ? item.videoUrl : item.url
                          if ((item.type === 'video' || item.type === 'live_photo') && full) {
                            e.stopPropagation()
                            setSelectedVideo(full)
                          }
                        }}
                      >
                        {/* White-bordered photo frame with exact aspect ratio & object-contain to prevent any cropping */}
                        <div
                          style={{ aspectRatio: aspect }}
                          className="w-auto h-auto max-h-[60vh] max-w-[70vw] relative overflow-hidden bg-neutral-100"
                        >
                          {item.type === 'image' && (
                            <img
                              src={item.url}
                              className="w-full h-full object-contain pointer-events-none"
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
                              className="w-full h-full object-contain pointer-events-none"
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
                              className="w-full h-full object-contain pointer-events-none"
                            />
                          )}

                          {/* Frosted glare overlay */}
                          <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                        </div>

                        {/* Handlabeled margin details (relative flex flow, auto-expands bottom border if wrapped) */}
                        {(item.location_name || item.date_taken) && (
                          <div 
                            style={{ fontFamily: "'Caveat', cursive" }}
                            className="mt-3.5 mb-1 w-full text-center text-[1.85rem] font-bold tracking-wide text-slate-700/85 select-none pointer-events-none flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 leading-tight px-1.5"
                          >
                            {item.location_name && <span>{item.location_name}</span>}
                            {item.location_name && item.date_taken && <span className="text-slate-400/70">-</span>}
                            {item.date_taken && <span>{formatDate(item.date_taken)}</span>}
                          </div>
                        )}
                      </motion.div>
                    </div>
                  )
                })()
              ) : (
                <div className="w-full h-full flex gap-12 items-center justify-center p-12 relative">
                  {activeSlide.items.map((item, idx) => {
                    const isFirst = idx === 0
                    const itemAspect = item.width && item.height ? `${item.width} / ${item.height}` : '3/4'
                    const baseRot = [2.2, -3.1, 1.4, -2.3, 3.2, -1.6][(currentIdx + idx) % 6]
                    
                    const itemSeed = item.url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
                    
                    const xStart = isFirst ? -400 - (itemSeed % 100) : 400 + (itemSeed % 100);
                    const xTarget = isFirst ? -30 - (itemSeed % 20) : 30 + (itemSeed % 20);
                    
                    const yStart = (itemSeed % 100) - 50;
                    const yTarget = yStart + (itemSeed % 2 === 0 ? 120 : -120);
                    
                    const initRot = isFirst ? baseRot : -baseRot + (itemSeed % 4);
                    const targetRot = initRot + (itemSeed % 2 === 0 ? 6 : -6);

                    const xKeys = [xStart, xStart + (xTarget - xStart)*0.35 + 8, xStart + (xTarget - xStart)*0.65 - 8, xTarget];
                    const yKeys = [yStart, yStart + (yTarget - yStart)*0.35 - 8, yStart + (yTarget - yStart)*0.65 + 8, yTarget];
                    const rotKeys = [initRot, initRot + (targetRot - initRot)*0.4, initRot + (targetRot - initRot)*0.8, targetRot];

                    const exitX = isFirst ? '120vw' : '-120vw';
                    const exitY = yTarget + (itemSeed % 2 === 0 ? 100 : -100);

                    return (
                        <motion.div
                          key={item.url}
                          initial={{ scale: 0.35, opacity: 0, filter: 'blur(8px)', x: xStart, y: yStart, rotate: initRot }}
                          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', x: xKeys, y: yKeys, rotate: rotKeys }}
                          exit={{
                            scale: 2.2,
                            x: exitX,
                            y: exitY,
                            rotate: isFirst ? targetRot - 25 : targetRot + 25,
                            opacity: 0,
                            transition: { duration: 1.2, ease: 'easeIn' }
                          }}
                          transition={{
                            scale: { type: 'spring', damping: 22, stiffness: 60, delay: isFirst ? 0 : 0.08 },
                            filter: { duration: 0.6, delay: isFirst ? 0 : 0.08 },
                            opacity: { duration: 0.6, delay: isFirst ? 0 : 0.08 },
                            x: { duration: 8.2, ease: 'easeInOut' },
                            y: { duration: 8.2, ease: 'easeInOut' },
                            rotate: { duration: 8.2, ease: 'easeInOut' }
                          }}
                          className="bg-[#faf8f5] p-3.5 pb-4 rounded-[4px] shadow-[0_4px_10px_rgba(0,0,0,0.35),0_30px_70px_rgba(0,0,0,0.55)] border border-neutral-200/50 flex flex-col items-center relative z-20 pointer-events-auto cursor-pointer"
                          onClick={(e) => {
                            const full = item.type === 'live_photo' ? item.videoUrl : item.url
                            if ((item.type === 'video' || item.type === 'live_photo') && full) {
                              e.stopPropagation()
                              setSelectedVideo(full)
                            }
                          }}
                        >
                          {/* White-bordered photo frame with exact aspect ratio & object-contain to prevent any cropping */}
                          <div
                            style={{ aspectRatio: itemAspect }}
                            className="w-auto h-auto max-h-[60vh] max-w-[34vw] relative overflow-hidden bg-neutral-100"
                          >
                            {item.type === 'image' && (
                              <img
                                src={item.url}
                                className="w-full h-full object-contain pointer-events-none"
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
                                className="w-full h-full object-contain pointer-events-none"
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
                                className="w-full h-full object-contain pointer-events-none"
                              />
                            )}

                            {/* Frosted glare overlay */}
                            <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                          </div>

                          {/* Handlabeled margin details (relative flex flow, auto-expands bottom border if wrapped) */}
                          {(item.location_name || item.date_taken) && (
                            <div 
                              style={{ fontFamily: "'Caveat', cursive" }}
                              className="mt-3.5 mb-1 w-full text-center text-[1.75rem] font-bold tracking-wide text-slate-700/85 select-none pointer-events-none flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 leading-tight px-1.5"
                            >
                              {item.location_name && <span>{item.location_name}</span>}
                              {item.location_name && item.date_taken && <span className="text-slate-400/70">-</span>}
                              {item.date_taken && <span>{formatDate(item.date_taken)}</span>}
                            </div>
                          )}
                        </motion.div>
                    )
                  })}
                </div>
              )}
        </motion.div>
      </AnimatePresence>

      {selectedVideo && (
        <div
          className="fixed inset-0 z-[130] bg-black flex items-center justify-center cursor-default"
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
            className="absolute top-6 right-6 z-[140] p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-white/10 shadow-lg cursor-pointer flex items-center justify-center"
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
      <div className="absolute bottom-6 left-6 text-white/35 text-xs font-light tracking-wider z-20 pointer-events-none">
        Tap screen to return
      </div>
    </div>
  )
}
