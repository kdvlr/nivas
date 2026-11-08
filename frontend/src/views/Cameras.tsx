import { useState, useRef, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import Icon from '../components/Icon'
import { SCRYPTED_NVR_URL } from '../lib/cameras'

interface CamerasProps {
  now?: Date
  config?: any
}

export default function Cameras({ now = new Date(), config }: CamerasProps) {
  const [iframeKey, setIframeKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleReload = () => {
    setIsLoading(true)
    setIframeKey((prev) => prev + 1)
  }

  const handleOpenExternal = () => {
    window.open(SCRYPTED_NVR_URL, '_blank', 'noopener,noreferrer')
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  return (
    <div
      ref={containerRef}
      className={`h-full flex flex-col min-h-0 overflow-hidden ${
        isFullscreen ? 'p-0 bg-black' : 'p-2 sm:p-4 lg:p-6'
      }`}
    >
      {!isFullscreen && (
        <PageHeader
          title="Cameras"
          now={now}
          config={config}
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300/60 dark:border-emerald-800/60 px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shrink-0">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          }
          rightActions={
            <>
              <button
                onClick={handleReload}
                className="btn-glass p-2 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 cursor-pointer"
                title="Reload camera feeds"
              >
                <Icon name="refresh" className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Reload</span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="btn-glass p-2 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 cursor-pointer"
                title="Toggle fullscreen"
              >
                <Icon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} />
                <span className="hidden sm:inline">Fullscreen</span>
              </button>
              <button
                onClick={handleOpenExternal}
                className="btn-glass p-2 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 cursor-pointer"
                title="Open Scrypted in new tab"
              >
                <Icon name="open_in_new" />
                <span className="hidden sm:inline">Pop Out</span>
              </button>
            </>
          }
        />
      )}

      {/* Camera Feed Container */}
      <div
        className={`relative flex-1 w-full min-h-0 overflow-hidden ${
          isFullscreen
            ? 'rounded-none border-0'
            : 'rounded-3xl glass shadow-lg border border-slate-200/50 dark:border-slate-800/60 bg-black/40 backdrop-blur-md'
        }`}
      >
        {/* Floating exit fullscreen button for tablet / touch kiosks */}
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-50 p-2.5 rounded-full shadow-lg bg-black/70 hover:bg-black/90 text-white transition-all duration-200 backdrop-blur-sm border border-white/20 cursor-pointer"
            title="Exit Fullscreen"
          >
            <Icon name="fullscreen_exit" className="text-2xl" />
          </button>
        )}

        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/60 backdrop-blur-sm text-white">
            <Icon name="progress_activity" className="animate-spin text-4xl text-teal-400" />
            <span className="text-sm font-medium tracking-wide">Connecting to Scrypted NVR...</span>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={SCRYPTED_NVR_URL}
          title="Scrypted Camera View"
          className="w-full h-full border-0 rounded-3xl"
          allow="autoplay; fullscreen; picture-in-picture; camera; microphone; display-capture"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  )
}
