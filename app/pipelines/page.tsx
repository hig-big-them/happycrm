"use client";

import * as React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { createClient } from "../../lib/supabase/client";
import { 
  Loader2, 
  Plus, 
  Settings,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Building,
  DollarSign,
  Calendar,
  Target,
  MapPin,
  Edit,
  Trash2,
  GripVertical,
  ChevronRight,
  Hash,
  User,
  Clock,
  Tag,
  ArrowUpDown
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";

// Mobil komponentler ve hook'lar
import { useMobile, useMediaQuery } from "../../hooks/use-mobile";
import { MobileStageNavigation, MobileStageSwipeNavigation } from "../../components/mobile/stage-tabs";
import { FloatingActionButton } from "../../components/mobile/floating-action-button";
import { CompactLeadCard as MobileLeadCard } from "../../components/mobile/compact-lead-card";
import { LeadQuickEditModal } from "../../components/mobile/lead-quick-edit";
import { BottomSheet } from "../../components/mobile/bottom-sheet";
import { StageNavigationControls, DotsIndicator, SwipeableStageContainer } from "../../components/mobile/stage-navigation";
import { useSwipe, triggerHaptic } from "../../hooks/use-swipe";


// Veri tipleri
interface Pipeline {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

interface Stage {
  id: string;
  pipeline_id: string | null;
  name: string;
  order_position: number;
  color?: string | null;
  is_hidden: boolean | null;
}

interface Lead {
  id: string;
  lead_name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  lead_value?: number | null;
  priority?: string | null;
  source?: string | null;
  description?: string | null;
  created_at: string | null;
  follow_up_date?: string | null;
  stage_id?: string | null;
  pipeline_id?: string | null;
  company_id?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  company?: {
    id: string;
    company_name: string;
  } | null;
}

// Stage renkleri
const stageColors = [
  { name: 'Mavi', value: '#3B82F6' },
  { name: 'Yeşil', value: '#10B981' },
  { name: 'Sarı', value: '#F59E0B' },
  { name: 'Kırmızı', value: '#EF4444' },
  { name: 'Mor', value: '#8B5CF6' },
  { name: 'Gri', value: '#6B7280' },
];

// Priority renkleri
const getPriorityBadge = (priority: string | null) => {
  switch (priority?.toLowerCase()) {
    case 'yüksek':
    case 'high':
      return <div className="w-2 h-2 rounded-full bg-red-500" title="Yüksek" />;
    case 'orta':
    case 'medium':
      return <div className="w-2 h-2 rounded-full bg-yellow-500" title="Orta" />;
    case 'düşük':
    case 'low':
      return <div className="w-2 h-2 rounded-full bg-green-500" title="Düşük" />;
    default:
      return null;
  }
};

// Kompakt Lead Kartı Komponenti
function CompactLeadCard({ 
  lead, 
  isDragging, 
  onDetailClick, 
  onEditClick,
  isSelected,
  onSelect 
}: { 
  lead: Lead; 
  isDragging: boolean; 
  onDetailClick: (lead: Lead) => void;
  onEditClick: (lead: Lead) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const formatCurrency = (amount: number | null) => {
    if (!amount) return '';
    return new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      notation: 'compact'
    }).format(amount);
  };

  return (
    <Card className={`hover:shadow-sm transition-all cursor-move bg-white p-2 relative ${
      isDragging ? 'shadow-lg opacity-90' : ''
    } ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(lead.id)}
              className="h-3 w-3 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
            <h4 className="text-sm font-medium text-gray-900 line-clamp-1 flex-1">
              {lead.lead_name}
            </h4>
          </div>
          <div className="flex items-center gap-1">
            {getPriorityBadge(lead.priority)}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                onEditClick(lead);
              }}
            >
              <Edit className="h-3 w-3 text-gray-500" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                onDetailClick(lead);
              }}
            >
              <Eye className="h-3 w-3 text-gray-500" />
            </Button>
          </div>
        </div>
        
        {lead.company && (
          <p className="text-xs text-gray-600 line-clamp-1">
            {lead.company.company_name}
          </p>
        )}
        
        {lead.event_date && (
          <div className="flex items-center gap-1 text-xs text-purple-600">
            <Calendar className="h-3 w-3" />
            <span>
              {lead.event_date}
              {lead.event_time && ` • ${lead.event_time}`}
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between text-xs">
          {lead.lead_value && (
            <span className="font-medium text-green-700">
              {formatCurrency(lead.lead_value)}
            </span>
          )}
          <div className="flex gap-1 text-gray-400">
            {lead.contact_email && <Mail className="h-3 w-3" />}
            {lead.contact_phone && <Phone className="h-3 w-3" />}
          </div>
        </div>
      </div>
    </Card>
  );
}

// Lead Detay Dialog Komponenti
function LeadDetailDialog({ 
  lead, 
  isOpen, 
  onClose,
  pipelines,
  stages,
  onEdit
}: { 
  lead: Lead | null; 
  isOpen: boolean; 
  onClose: () => void;
  pipelines: Pipeline[];
  stages: Stage[];
  onEdit: (lead: Lead) => void;
}) {
  if (!lead) return null;

  const pipeline = pipelines.find(p => p.id === lead.pipeline_id);
  const stage = stages.find(s => s.id === lead.stage_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{lead.lead_name}</DialogTitle>
          <DialogDescription>Müşteri Detayları</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Müşteri Bilgileri */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">MÜŞTERİ BİLGİLERİ</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{lead.lead_name}</span>
              </div>
              
              {lead.contact_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`tel:${lead.contact_phone}`}
                    className="text-primary hover:underline"
                  >
                    {lead.contact_phone}
                  </a>
                </div>
              )}
              
              {lead.contact_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a 
                    href={`mailto:${lead.contact_email}`}
                    className="text-primary hover:underline"
                  >
                    {lead.contact_email}
                  </a>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Pipeline - Stage */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">PIPELINE - STAGE</h3>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {pipeline?.name || 'Belirtilmemiş'} 
                {stage && (
                  <>
                    <ChevronRight className="h-4 w-4 inline mx-1 text-muted-foreground" />
                    <Badge variant="outline">{stage.name}</Badge>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Event Date - Event Time */}
          {(lead.event_date || lead.event_time) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">EVENT TARİH - SAAT</h3>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {lead.event_date || 'Tarih belirtilmemiş'}
                    {lead.event_time && (
                      <>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <Clock className="h-4 w-4 inline mr-1 text-muted-foreground" />
                        {lead.event_time}
                      </>
                    )}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Kapat
          </Button>
          <Button 
            onClick={() => {
              onClose();
              onEdit(lead);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Düzenle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lead Create Dialog
function LeadCreateDialog({ 
  isOpen, 
  onClose, 
  pipelines, 
  stages,
  defaultPipelineId,
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  pipelines: Pipeline[];
  stages: Stage[];
  defaultPipelineId: string | null;
  onSave: (newLead: Partial<Lead>) => Promise<void>;
}) {
  const [formData, setFormData] = React.useState({
    lead_name: '',
    contact_phone: '',
    contact_email: '',
    pipeline_id: defaultPipelineId || '',
    stage_id: '',
    event_date: '',
    event_time: '',
    priority: 'medium',
    lead_value: ''
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (defaultPipelineId) {
      setFormData(prev => ({ ...prev, pipeline_id: defaultPipelineId }));
    }
  }, [defaultPipelineId]);

  const handleSubmit = async () => {
    if (!formData.lead_name.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSave({
        lead_name: formData.lead_name.trim(),
        contact_phone: formData.contact_phone || null,
        contact_email: formData.contact_email || null,
        pipeline_id: formData.pipeline_id || null,
        stage_id: formData.stage_id || null,
        event_date: formData.event_date || null,
        event_time: formData.event_time || null,
        priority: formData.priority || null,
        lead_value: formData.lead_value ? parseFloat(formData.lead_value) : null
      });
      onClose();
      // Reset form
      setFormData({
        lead_name: '',
        contact_phone: '',
        contact_email: '',
        pipeline_id: defaultPipelineId || '',
        stage_id: '',
        event_date: '',
        event_time: '',
        priority: 'medium',
        lead_value: ''
      });
    } catch (error) {
      console.error('Lead oluşturma hatası:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStages = stages.filter(s => s.pipeline_id === formData.pipeline_id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Lead Oluştur</DialogTitle>
          <DialogDescription>
            Lead bilgilerini girin
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new_lead_name">Ad Soyad *</Label>
            <Input
              id="new_lead_name"
              value={formData.lead_name}
              onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
              placeholder="Müşteri adı"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new_contact_phone">Telefon</Label>
              <Input
                id="new_contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+90 555 555 5555"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_contact_email">Email</Label>
              <Input
                id="new_contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="email@örnek.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new_pipeline_id">Pipeline</Label>
              <select
                id="new_pipeline_id"
                value={formData.pipeline_id}
                onChange={(e) => setFormData({ ...formData, pipeline_id: e.target.value, stage_id: '' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              >
                <option value="">Seçin</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_stage_id">Stage</Label>
              <select
                id="new_stage_id"
                value={formData.stage_id}
                onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting || !formData.pipeline_id}
              >
                <option value="">Seçin</option>
                {filteredStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new_event_date">Event Tarihi</Label>
              <Input
                id="new_event_date"
                type="text"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                placeholder="Örn: 15 Mart 2024"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_event_time">Event Saati</Label>
              <Input
                id="new_event_time"
                type="text"
                value={formData.event_time}
                onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                placeholder="Örn: 14:30"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new_priority">Öncelik</Label>
              <select
                id="new_priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new_lead_value">Değer (₺)</Label>
              <Input
                id="new_lead_value"
                type="number"
                value={formData.lead_value}
                onChange={(e) => setFormData({ ...formData, lead_value: e.target.value })}
                placeholder="0"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !formData.lead_name}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              'Oluştur'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lead Edit Dialog
function LeadEditDialog({ 
  lead, 
  isOpen, 
  onClose, 
  pipelines, 
  stages,
  onSave,
  onDelete
}: { 
  lead: Lead | null; 
  isOpen: boolean; 
  onClose: () => void;
  pipelines: Pipeline[];
  stages: Stage[];
  onSave: (updatedLead: Partial<Lead>) => Promise<void>;
  onDelete: (leadId: string) => Promise<void>;
}) {
  const [formData, setFormData] = React.useState({
    lead_name: '',
    contact_phone: '',
    pipeline_id: '',
    stage_id: '',
    event_date: '',
    event_time: ''
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (lead) {
      setFormData({
        lead_name: lead.lead_name || '',
        contact_phone: lead.contact_phone || '',
        pipeline_id: lead.pipeline_id || '',
        stage_id: lead.stage_id || '',
        event_date: lead.event_date || '',
        event_time: lead.event_time || ''
      });
    }
  }, [lead]);

  const handleSubmit = async () => {
    if (!lead) return;
    
    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        id: lead.id
      });
      onClose();
    } catch (error) {
      console.error('Lead güncelleme hatası:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    
    if (!window.confirm(`"${lead.lead_name}" adlı lead'i silmek istediğinizden emin misiniz?`)) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onDelete(lead.id);
      onClose();
    } catch (error) {
      console.error('Lead silme hatası:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStages = stages.filter(s => s.pipeline_id === formData.pipeline_id);

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Lead Düzenle</DialogTitle>
          <DialogDescription>
            Temel bilgileri güncelleyin
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lead_name">Ad Soyad *</Label>
            <Input
              id="lead_name"
              value={formData.lead_name}
              onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
              placeholder="Müşteri adı"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_phone">Telefon</Label>
            <Input
              id="contact_phone"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="+90 555 555 5555"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pipeline_id">Pipeline</Label>
              <select
                id="pipeline_id"
                value={formData.pipeline_id}
                onChange={(e) => setFormData({ ...formData, pipeline_id: e.target.value, stage_id: '' })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              >
                <option value="">Seçin</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage_id">Stage</Label>
              <select
                id="stage_id"
                value={formData.stage_id}
                onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting || !formData.pipeline_id}
              >
                <option value="">Seçin</option>
                {filteredStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date">Event Tarihi</Label>
              <Input
                id="event_date"
                type="text"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                placeholder="Örn: 15 Mart 2024"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_time">Event Saati</Label>
              <Input
                id="event_time"
                type="text"
                value={formData.event_time}
                onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                placeholder="Örn: 14:30"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="mr-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Siliniyor...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Sil
              </>
            )}
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              İptal
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.lead_name}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                'Kaydet'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Stage Sütunu Komponenti
function StageColumn({ 
  stage, 
  leads, 
  isHidden,
  onToggleVisibility,
  onEditStage,
  onDeleteStage,
  onLeadDetail,
  onLeadEdit,
  selectedLeads,
  onLeadSelect
}: { 
  stage: Stage; 
  leads: Lead[];
  isHidden: boolean;
  onToggleVisibility: () => void;
  onEditStage: () => void;
  onDeleteStage: () => void;
  onLeadDetail: (lead: Lead) => void;
  onLeadEdit: (lead: Lead) => void;
  selectedLeads: Set<string>;
  onLeadSelect: (id: string) => void;
}) {
  if (isHidden) {
    return (
      <div className="bg-gray-100 rounded-lg p-3 w-72 flex-shrink-0 opacity-60">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sm text-gray-600">{stage.name}</h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleVisibility}
            className="h-6 w-6 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500">Bu aşama gizli</p>
      </div>
    );
  }

  return (
    <div 
      className="bg-gray-50 rounded-lg p-3 w-72 flex-shrink-0 border-t-4 min-h-[400px]"
      style={{ borderTopColor: stage.color || '#6B7280' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          <h3 className="font-semibold text-sm text-gray-900">{stage.name}</h3>
          <Badge variant="secondary" className="text-xs px-1">
            {leads.length}
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleVisibility}
            className="h-6 w-6 p-0"
          >
            <EyeOff className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onEditStage}
            className="h-6 w-6 p-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDeleteStage}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-2 min-h-[300px] transition-colors rounded-md p-1 ${
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
          >
            {leads.map((lead, index) => (
              <Draggable key={lead.id} draggableId={lead.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <CompactLeadCard 
                      lead={lead} 
                      isDragging={snapshot.isDragging}
                      onDetailClick={(lead) => onLeadDetail(lead)}
                      onEditClick={(lead) => onLeadEdit(lead)}
                      isSelected={selectedLeads.has(lead.id)}
                      onSelect={onLeadSelect}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            
            {leads.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center text-gray-400 py-8">
                <Target className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Lead yok</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// Pipeline Kartı
function PipelineCard({ 
  pipeline, 
  isActive, 
  onClick, 
  leadCount,
  onArchiveToggle
}: { 
  pipeline: Pipeline; 
  isActive: boolean; 
  onClick: () => void;
  leadCount: number;
  onArchiveToggle: (pipelineId: string, currentStatus: boolean) => void;
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md relative ${
        isActive ? 'ring-2 ring-primary shadow-md' : ''
      } ${!pipeline.is_active ? 'opacity-75' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MapPin className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
            <CardTitle className="text-lg">{pipeline.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isActive ? "default" : "secondary"}>
              {leadCount} Lead
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onArchiveToggle(pipeline.id, pipeline.is_active || true);
              }}
              title={pipeline.is_active === false ? "Aktif Et" : "Arşivle"}
            >
              {pipeline.is_active === false ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {pipeline.description && (
          <CardDescription className="text-sm mt-1">
            {pipeline.description}
          </CardDescription>
        )}
      </CardHeader>
    </Card>
  );
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = React.useState<Lead[]>([]);
  const [activePipeline, setActivePipeline] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [pipelineLeadCounts, setPipelineLeadCounts] = React.useState<{[key: string]: number}>({});
  
  // Modals
  const [isPipelineModalOpen, setIsPipelineModalOpen] = React.useState(false);
  const [isStageModalOpen, setIsStageModalOpen] = React.useState(false);
  const [editingStage, setEditingStage] = React.useState<Stage | null>(null);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [isLeadDetailOpen, setIsLeadDetailOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);
  const [isLeadEditOpen, setIsLeadEditOpen] = React.useState(false);
  const [isLeadCreateOpen, setIsLeadCreateOpen] = React.useState(false);
  
  // Selection & Filter
  const [selectedLeads, setSelectedLeads] = React.useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState<string>("");
  const [filterDateRange, setFilterDateRange] = React.useState<{start: string, end: string}>({start: '', end: ''});
  const [pipelineTab, setPipelineTab] = React.useState<"active" | "archived">("active");
  
  // Form states
  const [newPipelineName, setNewPipelineName] = React.useState("");
  const [newPipelineDescription, setNewPipelineDescription] = React.useState("");
  const [newStageName, setNewStageName] = React.useState("");
  const [newStageColor, setNewStageColor] = React.useState("#3B82F6");
  const [newStagePosition, setNewStagePosition] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Mobile states
  const isMobile = useMobile();
  const [mobileActiveStage, setMobileActiveStage] = React.useState<string>("");
  const [quickEditLead, setQuickEditLead] = React.useState<Lead | null>(null);
  const [isQuickEditOpen, setIsQuickEditOpen] = React.useState(false);

  const router = useRouter();

  // Auto-select first pipeline and stage for mobile
  React.useEffect(() => {
    // Sadece mobilde ve pipeline yoksa çalış
    if (isMobile && pipelines.length > 0 && !activePipeline) {
      const firstActivePipeline = pipelines.find(p => p.is_active !== false)
      if (firstActivePipeline) {
        console.log('Auto-selecting first pipeline:', firstActivePipeline.name)
        setActivePipeline(firstActivePipeline.id)
      }
    }
  }, [isMobile, pipelines, activePipeline])

  React.useEffect(() => {
    // Mobilde pipeline seçildiğinde ilk stage'i seç
    if (isMobile && activePipeline && stages.length > 0) {
      const pipelineStages = stages.filter(s => s.pipeline_id === activePipeline)
      if (pipelineStages.length > 0 && !mobileActiveStage) {
        const firstStage = pipelineStages.sort((a, b) => a.order_position - b.order_position)[0]
        console.log('Auto-selecting first stage:', firstStage.name)
        setMobileActiveStage(firstStage.id)
      }
    }
  }, [isMobile, activePipeline, stages, mobileActiveStage])

  // Pipeline değiştiğinde stage'i resetle
  React.useEffect(() => {
    if (isMobile && activePipeline) {
      const pipelineStages = stages.filter(s => s.pipeline_id === activePipeline)
      if (pipelineStages.length > 0) {
        const firstStage = pipelineStages.sort((a, b) => a.order_position - b.order_position)[0]
        console.log('Resetting stage for pipeline change:', firstStage.name)
        setMobileActiveStage(firstStage.id)
      } else {
        setMobileActiveStage(null)
      }
    }
  }, [activePipeline]) // Sadece activePipeline değiştiğinde çalış

  const loadPipelineData = React.useCallback(async () => {
    const supabase = createClient();
    
    try {
      // TÜM pipeline'ları çek (aktif ve pasif)
      const { data: pipelinesData, error: pipelinesError } = await supabase
        .from("pipelines")
        .select("*")
        .order("name");

      if (pipelinesError) throw pipelinesError;

      setPipelines(pipelinesData || []);
      
      // Her pipeline için lead sayısını çek
      const counts: {[key: string]: number} = {};
      for (const pipeline of pipelinesData || []) {
        const { count } = await supabase
          .from("leads")
          .select("*", { count: 'exact', head: true })
          .eq("pipeline_id", pipeline.id);
        
        counts[pipeline.id] = count || 0;
      }
      setPipelineLeadCounts(counts);
      
      // Pipeline otomatik seçimi - aktif pipeline yoksa ilk aktif pipeline'ı seç
      if (pipelinesData && pipelinesData.length > 0 && !activePipeline) {
        const firstActivePipeline = pipelinesData.find(p => p.is_active !== false);
        if (firstActivePipeline) {
          console.log('Auto-selecting first active pipeline:', firstActivePipeline.name);
          setActivePipeline(firstActivePipeline.id);
        }
      }
      
    } catch (err) {
      console.error("Pipeline data yükleme hatası:", err);
      setError("Veriler yüklenirken hata oluştu");
    }
  }, [activePipeline]);

  async function loadStagesAndLeads(pipelineId: string) {
    const supabase = createClient();
    
    try {
      // TÜM stage'leri çek (sadece aktif pipeline'ın değil)
      const { data: allStagesData, error: allStagesError } = await supabase
        .from("stages")
        .select("*")
        .order("order_position");

      if (allStagesError) throw allStagesError;
      
      // Lead'leri çek
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select(`
          *,
          company:companies(id, company_name)
        `)
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false });

      if (leadsError) throw leadsError;

      setStages(allStagesData || []);
      setLeads(leadsData || []);
      
    } catch (err) {
      console.error("Stage/Lead data yükleme hatası:", err);
      setError("Stage verileri yüklenirken hata oluştu");
    }
  }

  React.useEffect(() => {
    async function init() {
      setIsLoading(true);
      await loadPipelineData();
      setIsLoading(false);
    }
    init();
  }, [loadPipelineData]);

  React.useEffect(() => {
    if (activePipeline) {
      loadStagesAndLeads(activePipeline);
    } else {
      setIsLoading(false);
    }
  }, [activePipeline]);

  // Filter leads when filters change
  React.useEffect(() => {
    let filtered = [...leads];
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(lead => 
        lead.lead_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.contact_phone?.includes(searchQuery) ||
        lead.contact_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.company?.company_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Priority filter
    if (filterPriority) {
      filtered = filtered.filter(lead => lead.priority === filterPriority);
    }
    
    // Date range filter
    if (filterDateRange.start || filterDateRange.end) {
      filtered = filtered.filter(lead => {
        if (!lead.event_date) return false;
        const eventDate = new Date(lead.event_date);
        const startDate = filterDateRange.start ? new Date(filterDateRange.start) : null;
        const endDate = filterDateRange.end ? new Date(filterDateRange.end) : null;
        
        if (startDate && eventDate < startDate) return false;
        if (endDate && eventDate > endDate) return false;
        return true;
      });
    }
    
    setFilteredLeads(filtered);
  }, [leads, searchQuery, filterPriority, filterDateRange]);

  // Drag & Drop handler
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    
    const { draggableId, source, destination } = result;
    
    if (source.droppableId === destination.droppableId) return;
    
    // Optimistic update: Önce state'i güncelle
    const leadToMove = leads.find(lead => lead.id === draggableId);
    if (!leadToMove) return;
    
    // Geçici olarak lead'i yeni konuma taşı
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === draggableId 
          ? { ...lead, stage_id: destination.droppableId }
          : lead
      )
    );
    
    // Sonra database'i güncelle
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ stage_id: destination.droppableId })
      .eq("id", draggableId);
      
    if (error) {
      // Hata olursa state'i geri al
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === draggableId 
            ? { ...lead, stage_id: source.droppableId }
            : lead
        )
      );
      console.error("Lead taşıma hatası:", error);
    }
  };

  // Pipeline oluşturma
  const handleCreatePipeline = async () => {
    if (!newPipelineName.trim()) return;
    
    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pipelines")
      .insert({
        name: newPipelineName.trim(),
        description: newPipelineDescription.trim() || null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error("Pipeline oluşturma hatası:", error);
      setError("Pipeline oluşturulamadı: " + error.message);
    } else if (data) {
      setPipelines([...pipelines, data]);
      setPipelineLeadCounts({ ...pipelineLeadCounts, [data.id]: 0 });
      setActivePipeline(data.id);
      setIsPipelineModalOpen(false);
      setNewPipelineName("");
      setNewPipelineDescription("");
    }
    setIsSubmitting(false);
  };

  // Stage oluşturma/güncelleme
  const handleSaveStage = async () => {
    if (!newStageName.trim() || !activePipeline) return;
    
    setIsSubmitting(true);
    const supabase = createClient();
    
    if (editingStage) {
      // Güncelleme
      const { error } = await supabase
        .from("stages")
        .update({
          name: newStageName.trim(),
          color: newStageColor
        })
        .eq("id", editingStage.id);

      if (!error) {
        await loadStagesAndLeads(activePipeline);
        setIsStageModalOpen(false);
        resetStageForm();
      } else {
        setError("Stage güncellenemedi: " + error.message);
      }
    } else {
      // Yeni oluşturma
      const position = newStagePosition ? parseInt(newStagePosition) : stages.length + 1;
      
      const { error } = await supabase
        .from("stages")
        .insert({
          pipeline_id: activePipeline,
          name: newStageName.trim(),
          color: newStageColor,
          order_position: position,
          is_hidden: false
        });

      if (!error) {
        await loadStagesAndLeads(activePipeline);
        setIsStageModalOpen(false);
        resetStageForm();
      } else {
        setError("Stage oluşturulamadı: " + error.message);
      }
    }
    setIsSubmitting(false);
  };

  // Stage görünürlüğünü değiştir
  const toggleStageVisibility = async (stageId: string, currentVisibility: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("stages")
      .update({ is_hidden: !currentVisibility })
      .eq("id", stageId);

    if (!error && activePipeline) {
      await loadStagesAndLeads(activePipeline);
    }
  };

  // Stage silme
  const deleteStage = async (stageId: string) => {
    if (!window.confirm("Bu aşamayı silmek istediğinizden emin misiniz?")) return;
    
    const supabase = createClient();
    const { error } = await supabase
      .from("stages")
      .delete()
      .eq("id", stageId);

    if (!error && activePipeline) {
      await loadStagesAndLeads(activePipeline);
    }
  };

  const resetStageForm = () => {
    setNewStageName("");
    setNewStageColor("#3B82F6");
    setNewStagePosition("");
    setEditingStage(null);
  };

  // Lead selection handlers
  const handleLeadSelect = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)));
    }
  };

  // Lead update handler
  const handleLeadUpdate = async (updatedData: Partial<Lead>) => {
    const { id, ...updateData } = updatedData;
    if (!id) return;
    
    try {
      // Database update first
      const supabase = createClient();
      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", id);

      if (error) {
        console.error("Lead güncelleme hatası:", error);
        throw error;
      }

      // Success: Update local state
      setLeads(prevLeads => 
        prevLeads.map(lead => 
          lead.id === id ? { ...lead, ...updateData } : lead
        )
      );
      
      // Close modal after successful update
      setIsLeadEditOpen(false);
      setEditingLead(null);
      
    } catch (error) {
      console.error("Lead update failed:", error);
      // Don't close modal on error, let user retry
    }
  };

  // Lead delete handler
  const handleLeadDelete = async (leadId: string) => {
    // Optimistic update
    const deletedLead = leads.find(lead => lead.id === leadId);
    setLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId));
    setIsLeadEditOpen(false);
    setEditingLead(null);
    
    // Lead sayısını güncelle
    if (deletedLead?.pipeline_id) {
      setPipelineLeadCounts(prev => ({
        ...prev,
        [deletedLead.pipeline_id!]: Math.max(0, (prev[deletedLead.pipeline_id!] || 0) - 1)
      }));
    }
    
    // Database update
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadId);

    if (error) {
      // Hata olursa lead'i geri ekle
      if (deletedLead) {
        setLeads(prevLeads => [...prevLeads, deletedLead]);
        // Lead sayısını geri al
        if (deletedLead.pipeline_id) {
          setPipelineLeadCounts(prev => ({
            ...prev,
            [deletedLead.pipeline_id!]: (prev[deletedLead.pipeline_id!] || 0) + 1
          }));
        }
      }
      console.error("Lead silme hatası:", error);
      if (activePipeline) {
        await loadStagesAndLeads(activePipeline);
      }
    }
  };

  // Lead create handler
  const handleLeadCreate = async (newLead: Partial<Lead>) => {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from("leads")
      .insert(newLead)
      .select()
      .single();

    if (!error && data) {
      // Başarılı olursa sadece yeni lead'i ekle
      setLeads(prevLeads => [...prevLeads, data]);
      setIsLeadCreateOpen(false);
      
      // Lead sayısını güncelle
      if (data.pipeline_id) {
        setPipelineLeadCounts(prev => ({
          ...prev,
          [data.pipeline_id!]: (prev[data.pipeline_id!] || 0) + 1
        }));
      }
    } else if (error) {
      console.error("Lead oluşturma hatası:", error);
      // Hata durumunda tüm veriyi yeniden yükle
      if (activePipeline) {
        await loadStagesAndLeads(activePipeline);
      }
    }
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;
    
    if (!window.confirm(`${selectedLeads.size} adet lead'i silmek istediğinizden emin misiniz?`)) return;
    
    const selectedIds = Array.from(selectedLeads);
    
    // Optimistic update
    const deletedLeads = leads.filter(lead => selectedIds.includes(lead.id));
    setLeads(prevLeads => prevLeads.filter(lead => !selectedIds.includes(lead.id)));
    setSelectedLeads(new Set());
    
    // Lead sayılarını güncelle
    const pipelineCounts: { [key: string]: number } = {};
    deletedLeads.forEach(lead => {
      if (lead.pipeline_id) {
        pipelineCounts[lead.pipeline_id] = (pipelineCounts[lead.pipeline_id] || 0) + 1;
      }
    });
    
    setPipelineLeadCounts(prev => {
      const newCounts = { ...prev };
      Object.entries(pipelineCounts).forEach(([pipelineId, count]) => {
        newCounts[pipelineId] = Math.max(0, (newCounts[pipelineId] || 0) - count);
      });
      return newCounts;
    });
    
    // Database update
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", selectedIds);

    if (error) {
      // Hata olursa lead'leri geri ekle
      setLeads(prevLeads => [...prevLeads, ...deletedLeads]);
      setSelectedLeads(new Set(selectedIds));
      
      // Lead sayılarını geri al
      setPipelineLeadCounts(prev => {
        const newCounts = { ...prev };
        Object.entries(pipelineCounts).forEach(([pipelineId, count]) => {
          newCounts[pipelineId] = (newCounts[pipelineId] || 0) + count;
        });
        return newCounts;
      });
      
      console.error("Bulk delete hatası:", error);
      if (activePipeline) {
        await loadStagesAndLeads(activePipeline);
      }
    }
  };

  const handleBulkMove = async (targetStageId: string) => {
    if (selectedLeads.size === 0) return;
    
    const selectedIds = Array.from(selectedLeads);
    
    // Optimistic update
    setLeads(prevLeads => 
      prevLeads.map(lead => 
        selectedIds.includes(lead.id) 
          ? { ...lead, stage_id: targetStageId }
          : lead
      )
    );
    setSelectedLeads(new Set());
    
    // Database update
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ stage_id: targetStageId })
      .in("id", selectedIds);

    if (error) {
      // Hata olursa verileri yeniden yükle
      console.error("Bulk move hatası:", error);
      if (activePipeline) {
        await loadStagesAndLeads(activePipeline);
      }
    }
  };

  // Pipeline arşivleme/aktif etme
  const handlePipelineArchiveToggle = async (pipelineId: string, currentStatus: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("pipelines")
      .update({ is_active: !currentStatus })
      .eq("id", pipelineId);

    if (!error) {
      await loadPipelineData();
      
      // Eğer arşivlenen pipeline aktif ise, başka bir aktif pipeline seç
      if (pipelineId === activePipeline && currentStatus) {
        const activePipelines = pipelines.filter(p => p.id !== pipelineId && p.is_active !== false);
        if (activePipelines.length > 0) {
          setActivePipeline(activePipelines[0].id);
        } else {
          setActivePipeline(null);
        }
      }
    }
  };

  // Mobile: Quick stage change handler
  const handleQuickStageChange = async (leadId: string, stageId: string) => {
    const originalLead = leads.find(l => l.id === leadId);
    if (!originalLead) return;

    // Optimistic update
    setLeads(prevLeads =>
      prevLeads.map(lead =>
        lead.id === leadId ? { ...lead, stage_id: stageId } : lead
      )
    );
    
    // Haptic feedback
    triggerHaptic('medium');
    
    // Database update
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ stage_id: stageId })
      .eq("id", leadId);

    if (error) {
      // Revert on error
      setLeads(prevLeads =>
        prevLeads.map(lead =>
          lead.id === leadId ? originalLead : lead
        )
      );
      console.error("Stage change error:", error);
    }
  };

  // Mobile: Initialize active stage
  React.useEffect(() => {
    if (isMobile && stages.length > 0 && !mobileActiveStage) {
      const activeStages = stages
        .filter(s => s.pipeline_id === activePipeline)
        .sort((a, b) => a.order_position - b.order_position);
      if (activeStages.length > 0) {
        setMobileActiveStage(activeStages[0].id);
      }
    }
  }, [isMobile, stages, activePipeline, mobileActiveStage]);

  // Mobile: Stage lead counts helper
  const getStageLeadCounts = () => {
    const counts: Record<string, number> = {};
    stages.forEach(stage => {
      counts[stage.id] = filteredLeads.filter(lead => lead.stage_id === stage.id).length;
    });
    return counts;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Pipeline'lar yükleniyor...</p>
      </div>
    );
  }

  const activePipelineData = pipelines.find(p => p.id === activePipeline);

  return (
    <div className="container mx-auto py-4 px-4 md:py-8 md:px-6">
      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">Pipeline Yönetimi</h1>
        </div>
        
        <div className="flex gap-2">
          {activePipeline && (
            <Button onClick={() => setIsLeadCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Lead
            </Button>
          )}
          
          <Dialog open={isPipelineModalOpen} onOpenChange={setIsPipelineModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Yeni Pipeline
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Pipeline (Şehir) Ekle</DialogTitle>
                <DialogDescription>
                  Yeni bir şehir veya bölge için pipeline oluşturun.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="pipelineName">Pipeline Adı *</Label>
                  <Input
                    id="pipelineName"
                    value={newPipelineName}
                    onChange={(e) => setNewPipelineName(e.target.value)}
                    placeholder="Örn: İstanbul, Ankara, İzmir"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pipelineDesc">Açıklama (Opsiyonel)</Label>
                  <Textarea
                    id="pipelineDesc"
                    value={newPipelineDescription}
                    onChange={(e) => setNewPipelineDescription(e.target.value)}
                    placeholder="Örn: Avrupa yakası müşterileri"
                    disabled={isSubmitting}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isSubmitting}>İptal</Button>
                </DialogClose>
                <Button onClick={handleCreatePipeline} disabled={isSubmitting || !newPipelineName.trim()}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Oluşturuluyor...
                    </>
                  ) : (
                    'Oluştur'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {activePipeline && (
            <Dialog open={isStageModalOpen} onOpenChange={(open) => {
              setIsStageModalOpen(open);
              if (!open) resetStageForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Aşama
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingStage ? "Aşamayı Düzenle" : "Yeni Aşama Ekle"}
                  </DialogTitle>
                  <DialogDescription>
                    {activePipelineData?.name} pipeline'ına aşama ekleyin.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="stageName">Aşama Adı *</Label>
                    <Input
                      id="stageName"
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      placeholder="Örn: Qualified, Incoming, Final Call"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Renk</Label>
                    <div className="grid grid-cols-6 gap-2">
                      {stageColors.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setNewStageColor(color.value)}
                          className={`h-8 w-full rounded border-2 transition-all ${
                            newStageColor === color.value ? 'border-gray-900 scale-110' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                          disabled={isSubmitting}
                        />
                      ))}
                    </div>
                  </div>
                  {!editingStage && (
                    <div className="space-y-2">
                      <Label htmlFor="stagePosition">Pozisyon (Opsiyonel)</Label>
                      <Input
                        id="stagePosition"
                        type="number"
                        value={newStagePosition}
                        onChange={(e) => setNewStagePosition(e.target.value)}
                        placeholder="Boş bırakırsanız sona eklenir"
                        min="1"
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={isSubmitting}>İptal</Button>
                  </DialogClose>
                  <Button onClick={handleSaveStage} disabled={isSubmitting || !newStageName.trim()}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingStage ? "Güncelleniyor..." : "Oluşturuluyor..."}
                      </>
                    ) : (
                      editingStage ? "Güncelle" : "Oluştur"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Mobile Header */}
      <div className="md:hidden mb-4">
        <h1 className="text-2xl font-bold mb-2">Pipeline Yönetimi</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{activePipelineData?.name || 'Pipeline seçin'}</span>
        </div>
      </div>

      {/* Mobile Pipeline Selection */}
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

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 border border-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Pipeline Cards */}
      {pipelines.length > 0 ? (
        <div className="space-y-6">
          {/* Pipeline Tabs */}
          <Tabs value={pipelineTab} onValueChange={(value) => setPipelineTab(value as "active" | "archived")}>
            <TabsList className="grid w-[200px] grid-cols-2">
              <TabsTrigger value="active">Aktif</TabsTrigger>
              <TabsTrigger value="archived">Geçmiş</TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pipelines
                  .filter(pipeline => pipeline.is_active !== false)
                  .map((pipeline) => (
                    <PipelineCard
                      key={pipeline.id}
                      pipeline={pipeline}
                      isActive={pipeline.id === activePipeline}
                      onClick={() => setActivePipeline(pipeline.id)}
                      leadCount={pipelineLeadCounts[pipeline.id] || 0}
                      onArchiveToggle={handlePipelineArchiveToggle}
                    />
                  ))}
                {pipelines.filter(p => p.is_active !== false).length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    Aktif pipeline bulunmuyor
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="archived" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pipelines
                  .filter(pipeline => pipeline.is_active === false)
                  .map((pipeline) => (
                    <PipelineCard
                      key={pipeline.id}
                      pipeline={pipeline}
                      isActive={pipeline.id === activePipeline}
                      onClick={() => setActivePipeline(pipeline.id)}
                      leadCount={pipelineLeadCounts[pipeline.id] || 0}
                      onArchiveToggle={handlePipelineArchiveToggle}
                    />
                  ))}
                {pipelines.filter(p => p.is_active === false).length === 0 && (
                  <div className="col-span-full text-center text-muted-foreground py-8">
                    Geçmiş pipeline bulunmuyor
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Aktif Pipeline Stage'leri */}
          {activePipeline && (
            <div>
              {/* Filters and Bulk Actions - Desktop Only */}
              {!isMobile && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4 space-y-4">
                  {/* Search and Filters */}
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Label htmlFor="search">Ara</Label>
                      <Input
                        id="search"
                        placeholder="İsim, telefon, email veya şirket..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="priority">Öncelik</Label>
                      <select
                        id="priority"
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Tümü</option>
                        <option value="high">Yüksek</option>
                        <option value="medium">Orta</option>
                        <option value="low">Düşük</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label htmlFor="startDate">Başlangıç</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={filterDateRange.start}
                        onChange={(e) => setFilterDateRange({ ...filterDateRange, start: e.target.value })}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="endDate">Bitiş</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={filterDateRange.end}
                        onChange={(e) => setFilterDateRange({ ...filterDateRange, end: e.target.value })}
                      />
                    </div>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchQuery("");
                        setFilterPriority("");
                        setFilterDateRange({ start: '', end: '' });
                      }}
                    >
                      Temizle
                    </Button>
                  </div>
                
                  {/* Bulk Actions */}
                  {selectedLeads.size > 0 && (
                    <div className="flex items-center gap-4 pt-2 border-t">
                      <span className="text-sm text-muted-foreground">
                        {selectedLeads.size} lead seçildi
                      </span>
                      
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleBulkMove(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="text-sm rounded-md border px-3 py-1"
                      >
                        <option value="">Taşı...</option>
                        {stages
                          .filter(s => s.pipeline_id === activePipeline)
                          .map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
                            </option>
                          ))}
                      </select>
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleBulkDelete}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Sil
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLeads(new Set())}
                      >
                        Seçimi Temizle
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {!isMobile && (
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-semibold">{activePipelineData?.name} Aşamaları</h2>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                  <span className="text-muted-foreground">
                    {stages.filter(s => s.pipeline_id === activePipeline).length} aşama, {filteredLeads.length} lead
                    {searchQuery || filterPriority || filterDateRange.start || filterDateRange.end ? ' (filtrelenmiş)' : ''}
                  </span>
                  
                  {filteredLeads.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSelectAll}
                      className="ml-auto"
                    >
                      {selectedLeads.size === filteredLeads.length ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                    </Button>
                  )}
                </div>
              )}

              {/* Mobile Stage Navigation */}
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
                                onMessage={() => {
                                  router.push(`/messaging?leadId=${lead.id}`);
                                }}
                                onEdit={() => {
                                  setEditingLead(lead);
                                  setIsLeadEditOpen(true);
                                }}
                                onEmail={lead.contact_email ? () => {
                                  window.location.href = `mailto:${lead.contact_email}`;
                                } : undefined}
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

              {/* Desktop Stage View */}
              {!isMobile && (
                <DragDropContext onDragEnd={handleDragEnd}>
                <div className="overflow-x-auto pb-4">
                  <div className="flex gap-4 min-w-max">
                    {stages
                      .filter(stage => stage.pipeline_id === activePipeline)
                      .sort((a, b) => a.order_position - b.order_position)
                      .map((stage) => {
                        const stageLeads = filteredLeads.filter(lead => lead.stage_id === stage.id);
                        return (
                          <StageColumn
                            key={stage.id}
                            stage={stage}
                            leads={stageLeads}
                            isHidden={stage.is_hidden || false}
                            onToggleVisibility={() => toggleStageVisibility(stage.id, stage.is_hidden || false)}
                            onEditStage={() => {
                              setEditingStage(stage);
                              setNewStageName(stage.name);
                              setNewStageColor(stage.color || "#3B82F6");
                              setIsStageModalOpen(true);
                            }}
                            onDeleteStage={() => deleteStage(stage.id)}
                            onLeadDetail={(lead) => {
                              setSelectedLead(lead);
                              setIsLeadDetailOpen(true);
                            }}
                            onLeadEdit={(lead) => {
                              setEditingLead(lead);
                              setIsLeadEditOpen(true);
                            }}
                            selectedLeads={selectedLeads}
                            onLeadSelect={handleLeadSelect}
                          />
                        );
                      })}
                    
                    {stages.filter(s => s.pipeline_id === activePipeline).length === 0 && (
                      <div className="text-center text-gray-500 py-16 px-6 border border-dashed rounded-lg w-full">
                        <Settings size={48} className="mx-auto mb-4 text-gray-400" />
                        <h2 className="text-xl font-semibold mb-2">Henüz Aşama Yok</h2>
                        <p className="text-base mb-6">Bu pipeline için aşama oluşturun.</p>
                        <Button onClick={() => setIsStageModalOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          İlk Aşamayı Ekle
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </DragDropContext>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-16 px-6 border border-dashed rounded-lg">
          <MapPin size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold mb-2">Henüz Pipeline Yok</h2>
          <p className="text-base mb-6">İlk pipeline'ınızı (şehir/bölge) oluşturun.</p>
          <Button onClick={() => setIsPipelineModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            İlk Pipeline'ı Oluştur
          </Button>
        </div>
      )}
      
      {/* Lead Detail Dialog */}
      <LeadDetailDialog 
        lead={selectedLead}
        isOpen={isLeadDetailOpen}
        onClose={() => {
          setIsLeadDetailOpen(false);
          setSelectedLead(null);
        }}
        pipelines={pipelines}
        stages={stages}
        onEdit={(lead) => {
          setEditingLead(lead);
          setIsLeadEditOpen(true);
        }}
      />
      
      {/* Lead Edit Dialog */}
      <LeadEditDialog
        lead={editingLead}
        isOpen={isLeadEditOpen}
        onClose={() => {
          setIsLeadEditOpen(false);
          setEditingLead(null);
        }}
        pipelines={pipelines}
        stages={stages}
        onSave={handleLeadUpdate}
        onDelete={handleLeadDelete}
      />
      
      {/* Lead Create Dialog */}
      <LeadCreateDialog
        isOpen={isLeadCreateOpen}
        onClose={() => setIsLeadCreateOpen(false)}
        pipelines={pipelines}
        stages={stages}
        defaultPipelineId={activePipeline}
        onSave={handleLeadCreate}
      />

      {/* Mobile Quick Edit Modal */}
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

      {/* Mobile FAB */}
      <FloatingActionButton
        onNewLead={activePipeline ? () => setIsLeadCreateOpen(true) : undefined}
        onNewStage={activePipeline ? () => setIsStageModalOpen(true) : undefined}
        onNewPipeline={() => setIsPipelineModalOpen(true)}
      />
    </div>
  );
}