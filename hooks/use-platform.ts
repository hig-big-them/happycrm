import { useState, useEffect } from 'react'

interface PlatformInfo {
  isIOS: boolean
  isAndroid: boolean
  isMobile: boolean
  isCapacitor: boolean
  isNative: boolean
  platform: 'ios' | 'android' | 'web'
}

export function usePlatform(): PlatformInfo {
  const [platform, setPlatform] = useState<PlatformInfo>({
    isIOS: false,
    isAndroid: false,
    isMobile: false,
    isCapacitor: false,
    isNative: false,
    platform: 'web'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const userAgent = (window.navigator && window.navigator.userAgent) || ''
      
      let isCapacitor = false
      try {
        isCapacitor = !!(window as any).Capacitor
      } catch (e) {
        // Capacitor not available, which is fine
      }
      
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream
      const isAndroid = /Android/.test(userAgent)
      const isMobile = isIOS || isAndroid || /Mobile/i.test(userAgent) ||
                      (window.screen && window.screen.width <= 768)

      setPlatform({
        isIOS,
        isAndroid,
        isMobile,
        isCapacitor,
        isNative: isCapacitor,
        platform: isIOS ? 'ios' : isAndroid ? 'android' : 'web'
      })
    } catch (error) {
      console.warn('Platform detection failed:', error)
      // Fallback to safe defaults
      setPlatform({
        isIOS: false,
        isAndroid: false,
        isMobile: false,
        isCapacitor: false,
        isNative: false,
        platform: 'web'
      })
    }
  }, [])

  return platform
}

// iOS specific utilities
export function getIOSVersion(): number | null {
  if (typeof window === 'undefined') return null
  
  try {
    const userAgent = (window.navigator && window.navigator.userAgent) || ''
    const match = userAgent.match(/OS (\d+)_(\d+)_?(\d+)?/)
    if (match) {
      return parseInt(match[1], 10)
    }
    return null
  } catch (error) {
    console.warn('iOS version detection failed:', error)
    return null
  }
}

export function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (window.navigator as any).standalone === true
  } catch (error) {
    console.warn('iOS standalone detection failed:', error)
    return false
  }
}

// Safe area utilities for iOS
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 }
  
  try {
    const computedStyle = getComputedStyle(document.documentElement)
    return {
      top: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
      bottom: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
      left: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
      right: parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
    }
  } catch (error) {
    console.warn('Safe area insets detection failed:', error)
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }
} 