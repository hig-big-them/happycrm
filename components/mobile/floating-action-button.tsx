'use client'

import React, { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Target, X, Users, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/hooks/use-swipe'

interface FloatingActionButtonProps {
  onNewLead?: () => void
  onNewStage?: () => void
  onNewPipeline?: () => void
  className?: string
}

export function FloatingActionButton({
  onNewLead,
  onNewStage,
  onNewPipeline,
  className
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // Navigation sonrasında menüyü kapat - multiple checks
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Route değişikliklerini dinle ve kapat
  useEffect(() => {
    const handleRouteChange = () => {
      setIsOpen(false)
    }
    
    // Manual route change listening
    window.addEventListener('popstate', handleRouteChange)
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [])

  // Click outside to close
  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element
        if (!target.closest('[data-fab-menu]')) {
          setIsOpen(false)
        }
      }
      
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [isOpen])

  const toggleMenu = () => {
    setIsOpen(!isOpen)
    triggerHaptic('light')
  }

  const handleAction = (action: () => void) => {
    triggerHaptic('medium')
    setIsOpen(false) // Hemen kapat
    // Action'ı çalıştır
    try {
      action()
    } catch (error) {
      console.error('FAB action error:', error)
    }
  }

  const actions = [
    {
      label: 'Yeni Lead',
      icon: Users,
      onClick: onNewLead,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      label: 'Yeni Stage',
      icon: Target,
      onClick: onNewStage,
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      label: 'Yeni Pipeline',
      icon: ChevronUp,
      onClick: onNewPipeline,
      color: 'bg-purple-500 hover:bg-purple-600',
    },
  ].filter(action => action.onClick)

  if (actions.length === 0) return null

  return (
    <div 
      className={cn("fixed bottom-4 right-4 z-50 md:hidden", className)}
      data-fab-menu
    >
      {/* Action buttons */}
      <div
        className={cn(
          "flex flex-col-reverse gap-2 mb-2 transition-all duration-300",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {actions.map((action, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 transition-all",
              isOpen
                ? "translate-y-0 opacity-100"
                : `translate-y-${(index + 1) * 4} opacity-0`
            )}
            style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
          >
            <span className="text-sm font-medium text-white bg-gray-800 px-3 py-1 rounded-full whitespace-nowrap">
              {action.label}
            </span>
            <Button
              onClick={() => handleAction(action.onClick!)}
              size="icon"
              className={cn(
                "rounded-full w-12 h-12 shadow-lg",
                action.color,
                "text-white border-0"
              )}
            >
              <action.icon className="h-5 w-5" />
            </Button>
          </div>
        ))}
      </div>

      {/* Main FAB button */}
      <Button
        onClick={toggleMenu}
        className={cn(
          "rounded-full w-14 h-14 shadow-lg",
          isOpen ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90",
          "transition-all duration-300"
        )}
        size="icon"
      >
        <Plus
          className={cn(
            "h-6 w-6 transition-transform duration-300",
            isOpen ? "rotate-45" : ""
          )}
        />
      </Button>
    </div>
  )
}

// Mini FAB variant
interface MiniFABProps {
  onClick: () => void
  icon: React.ElementType
  label?: string
  className?: string
}

export function MiniFAB({ onClick, icon: Icon, label, className }: MiniFABProps) {
  return (
    <Button
      onClick={() => {
        onClick()
        triggerHaptic('light')
      }}
      className={cn(
        "fixed bottom-4 right-4 z-50 md:hidden",
        "rounded-full shadow-lg",
        "flex items-center gap-2",
        label ? "pl-4 pr-5 h-12" : "w-14 h-14",
        className
      )}
      size={label ? "default" : "icon"}
    >
      <Icon className={label ? "h-4 w-4" : "h-6 w-6"} />
      {label && <span className="font-medium">{label}</span>}
    </Button>
  )
} 