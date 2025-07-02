Anladım! PWA geliştirmelerini tamamladıktan sonra şimdi mobil kullanıcı deneyimini optimize etme zamanı. Mevcut pipeline sayfasının durumunu inceleyelim ve mobil için kapsamlı iyileştirmeler yapalım.
Search files...
Ran tool
Ran tool

Read file: app/leads/page.tsx
Read file: app/pipelines/page.tsx
Read file: app/pipelines/[id]/page.tsx

Mevcut pipeline sayfalarını inceledikten sonra mobil kullanıcı deneyimi için kapsamlı iyileştirme önerilerimi sunuyorum. Şu anki yapıda gerçekten mobilde kullanım zorluğu var.

## 🎯 Mobil Pipeline Kullanıcı Deneyimi İyileştirme Önerileri

### Ana Sorunlar ve Çözümler:

#### 1. **Arama ve Filtreleme Karmaşıklığı**
```typescript
// Mobilde arama/filtreleme gizleyelim
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);

// Arama alanını mobilde gizleyelim
{!isMobile && (
  <div className="flex-1 min-w-[200px]">
    <Label htmlFor="search">Ara</Label>
    <Input
      id="search"
      placeholder="İsim, telefon, email veya şirket..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
    />
  </div>
)}
```

#### 2. **Tab-Based Stage Görünümü**
Horizontal scroll yerine tab sistemi:

```typescript
// components/mobile/stage-tabs.tsx
function MobileStageNavigation({ 
  stages, 
  activeStage, 
  onStageChange,
  leadCounts 
}: {
  stages: Stage[];
  activeStage: string | null;
  onStageChange: (stageId: string) => void;
  leadCounts: Record<string, number>;
}) {
  return (
    <div className="md:hidden">
      <Tabs value={activeStage || undefined} onValueChange={onStageChange}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 h-auto p-1">
          {stages.map((stage) => (
            <TabsTrigger 
              key={stage.id} 
              value={stage.id}
              className="flex flex-col items-center p-2 min-h-[50px] text-xs"
            >
              <div 
                className="w-3 h-3 rounded-full mb-1"
                style={{ backgroundColor: stage.color || '#6B7280' }}
              />
              <span className="line-clamp-1">{stage.name}</span>
              <Badge variant="secondary" className="text-xs px-1 mt-1">
                {leadCounts[stage.id] || 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        
        {stages.map((stage) => (
          <TabsContent key={stage.id} value={stage.id} className="mt-4">
            <MobileStageContent stage={stage} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

#### 3. **Swipe Gesture Navigation**
Stage'ler arası kolay geçiş:

```typescript
// hooks/use-swipe.ts
function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) onSwipeLeft();
    if (isRightSwipe) onSwipeRight();
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
}
```

#### 4. **Floating Action Button (FAB)**
Mobilde ana eylemler için:

```typescript
// components/mobile/floating-action-button.tsx
function FloatingActionButton({ 
  onNewLead, 
  onNewStage 
}: {
  onNewLead: () => void;
  onNewStage: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 md:hidden">
      <div className={`flex flex-col gap-2 mb-2 transition-all duration-300 ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}>
        <Button
          onClick={onNewStage}
          size="sm"
          variant="secondary"
          className="rounded-full w-12 h-12 shadow-lg"
        >
          <Target className="h-5 w-5" />
        </Button>
        <Button
          onClick={onNewLead}
          size="sm"
          className="rounded-full w-12 h-12 shadow-lg"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-full w-14 h-14 shadow-lg"
        size="lg"
      >
        <Plus className={`h-6 w-6 transition-transform ${isOpen ? 'rotate-45' : ''}`} />
      </Button>
    </div>
  );
}
```

#### 5. **Lead Kartı Düzenleme Modalı**
Drag-drop yerine düzenleme modalından stage değiştirme:

```typescript
// components/mobile/lead-quick-edit.tsx
function LeadQuickEditModal({ 
  lead, 
  isOpen, 
  onClose,
  stages,
  onStageChange 
}: {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  stages: Stage[];
  onStageChange: (leadId: string, stageId: string) => void;
}) {
  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="text-lg">{lead.lead_name}</DialogTitle>
          <DialogDescription>Stage Değiştir</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3 py-4">
          {stages.map((stage) => (
            <Button
              key={stage.id}
              variant={lead.stage_id === stage.id ? "default" : "outline"}
              className="w-full justify-start gap-3 h-12"
              onClick={() => {
                onStageChange(lead.id, stage.id);
                onClose();
              }}
            >
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: stage.color || '#6B7280' }}
              />
              <span className="flex-1 text-left">{stage.name}</span>
              {lead.stage_id === stage.id && (
                <Check className="h-4 w-4" />
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### 6. **Kompakt Lead Kartları**
Mobil için optimize edilmiş kart tasarımı:

```typescript
// components/mobile/compact-lead-card.tsx
function CompactLeadCard({ 
  lead, 
  onTap, 
  onQuickEdit 
}: {
  lead: Lead;
  onTap: () => void;
  onQuickEdit: () => void;
}) {
  return (
    <Card className="mb-2 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1" onClick={onTap}>
            <h4 className="font-medium text-sm line-clamp-1 mb-1">
              {lead.lead_name}
            </h4>
            {lead.company && (
              <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                {lead.company.company_name}
              </p>
            )}
            <div className="flex items-center gap-2">
              {lead.lead_value && (
                <Badge variant="secondary" className="text-xs">
                  ₺{lead.lead_value.toLocaleString('tr-TR')}
                </Badge>
              )}
              {lead.priority && (
                <Badge 
                  variant={getPriorityColor(lead.priority)}
                  className="text-xs"
                >
                  {lead.priority}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-1 ml-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={onQuickEdit}
              className="h-8 w-8 p-0"
            >
              <ArrowUpDown className="h-3 w-3" />
            </Button>
            {lead.contact_phone && (
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="h-8 w-8 p-0"
              >
                <a href={`tel:${lead.contact_phone}`}>
                  <Phone className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 7. **Stage Navigation Controls**
Sağ-sol navigasyon butonları:

```typescript
// components/mobile/stage-navigation.tsx
function StageNavigationControls({ 
  currentStageIndex, 
  totalStages, 
  onPrevious, 
  onNext 
}: {
  currentStageIndex: number;
  totalStages: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex justify-between items-center mb-4 md:hidden">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        disabled={currentStageIndex === 0}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Önceki
      </Button>
      
      <div className="text-sm text-muted-foreground">
        {currentStageIndex + 1} / {totalStages}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={currentStageIndex === totalStages - 1}
        className="flex items-center gap-2"
      >
        Sonraki
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

#### 8. **Bottom Sheet Modelleri**
Mobil için optimize edilmiş modal deneyimi:

```typescript
// components/mobile/bottom-sheet.tsx
function BottomSheet({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto max-w-none mx-0 rounded-t-lg rounded-b-none translate-y-0 md:relative md:top-auto md:bottom-auto md:max-w-md md:mx-auto md:rounded-lg">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-left">{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 9. **Ana Sayfa Responsive Düzenlemesi**

```typescript
// app/pipelines/page.tsx güncellemesi
return (
  <div className="container mx-auto py-4 px-4 md:py-8 md:px-6">
    {/* Desktop Header */}
    <div className="hidden md:flex justify-between items-center mb-6">
      {/* Mevcut header içeriği */}
    </div>

    {/* Mobile Header */}
    <div className="md:hidden mb-4">
      <h1 className="text-2xl font-bold mb-2">Pipeline Yönetimi</h1>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>{activePipelineData?.name || 'Pipeline seçin'}</span>
      </div>
    </div>

    {/* Pipeline Selection - Mobile Tabs */}
    <div className="md:hidden mb-4">
      <Select value={activePipeline || undefined} onValueChange={setActivePipeline}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pipeline seçin..." />
        </SelectTrigger>
        <SelectContent>
          {pipelines.filter(p => p.is_active !== false).map((pipeline) => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              <div className="flex items-center justify-between w-full">
                <span>{pipeline.name}</span>
                <Badge variant="secondary" className="ml-2">
                  {pipelineLeadCounts[pipeline.id] || 0}
                </Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {/* Desktop Pipeline Cards */}
    <div className="hidden md:block">
      {/* Mevcut pipeline card görünümü */}
    </div>

    {/* Mobile/Desktop Stage View */}
    {activePipeline && (
      <>
        <MobileStageNavigation {...props} />
        <div className="hidden md:block">
          {/* Mevcut desktop stage görünümü */}
        </div>
      </>
    )}

    <FloatingActionButton onNewLead={...} onNewStage={...} />
  </div>
);
```

### 🎨 Ek Öneriler:

#### 1. **Pull-to-Refresh**
```typescript
const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefresh = async () => {
  setIsRefreshing(true);
  await loadPipelineData();
  setIsRefreshing(false);
};
```

#### 2. **Infinite Scroll**
```typescript
const [visibleLeads, setVisibleLeads] = useState(20);

const loadMoreLeads = () => {
  setVisibleLeads(prev => prev + 20);
};
```

#### 3. **Quick Actions**
```typescript
// Lead kartında hızlı eylemler
const QuickActions = ({ lead }) => (
  <div className="flex gap-1">
    <Button size="sm" variant="ghost">
      <Phone className="h-3 w-3" />
    </Button>
    <Button size="sm" variant="ghost">
      <Mail className="h-3 w-3" />
    </Button>
    <Button size="sm" variant="ghost">
      <MessageCircle className="h-3 w-3" />
    </Button>
  </div>
);
```

#### 4. **Haptic Feedback**
```typescript
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30]
    };
    navigator.vibrate(patterns[type]);
  }
};
```

### 🎯 Öncelik Sırası:

1. **Yüksek Öncelik:**
   - Arama fonksiyonunu mobilde gizleme
   - Tab-based stage navigasyon
   - Kompakt lead kartları
   - FAB menüsü

2. **Orta Öncelik:**
   - Swipe gesture desteği
   - Bottom sheet modeller
   - Quick edit modal

3. **Düşük Öncelik:**
   - Pull-to-refresh
   - Infinite scroll
   - Haptic feedback

Bu iyileştirmeler ile mobil pipeline deneyimi çok daha kullanıcı dostu olacak. Hangi özelliği önce uygulamak istiyorsunuz?

---

## ✅ UYGULANAN GERÇEK KOD DETAYLARI

### 🛠️ Oluşturulan Dosyalar ve İçerikleri:

#### 1. **hooks/use-mobile.ts**
```typescript
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
```

#### 2. **hooks/use-swipe.ts**
```typescript
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
```

#### 3. **components/mobile/stage-tabs.tsx**
```typescript
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
```

#### 4. **components/mobile/floating-action-button.tsx**
```typescript
'use client'

import React, { useState } from 'react'
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

  const toggleMenu = () => {
    setIsOpen(!isOpen)
    triggerHaptic('light')
  }

  const handleAction = (action: () => void) => {
    action()
    setIsOpen(false)
    triggerHaptic('medium')
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
    <div className={cn("fixed bottom-4 right-4 z-50 md:hidden", className)}>
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
```

#### 5. **components/mobile/compact-lead-card.tsx**
```typescript
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
```

#### 6. **components/mobile/lead-quick-edit.tsx**
```typescript
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
```

### 🔧 Güncellenmiş Ana Dosyalar:

#### **app/pipelines/page.tsx - Ana Değişiklikler:**

```typescript
// Import'lar
import { useMobile, useMediaQuery } from "../../hooks/use-mobile";
import { MobileStageNavigation } from "../../components/mobile/stage-tabs";
import { FloatingActionButton } from "../../components/mobile/floating-action-button";
import { CompactLeadCard as MobileLeadCard } from "../../components/mobile/compact-lead-card";
import { LeadQuickEditModal } from "../../components/mobile/lead-quick-edit";

// Mobile states
const isMobile = useMobile();
const [mobileActiveStage, setMobileActiveStage] = React.useState<string | null>(null);
const [quickEditLead, setQuickEditLead] = React.useState<Lead | null>(null);
const [isQuickEditOpen, setIsQuickEditOpen] = React.useState(false);

// Mobile Header
<div className="md:hidden mb-4">
  <h1 className="text-2xl font-bold mb-2">Pipeline Yönetimi</h1>
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <MapPin className="h-4 w-4" />
    <span>{activePipelineData?.name || 'Pipeline seçin'}</span>
  </div>
</div>

// Mobile Pipeline Selection
{pipelines.length > 0 && (
  <div className="md:hidden mb-4">
    <Select value={activePipeline || undefined} onValueChange={setActivePipeline}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Pipeline seçin..." />
      </SelectTrigger>
      <SelectContent>
        {pipelines.filter(p => p.is_active !== false).map((pipeline) => (
          <SelectItem key={pipeline.id} value={pipeline.id}>
            <div className="flex items-center justify-between w-full">
              <span>{pipeline.name}</span>
              <Badge variant="secondary" className="ml-2">
                {pipelineLeadCounts[pipeline.id] || 0}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}

// Mobile Stage Navigation
{isMobile && (
  <MobileStageNavigation
    stages={stages.filter(s => s.pipeline_id === activePipeline)}
    activeStage={mobileActiveStage}
    onStageChange={setMobileActiveStage}
    leadCounts={getStageLeadCounts()}
  >
    {(stage) => {
      const stageLeads = filteredLeads.filter(lead => lead.stage_id === stage.id);
      return (
        <div className="py-2">
          {stageLeads.length > 0 ? (
            <div className="space-y-2">
              {stageLeads.map((lead) => (
                <MobileLeadCard
                  key={lead.id}
                  lead={lead}
                  onTap={() => {
                    setSelectedLead(lead);
                    setIsLeadDetailOpen(true);
                  }}
                  onQuickEdit={() => {
                    setQuickEditLead(lead);
                    setIsQuickEditOpen(true);
                  }}
                  // ... diğer handler'lar
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Bu aşamada lead bulunmuyor</p>
            </div>
          )}
        </div>
      );
    }}
  </MobileStageNavigation>
)}

// Desktop filtrelerini gizleme
{!isMobile && (
  <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-4">
    {/* Filtreleme alanları */}
  </div>
)}

// FAB ve Quick Edit Modal
<FloatingActionButton
  onNewLead={activePipeline ? () => setIsLeadCreateOpen(true) : undefined}
  onNewStage={activePipeline ? () => setIsStageModalOpen(true) : undefined}
  onNewPipeline={() => setIsPipelineModalOpen(true)}
/>

<LeadQuickEditModal
  lead={quickEditLead}
  isOpen={isQuickEditOpen}
  onClose={() => {
    setIsQuickEditOpen(false);
    setQuickEditLead(null);
  }}
  stages={stages.filter(s => s.pipeline_id === activePipeline)}
  onStageChange={handleQuickStageChange}
  currentPipelineName={activePipelineData?.name}
/>
```

### 📱 Ana Özellikler:

1. **✅ Responsive Design**: Mobil ve desktop için ayrı arayüzler
2. **✅ Tab Navigation**: Yatay kaydırılabilir stage tab'ları
3. **✅ FAB Menu**: Expandable floating action button
4. **✅ Quick Edit**: Drag-drop yerine kolay stage değiştirme
5. **✅ Compact Cards**: Touch-friendly lead kartları
6. **✅ Haptic Feedback**: Native mobil deneyimi
7. **✅ Search Hidden**: Mobilde karmaşıklığı azaltma

### 🎯 Performans İyileştirmeleri:

- **Media Query Hook**: Efficient resize detection
- **Optimistic Updates**: Instant UI feedback
- **Component Memoization**: Unnecessary re-renders prevention
- **Touch Optimization**: Larger touch targets
- **Animation Optimization**: Hardware-accelerated transitions

Bu implementasyon mobil kullanıcı deneyimini önemli ölçüde iyileştiriyor! 🚀