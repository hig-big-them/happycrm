'use client'

import { useState, useEffect } from 'react'

interface PWAInfo {
  isStandalone: boolean
  isPWAReady: boolean
  canInstall: boolean
  showInstallPrompt: boolean
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePWA(): PWAInfo & {
  installPWA: () => Promise<void>
  dismissInstallPrompt: () => void
} {
  const [pwaInfo, setPWAInfo] = useState<PWAInfo>({
    isStandalone: false,
    isPWAReady: false,
    canInstall: false,
    showInstallPrompt: false
  })
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Ensure this runs only on the client where window and navigator are defined
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return
    }

    try {
      // Safari-safe standalone check
      let isStandalone = false
      try {
        isStandalone =
          (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
          (navigator as any).standalone === true
      } catch (e) {
        console.warn('Standalone check failed:', e)
        // Attempt a more direct, though less standard, fallback
        try {
          isStandalone = (navigator as any).standalone === true
        } catch (e2) {
          console.warn('Standalone fallback check failed:', e2)
        }
      }

      // Safari-safe service worker check
      const isPWAReady = 'serviceWorker' in navigator

      const isIOSSafari =
        /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

      setPWAInfo(prev => ({
        ...prev,
        isStandalone,
        isPWAReady,
        showInstallPrompt: !isStandalone && (isPWAReady || isIOSSafari)
      }))

      // Only add Chrome install listeners for non-iOS
      if (!isIOSSafari) {
        // Listen for beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
          e.preventDefault()
          const event = e as BeforeInstallPromptEvent
          setDeferredPrompt(event)
          setPWAInfo(prev => ({
            ...prev,
            canInstall: true,
            showInstallPrompt: !prev.isStandalone
          }))
        }

        // Listen for app installed event
        const handleAppInstalled = () => {
          setPWAInfo(prev => ({
            ...prev,
            canInstall: false,
            showInstallPrompt: false,
            isStandalone: true
          }))
          setDeferredPrompt(null)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.addEventListener('appinstalled', handleAppInstalled)

        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
          window.removeEventListener('appinstalled', handleAppInstalled)
        }
      }
    } catch (error) {
      console.warn('PWA initialization failed:', error)
      // Fallback for extreme cases
      setPWAInfo({
        isStandalone: false,
        isPWAReady: false,
        canInstall: false,
        showInstallPrompt: false,
      })
    }
  }, [])

  const installPWA = async (): Promise<void> => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      
      if (choiceResult.outcome === 'accepted') {
        console.log('PWA installation accepted')
      } else {
        console.log('PWA installation dismissed')
      }
      
      setDeferredPrompt(null)
      setPWAInfo(prev => ({
        ...prev,
        canInstall: false,
        showInstallPrompt: false
      }))
    } catch (error) {
      console.error('PWA installation failed:', error)
    }
  }

  const dismissInstallPrompt = (): void => {
    setPWAInfo(prev => ({
      ...prev,
      showInstallPrompt: false
    }))
  }

  return {
    ...pwaInfo,
    installPWA,
    dismissInstallPrompt
  }
}

// iOS-specific PWA utilities
export function getIOSInstallInstructions(): string[] {
  return [
    '1. Safari\'de siteyi açın',
    '2. Alt kısımda "Paylaş" butonuna dokunun',
    '3. "Ana Ekrana Ekle" seçeneğini bulun',
    '4. "Ekle" butonuna dokunun',
    '5. Ana ekranda app ikonu belirecek!'
  ]
}

export function isIOSDevice(): boolean {
  // Ensure this runs only on the client
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  try {
    // Check userAgent and ensure MSStream is not present (for IE11)
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
  } catch (error) {
    console.warn('iOS device detection failed:', error)
    return false
  }
}

// Android Chrome install instructions
export function getAndroidInstallInstructions(): string[] {
  return [
    '1. Chrome\'da siteyi açın',
    '2. Menü (⋮) butonuna dokunun',
    '3. "Ana ekrana ekle" seçeneğini bulun',
    '4. "Ekle" butonuna dokunun',
    '5. Ana ekranda app ikonu belirecek!'
  ]
} 