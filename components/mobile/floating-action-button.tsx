'use client'

import React, { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Target, X, Users, ChevronUp, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/hooks/use-swipe'

interface FloatingActionButtonProps {
  onNewLead?: () => void
  onMessages?: () => void
  className?: string
}

export function FloatingActionButton({
  onNewLead,
  onMessages,
  className
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  // Navigation sonrasında menüyü kapat
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Click outside to close - improved version
  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      
      // Delay to prevent immediate close on open
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside as any)
      }, 100)
      
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside as any)
      }
    }
  }, [isOpen])

  const toggleMenu = () => {
    setIsOpen(prev => !prev)
    triggerHaptic('light')
  }

  const handleAction = (action: () => void) => {
    triggerHaptic('medium')
    
    // Immediately close menu
    setIsOpen(false)
    
    // Execute action after a small delay to ensure menu closes first
    setTimeout(() => {
      try {
        action()
      } catch (error) {
        console.error('FAB action error:', error)
      }
    }, 150)
  }

  const handleMessagesClick = () => {
    router.push('/messaging')
  }

  const actions = [
    {
      label: 'Yeni Lead',
      icon: Users,
      onClick: onNewLead,
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      label: 'Mesajlar',
      icon: MessageCircle,
      onClick: onMessages || handleMessagesClick,
      color: 'bg-green-500 hover:bg-green-600',
    },
  ].filter(action => action.onClick)

  if (actions.length === 0) return null

  return (
    <div 
      ref={menuRef}
      className={cn("fixed bottom-4 right-6 z-50 md:hidden", className)}
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
                : "translate-y-4 opacity-0"
            )}
            style={{ transitionDelay: isOpen ? `${index * 50}ms` : '0ms' }}
          >
            <span className="text-sm font-medium text-white bg-gray-800 px-3 py-1 rounded-full whitespace-nowrap">
              {action.label}
            </span>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleAction(action.onClick!)
              }}
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
        onClick={(e) => {
          e.stopPropagation()
          toggleMenu()
        }}
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
        "fixed bottom-4 right-6 z-50 md:hidden",
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