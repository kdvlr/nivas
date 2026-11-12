import { useEffect, useMemo, useRef, useState } from 'react'
import { buildInjectedSrcDoc } from '../../lib/storyboardHtml'

const storyboardHtmlCache = new Map<string, string>()
let prewarmStarted = false

const ALL_STORYBOARD_PATHS = [
  '/celebrations/bunny_bake_off.html',
  '/celebrations/panda_tea_party.html',
  '/celebrations/butterfly_chore_garden.html',
  '/celebrations/pop_star_chore_concert.html',
  '/celebrations/baa_baa_chores.html',
  '/celebrations/monster_truck_chore_crusher.html',
  '/celebrations/robot_completion_mission.html',
  '/celebrations/pirate_chore_treasure.html',
  '/celebrations/hot_cocoa_chore_crew.html',
  '/celebrations/donut_chore_crusher.html',
  '/celebrations/firefighter_chore_rescue.html',
  '/celebrations/ninja_chore_chop.html',
  '/celebrations/chore_tower.html',
  '/celebrations/canyon_stunt_jump.html',
  '/celebrations/ice_cream_tragedy.html',
  '/celebrations/balance_beam_oops.html',
  '/celebrations/bicycle_park_rain.html',
  '/celebrations/trick_or_treat_penalty.html',
  '/celebrations/banana_peel_monkey.html',
]

function cacheStoryboard(pathname: string): Promise<string | undefined> {
  const existing = storyboardHtmlCache.get(pathname)
  if (existing) return Promise.resolve(existing)
  return fetch(pathname)
    .then((res) => (res.ok ? res.text() : undefined))
    .then((html) => {
      if (html) {
        storyboardHtmlCache.set(pathname, html)
      }
      return html
    })
    .catch(() => undefined)
}

/**
 * Stagger-prefetches all standalone SVG/GSAP/Canvas storyboards into memory during idle time
 * so tapping a chore plays from RAM via `srcdoc` with zero network round-trip latency.
 */
export function prewarmStoryboards(): void {
  if (prewarmStarted || typeof window === 'undefined') return
  prewarmStarted = true

  const schedule =
    typeof window.requestIdleCallback === 'function'
      ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 4000 })
      : (cb: () => void) => window.setTimeout(cb, 2200)

  schedule(() => {
    ALL_STORYBOARD_PATHS.forEach((path, idx) => {
      window.setTimeout(() => {
        cacheStoryboard(path)
      }, 400 + idx * 140)
    })
  })
}

export default function StoryboardStage({
  url,
  title,
}: {
  url: string
  title: string
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const { pathname, search } = useMemo(() => {
    const qIdx = url.indexOf('?')
    if (qIdx === -1) return { pathname: url, search: '' }
    return { pathname: url.slice(0, qIdx), search: url.slice(qIdx) }
  }, [url])

  const [cachedRaw] = useState<string | undefined>(() => storyboardHtmlCache.get(pathname))

  useEffect(() => {
    if (!storyboardHtmlCache.has(pathname)) {
      cacheStoryboard(pathname)
    }
  }, [pathname])

  // Explicitly tear down Blink sub-document on unmount to reclaim RAM & stop timers on 4 GB tablet
  useEffect(() => {
    const node = iframeRef.current
    return () => {
      if (!node) return
      try {
        node.srcdoc = ''
        node.removeAttribute('srcdoc')
        node.src = 'about:blank'
      } catch {}
    }
  }, [])

  const srcDoc = useMemo(() => {
    if (!cachedRaw) return undefined
    return buildInjectedSrcDoc(cachedRaw, search)
  }, [cachedRaw, search])

  return (
    <iframe
      ref={iframeRef}
      title={title}
      {...(srcDoc ? { srcDoc } : { src: url })}
      className="pointer-events-none h-full w-full border-0"
    />
  )
}
