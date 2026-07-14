import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '../lib/hooks'
import Icon from '../components/Icon'

interface MediaItem {
  url: string
  thumbnailUrl?: string
  videoUrl?: string
  type: 'image' | 'video' | 'live_photo'
  name: string
  orientation?: 'portrait' | 'landscape'
  width?: number
  height?: number
  date_taken?: string | null
  location_name?: string | null
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

// Sub-component for individual media grid tiles to isolate state and performance
const MediaTile = ({ item, onClick }: { item: MediaItem; onClick: () => void }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [imgError, setImgError] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver to auto-play Live Photos when they scroll into view
  useEffect(() => {
    if (item.type !== 'live_photo' || !item.videoUrl) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsPlaying(true)
          videoRef.current?.play().catch((err) => console.log('Live Photo autoplay blocked:', err))
        } else {
          setIsPlaying(false)
          videoRef.current?.pause()
        }
      },
      { threshold: 0.6 } // Play when 60% of the tile is visible in the viewport
    )

    const currentRef = containerRef.current
    if (currentRef) observer.observe(currentRef)

    return () => {
      if (currentRef) observer.unobserve(currentRef)
    }
  }, [item.type, item.videoUrl])

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="relative aspect-square cursor-pointer overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-800 shadow-sm group border border-slate-200/50 dark:border-slate-700/50 select-none"
    >
      {item.type === 'image' && (
        imgError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-200 dark:bg-slate-700/50" onClick={onClick}>
            <Icon name="broken_image" className="text-4xl opacity-50 mb-1" />
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-60">Unsupported</span>
          </div>
        ) : (
          <img
            src={item.thumbnailUrl || item.url}
            alt={item.name}
            loading="lazy"
            onClick={onClick}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )
      )}

      {item.type === 'video' && (
        <div className="w-full h-full relative animate-fadeIn" onClick={onClick}>
          <video
            src={`${item.url}#t=0.1`} // Seek to 0.1s to force the browser to render a preview poster frame
            preload="metadata" // Download metadata only to conserve bandwidth and speed up layout
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Video Icon Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/25 transition-colors">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/95 dark:bg-neutral-900/95 text-slate-900 dark:text-white shadow-md transition-transform duration-300 group-hover:scale-110">
              <Icon name="play_arrow" className="text-2xl pl-0.5" />
            </div>
          </div>
        </div>
      )}

      {item.type === 'live_photo' && (
        <div
          ref={containerRef}
          className="w-full h-full relative"
          onClick={onClick}
        >
          {/* Static JPEG component (fallback / behind video) */}
          <img
            src={item.thumbnailUrl || item.url}
            alt={item.name}
            loading="lazy"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isPlaying ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Inline auto-playing video layer */}
          {item.videoUrl && (
            <video
              ref={videoRef}
              src={item.videoUrl}
              preload="metadata"
              muted
              playsInline
              loop
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
          )}

          {/* Live Photo Circle Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-[9px] font-bold tracking-wider shadow-sm select-none pointer-events-none">
            <Icon name="adjust" className="text-[10px] animate-pulse text-indigo-400" />
            <span>LIVE</span>
          </div>
        </div>
      )}

      {/* Hover filename label */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-end">
        <p className="text-xs text-white font-medium truncate drop-shadow-md">{item.name}</p>
        {(item.date_taken || item.width) && (
          <p className="text-[10px] text-white/80 truncate mt-0.5 drop-shadow-md">
            {[formatDate(item.date_taken), item.width ? `${item.width}×${item.height}` : null].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// Lightbox Live Photo display helper
const LightboxLivePhoto = ({ item }: { item: MediaItem }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Autoplay live photo in lightbox
    setIsPlaying(true)
    videoRef.current?.play().catch((err) => console.log('Lightbox Live Photo autoplay failed:', err))
  }, [item.url])

  return (
    <div className="relative flex items-center justify-center max-h-[80vh] max-w-[90vw] select-none">
      <img
        src={item.url}
        alt={item.name}
        className={`max-h-[80vh] max-w-[90vw] object-contain rounded-2xl transition-opacity duration-300 ${
          isPlaying ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {item.videoUrl && (
        <video
          ref={videoRef}
          src={item.videoUrl}
          preload="metadata"
          muted
          playsInline
          loop
          className={`absolute max-h-[80vh] max-w-[90vw] object-contain rounded-2xl transition-opacity duration-300 ${
            isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />
      )}

      {/* Live Badge overlay */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold tracking-wider shadow-md pointer-events-none">
        <Icon name="adjust" className="text-sm animate-pulse text-indigo-400" />
        <span>LIVE PHOTO</span>
      </div>
    </div>
  )
}

export default function Photos({ onStartSlideshow }: { onStartSlideshow?: () => void }) {
  const { data: media, reload, loading } = useData<MediaItem[]>('/api/photos', ['photos'])
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(48)

  useEffect(() => {
    setVisibleCount(48)
  }, [media])

  // Infinite scroll listener
  useEffect(() => {
    if (!media || media.length <= visibleCount) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 48, media.length))
        }
      },
      { rootMargin: '200px' }
    )

    const sentinel = document.getElementById('load-more-sentinel')
    if (sentinel) observer.observe(sentinel)

    return () => {
      if (sentinel) observer.unobserve(sentinel)
    }
  }, [media, visibleCount])

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIdx === null || !media) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setLightboxIdx((prev) => (prev !== null ? (prev - 1 + media.length) % media.length : null))
      } else if (e.key === 'ArrowRight') {
        setLightboxIdx((prev) => (prev !== null ? (prev + 1) % media.length : null))
      } else if (e.key === 'Escape') {
        setLightboxIdx(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIdx, media])

  const openLightbox = (index: number) => {
    setLightboxIdx(index)
  }

  const closeLightbox = () => {
    setLightboxIdx(null)
  }

  const navigateLightbox = (dir: 'prev' | 'next') => {
    if (lightboxIdx === null || !media) return
    if (dir === 'prev') {
      setLightboxIdx((lightboxIdx - 1 + media.length) % media.length)
    } else {
      setLightboxIdx((lightboxIdx + 1) % media.length)
    }
  }

  const currentMedia = lightboxIdx !== null && media ? media[lightboxIdx] : null

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      {/* Header section in MD3 Style */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">
            Photos
          </h1>
          <p className="text-sm lg:text-base text-ink-soft mt-1">
            Ambient family gallery synced from iCloud
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onStartSlideshow && media && media.length > 0 && (
            <button
              onClick={onStartSlideshow}
              className="btn-glass px-4 py-2.5 shadow-sm text-sm"
            >
              <Icon name="play_circle" className="text-lg" />
              <span>Slideshow</span>
            </button>
          )}

          <button
            onClick={reload}
            disabled={loading}
            className="btn-glass p-3 shadow-sm"
            title="Refresh gallery"
          >
            <Icon name="refresh" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !media && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <Icon name="progress_activity" className="text-4xl text-indigo-500 animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Scanning gallery...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && (!media || media.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-4">
          <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400">
            <Icon name="photo_library" className="text-5xl" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No photos or videos yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm leading-relaxed">
              Place photos and videos inside <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">/docker/nivas/photos</code> on the server to populate the family dashboard.
            </p>
          </div>
          <button
            onClick={reload}
            className="px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all active:scale-95 shadow-sm"
          >
            Scan Folder
          </button>
        </div>
      )}

      {/* Media Grid */}
      {media && media.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {media.slice(0, visibleCount).map((item, idx) => (
              <MediaTile key={item.url} item={item} onClick={() => openLightbox(idx)} />
            ))}
          </div>

          {media.length > visibleCount && (
            <div id="load-more-sentinel" className="h-20 flex items-center justify-center mt-6">
              <Icon name="progress_activity" className="text-2xl text-indigo-500 animate-spin" />
            </div>
          )}
        </>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {currentMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-neutral-950/98 backdrop-blur-md flex flex-col"
          >
            {/* Top Toolbar */}
            <div className="flex items-start justify-between p-4 z-10 text-white gap-4 w-full">
              <div className="flex flex-col text-left truncate">
                <span className="text-sm font-bold text-white/95 truncate">{currentMedia.name}</span>
                {(currentMedia.location_name || currentMedia.date_taken) && (
                  <span className="text-xs text-white/60 mt-1 flex items-center gap-2 truncate">
                    {currentMedia.location_name && (
                      <span className="flex items-center gap-0.5 truncate">
                        <Icon name="location_on" className="text-xs text-rose-400" />
                        {currentMedia.location_name}
                      </span>
                    )}
                    {currentMedia.location_name && currentMedia.date_taken && <span>•</span>}
                    {currentMedia.date_taken && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Icon name="calendar_today" className="text-[10px] text-indigo-300" />
                        {formatDate(currentMedia.date_taken)}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <button
                onClick={closeLightbox}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95 shrink-0"
              >
                <Icon name="close" />
              </button>
            </div>

            {/* Central Slide Display */}
            <div className="flex-1 relative flex items-center justify-center p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentMedia.url}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="max-h-[80vh] max-w-[90vw] flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  {currentMedia.type === 'image' && (
                    <img
                      src={currentMedia.url}
                      alt={currentMedia.name}
                      className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl"
                    />
                  )}

                  {currentMedia.type === 'video' && (
                    <video
                      src={currentMedia.url}
                      controls
                      autoPlay
                      className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl"
                    />
                  )}

                  {currentMedia.type === 'live_photo' && (
                    <LightboxLivePhoto item={currentMedia} />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Side Navigation Buttons */}
              <button
                onClick={() => navigateLightbox('prev')}
                className="absolute left-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90"
              >
                <Icon name="chevron_left" className="text-3xl" />
              </button>

              <button
                onClick={() => navigateLightbox('next')}
                className="absolute right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90"
              >
                <Icon name="chevron_right" className="text-3xl" />
              </button>
            </div>

            {/* Bottom thumbnail helper / counter */}
            <div className="p-4 text-center text-white/50 text-xs tracking-wider z-10">
              {lightboxIdx !== null && media && `${lightboxIdx + 1} / ${media.length}`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
