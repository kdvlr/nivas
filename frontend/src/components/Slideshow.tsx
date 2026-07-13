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
const PhotoInfoCard = ({ item, theme }: { item: MediaItem, theme: 'album' | 'grid' }) => {
  if (theme === 'album') return null // Hand-labeled margin takes care of it
  if (!item.location_name && !item.date_taken) return null

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, type: 'spring', damping: 15 }}
      className="absolute bottom-4 left-6 z-20 flex items-center gap-3 px-4.5 py-2.5 rounded-full bg-neutral-900/90 border border-white/10 text-white shadow-xl backdrop-blur-md select-none pointer-events-none"
    >
      {item.location_name && (
        <div className="flex items-center gap-1.5 text-xs font-bold tracking-tight">
          <Icon name="location_on" className="text-sm text-indigo-400" />
          <span>{item.location_name}</span>
        </div>
      )}
      {item.location_name && item.date_taken && (
        <span className="w-1 h-1 rounded-full bg-white/20" />
      )}
      {item.date_taken && (
        <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium">
          <Icon name="calendar_today" className="text-[11px] text-teal-300" />
          <span>{formatDate(item.date_taken)}</span>
        </div>
      )}
    </motion.div>
  )
}

export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [styleTheme, setStyleTheme] = useState<'album' | 'grid'>(() => {
    return (localStorage.getItem('screensaverStyle') as 'album' | 'grid') || 'album'
  })

  const toggleStyleTheme = (theme: 'album' | 'grid') => {
    setStyleTheme(theme)
    localStorage.setItem('screensaverStyle', theme)
  }

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

  const gridBgStyle = {
    backgroundColor: '#080b13',
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px'
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden cursor-none select-none transition-all duration-700 flex items-center justify-center"
      style={styleTheme === 'album' ? albumBgStyle : gridBgStyle}
      onClick={onDismiss}
    >
      {/* Dynamic Style Switcher Segmented Control overlay */}
      <div 
        className="absolute top-6 right-6 z-[120] flex items-center gap-1 p-1 rounded-full bg-neutral-900/60 backdrop-blur-md border border-white/10 shadow-lg cursor-default select-none pointer-events-auto"
        onClick={(e) => e.stopPropagation()} // Prevent closing screensaver when toggling theme
      >
        <button
          onClick={() => toggleStyleTheme('album')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1 ${
            styleTheme === 'album' 
              ? 'bg-white text-neutral-900 shadow-sm scale-100' 
              : 'text-white/60 hover:text-white hover:bg-white/5 scale-95'
          }`}
        >
          <span>🍎</span> Album
        </button>
        <button
          onClick={() => toggleStyleTheme('grid')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1 ${
            styleTheme === 'grid' 
              ? 'bg-white text-neutral-900 shadow-sm scale-100' 
              : 'text-white/60 hover:text-white hover:bg-white/5 scale-95'
          }`}
        >
          <span>🤖</span> Grid
        </button>
      </div>

      {styleTheme === 'album' ? (
        <>
          {/* Style A: Dappled sunlight pattern overlay */}
          <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.09] bg-gradient-to-br from-white via-transparent to-black mix-blend-overlay" />

          {/* Main Slideshow Frame */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`album_${activeSlide.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 1.6, ease: 'easeInOut' }}
              className="absolute inset-0 z-10 w-full h-full flex items-center justify-center"
            >
              {activeSlide.type === 'single' ? (
                (() => {
                  const item = activeSlide.items[0]
                  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '16/9'
                  const rotation = [2.2, -3.1, 1.4, -2.3, 3.2, -1.6][currentIdx % 6]
                  
                  return (
                    <div className="relative flex items-center justify-center">
                      <motion.div
                        style={{ aspectRatio: aspect, rotate: rotation }}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, x: dir.x[1] * 1.8, y: dir.y[1] * 1.8 }}
                        exit={{
                          scale: 1.4,
                          x: currentIdx % 2 === 0 ? '-100vw' : '100vw',
                          opacity: 0,
                          transition: { duration: 1.4, ease: 'easeInOut' }
                        }}
                        transition={{
                          scale: { type: 'spring', damping: 20, stiffness: 85 },
                          opacity: { duration: 0.6 },
                          x: { duration: 8.2, ease: 'linear' },
                          y: { duration: 8.2, ease: 'linear' }
                        }}
                        className="max-h-[76vh] max-w-[76vw] bg-[#faf8f5] p-3.5 pb-11 rounded-lg shadow-[0_4px_10px_rgba(0,0,0,0.35),0_30px_70px_rgba(0,0,0,0.55)] border border-neutral-200/50 flex flex-col items-center justify-center relative z-20 pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          const full = item.type === 'live_photo' ? item.videoUrl : item.url
                          if ((item.type === 'video' || item.type === 'live_photo') && full) {
                            e.stopPropagation()
                            setSelectedVideo(full)
                          }
                        }}
                      >
                        {/* Static unzoomed media inside frame to prevent any cropping */}
                        <div className="w-full h-full relative overflow-hidden bg-neutral-900 rounded-md">
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

                          {/* Frosted glare overlay */}
                          <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                        </div>

                        {/* Handlabeled margin details */}
                        {(item.location_name || item.date_taken) && (
                          <div 
                            style={{ fontFamily: "'Caveat', cursive" }}
                            className="absolute bottom-1 w-full text-center text-[1.75rem] font-bold tracking-wide text-slate-700/85 select-none pointer-events-none flex items-center justify-center gap-2"
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
                    const rotation = [2.2, -3.1, 1.4, -2.3, 3.2, -1.6][(currentIdx + idx) % 6]
                    const cardRot = isFirst ? rotation : -rotation * 0.8
                    const childDir = {
                      x: isFirst ? [dir.x[0] / 2, dir.x[1] / 2] : [-dir.x[0] / 2, -dir.x[1] / 2],
                      y: [dir.y[0] / 2, dir.y[1] / 2]
                    }
                    
                    return (
                      <motion.div
                        key={item.url}
                        style={{ aspectRatio: itemAspect, rotate: cardRot }}
                        initial={{ scale: 0.7, opacity: 0, x: isFirst ? -80 : 80 }}
                        animate={{ scale: 1, opacity: 1, x: childDir.x[1] * 1.8, y: childDir.y[1] * 1.8 }}
                        exit={{
                          scale: 1.4,
                          x: isFirst ? '-100vw' : '100vw',
                          opacity: 0,
                          transition: { duration: 1.4, ease: 'easeInOut' }
                        }}
                        transition={{
                          scale: { type: 'spring', damping: 20, stiffness: 85 },
                          opacity: { duration: 0.6 },
                          x: { duration: 8.2, ease: 'linear' },
                          y: { duration: 8.2, ease: 'linear' }
                        }}
                        className="max-h-[76vh] flex-1 bg-[#faf8f5] p-3.5 pb-11 rounded-lg shadow-[0_4px_10px_rgba(0,0,0,0.35),0_30px_70px_rgba(0,0,0,0.55)] border border-neutral-200/50 flex flex-col items-center justify-center relative z-20 pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          const full = item.type === 'live_photo' ? item.videoUrl : item.url
                          if ((item.type === 'video' || item.type === 'live_photo') && full) {
                            e.stopPropagation()
                            setSelectedVideo(full)
                          }
                        }}
                      >
                        {/* Static unzoomed media inside frame to prevent any cropping */}
                        <div className="w-full h-full relative overflow-hidden bg-neutral-900 rounded-md">
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

                          {/* Frosted glare overlay */}
                          <div className="absolute inset-0 z-10 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10" />
                        </div>

                        {/* Handlabeled margin details */}
                        {(item.location_name || item.date_taken) && (
                          <div 
                            style={{ fontFamily: "'Caveat', cursive" }}
                            className="absolute bottom-1 w-full text-center text-[1.75rem] font-bold tracking-wide text-slate-700/85 select-none pointer-events-none flex items-center justify-center gap-2"
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
        </>
      ) : (
        <>
          {/* Style B: Geometric Collage Grid */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`grid_${activeSlide.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              transition={{ duration: 1.2, ease: 'easeInOut' }}
              className="absolute inset-0 z-10 w-full h-full flex items-center justify-center"
            >
              {activeSlide.type === 'single' ? (
                (() => {
                  const item = activeSlide.items[0]
                  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : '16/9'
                  
                  return (
                    <div className="relative flex items-center justify-center p-6">
                      <motion.div
                        style={{ aspectRatio: aspect }}
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1.02, opacity: 1, x: dir.x[1] / 2, y: dir.y[1] / 2 }}
                        exit={{
                          scale: 1.4,
                          x: currentIdx % 2 === 0 ? '-100vw' : '100vw',
                          opacity: 0,
                          transition: { duration: 1.4, ease: 'easeInOut' }
                        }}
                        transition={{
                          scale: { type: 'spring', damping: 20, stiffness: 90 },
                          opacity: { duration: 0.6 },
                          x: { duration: 8.2, ease: 'linear' },
                          y: { duration: 8.2, ease: 'linear' }
                        }}
                        className="max-h-[82vh] max-w-[82vw] rounded-[28px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 bg-neutral-950 flex items-center justify-center relative z-20 pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          const full = item.type === 'live_photo' ? item.videoUrl : item.url
                          if ((item.type === 'video' || item.type === 'live_photo') && full) {
                            e.stopPropagation()
                            setSelectedVideo(full)
                          }
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

                        {/* Interactive Travel postmark post stamp badge */}
                        {item.location_name && (
                          <motion.div 
                            initial={{ scale: 0, rotate: 0 }}
                            animate={{ scale: 1, rotate: -12 }}
                            transition={{ delay: 0.7, type: 'spring', damping: 12 }}
                            className="absolute top-4 -right-2 z-30 px-3 py-1.5 rounded-full border-2 border-dashed border-rose-500/40 bg-neutral-950/95 text-rose-400 font-bold uppercase tracking-widest text-[9px] select-none pointer-events-none shadow-md flex items-center gap-1"
                          >
                            <Icon name="location_on" className="text-[10px]" />
                            <span>{item.location_name.split(',')[0]}</span>
                          </motion.div>
                        )}
                      </motion.div>

                      {/* Floating details badge under container */}
                      <PhotoInfoCard item={item} theme={styleTheme} />
                    </div>
                  )
                })()
              ) : (
                <div className="w-full h-full flex gap-8 items-center justify-center p-8 relative">
                  {activeSlide.items.map((item, idx) => {
                    const isFirst = idx === 0
                    const itemAspect = item.width && item.height ? `${item.width} / ${item.height}` : '3/4'
                    const childDir = {
                      x: isFirst ? [dir.x[0] / 2, dir.x[1] / 2] : [-dir.x[0] / 2, -dir.x[1] / 2],
                      y: [dir.y[0] / 2, dir.y[1] / 2]
                    }
                    
                    return (
                      <div key={item.url} className="relative flex-1 h-full max-h-[82vh] flex items-center justify-center">
                        <motion.div
                          style={{ aspectRatio: itemAspect }}
                          initial={{ scale: 0.7, opacity: 0, x: isFirst ? -80 : 80 }}
                          animate={{ scale: 1.02, opacity: 1, x: childDir.x[1] / 2, y: childDir.y[1] / 2 }}
                          exit={{
                            scale: 1.4,
                            x: isFirst ? '-100vw' : '100vw',
                            opacity: 0,
                            transition: { duration: 1.4, ease: 'easeInOut' }
                          }}
                          transition={{
                            scale: { type: 'spring', damping: 20, stiffness: 90 },
                            opacity: { duration: 0.6 },
                            x: { duration: 8.2, ease: 'linear' },
                            y: { duration: 8.2, ease: 'linear' }
                          }}
                          className="h-full rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 bg-neutral-950 flex items-center justify-center relative z-20 pointer-events-auto cursor-pointer"
                          onClick={(e) => {
                            const full = item.type === 'live_photo' ? item.videoUrl : item.url
                            if ((item.type === 'video' || item.type === 'live_photo') && full) {
                              e.stopPropagation()
                              setSelectedVideo(full)
                            }
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

                          {/* Post stamp badge in grid cells */}
                          {item.location_name && (
                            <motion.div 
                              initial={{ scale: 0, rotate: 0 }}
                              animate={{ scale: 1, rotate: -12 }}
                              transition={{ delay: 0.7, type: 'spring', damping: 12 }}
                              className="absolute top-4 -right-2 z-30 px-3 py-1.5 rounded-full border-2 border-dashed border-rose-500/40 bg-neutral-950/95 text-rose-400 font-bold uppercase tracking-widest text-[9px] select-none pointer-events-none shadow-md flex items-center gap-1"
                            >
                              <Icon name="location_on" className="text-[10px]" />
                              <span>{item.location_name.split(',')[0]}</span>
                            </motion.div>
                          )}
                        </motion.div>

                        <PhotoInfoCard item={item} theme={styleTheme} />
                      </div>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

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
