'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  showCloseButton?: boolean
  preferSheet?: boolean // Use Sheet component instead of Dialog on mobile
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  preferSheet = false
}: BottomSheetProps) {
  // Mobile detection for preferSheet option
  const [isMobile, setIsMobile] = React.useState(false)
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Use Sheet component on mobile if preferred
  if (preferSheet && isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className={cn("h-[90vh] p-0", className)}>
          {(title || showCloseButton) && (
            <SheetHeader className="px-4 py-3 border-b">
              {title && <SheetTitle>{title}</SheetTitle>}
            </SheetHeader>
          )}
          <div className="overflow-y-auto h-full px-4 py-4">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Default Dialog with bottom sheet styling on mobile
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          // Mobile bottom sheet styling
          "fixed inset-x-0 bottom-0 top-auto max-w-none mx-0",
          "rounded-t-2xl rounded-b-none",
          "translate-y-0 duration-300",
          "max-h-[90vh] flex flex-col",
          // Desktop modal styling
          "md:relative md:top-auto md:bottom-auto",
          "md:max-w-md md:mx-auto md:rounded-lg",
          "md:max-h-[85vh]",
          className
        )}
      >
        {/* Drag handle for mobile */}
        <div className="md:hidden">
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-4" />
        </div>

        {(title || showCloseButton) && (
          <DialogHeader className="pb-4 border-b flex-shrink-0">
            {title && <DialogTitle className="text-left">{title}</DialogTitle>}
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            {showCloseButton && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 md:hidden"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogHeader>
        )}

        <div className="overflow-y-auto flex-1 py-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Simplified mobile action sheet
interface ActionSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  actions: Array<{
    label: string
    onClick: () => void
    icon?: React.ElementType
    variant?: 'default' | 'destructive' | 'secondary'
    disabled?: boolean
  }>
}

export function ActionSheet({
  isOpen,
  onClose,
  title,
  actions
}: ActionSheetProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      showCloseButton={false}
    >
      <div className="space-y-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'outline'}
            className="w-full justify-start h-12"
            onClick={() => {
              action.onClick()
              onClose()
            }}
            disabled={action.disabled}
          >
            {action.icon && <action.icon className="h-4 w-4 mr-3" />}
            {action.label}
          </Button>
        ))}
        
        <Button
          variant="outline"
          className="w-full h-12 mt-4"
          onClick={onClose}
        >
          İptal
        </Button>
      </div>
    </BottomSheet>
  )
} 