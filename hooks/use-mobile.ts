'use client'

import { useState, useEffect } from 'react'

export function useMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // İlk kontrol
    checkMobile()

    // Resize event listener
    window.addEventListener('resize', checkMobile)
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile)
  }, [breakpoint])

  return isMobile
}

// Media query hook'u - daha performanslı
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    
    // İlk değeri al
    setMatches(media.matches)

    // Event listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Modern tarayıcılar için
    if (media.addEventListener) {
      media.addEventListener('change', listener)
    } else {
      // Eski tarayıcılar için fallback
      media.addListener(listener)
    }

    // Cleanup
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', listener)
      } else {
        media.removeListener(listener)
      }
    }
  }, [query])

  return matches
}

// Kullanım örneği:
// const isMobile = useMobile()
// const isTablet = useMediaQuery('(max-width: 1024px)') 