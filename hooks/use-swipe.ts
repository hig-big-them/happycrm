'use client'

import { useState } from 'react'

interface SwipeInput {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  minSwipeDistance?: number
  trackMouse?: boolean
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
  onMouseDown?: (e: React.MouseEvent) => void
  onMouseMove?: (e: React.MouseEvent) => void
  onMouseUp?: () => void
  onMouseLeave?: () => void
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  minSwipeDistance = 50,
  trackMouse = false
}: SwipeInput): SwipeHandlers {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)
  const [mouseDown, setMouseDown] = useState(false)

  const handleSwipe = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const distanceX = start.x - end.x
    const distanceY = start.y - end.y
    const absX = Math.abs(distanceX)
    const absY = Math.abs(distanceY)

    // Horizontal swipe
    if (absX > absY && absX > minSwipeDistance) {
      if (distanceX > 0 && onSwipeLeft) {
        onSwipeLeft()
      } else if (distanceX < 0 && onSwipeRight) {
        onSwipeRight()
      }
    }
    
    // Vertical swipe
    else if (absY > absX && absY > minSwipeDistance) {
      if (distanceY > 0 && onSwipeUp) {
        onSwipeUp()
      } else if (distanceY < 0 && onSwipeDown) {
        onSwipeDown()
      }
    }
  }

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    handleSwipe(touchStart, touchEnd)
  }

  // Mouse handlers (optional)
  const mouseHandlers = trackMouse ? {
    onMouseDown: (e: React.MouseEvent) => {
      setMouseDown(true)
      setTouchEnd(null)
      setTouchStart({
        x: e.clientX,
        y: e.clientY
      })
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!mouseDown) return
      setTouchEnd({
        x: e.clientX,
        y: e.clientY
      })
    },
    onMouseUp: () => {
      if (!touchStart || !touchEnd) return
      handleSwipe(touchStart, touchEnd)
      setMouseDown(false)
    },
    onMouseLeave: () => {
      setMouseDown(false)
    }
  } : {}

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    ...mouseHandlers
  }
}

// Haptic feedback helper
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    }
    navigator.vibrate(patterns[type])
  }
} 