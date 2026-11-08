import { useState } from 'react'
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

  const handleReload = () => {
    setIsLoading(true)
    setIframeKey((prev) => prev + 1)
  }

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden p-1 sm:p-2 lg:p-2.5">
      <PageHeader
        title="Cameras"
        now={now}
        config={config}
        className="mb-1 sm:mb-1.5 shrink-0"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300/60 dark:border-emerald-800/60 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        }
        rightActions={
          <button
            onClick={handleReload}
            className="btn-glass p-1.5 sm:px-2.5 sm:py-1 text-xs font-medium flex items-center gap-1 cursor-pointer"
            title="Reload camera feeds"
          >
            <Icon name="refresh" className={isLoading ? 'animate-spin text-sm' : 'text-sm'} />
            <span className="hidden sm:inline text-xs">Reload</span>
          </button>
        }
      />

      {/* Maximized Camera Feed Container */}
      <div className="relative flex-1 w-full min-h-0 rounded-2xl glass shadow-md border border-slate-200/50 dark:border-slate-800/60 bg-black/60 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/60 backdrop-blur-sm text-white">
            <Icon name="progress_activity" className="animate-spin text-3xl text-teal-400" />
            <span className="text-xs sm:text-sm font-medium tracking-wide">Connecting to Scrypted NVR...</span>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={SCRYPTED_NVR_URL}
          title="Scrypted Camera View"
          className="w-full h-full border-0 rounded-2xl bg-black"
          allow="autoplay; fullscreen; picture-in-picture; camera; microphone; display-capture"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  )
}
