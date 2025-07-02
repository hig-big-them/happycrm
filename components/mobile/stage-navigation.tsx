'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StageNavigationControlsProps {
  currentStageIndex: number
  totalStages: number
  onPrevious: () => void
  onNext: () => void
  stageName?: string
  className?: string
}

export function StageNavigationControls({
  currentStageIndex,
  totalStages,
  onPrevious,
  onNext,
  stageName,
  className
}: StageNavigationControlsProps) {
  return (
    <div className={cn("flex justify-between items-center mb-4 md:hidden", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={currentStageIndex === 0}
        className="flex items-center gap-1 h-9 px-3"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Önceki</span>
      </Button>
      
      <div className="text-center px-3">
        {stageName && (
          <h3 className="font-medium text-sm mb-0.5">{stageName}</h3>
        )}
        <p className="text-xs text-muted-foreground">
          {currentStageIndex + 1} / {totalStages}
        </p>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={currentStageIndex === totalStages - 1}
        className="flex items-center gap-1 h-9 px-3"
      >
        <span className="hidden sm:inline">Sonraki</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

// Dots indicator variant
interface DotsIndicatorProps {
  currentIndex: number
  totalCount: number
  onDotClick?: (index: number) => void
  className?: string
}

export function DotsIndicator({
  currentIndex,
  totalCount,
  onDotClick,
  className
}: DotsIndicatorProps) {
  return (
    <div className={cn("flex justify-center gap-1.5 py-2", className)}>
      {Array.from({ length: totalCount }).map((_, index) => (
        <button
          key={index}
          onClick={() => onDotClick?.(index)}
          className={cn(
            "w-2 h-2 rounded-full transition-all",
            index === currentIndex
              ? "bg-primary w-6"
              : "bg-gray-300 hover:bg-gray-400"
          )}
          aria-label={`Stage ${index + 1}`}
        />
      ))}
    </div>
  )
}

// Swipeable container wrapper
interface SwipeableStageContainerProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  className?: string
}

export function SwipeableStageContainer({
  children,
  onSwipeLeft,
  onSwipeRight,
  className
}: SwipeableStageContainerProps) {
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  
  const minSwipeDistance = 50
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
    setIsDragging(true)
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false)
      return
    }
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft()
    } else if (isRightSwipe && onSwipeRight) {
      onSwipeRight()
    }
    
    setIsDragging(false)
  }
  
  // Calculate swipe progress for visual feedback
  const swipeOffset = touchStart && touchEnd && isDragging
    ? touchEnd - touchStart
    : 0
  
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: isDragging
            ? `translateX(${Math.max(-50, Math.min(50, swipeOffset * 0.3))}px)`
            : 'translateX(0)'
        }}
      >
        {children}
      </div>
    </div>
  )
} 