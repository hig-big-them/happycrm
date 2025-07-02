'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  Phone, 
  Mail, 
  MessageCircle, 
  ArrowUpDown, 
  Calendar,
  DollarSign,
  Building,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { triggerHaptic } from '@/hooks/use-swipe'

interface Lead {
  id: string
  lead_name: string
  contact_email?: string | null
  contact_phone?: string | null
  lead_value?: number | null
  priority?: string | null
  event_date?: string | null
  event_time?: string | null
  company?: {
    id: string
    company_name: string
  } | null
  stage_id?: string | null
}

interface CompactLeadCardProps {
  lead: Lead
  onTap?: () => void
  onQuickEdit?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onCall?: () => void
  onEmail?: () => void
  onMessage?: () => void
  showActions?: boolean
  className?: string
}

const getPriorityColor = (priority: string | null) => {
  switch (priority?.toLowerCase()) {
    case 'yüksek':
    case 'high':
      return 'destructive'
    case 'orta':
    case 'medium':
      return 'default'
    case 'düşük':
    case 'low':
      return 'secondary'
    default:
      return 'outline'
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function CompactLeadCard({
  lead,
  onTap,
  onQuickEdit,
  onEdit,
  onDelete,
  onCall,
  onEmail,
  onMessage,
  showActions = true,
  className
}: CompactLeadCardProps) {
  const handleAction = (e: React.MouseEvent, action?: () => void) => {
    e.stopPropagation()
    if (action) {
      triggerHaptic('light')
      action()
    }
  }

  return (
    <Card 
      className={cn(
        "mb-2 shadow-sm transition-all active:scale-[0.98]",
        onTap && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onTap}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          {/* Lead Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-1 mb-1">
              {lead.lead_name}
            </h4>
            
            {lead.company && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <Building className="h-3 w-3" />
                <span className="line-clamp-1">{lead.company.company_name}</span>
              </div>
            )}
            
            {/* Tags & Info */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {lead.lead_value && (
                <Badge variant="secondary" className="text-xs h-5 px-2">
                  <DollarSign className="h-3 w-3 mr-0.5" />
                  {formatCurrency(lead.lead_value)}
                </Badge>
              )}
              
              {lead.priority && (
                <Badge 
                  variant={getPriorityColor(lead.priority)}
                  className="text-xs h-5 px-2"
                >
                  {lead.priority}
                </Badge>
              )}
              
              {lead.event_date && (
                <Badge variant="outline" className="text-xs h-5 px-2">
                  <Calendar className="h-3 w-3 mr-1" />
                  {lead.event_date}
                  {lead.event_time && ` • ${lead.event_time}`}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex items-center gap-1">
              {/* Quick Actions */}
              <div className="flex flex-col gap-1">
                {onQuickEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleAction(e, onQuickEdit)}
                    className="h-7 w-7 p-0"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </Button>
                )}
                
                {lead.contact_phone && onCall && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => handleAction(e, onCall)}
                    className="h-7 w-7 p-0"
                    asChild
                  >
                    <a href={`tel:${lead.contact_phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>

              {/* More Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {onEdit && (
                    <DropdownMenuItem onClick={() => handleAction({} as any, onEdit)}>
                      <Edit className="h-3.5 w-3.5 mr-2" />
                      Düzenle
                    </DropdownMenuItem>
                  )}
                  
                  {lead.contact_email && onEmail && (
                    <DropdownMenuItem onClick={() => handleAction({} as any, onEmail)}>
                      <Mail className="h-3.5 w-3.5 mr-2" />
                      E-posta Gönder
                    </DropdownMenuItem>
                  )}
                  
                  {onMessage && (
                    <DropdownMenuItem onClick={() => handleAction({} as any, onMessage)}>
                      <MessageCircle className="h-3.5 w-3.5 mr-2" />
                      Mesaj Gönder
                    </DropdownMenuItem>
                  )}
                  
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleAction({} as any, onDelete)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Sil
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Simple variant without actions
export function SimpleLeadCard({ lead, onTap, className }: {
  lead: Lead
  onTap?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        "p-3 bg-white rounded-lg border shadow-sm",
        "transition-all active:scale-[0.98]",
        onTap && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onTap}
    >
      <div className="space-y-1">
        <h4 className="font-medium text-sm line-clamp-1">{lead.lead_name}</h4>
        
        {lead.company && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {lead.company.company_name}
          </p>
        )}
        
        <div className="flex items-center gap-2 mt-1.5">
          {lead.lead_value && (
            <span className="text-xs font-medium text-green-600">
              {formatCurrency(lead.lead_value)}
            </span>
          )}
          
          {lead.priority && (
            <Badge 
              variant={getPriorityColor(lead.priority)}
              className="text-xs h-4 px-1.5"
            >
              {lead.priority}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
} 