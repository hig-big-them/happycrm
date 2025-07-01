"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  Trash2, 
  Edit3, 
  CheckSquare, 
  Square, 
  AlertCircle,
  Filter,
  Search,
  RotateCcw
} from "lucide-react";
import { bulkDeleteTransfers, bulkUpdateTransfers } from "@/lib/actions/agency-transfer-actions";
import { formatDateTime } from "@/lib/utils/date";
import CountdownTimer from "@/components/countdown-timer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Transfer {
  id: string;
  title: string;
  patient_name: string;
  transfer_datetime: string;
  deadline_datetime: string;
  status: string;
  priority: number;
  routes?: { id: string; name: string };
  location_from?: { id: string; name: string };
  location_to?: { id: string; name: string };
  agencies?: { id: string; name: string };
  assigned_officer?: { id: string; username: string };
}

interface BulkTransferManagerProps {
  transfers: Transfer[];
  onRefresh?: () => void;
  allowDelete?: boolean;
}

const statusOptions = [
  { value: 'pending', label: 'Beklemede', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'driver_assigned', label: 'Sürücü Atandı', color: 'bg-blue-100 text-blue-800' },
  { value: 'patient_picked_up', label: 'Hasta Alındı', color: 'bg-green-100 text-green-800' },
  { value: 'completed', label: 'Tamamlandı', color: 'bg-gray-100 text-gray-800' },
  { value: 'delayed', label: 'Gecikti', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'İptal Edildi', color: 'bg-gray-100 text-gray-600' }
];

export function BulkTransferManager({ 
  transfers: initialTransfers, 
  onRefresh,
  allowDelete = true 
}: BulkTransferManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [transfers, setTransfers] = useState<Transfer[]>(initialTransfers);
  const [filteredTransfers, setFilteredTransfers] = useState<Transfer[]>(initialTransfers);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkPriority, setBulkPriority] = useState<string>("");
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Update transfers when props change
  useEffect(() => {
    setTransfers(initialTransfers);
    setFilteredTransfers(initialTransfers);
  }, [initialTransfers]);

  // Apply filters
  useEffect(() => {
    let filtered = transfers;
    
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(transfer => 
        transfer.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transfer.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transfer.routes?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(transfer => transfer.status === statusFilter);
    }
    
    setFilteredTransfers(filtered);
  }, [transfers, searchQuery, statusFilter]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredTransfers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransfers.map(t => t.id)));
    }
  }, [selectedIds, filteredTransfers]);

  const handleSelectOne = useCallback((id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }, [selectedIds]);

  const handleBulkDelete = async () => {
    console.log('🗑️ [BULK-DELETE] Starting bulk delete...', {
      selectedCount: selectedIds.size,
      selectedIds: Array.from(selectedIds)
    });
    
    if (selectedIds.size === 0) {
      console.log('⚠️ [BULK-DELETE] No items selected, returning early');
      return;
    }
    
    setIsProcessing(true);
    try {
      console.log('🔄 [BULK-DELETE] Calling bulkDeleteTransfers action...');
      const result = await bulkDeleteTransfers({ 
        transferIds: Array.from(selectedIds) 
      });
      
      console.log('📊 [BULK-DELETE] Action result:', {
        success: result?.data?.success,
        error: result?.data?.error,
        serverError: result?.serverError,
        validationErrors: result?.validationErrors,
        fullResult: result
      });
      
      // Check for success in the data property
      if (result?.data?.success) {
        console.log('✅ [BULK-DELETE] Delete successful');
        const message = result.data.message || `${selectedIds.size} transfer silindi`;
        toast.success(message);
        setSelectedIds(new Set());
        if (onRefresh) {
          console.log('🔄 [BULK-DELETE] Calling onRefresh...');
          onRefresh();
        }
      } else {
        // Handle errors from data property or server errors
        const errorMessage = result?.data?.error || result?.serverError || "Silme işlemi başarısız";
        console.log('❌ [BULK-DELETE] Delete failed:', errorMessage);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('💥 [BULK-DELETE] Exception caught:', error);
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      console.log('🏁 [BULK-DELETE] Cleanup - setting processing false');
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    
    const updates: any = {};
    if (bulkStatus) updates.status = bulkStatus;
    if (bulkPriority) updates.priority = parseInt(bulkPriority);
    
    if (Object.keys(updates).length === 0) {
      toast.error("En az bir güncelleme seçilmeli");
      return;
    }
    
    setIsProcessing(true);
    try {
      const result = await bulkUpdateTransfers({ 
        transferIds: Array.from(selectedIds),
        updates
      });
      
      if (result?.success) {
        toast.success(result.message || `${selectedIds.size} transfer güncellendi`);
        setSelectedIds(new Set());
        setBulkStatus("");
        setBulkPriority("");
        if (onRefresh) onRefresh();
      } else {
        toast.error(result?.error || "Güncelleme işlemi başarısız");
      }
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error("Beklenmeyen bir hata oluştu");
    } finally {
      setIsProcessing(false);
      setShowBulkEditDialog(false);
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Toplu Transfer Yönetimi</CardTitle>
          <CardDescription>
            Birden fazla transferi seçerek toplu işlem yapabilirsiniz
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Hasta adı veya başlık ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Durum filtresi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Filtreleri Temizle
            </Button>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedIds.size === filteredTransfers.length ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Seçimi Kaldır
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Tümünü Seç
                  </>
                )}
              </Button>
              
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} transfer seçildi
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                  >
                    Temizle
                  </Button>
                </>
              )}
            </div>

            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkEditDialog(true)}
                  disabled={isProcessing}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Toplu Düzenle
                </Button>
                
                {allowDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isProcessing}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Toplu Sil ({selectedIds.size})
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transfer List */}
      <div className="space-y-2">
        {filteredTransfers.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all' 
                  ? "Filtrelere uygun transfer bulunamadı" 
                  : "Henüz transfer bulunmamaktadır"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredTransfers.map((transfer) => (
            <TransferBulkItem
              key={transfer.id}
              transfer={transfer}
              selected={selectedIds.has(transfer.id)}
              onSelect={() => handleSelectOne(transfer.id)}
            />
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Transfer Silme Onayı
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedIds.size}</strong> adet transfer kalıcı olarak silinecektir. 
              Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? "Siliniyor..." : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Edit Dialog */}
      <AlertDialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Toplu Düzenleme</AlertDialogTitle>
            <AlertDialogDescription>
              Seçili {selectedIds.size} transfer için yapılacak değişiklikleri belirtin
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Durum Güncelle</label>
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Durum seçin (isteğe bağlı)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Değiştirme</SelectItem>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Öncelik Güncelle</label>
              <Select value={bulkPriority} onValueChange={setBulkPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Öncelik seçin (isteğe bağlı)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Değiştirme</SelectItem>
                  {[...Array(11)].map((_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i} {i > 5 ? '(Yüksek)' : i > 3 ? '(Orta)' : '(Düşük)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkUpdate}
              disabled={isProcessing || (!bulkStatus && !bulkPriority)}
            >
              {isProcessing ? "Güncelleniyor..." : "Güncelle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Individual Transfer Item Component
function TransferBulkItem({ 
  transfer, 
  selected, 
  onSelect 
}: { 
  transfer: Transfer; 
  selected: boolean;
  onSelect: () => void;
}) {
  const statusConfig = statusOptions.find(s => s.value === transfer.status);
  const isOverdue = new Date() > new Date(transfer.deadline_datetime) && 
    !['patient_picked_up', 'completed', 'cancelled'].includes(transfer.status);

  return (
    <Card className={`transition-colors ${selected ? 'border-primary' : ''} ${isOverdue ? 'border-red-400' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className="mt-1"
          />
          
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{transfer.patient_name}</h4>
                <p className="text-sm text-muted-foreground">{transfer.title}</p>
              </div>
              <div className="flex items-center gap-2">
                {statusConfig && (
                  <Badge className={statusConfig.color}>
                    {statusConfig.label}
                  </Badge>
                )}
                {transfer.priority > 5 && (
                  <Badge variant="destructive">Öncelik: {transfer.priority}</Badge>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div>
                <span className="font-medium">Rota:</span> {transfer.routes?.name || '-'}
              </div>
              <div>
                <span className="font-medium">Transfer:</span> {formatDateTime(transfer.transfer_datetime)}
              </div>
              <div>
                <span className="font-medium">Nereden:</span> {transfer.location_from?.name || '-'}
              </div>
              <div>
                <span className="font-medium">Nereye:</span> {transfer.location_to?.name || '-'}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Deadline:</span> {formatDateTime(transfer.deadline_datetime)}
              </div>
              <CountdownTimer 
                deadline={transfer.deadline_datetime}
                showExpiredMessage={true}
                className={isOverdue ? 'text-red-600 font-bold' : ''}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}