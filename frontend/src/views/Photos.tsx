import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useData } from '../lib/hooks'

interface MediaItem {
  url: string
  type: 'image' | 'video'
  name: string
}

export default function Photos() {
  const { data: media, reload, loading } = useData<MediaItem[]>('/api/photos', ['photos'])
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  
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
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Photos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Ambient family gallery synced from iCloud
          </p>
        </div>

        <button
          onClick={reload}
          disabled={loading}
          className={`flex items-center justify-center p-3 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all active:scale-95 ${
            loading ? 'animate-spin' : ''
          }`}
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && !media && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-indigo-500 animate-spin">
            progress_activity
          </span>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Scanning gallery...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && (!media || media.length === 0) && (
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto text-center space-y-4">
          <div className="p-4 rounded-3xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 dark:text-indigo-400">
            <span className="material-symbols-outlined text-5xl">photo_library</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {media.map((item, idx) => (
            <motion.div
              key={item.url}
              onClick={() => openLightbox(idx)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="relative aspect-square cursor-pointer overflow-hidden rounded-3xl bg-slate-100 dark:bg-slate-800 shadow-sm group border border-slate-200/50 dark:border-slate-700/50"
            >
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full relative">
                  <video
                    src={item.url}
                    preload="metadata"
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Video Icon Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/90 dark:bg-neutral-900/90 text-slate-900 dark:text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                      <span className="material-symbols-outlined text-2xl pl-0.5">play_arrow</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Hover filename label */}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                <p className="text-[10px] text-white font-medium truncate">{item.name}</p>
              </div>
            </motion.div>
          ))}
        </div>
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
            <div className="flex items-center justify-between p-4 z-10 text-white">
              <span className="text-sm font-light truncate max-w-[70vw]">{currentMedia.name}</span>
              <button
                onClick={closeLightbox}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">close</span>
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
                  {currentMedia.type === 'image' ? (
                    <img
                      src={currentMedia.url}
                      alt={currentMedia.name}
                      className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl"
                    />
                  ) : (
                    <video
                      src={currentMedia.url}
                      controls
                      autoPlay
                      className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl"
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Side Navigation Buttons (Desktop / Large display) */}
              <button
                onClick={() => navigateLightbox('prev')}
                className="absolute left-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90"
              >
                <span className="material-symbols-outlined text-3xl">chevron_left</span>
              </button>

              <button
                onClick={() => navigateLightbox('next')}
                className="absolute right-6 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90"
              >
                <span className="material-symbols-outlined text-3xl">chevron_right</span>
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
