import { RuntimeLoader } from '@rive-app/react-webgl2'
import riveWasmUrl from '@rive-app/webgl2/rive.wasm?url'
import riveFallbackWasmUrl from '@rive-app/webgl2/rive_fallback.wasm?url'

// Configure Rive WebGL2 to load WASM strictly from local Vite bundle (zero unpkg/jsdelivr CDN calls).
RuntimeLoader.setWasmUrl(riveWasmUrl)
RuntimeLoader.setWasmFallbackUrl(riveFallbackWasmUrl)

const rivBufferCache = new Map<string, ArrayBuffer>()
let prewarmed = false

const ALL_RIVE_ASSETS = [
  '/celebrations/rive/birb.riv',
  '/celebrations/rive/marty_hoverboard.riv',
  '/celebrations/rive/safari_jeep.riv',
  '/celebrations/rive/happy_juice.riv',
  '/celebrations/rive/jet_blast.riv',
  '/celebrations/rive/rewards_chest.riv',
  '/celebrations/rive/gizmo_bot.riv',
  '/celebrations/rive/road_trip.riv',
  '/celebrations/rive/coyote.riv',
]

export function getCachedRivBuffer(src: string): ArrayBuffer | undefined {
  const buf = rivBufferCache.get(src)
  return buf ? buf.slice(0) : undefined
}

export function fetchAndCacheRiv(src: string): Promise<ArrayBuffer | undefined> {
  const existing = rivBufferCache.get(src)
  if (existing) return Promise.resolve(existing.slice(0))
  return fetch(src)
    .then((res) => (res.ok ? res.arrayBuffer() : undefined))
    .then((buf) => {
      if (buf) {
        rivBufferCache.set(src, buf)
        return buf.slice(0)
      }
      return undefined
    })
    .catch(() => undefined)
}

/**
 * Pre-compiles the Rive WebGL2 WASM module and pre-caches `.riv` byte buffers during idle time
 * so chore/reward celebrations start in < 5ms on the Apolosign 21.5" Android tablet.
 */
export function prewarmRiveRuntime(): void {
  if (prewarmed || typeof window === 'undefined') return
  prewarmed = true

  const schedule =
    typeof window.requestIdleCallback === 'function'
      ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 3000 })
      : (cb: () => void) => window.setTimeout(cb, 1400)

  schedule(() => {
    RuntimeLoader.awaitInstance().catch(() => {})
    ALL_RIVE_ASSETS.forEach((src, idx) => {
      window.setTimeout(() => {
        fetchAndCacheRiv(src)
      }, 250 + idx * 180)
    })
  })
}
