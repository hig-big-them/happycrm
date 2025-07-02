"use client";

import * as React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "../../components/ui/dialog";
import { Checkbox } from "../../components/ui/checkbox";
import { Textarea } from "../../components/ui/textarea";
import { Separator } from "../../components/ui/separator";
import { createClient } from "../../lib/supabase/client";
import { 
  PlusCircle, 
  Loader2, 
  Users, 
  Building, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Target, 
  Clock,
  Search,
  Filter,
  Download,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal
} from "lucide-react";
import { useRouter } from "next/navigation";

// Veri tipleri
interface Stage {
  id: string;
  name: string;
  order_position: number;
  color?: string | null;
  pipeline_id?: string | null;
}

interface Company {
  id: string;
  company_name: string;
}

interface Pipeline {
  id: string;
  name: string;
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
  company?: Company | null;
  stage?: Stage | null;
  pipeline?: Pipeline | null;
}

// Priority renkleri
const getPriorityColor = (priority: string | null) => {
  switch (priority?.toLowerCase()) {
    case 'yüksek':
    case 'high':
      return 'destructive';
    case 'orta':
    case 'medium':
      return 'warning';
    case 'düşük':
    case 'low':
      return 'success';
    default:
      return 'secondary';
  }
};

// Lead Detay Modalı - Pipeline'daki gibi
function LeadDetailModal({ 
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
                <Users className="h-4 w-4 text-muted-foreground" />
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
              <Target className="h-4 w-4 text-muted-foreground" />
              <span>
                {pipeline?.name || 'Belirtilmemiş'} 
                {stage && (
                  <>
                    <ChevronRight className="h-4 w-4 inline mx-1 text-muted-foreground" />
                    <Badge 
                      style={{ backgroundColor: stage.color || '#3B82F6' }}
                      className="text-white"
                    >
                      {stage.name}
                    </Badge>
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

// Lead Edit Dialog - Pipeline'daki gibi
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
  onSave: (updatedLead: Lead) => Promise<void>;
  onDelete: (leadId: string) => Promise<void>;
}) {
  const [formData, setFormData] = React.useState({
    lead_name: '',
    contact_phone: '',
    contact_email: '',
    pipeline_id: '',
    stage_id: '',
    event_date: '',
    event_time: '',
    priority: 'medium',
    lead_value: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [filteredStages, setFilteredStages] = React.useState<Stage[]>([]);

  React.useEffect(() => {
    if (lead) {
      setFormData({
        lead_name: lead.lead_name || '',
        contact_phone: lead.contact_phone || '',
        contact_email: lead.contact_email || '',
        pipeline_id: lead.pipeline_id || '',
        stage_id: lead.stage_id || '',
        event_date: lead.event_date || '',
        event_time: lead.event_time || '',
        priority: lead.priority || 'medium',
        lead_value: lead.lead_value?.toString() || '',
        description: lead.description || ''
      });
    }
  }, [lead]);

  React.useEffect(() => {
    if (formData.pipeline_id) {
      const filtered = stages.filter(s => s.pipeline_id === formData.pipeline_id);
      setFilteredStages(filtered);
    } else {
      setFilteredStages([]);
    }
  }, [formData.pipeline_id, stages]);

  const handleSubmit = async () => {
    if (!lead || !formData.lead_name.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSave({
        ...lead,
        ...formData,
        lead_value: formData.lead_value ? parseFloat(formData.lead_value) : null
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
              <Select
                value={formData.pipeline_id}
                onValueChange={(value) => setFormData({ ...formData, pipeline_id: value, stage_id: '' })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="pipeline_id">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage_id">Stage</Label>
              <Select
                value={formData.stage_id}
                onValueChange={(value) => setFormData({ ...formData, stage_id: value })}
                disabled={isSubmitting || !formData.pipeline_id}
              >
                <SelectTrigger id="stage_id">
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Sil
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

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = React.useState<Lead[]>([]);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = React.useState<string | undefined>(undefined);

  // Filtreleme ve arama state'leri
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedPipeline, setSelectedPipeline] = React.useState<string>("all");
  const [selectedStage, setSelectedStage] = React.useState<string>("all");
  const [selectedPriority, setSelectedPriority] = React.useState<string>("all");
  const [selectedCompany, setSelectedCompany] = React.useState<string>("all");
  
  // Sayfalama
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage] = React.useState(20);
  
  // Seçim ve detay
  const [selectedLeads, setSelectedLeads] = React.useState<string[]>([]);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [editingLead, setEditingLead] = React.useState<Lead | null>(null);

  async function getCurrentUserRole() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserRole(user?.app_metadata?.role);
  }

  async function fetchData() {
    const supabase = createClient();
    
    try {
      // Tüm verileri paralel olarak çek
      const [leadsResponse, stagesResponse, pipelinesResponse, companiesResponse] = await Promise.all([
        supabase
          .from("leads")
          .select(`
            *,
            company:companies(id, company_name),
            stage:stages(id, name, color),
            pipeline:pipelines(id, name)
          `)
          .order("created_at", { ascending: false }),
        
        supabase
          .from("stages")
          .select("*")
          .order("order_position"),
          
        supabase
          .from("pipelines")
          .select("*")
          .eq("is_active", true)
          .order("name"),
          
        supabase
          .from("companies")
          .select("id, company_name")
          .eq("is_active", true)
          .order("company_name")
      ]);

      if (leadsResponse.error) throw leadsResponse.error;
      if (stagesResponse.error) throw stagesResponse.error;
      if (pipelinesResponse.error) throw pipelinesResponse.error;
      if (companiesResponse.error) throw companiesResponse.error;

      setLeads(leadsResponse.data || []);
      setFilteredLeads(leadsResponse.data || []);
      setStages(stagesResponse.data || []);
      setPipelines(pipelinesResponse.data || []);
      setCompanies(companiesResponse.data || []);
      
    } catch (err) {
      const error = err as Error;
      console.error("Veri çekme hatası:", error);
      setError("Veriler yüklenirken hata oluştu: " + error.message);
    }
  }

  React.useEffect(() => {
    async function init() {
      setIsLoading(true);
      await getCurrentUserRole();
      await fetchData();
      setIsLoading(false);
    }
    init();
  }, []);

  // Filtreleme logic'i
  React.useEffect(() => {
    let filtered = [...leads];
    
    // Arama
    if (searchTerm) {
      filtered = filtered.filter(lead => 
        lead.lead_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_phone?.includes(searchTerm) ||
        lead.company?.company_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Pipeline filtresi
    if (selectedPipeline !== "all") {
      filtered = filtered.filter(lead => lead.pipeline_id === selectedPipeline);
    }
    
    // Stage filtresi
    if (selectedStage !== "all") {
      filtered = filtered.filter(lead => lead.stage_id === selectedStage);
    }
    
    // Priority filtresi
    if (selectedPriority !== "all") {
      filtered = filtered.filter(lead => lead.priority === selectedPriority);
    }
    
    // Company filtresi
    if (selectedCompany !== "all") {
      filtered = filtered.filter(lead => lead.company_id === selectedCompany);
    }
    
    setFilteredLeads(filtered);
    setCurrentPage(1);
  }, [searchTerm, selectedPipeline, selectedStage, selectedPriority, selectedCompany, leads]);

  // Sayfalama hesaplamaları
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentLeads = filteredLeads.slice(startIndex, endIndex);

  // Toplu seçim
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(currentLeads.map(lead => lead.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, leadId]);
    } else {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    }
  };

  // Lead detayını görüntüle
  const handleViewLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDetailModalOpen(true);
  };

  // Lead düzenleme
  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setIsEditModalOpen(true);
  };

  // Lead güncelleme
  const handleUpdateLead = async (updatedLead: Lead) => {
    const supabase = createClient();
    const { id, company, stage, pipeline, ...updateData } = updatedLead;
    
    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id);
      
    if (!error) {
      await fetchData();
      setEditingLead(null);
      setIsEditModalOpen(false);
    }
  };

  // Lead silme
  const handleDeleteLead = async (leadId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", leadId);
      
    if (!error) {
      await fetchData();
      setEditingLead(null);
      setIsEditModalOpen(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('tr-TR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(new Date(dateString));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Müşteri adayları yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Müşteri Adayları</h1>
          <p className="text-muted-foreground">
            Toplam {filteredLeads.length} lead • {selectedLeads.length} seçili
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" disabled={selectedLeads.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Dışa Aktar ({selectedLeads.length})
          </Button>
          {currentUserRole === 'superuser' && (
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Yeni Lead
            </Button>
          )}
        </div>
      </div>

      {/* Filtreler */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Arama */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Lead ara (isim, email, telefon, şirket)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Pipeline Filtresi */}
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger>
                <SelectValue placeholder="Tüm Pipeline'lar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Pipeline'lar</SelectItem>
                {pipelines.map(pipeline => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Stage Filtresi */}
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Tüm Aşamalar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Aşamalar</SelectItem>
                {stages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color || '#6B7280' }}
                      />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Öncelik Filtresi */}
            <Select value={selectedPriority} onValueChange={setSelectedPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Tüm Öncelikler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Öncelikler</SelectItem>
                <SelectItem value="Yüksek">Yüksek</SelectItem>
                <SelectItem value="Orta">Orta</SelectItem>
                <SelectItem value="Düşük">Düşük</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 border border-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Leads Tablosu */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6">
                <Checkbox 
                  checked={currentLeads.length > 0 && selectedLeads.length === currentLeads.length}
                  onCheckedChange={handleSelectAll}
                  className="h-2.5 w-2.5"
                />
              </TableHead>
              <TableHead>Lead Adı</TableHead>
              <TableHead>Pipeline</TableHead>
              <TableHead>Aşama</TableHead>
              <TableHead>Değer</TableHead>
              <TableHead>Öncelik</TableHead>
              <TableHead>Takip Tarihi</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentLeads.map((lead) => (
              <TableRow key={lead.id} className="hover:bg-gray-50">
                <TableCell>
                  <Checkbox 
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                    className="h-2.5 w-2.5"
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{lead.lead_name}</p>
                    <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                      {lead.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.contact_email}
                        </span>
                      )}
                      {lead.contact_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.contact_phone}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{lead.pipeline?.name || '-'}</TableCell>
                <TableCell>
                  {lead.stage && (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: lead.stage.color || '#6B7280' }}
                      />
                      <span className="text-sm">{lead.stage.name}</span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium text-green-600">
                  {formatCurrency(lead.lead_value)}
                </TableCell>
                <TableCell>
                  {lead.priority && (
                    <Badge variant={getPriorityColor(lead.priority)}>
                      {lead.priority}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{formatDate(lead.follow_up_date)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => handleViewLead(lead)}
                    >
                      <Eye className="h-3 w-3 text-gray-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {currentLeads.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Kriterlere uygun lead bulunamadı</p>
          </div>
        )}
      </Card>

      {/* Sayfalama */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            {startIndex + 1} - {Math.min(endIndex, filteredLeads.length)} / {filteredLeads.length} lead gösteriliyor
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Önceki
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1;
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            {totalPages > 5 && <span className="px-2">...</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Lead Detay Modalı */}
      <LeadDetailModal 
        lead={selectedLead} 
        isOpen={isDetailModalOpen} 
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLead(null);
        }}
        pipelines={pipelines}
        stages={stages}
        onEdit={handleEditLead}
      />

      {/* Lead Edit Modalı */}
      <LeadEditDialog
        lead={editingLead}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLead(null);
        }}
        pipelines={pipelines}
        stages={stages}
        onSave={handleUpdateLead}
        onDelete={handleDeleteLead}
      />
    </div>
  );
}