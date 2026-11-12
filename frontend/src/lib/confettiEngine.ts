import confetti from 'canvas-confetti'

/**
 * Hardware profile detection for Apolosign 21.5" Android Tablet (RK3576 + ARM Mali-G52 MC3)
 * and similar touch/tablet displays. Evaluated once at module load to avoid layout reads.
 */
export const IS_TABLET_KIOSK: boolean =
  typeof window !== 'undefined' &&
  (navigator.maxTouchPoints > 0 ||
    /Android|webOS|iPhone|iPad|iPod|Tablet/i.test(navigator.userAgent))

/** Cap backing-store DPR on Mali-G52 tablets so 1920x1080 fullscreen canvases stay locked at 60 FPS. */
export const TABLET_DPR_CAP: number = IS_TABLET_KIOSK ? 1.35 : 2

export function getOptimalDpr(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(window.devicePixelRatio || 1, TABLET_DPR_CAP)
}

export function scaleTabletParticleCount(baseCount: number, isTablet = IS_TABLET_KIOSK): number {
  const ratio = isTablet ? 0.44 : 0.85
  return Math.max(8, Math.round(baseCount * ratio))
}

const CAN_USE_WORKER: boolean =
  typeof window !== 'undefined' &&
  typeof Worker !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' &&
  typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function'

let globalWorkerLauncher: confetti.CreateTypes | null = null

function getGlobalLauncher(): confetti.CreateTypes {
  if (!globalWorkerLauncher) {
    globalWorkerLauncher = confetti.create(undefined, {
      resize: true,
      useWorker: CAN_USE_WORKER,
    })
  }
  return globalWorkerLauncher
}

/**
 * Fires confetti on a dedicated OffscreenCanvas Web Worker (offloading physics from the
 * Cortex-A72 main thread) with Mali-G52–friendly quad shapes and scaled flake sizes.
 */
export function fireTabletConfetti(opts: confetti.Options) {
  const shoot = getGlobalLauncher()
  const baseCount = opts.particleCount ?? 50
  return shoot({
    ...opts,
    particleCount: scaleTabletParticleCount(baseCount),
    ticks: opts.ticks ?? (IS_TABLET_KIOSK ? 95 : 135),
    scalar: (opts.scalar ?? 1.0) * (IS_TABLET_KIOSK ? 1.32 : 1.08),
    shapes: opts.shapes ?? (IS_TABLET_KIOSK ? ['square'] : ['square', 'circle']),
    zIndex: opts.zIndex ?? 9999,
    disableForReducedMotion: true,
  })
}

export function resetTabletConfetti() {
  try {
    globalWorkerLauncher?.reset()
    confetti.reset()
  } catch {}
}

const transferredCanvases = new WeakSet<HTMLCanvasElement>()

/**
 * Creates a confetti launcher bound to a specific `<canvas>`, safely enabling
 * OffscreenCanvas worker offloading once per element (StrictMode-safe).
 */
export function createBoundConfetti(canvas: HTMLCanvasElement): confetti.CreateTypes {
  let useWorker = false
  if (CAN_USE_WORKER && !transferredCanvases.has(canvas)) {
    transferredCanvases.add(canvas)
    useWorker = true
  }
  return confetti.create(canvas, { resize: true, useWorker })
}
