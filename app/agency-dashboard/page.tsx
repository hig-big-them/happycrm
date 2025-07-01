"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { TransferStatusCard } from "./components/transfer-status-card";
import { getAgencyTransfers } from "@/lib/actions/agency-transfer-actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";

export default function AgencyDashboardPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [filteredTransfers, setFilteredTransfers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>("Ajans");
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchTransfers = useCallback(async (showRefreshToast = false) => {
    if (!user) return;
    
    try {
      if (showRefreshToast) setIsRefreshing(true);
      
      const result = await getAgencyTransfers({
        status: statusFilter === 'all' ? undefined : statusFilter as any,
        search: searchQuery || undefined,
        limit: 100
      });

      if (result?.success && result.transfers) {
        setTransfers(result.transfers);
        setFilteredTransfers(result.transfers);
        
        // Get agency name from first transfer if available
        if (result.transfers.length > 0 && result.transfers[0].agencies) {
          setAgencyName(result.transfers[0].agencies.name || "Ajans");
        }
        
        if (showRefreshToast) {
          toast.success("Transferler güncellendi");
        }
      } else {
        setError(result?.error || "Transferler yüklenirken hata oluştu");
        if (showRefreshToast) {
          toast.error(result?.error || "Güncelleme başarısız");
        }
      }
    } catch (err) {
      console.error("Fetch transfers error:", err);
      setError("Beklenmeyen bir hata oluştu");
      if (showRefreshToast) {
        toast.error("Beklenmeyen bir hata oluştu");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, statusFilter, searchQuery]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Local filtering
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

  const handleStatusUpdate = (transferId: string, newStatus: string) => {
    // Update local state
    setTransfers(prev => prev.map(t => 
      t.id === transferId ? { ...t, status: newStatus } : t
    ));
  };

  const handleRefresh = () => {
    fetchTransfers(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Transferleriniz yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto py-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{agencyName} Transfer Paneli</h1>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Yenile</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Hasta adı, başlık veya rota ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Durum seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                <SelectItem value="pending">Beklemede</SelectItem>
                <SelectItem value="driver_assigned">Sürücü Atandı</SelectItem>
                <SelectItem value="patient_picked_up">Hasta Alındı</SelectItem>
                <SelectItem value="completed">Tamamlandı</SelectItem>
                <SelectItem value="delayed">Gecikti</SelectItem>
                <SelectItem value="cancelled">İptal Edildi</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground">
                {filteredTransfers.length} transfer gösteriliyor
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <div className="border rounded-lg p-4 min-h-[200px] flex items-center justify-center bg-red-50 border-red-200">
          <p className="text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!error && filteredTransfers.length === 0 && (
        <div className="border rounded-lg p-4 min-h-[200px] flex items-center justify-center bg-gray-50">
          <p className="text-gray-500">
            {searchQuery || statusFilter !== 'all' 
              ? "Filtrelere uygun transfer bulunamadı." 
              : "Henüz size atanmış transfer bulunmamaktadır."}
          </p>
        </div>
      )}

      {/* Transfer Cards Grid */}
      {!error && filteredTransfers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTransfers.map((transfer) => (
            <TransferStatusCard
              key={transfer.id}
              transfer={transfer}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
} 