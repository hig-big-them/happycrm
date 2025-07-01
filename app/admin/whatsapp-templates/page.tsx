/**
 * 📱 Admin - WhatsApp Template Yönetimi
 * 
 * WhatsApp Cloud API template'leri oluştur, düzenle ve yönet
 */

"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTable } from '@/components/ui/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  Edit,
  Trash,
  Eye,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Download,
  Upload,
  MessageSquare,
  Settings,
  Globe,
  Filter,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
// import { TemplateBuilder } from '@/components/messaging/template-builder'; // Geçici olarak kapalı
import { createWhatsAppService } from '@/lib/services/whatsapp-cloud-service';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
  components: any[];
  created_at: string;
  updated_at: string;
  approved_at?: string;
  rejected_reason?: string;
  usage_count: number;
  delivery_rate: number;
  read_rate: number;
  click_rate: number;
  cost_per_message: number;
}

export default function WhatsAppTemplatesPage() {
  const router = useRouter();
  const supabase = createClient();
  const whatsappService = createWhatsAppService();
  
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [stats, setStats] = useState({
    total_templates: 0,
    approved_templates: 0,
    pending_templates: 0,
    total_sent: 0,
    avg_delivery_rate: 0,
    avg_read_rate: 0
  });

  useEffect(() => {
    loadTemplates();
    loadStats();
  }, [statusFilter, categoryFilter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      
      // Geçici mock data
      const mockTemplates = [
        {
          id: '1',
          name: 'Hoş Geldin Mesajı',
          category: 'UTILITY',
          language: 'tr',
          status: 'APPROVED',
          components: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 150,
          delivery_rate: 0.95,
          read_rate: 0.78,
          click_rate: 0.12,
          cost_per_message: 0.05
        },
        {
          id: '2',
          name: 'Randevu Hatırlatma',
          category: 'MARKETING',
          language: 'tr',
          status: 'PENDING',
          components: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usage_count: 89,
          delivery_rate: 0.92,
          read_rate: 0.85,
          click_rate: 0.18,
          cost_per_message: 0.08
        }
      ];
      
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: "Hata",
        description: "Template'ler yüklenirken hata oluştu",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Mock stats
      setStats({
        total_templates: 2,
        approved_templates: 1,
        pending_templates: 1,
        total_sent: 239,
        avg_delivery_rate: 0.935,
        avg_read_rate: 0.815
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleDeleteTemplate = async (template: WhatsAppTemplate) => {
    if (!confirm(`"${template.name}" template'ini silmek istediğinize emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Template silindi",
      });

      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Hata",
        description: "Template silinirken hata oluştu",
        variant: "destructive"
      });
    }
  };

  const handleSubmitForApproval = async (template: WhatsAppTemplate) => {
    try {
      // WhatsApp API'ye gönder
      const result = await whatsappService.submitTemplate({
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components
      });

      // Database'de durumu güncelle
      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ 
          status: 'PENDING',
          submitted_at: new Date().toISOString()
        })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Template onay için gönderildi",
      });

      loadTemplates();
    } catch (error) {
      console.error('Error submitting template:', error);
      toast({
        title: "Hata",
        description: "Template gönderilirken hata oluştu",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      DRAFT: { variant: 'secondary' as const, label: 'Taslak', icon: Edit },
      PENDING: { variant: 'default' as const, label: 'Beklemede', icon: Clock },
      APPROVED: { variant: 'success' as const, label: 'Onaylı', icon: CheckCircle },
      REJECTED: { variant: 'destructive' as const, label: 'Reddedildi', icon: XCircle },
      DISABLED: { variant: 'outline' as const, label: 'Devre Dışı', icon: AlertCircle }
    };

    const { variant, label, icon: Icon } = config[status as keyof typeof config] || config.DRAFT;
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      MARKETING: 'bg-blue-500',
      UTILITY: 'bg-green-500',
      AUTHENTICATION: 'bg-purple-500'
    };

    return (
      <Badge variant="outline" className={`${colors[category as keyof typeof colors]} text-white`}>
        {category}
      </Badge>
    );
  };

  // Tablo kolonları
  const columns: ColumnDef<WhatsAppTemplate>[] = [
    {
      accessorKey: 'name',
      header: 'Template Adı',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-sm text-muted-foreground">{row.original.language}</div>
        </div>
      )
    },
    {
      accessorKey: 'category',
      header: 'Kategori',
      cell: ({ row }) => getCategoryBadge(row.original.category)
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ row }) => getStatusBadge(row.original.status)
    },
    {
      accessorKey: 'usage_count',
      header: 'Kullanım',
      cell: ({ row }) => (
        <div className="text-center">
          <div className="font-medium">{row.original.usage_count.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">mesaj</div>
        </div>
      )
    },
    {
      accessorKey: 'delivery_rate',
      header: 'Teslimat Oranı',
      cell: ({ row }) => (
        <div className="text-center">
          <div className="font-medium">{(row.original.delivery_rate * 100).toFixed(1)}%</div>
        </div>
      )
    },
    {
      accessorKey: 'created_at',
      header: 'Oluşturulma',
      cell: ({ row }) => (
        <div className="text-sm">
          {formatDistanceToNow(new Date(row.original.created_at), {
            addSuffix: true,
            locale: tr
          })}
        </div>
      )
    },
    {
      id: 'actions',
      header: 'İşlemler',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSelectedTemplate(row.original)}>
              <Eye className="h-4 w-4 mr-2" />
              Görüntüle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setSelectedTemplate(row.original);
              setIsBuilderOpen(true);
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Düzenle
            </DropdownMenuItem>
            {row.original.status === 'DRAFT' && (
              <DropdownMenuItem onClick={() => handleSubmitForApproval(row.original)}>
                <Send className="h-4 w-4 mr-2" />
                Onaya Gönder
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => handleDeleteTemplate(row.original)}
              className="text-destructive"
            >
              <Trash className="h-4 w-4 mr-2" />
              Sil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">WhatsApp Template Yönetimi</h1>
            <p className="text-muted-foreground">
              WhatsApp Business Cloud API template'lerini oluştur ve yönet
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={loadTemplates}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Yenile
            </Button>
            <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedTemplate(null)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {selectedTemplate ? 'Template Düzenle' : 'Yeni Template Oluştur'}
                  </DialogTitle>
                  <DialogDescription>
                    WhatsApp template'inizi tasarlayın ve önizleme yapın
                  </DialogDescription>
                </DialogHeader>
                <div className="p-8 text-center">
                  <p className="text-muted-foreground">Template Builder yükleniyor...</p>
                  <p className="text-sm text-muted-foreground mt-2">Component import hataları düzeltiliyor.</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total_templates}</div>
            <p className="text-sm text-muted-foreground">Toplam Template</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.approved_templates}</div>
            <p className="text-sm text-muted-foreground">Onaylı</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_templates}</div>
            <p className="text-sm text-muted-foreground">Beklemede</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total_sent.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Gönderilen Mesaj</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{(stats.avg_delivery_rate * 100).toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Ort. Teslimat</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{(stats.avg_read_rate * 100).toFixed(1)}%</div>
            <p className="text-sm text-muted-foreground">Ort. Okunma</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtreler */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Template ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="DRAFT">Taslak</option>
              <option value="PENDING">Beklemede</option>
              <option value="APPROVED">Onaylı</option>
              <option value="REJECTED">Reddedildi</option>
            </select>
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">Tüm Kategoriler</option>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Template Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle>Template'ler</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={templates}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}