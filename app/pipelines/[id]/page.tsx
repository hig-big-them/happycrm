'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Trash2, GripVertical, Eye, Phone, Mail, Loader2, ArrowUpDown, Target } from 'lucide-react'
import { DndContext, DragEndEvent, closestCenter, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter 
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { 
  getPipelineById, 
  createStage, 
  deleteStage,
  reorderStages 
} from '@/lib/actions/pipeline-actions'
import { 
  getLeadsByStage,
  moveLead 
} from '@/lib/actions/lead-actions'
import { Pipeline, Stage, Lead, CreateStageInput } from '@/lib/actions/pipeline-types'

// Mobil komponentler ve hook'lar
import { useMobile } from '@/hooks/use-mobile'
import { MobileStageNavigation } from '@/components/mobile/stage-tabs'
import { FloatingActionButton } from '@/components/mobile/floating-action-button'
import { CompactLeadCard as MobileLeadCard } from '@/components/mobile/compact-lead-card'
import { LeadQuickEditModal } from '@/components/mobile/lead-quick-edit'
import { triggerHaptic } from '@/hooks/use-swipe'

// Sortable Stage Component
function SortableStage({ stage, leads, onDelete, onViewLead }: {
  stage: Stage
  leads: Lead[]
  onDelete: (stage: Stage) => void
  onViewLead: (lead: Lead) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="w-96 flex-shrink-0 shadow-lg border-2"
    >
      <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-move hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded">
              <GripVertical className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{stage.name}</CardTitle>
              <CardDescription className="text-sm mt-1">
                {leads.length} lead{leads.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(stage)}
              className="h-8 w-8"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 max-h-[600px] overflow-y-auto">
        <div className="space-y-3">
          <SortableContext
            items={leads.map(l => l.id)}
            strategy={verticalListSortingStrategy}
          >
            {leads.map((lead) => (
              <SortableLead key={lead.id} lead={lead} onView={onViewLead} />
            ))}
          </SortableContext>
          {leads.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Henüz lead bulunmuyor</p>
              <p className="text-xs mt-1">Lead'leri buraya sürükleyebilirsiniz</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Sortable Lead Component
function SortableLead({ lead, onView }: { lead: Lead; onView: (lead: Lead) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lead.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white dark:bg-gray-800 p-2.5 rounded-lg shadow-sm cursor-move hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 hover:scale-[1.02]"
      onClick={(e) => {
        e.stopPropagation();
        onView(lead);
      }}
    >
      <div className="space-y-1.5">
        <div className="flex justify-between items-start gap-2">
          <h4 className="font-medium text-sm line-clamp-1 flex-1">{lead.lead_name}</h4>
          <Badge 
            variant={
              lead.priority === 'urgent' || lead.priority === 'high' ? 'destructive' :
              lead.priority === 'low' ? 'secondary' :
              'default'
            }
            className="text-xs px-1.5 py-0"
          >
            {lead.priority === 'urgent' || lead.priority === 'high' ? 'Yüksek' :
             lead.priority === 'low' ? 'Düşük' : 
             lead.priority === 'medium' ? 'Orta' : 
             lead.priority || 'Orta'}
          </Badge>
        </div>
        
        {lead.company && (
          <p className="text-xs text-muted-foreground line-clamp-1">{lead.company.company_name}</p>
        )}
        
        <div className="flex justify-between items-center">
          {lead.lead_value ? (
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
              ₺{lead.lead_value.toLocaleString('tr-TR')}
            </p>
          ) : (
            <span className="text-xs text-muted-foreground">Değer yok</span>
          )}
          
          <div className="flex gap-1.5">
            {lead.contact_phone && (
              <div className="p-1 rounded bg-gray-100 dark:bg-gray-700">
                <Phone className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
            {lead.contact_email && (
              <div className="p-1 rounded bg-gray-100 dark:bg-gray-700">
                <Mail className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PipelineDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [stageLeads, setStageLeads] = useState<Record<string, Lead[]>>({})
  const [loading, setLoading] = useState(true)
  const [isCreateStageOpen, setIsCreateStageOpen] = useState(false)

  const [isDeleteStageOpen, setIsDeleteStageOpen] = useState(false)
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null)
  const [stageFormData, setStageFormData] = useState<CreateStageInput>({
    pipeline_id: params.id as string,
    name: '',
    order_position: 0,
    color: '#3b82f6'
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Mobile states
  const isMobile = useMobile()
  const [mobileActiveStage, setMobileActiveStage] = useState<string | null>(null)
  const [quickEditLead, setQuickEditLead] = useState<Lead | null>(null)
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false)

  useEffect(() => {
    loadPipelineData()
  }, [params.id])

  const loadPipelineData = async () => {
    try {
      const pipelineData = await getPipelineById(params.id as string)
      if (!pipelineData) {
        router.push('/pipelines')
        return
      }
      setPipeline(pipelineData)
      
      // Load leads for each stage
      const leadsData: Record<string, Lead[]> = {}
      for (const stage of pipelineData.stages || []) {
        const leads = await getLeadsByStage(stage.id)
        leadsData[stage.id] = leads
      }
      setStageLeads(leadsData)
      
      // Set order position for new stage
      setStageFormData({
        ...stageFormData,
        order_position: pipelineData.stages?.length || 0
      })
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Pipeline bilgileri yüklenirken hata oluştu',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStage = async () => {
    if (!stageFormData.name.trim()) {
      toast({
        title: 'Hata',
        description: 'Stage adı boş olamaz',
        variant: 'destructive'
      })
      return
    }
    
    setLoading(true)
    try {
      const result = await createStage(stageFormData)
      if (result?.data) {
        toast({
          title: 'Başarılı',
          description: 'Stage oluşturuldu'
        })
        setIsCreateStageOpen(false)
        setStageFormData({
          pipeline_id: params.id as string,
          name: '',
          order_position: pipeline?.stages?.length || 0,
          color: '#3b82f6'
        })
        await loadPipelineData()
      } else {
        throw new Error('Stage oluşturulamadı')
      }
    } catch (error) {
      console.error('Stage create error:', error)
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Stage oluşturulurken hata oluştu',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }



  const handleDeleteStage = async () => {
    if (!selectedStage) return
    
    try {
      await deleteStage({ id: selectedStage.id })
      toast({
        title: 'Başarılı',
        description: 'Stage silindi'
      })
      setIsDeleteStageOpen(false)
      setSelectedStage(null)
      loadPipelineData()
    } catch (error) {
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Stage silinirken hata oluştu',
        variant: 'destructive'
      })
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || active.id === over.id) return
    
    // Check if we're moving a stage or a lead
    const activeStage = pipeline?.stages?.find(s => s.id === active.id)
    const activeLeadStageId = Object.keys(stageLeads).find(stageId => 
      stageLeads[stageId].some(lead => lead.id === active.id)
    )
    
    if (activeStage && pipeline?.stages) {
      // Reordering stages
      const oldIndex = pipeline.stages.findIndex(s => s.id === active.id)
      const newIndex = pipeline.stages.findIndex(s => s.id === over.id)
      
      const newStages = [...pipeline.stages]
      const [movedStage] = newStages.splice(oldIndex, 1)
      newStages.splice(newIndex, 0, movedStage)
      
      // Update order positions
      const stageOrders = newStages.map((stage, index) => ({
        id: stage.id,
        order_position: index
      }))
      
      try {
        await reorderStages({
          pipeline_id: pipeline.id,
          stage_orders: stageOrders
        })
        loadPipelineData()
      } catch (error) {
        toast({
          title: 'Hata',
          description: 'Stage sıralaması güncellenirken hata oluştu',
          variant: 'destructive'
        })
      }
    } else if (activeLeadStageId) {
      // Moving a lead to a different stage
      const overStage = pipeline?.stages?.find(s => s.id === over.id)
      if (overStage) {
        try {
          await moveLead({
            lead_id: active.id as string,
            stage_id: overStage.id
          })
          loadPipelineData()
          toast({
            title: 'Başarılı',
            description: 'Lead taşındı'
          })
        } catch (error) {
          toast({
            title: 'Hata',
            description: 'Lead taşınırken hata oluştu',
            variant: 'destructive'
          })
        }
      }
    }
    
    setActiveId(null)
  }



  const openDeleteStageDialog = (stage: Stage) => {
    setSelectedStage(stage)
    setIsDeleteStageOpen(true)
  }

  const viewLead = (lead: Lead) => {
    router.push(`/leads/${lead.id}`)
  }

  // Mobile: Quick stage change handler
  const handleQuickStageChange = async (leadId: string, stageId: string) => {
    try {
      await moveLead({
        lead_id: leadId,
        stage_id: stageId
      })
      loadPipelineData()
      triggerHaptic('medium')
      toast({
        title: 'Başarılı',
        description: 'Lead taşındı'
      })
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Lead taşınırken hata oluştu',
        variant: 'destructive'
      })
    }
  }

  // Mobile: Initialize active stage
  useEffect(() => {
    if (isMobile && pipeline?.stages && pipeline.stages.length > 0 && !mobileActiveStage) {
      setMobileActiveStage(pipeline.stages[0].id)
    }
  }, [isMobile, pipeline?.stages, mobileActiveStage])

  // Mobile: Stage lead counts helper
  const getStageLeadCounts = () => {
    const counts: Record<string, number> = {}
    Object.keys(stageLeads).forEach(stageId => {
      counts[stageId] = stageLeads[stageId].length
    })
    return counts
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">Yükleniyor...</div>
  }

  if (!pipeline) {
    return <div className="flex items-center justify-center h-96">Pipeline bulunamadı</div>
  }

  return (
    <div className="container-fluid py-4 md:py-8 px-4">
      {/* Desktop Header */}
      <div className="hidden md:block mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{pipeline.name}</h1>
            {pipeline.description && (
              <p className="text-muted-foreground mt-2">{pipeline.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsCreateStageOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              <Plus className="mr-2 h-5 w-5" />
              Yeni Stage Ekle
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push(`/leads/new?pipeline=${pipeline.id}`)}
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Lead Ekle
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden mb-4">
        <h1 className="text-2xl font-bold mb-1">{pipeline.name}</h1>
        {pipeline.description && (
          <p className="text-sm text-muted-foreground">{pipeline.description}</p>
        )}
      </div>

      {/* Mobile Stage Navigation */}
      {isMobile && pipeline.stages && (
        <MobileStageNavigation
          stages={pipeline.stages}
          activeStage={mobileActiveStage}
          onStageChange={setMobileActiveStage}
          leadCounts={getStageLeadCounts()}
        >
          {(stage) => {
            const leads = stageLeads[stage.id] || []
            return (
              <div className="py-2">
                {leads.length > 0 ? (
                  <div className="space-y-2">
                    {leads.map((lead) => (
                      <MobileLeadCard
                        key={lead.id}
                        lead={lead}
                        onTap={() => viewLead(lead)}
                        onQuickEdit={() => {
                          setQuickEditLead(lead)
                          setIsQuickEditOpen(true)
                        }}
                        onEdit={() => router.push(`/leads/${lead.id}/edit`)}
                        onCall={lead.contact_phone ? () => window.location.href = `tel:${lead.contact_phone}` : undefined}
                        onEmail={lead.contact_email ? () => window.location.href = `mailto:${lead.contact_email}` : undefined}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Bu aşamada lead bulunmuyor</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => router.push(`/leads/new?pipeline=${pipeline.id}&stage=${stage.id}`)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Lead Ekle
                    </Button>
                  </div>
                )}
              </div>
            )
          }}
        </MobileStageNavigation>
      )}

      {/* Desktop Stage View */}
      {!isMobile && (
        <DndContext
          collisionDetection={closestCenter}
          onDragStart={(event) => setActiveId(event.active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 overflow-x-auto pb-6 px-2">
            <SortableContext
              items={pipeline.stages?.map(s => s.id) || []}
              strategy={horizontalListSortingStrategy}
            >
              {pipeline.stages?.map((stage) => (
                <SortableStage
                  key={stage.id}
                  stage={stage}
                  leads={stageLeads[stage.id] || []}
                  onDelete={openDeleteStageDialog}
                  onViewLead={viewLead}
                />
              ))}
            </SortableContext>
            
            {/* Yeni Stage Ekle Kartı */}
            <Card className="w-96 flex-shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary transition-colors cursor-pointer"
                  onClick={() => setIsCreateStageOpen(true)}>
              <CardContent className="flex items-center justify-center h-full min-h-[200px]">
                <div className="text-center">
                  <Plus className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Yeni Stage Ekle</p>
                </div>
              </CardContent>
            </Card>
          </div>
        
        <DragOverlay>
          {activeId ? (
            <div className="cursor-grabbing">
              {(() => {
                // Check if it's a stage
                const stage = pipeline?.stages?.find(s => s.id === activeId)
                if (stage) {
                  return (
                    <Card className="w-96 shadow-2xl opacity-90 rotate-3">
                      <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                        <CardTitle className="text-lg">{stage.name}</CardTitle>
                      </CardHeader>
                    </Card>
                  )
                }
                
                // Check if it's a lead
                const leadStageId = Object.keys(stageLeads).find(stageId => 
                  stageLeads[stageId].some(lead => lead.id === activeId)
                )
                if (leadStageId) {
                  const lead = stageLeads[leadStageId].find(l => l.id === activeId)
                  if (lead) {
                    return (
                      <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg shadow-2xl cursor-grabbing border border-gray-200 dark:border-gray-700 rotate-3 opacity-90">
                        <div className="space-y-1.5">
                          <h4 className="font-medium text-sm line-clamp-1">{lead.lead_name}</h4>
                          {lead.company && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{lead.company.company_name}</p>
                          )}
                          {lead.lead_value && (
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                              ₺{lead.lead_value.toLocaleString('tr-TR')}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  }
                }
                
                return null
              })()}
            </div>
                      ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* Create Stage Dialog */}
      <Dialog open={isCreateStageOpen} onOpenChange={setIsCreateStageOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Yeni Stage Ekle</DialogTitle>
            <DialogDescription>
              Pipeline\'a yeni bir aşama ekleyin. Lead\'ler bu aşamalar arasında hareket edecek.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stage-name" className="text-sm font-medium">
                Stage Adı <span className="text-red-500">*</span>
              </Label>
              <Input
                id="stage-name"
                value={stageFormData.name}
                onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
                placeholder="Örn: İlk Görüşme, Teklif Sunuldu, Müzakere..."
                className="h-11"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Stage ismi, satış sürecinizdeki bir aşamayı temsil etmelidir
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-color" className="text-sm font-medium">
                Renk Seçimi
              </Label>
              <div className="flex gap-3 items-center">
                <input
                  id="stage-color"
                  type="color"
                  value={stageFormData.color}
                  onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                  className="h-11 w-20 rounded cursor-pointer border border-gray-300"
                />
                <Input
                  value={stageFormData.color}
                  onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                  placeholder="#3b82f6"
                  className="flex-1 h-11"
                />
                <div 
                  className="h-11 w-11 rounded-lg border-2"
                  style={{ backgroundColor: stageFormData.color }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Stage\'i görsel olarak ayırt etmek için bir renk seçin
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateStageOpen(false)
                setStageFormData({
                  pipeline_id: params.id as string,
                  name: '',
                  order_position: pipeline?.stages?.length || 0,
                  color: '#3b82f6'
                })
              }}
              disabled={loading}
            >
              İptal
            </Button>
            <Button 
              onClick={handleCreateStage} 
              disabled={!stageFormData.name.trim() || loading}
              className="min-w-[100px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ekleniyor...
                </>
              ) : (
                'Stage Ekle'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Delete Stage Dialog */}
      <Dialog open={isDeleteStageOpen} onOpenChange={setIsDeleteStageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stage Sil</DialogTitle>
            <DialogDescription>
              Bu stage\'i silmek istediğinizden emin misiniz? 
              {stageLeads[selectedStage?.id || '']?.length > 0 && (
                <span className="text-red-500 block mt-2">
                  Bu stage\'de {stageLeads[selectedStage?.id || ''].length} lead bulunmaktadır!
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteStageOpen(false)}>
              İptal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteStage}
              disabled={stageLeads[selectedStage?.id || '']?.length > 0}
            >
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Quick Edit Modal */}
      <LeadQuickEditModal
        lead={quickEditLead}
        isOpen={isQuickEditOpen}
        onClose={() => {
          setIsQuickEditOpen(false)
          setQuickEditLead(null)
        }}
        stages={pipeline.stages || []}
        onStageChange={handleQuickStageChange}
        currentPipelineName={pipeline.name}
      />

      {/* Mobile FAB */}
      <FloatingActionButton
        onNewLead={() => router.push(`/leads/new?pipeline=${pipeline.id}`)}
        onNewStage={() => setIsCreateStageOpen(true)}
      />
    </div>
  )
}