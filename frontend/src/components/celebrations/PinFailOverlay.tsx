import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { PinFailAnimation } from './pin-fail-animations'

const DURATION_MS = 3400

/** Fullscreen wrong-PIN animation; auto-dismisses (or tap to skip). */
export default function PinFailOverlay({
  anim,
  onDone,
}: {
  anim: PinFailAnimation
  onDone: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const tauntRef = useRef('')
  if (!tauntRef.current) {
    tauntRef.current = anim.taunts[Math.floor(Math.random() * anim.taunts.length)]
  }

  useEffect(() => {
    const cleanup = canvasRef.current ? anim.run(canvasRef.current) : undefined
    const duration = anim.durationMs || DURATION_MS
    const timer = setTimeout(() => onDoneRef.current(), duration)
    return () => {
      cleanup?.()
      clearTimeout(timer)
    }
  }, [anim])

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-hidden select-none cursor-pointer"
      style={{ background: anim.backdrop }}
      onClick={() => onDoneRef.current()}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      {!anim.hideHtmlTaunt && (
        <div className="pointer-events-none absolute inset-x-0 top-[10%] px-6 text-center">
          <span
            className="inline-block animate-bounce text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
          >
            {tauntRef.current}
          </span>
        </div>
      )}
    </div>,
    document.body,
  )
}

