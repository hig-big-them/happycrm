'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/hooks/use-swipe'

interface Stage {
  id: string
  name: string
  color?: string | null
  order_position: number
}

interface Lead {
  id: string
  lead_name: string
  stage_id?: string | null
}

interface LeadQuickEditModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  stages: Stage[]
  onStageChange: (leadId: string, stageId: string) => void
  currentPipelineName?: string
}

export function LeadQuickEditModal({
  lead,
  isOpen,
  onClose,
  stages,
  onStageChange,
  currentPipelineName
}: LeadQuickEditModalProps) {
  if (!lead) return null

  const sortedStages = [...stages].sort((a, b) => a.order_position - b.order_position)
  const currentStageIndex = sortedStages.findIndex(s => s.id === lead.stage_id)

  const handleStageSelect = (stageId: string) => {
    if (stageId !== lead.stage_id) {
      triggerHaptic('medium')
      onStageChange(lead.id, stageId)
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            Stage Değiştir
          </DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="font-medium text-foreground">{lead.lead_name}</span>
            {currentPipelineName && (
              <span className="text-sm text-muted-foreground block">
                Pipeline: {currentPipelineName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {sortedStages.map((stage, index) => {
            const isActive = lead.stage_id === stage.id
            const isPrevious = currentStageIndex > -1 && index < currentStageIndex
            const isNext = currentStageIndex > -1 && index > currentStageIndex

            return (
              <Button
                key={stage.id}
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "w-full justify-between h-auto py-3 px-4",
                  isActive && "ring-2 ring-primary ring-offset-2",
                  isPrevious && "opacity-60"
                )}
                onClick={() => handleStageSelect(stage.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full transition-all",
                        isActive && "ring-2 ring-white ring-offset-2"
                      )}
                      style={{ backgroundColor: stage.color || '#6B7280' }}
                    />
                    <span className="text-sm font-medium">
                      {index + 1}
                    </span>
                  </div>
                  <span className="text-left flex-1">{stage.name}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isPrevious && (
                    <Badge variant="secondary" className="text-xs">
                      Önceki
                    </Badge>
                  )}
                  {isNext && (
                    <Badge variant="outline" className="text-xs">
                      Sonraki
                    </Badge>
                  )}
                  {isActive && (
                    <Check className="h-4 w-4" />
                  )}
                  {!isActive && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </Button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Simplified version for bottom sheet
export function LeadStageSelector({
  lead,
  stages,
  onStageChange,
  onClose
}: {
  lead: Lead
  stages: Stage[]
  onStageChange: (leadId: string, stageId: string) => void
  onClose?: () => void
}) {
  const sortedStages = [...stages].sort((a, b) => a.order_position - b.order_position)

  const handleSelect = (stageId: string) => {
    if (stageId !== lead.stage_id) {
      triggerHaptic('medium')
      onStageChange(lead.id, stageId)
    }
    onClose?.()
  }

  return (
    <div className="space-y-2">
      {sortedStages.map((stage) => (
        <button
          key={stage.id}
          onClick={() => handleSelect(stage.id)}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-lg transition-all",
            "hover:bg-accent active:scale-[0.98]",
            lead.stage_id === stage.id
              ? "bg-primary text-primary-foreground"
              : "bg-background border"
          )}
        >
          <div
            className={cn(
              "w-3 h-3 rounded-full",
              lead.stage_id === stage.id && "ring-2 ring-white/50"
            )}
            style={{ backgroundColor: stage.color || '#6B7280' }}
          />
          <span className="flex-1 text-left font-medium">{stage.name}</span>
          {lead.stage_id === stage.id && (
            <Check className="h-4 w-4" />
          )}
        </button>
      ))}
    </div>
  )
} 