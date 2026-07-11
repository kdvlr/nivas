import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { PinFailAnimation } from './pin-fail-animations'

const DURATION_MS = 3200

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
    const timer = setTimeout(() => onDoneRef.current(), DURATION_MS)
    return () => {
      cleanup?.()
      clearTimeout(timer)
    }
  }, [anim])

  return createPortal(
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: anim.backdrop }}
      onClick={() => onDoneRef.current()}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-[12%] px-6 text-center">
        <span
          className="inline-block animate-bounce text-5xl font-black tracking-tight text-white lg:text-7xl"
          style={{ textShadow: '0 4px 24px rgba(0,0,0,0.55)' }}
        >
          {tauntRef.current}
        </span>
      </div>
    </div>,
    document.body,
  )
}
