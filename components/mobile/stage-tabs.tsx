'use client'

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface Stage {
  id: string
  name: string
  color?: string | null
  order_position: number
}

interface MobileStageNavigationProps {
  stages: Stage[]
  activeStage: string | null
  onStageChange: (stageId: string) => void
  leadCounts: Record<string, number>
  children?: (stage: Stage) => React.ReactNode
  className?: string
}

export function MobileStageNavigation({
  stages,
  activeStage,
  onStageChange,
  leadCounts,
  children,
  className
}: MobileStageNavigationProps) {
  const sortedStages = [...stages].sort((a, b) => a.order_position - b.order_position)
  
  return (
    <div className={cn("md:hidden", className)}>
      <Tabs value={activeStage || undefined} onValueChange={onStageChange}>
        <ScrollArea className="w-full whitespace-nowrap border-b">
          <TabsList className="inline-flex h-auto gap-1 p-1 bg-transparent">
            {sortedStages.map((stage) => (
              <TabsTrigger
                key={stage.id}
                value={stage.id}
                className="flex flex-col items-center p-2 min-w-[80px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: stage.color || '#6B7280' }}
                  />
                  <Badge variant="secondary" className="h-5 px-1 text-xs">
                    {leadCounts[stage.id] || 0}
                  </Badge>
                </div>
                <span className="text-xs font-medium line-clamp-1">{stage.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        {sortedStages.map((stage) => (
          <TabsContent key={stage.id} value={stage.id} className="mt-0 p-0">
            {children ? children(stage) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

// Swipe destekli versiyon
interface MobileStageSwipeNavigationProps extends MobileStageNavigationProps {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export function MobileStageSwipeNavigation({
  stages,
  activeStage,
  onStageChange,
  leadCounts,
  children,
  className,
  onSwipeLeft,
  onSwipeRight
}: MobileStageSwipeNavigationProps) {
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const [touchEnd, setTouchEnd] = React.useState<number | null>(null)
  
  const minSwipeDistance = 50
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft()
    } else if (isRightSwipe && onSwipeRight) {
      onSwipeRight()
    }
  }
  
  return (
    <div
      className={cn("md:hidden", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <MobileStageNavigation
        stages={stages}
        activeStage={activeStage}
        onStageChange={onStageChange}
        leadCounts={leadCounts}
        className="!block"
      >
        {children}
      </MobileStageNavigation>
    </div>
  )
} 