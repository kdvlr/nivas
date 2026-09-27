import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    globalDeferredPrompt = e
    promptListeners.forEach((l) => l(globalDeferredPrompt))
  })

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null
    promptListeners.forEach((l) => l(null))
  })
}

function checkIsFullyKiosk(): boolean {
  if (typeof window === 'undefined') return false
  if (Boolean((window as any).fully || (window as any).fullyKiosk)) return true
  const ua = (window.navigator?.userAgent || '').toLowerCase()
  if (ua.includes('fully') || ua.includes('kiosk')) return true
  // Android WebView in a dedicated kiosk shell (e.g. Apolosign)
  if (/android.*version\/[0-9.]+/i.test(ua) && ua.includes('; wv')) return true
  if (window.location?.search?.includes('kiosk') || window.location?.search?.includes('standalone')) return true
  return false
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isFullyKiosk, setIsFullyKiosk] = useState(false)
  const [isSecure, setIsSecure] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const secure = window.isSecureContext ?? (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      setIsSecure(Boolean(secure))
    }
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches
      const isStandaloneNavigator = (navigator as unknown as { standalone?: boolean }).standalone === true
      return isStandaloneMedia || isStandaloneNavigator
    }

    const evaluateState = () => {
      const fully = checkIsFullyKiosk()
      const standalone = checkStandalone() || fully
      setIsFullyKiosk(fully)
      setIsStandalone(standalone)
      setIsInstalled(standalone)
    }

    evaluateState()

    const ua = (window.navigator?.userAgent || '').toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua)
    setIsIos(ios)

    // Android WebViews can bind window.fully asynchronously
    const t1 = setTimeout(evaluateState, 400)
    const t2 = setTimeout(evaluateState, 1500)
    const t3 = setTimeout(evaluateState, 3000)

    const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(display-mode: standalone)') : null
    const handleMediaChange = () => evaluateState()
    mediaQuery?.addEventListener?.('change', handleMediaChange)

    const listener = (prompt: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(prompt)
      if (!prompt) {
        evaluateState()
      }
    }

    promptListeners.add(listener)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      mediaQuery?.removeEventListener?.('change', handleMediaChange)
      promptListeners.delete(listener)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!globalDeferredPrompt) return false
    try {
      await globalDeferredPrompt.prompt()
      const choice = await globalDeferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsInstalled(true)
        globalDeferredPrompt = null
        promptListeners.forEach((l) => l(null))
        return true
      }
      return false
    } catch (err) {
      console.error('PWA install prompt error:', err)
      return false
    }
  }, [])

  return {
    isInstallable: isFullyKiosk ? false : Boolean(deferredPrompt),
    isInstalled,
    isStandalone,
    isFullyKiosk,
    isIos,
    isSecure,
    promptInstall,
  }
}

