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

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches
      const isStandaloneNavigator = (navigator as unknown as { standalone?: boolean }).standalone === true
      return isStandaloneMedia || isStandaloneNavigator
    }

    const standalone = checkStandalone()
    setIsStandalone(standalone)
    setIsInstalled(standalone)

    const ua = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(ua)
    setIsIos(ios)

    const listener = (prompt: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(prompt)
      if (!prompt && checkStandalone()) {
        setIsInstalled(true)
      }
    }

    promptListeners.add(listener)
    return () => {
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
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isStandalone,
    isIos,
    promptInstall,
  }
}
