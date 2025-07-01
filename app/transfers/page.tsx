"use client";

export const dynamic = 'force-dynamic'; // Sayfanın her istekte yeniden render edilmesini sağlar

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from 'date-fns';
import { formatDateTime } from "../../lib/utils/date";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import CountdownTimer from "@/components/countdown-timer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BulkTransferManager } from "./components/bulk-transfer-manager";
import { useAuth } from "@/components/auth-provider";
import { type TransferWithRelations, getAllTransfers } from "@/lib/actions/transfer-actions";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Durumları ve karşılık gelen badge varyantlarını/metinlerini tanımlayalım
const statusMap: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { text: "Beklemede", variant: "secondary" },
  driver_assigned: { text: "Sürücü Atandı", variant: "default" },
  patient_picked_up: { text: "Hasta Alındı", variant: "default" },
  completed: { text: "Tamamlandı", variant: "default" },
  delayed: { text: "Gecikti", variant: "destructive" },
  cancelled: { text: "İptal Edildi", variant: "outline" },
};

export default function TransfersPage() {
  const [activeTab, setActiveTab] = useState("table");
  const { user, userRole, loading } = useAuth();

  // Check if user is admin or has permissions
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const canManageBulk = isAdmin || userRole === 'agency_admin';

  const getStatusDisplay = (status: string | null) => {
    if (!status || !statusMap[status]) {
      return <Badge variant="outline">Belirtilmemiş</Badge>;
    }
    const { text, variant } = statusMap[status];
    if (status === 'completed' && variant === 'default') {
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">{text}</Badge>
    }
    if ((status === 'driver_assigned' || status === 'patient_picked_up') && variant === 'default') {
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{text}</Badge>
    } 
    return <Badge variant={variant}>{text}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Transfer Yönetimi</h1>
        <Button asChild>
          <Link href="/transfers/new">Yeni Transfer Ekle</Link>
        </Button>
      </div>

      {canManageBulk ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="table">Transfer Listesi</TabsTrigger>
            <TabsTrigger value="bulk">Toplu Yönetim</TabsTrigger>
          </TabsList>
          
          <TabsContent value="table" className="mt-6">
            <TransferTable />
          </TabsContent>
          
          <TabsContent value="bulk" className="mt-6">
            <BulkTransferManagerWrapper />
          </TabsContent>
        </Tabs>
      ) : (
        <TransferTable />
      )}
    </div>
  );
}

// Wrapper for BulkTransferManager that fetches transfers
function BulkTransferManagerWrapper() {
  const [transfers, setTransfers] = useState<TransferWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransfers = useCallback(async () => {
    console.log('🔄 [TRANSFERS] Starting fetchTransfers via server action...');
    setIsLoading(true);
    try {
      console.log('📡 [TRANSFERS] Calling getAllTransfers action...');
      const result = await getAllTransfers({
        limit: 50,
        offset: 0
      });
      
      console.log('📝 [TRANSFERS] Action result:', {
        success: result.data?.success,
        dataCount: result.data?.data?.length,
        hasError: !!result.serverError
      });
      
      if (result.data?.success && result.data?.data) {
        console.log('✅ [TRANSFERS] Setting transfers:', result.data.data.length, 'items');
        setTransfers(result.data.data || []);
      } else {
        const errorMsg = result.serverError || result.data?.error || 'Transferler yüklenirken hata oluştu';
        console.log('❌ [TRANSFERS] Action error:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('💥 [TRANSFERS] Error fetching transfers:', error);
      toast.error('Transferler yüklenirken hata oluştu');
    }
    setIsLoading(false);
    console.log('🏁 [TRANSFERS] fetchTransfers completed');
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, []); // Empty dependency array to run only once

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p className="text-lg">Transferler yükleniyor...</p>
      </div>
    );
  }

  return (
    <BulkTransferManager 
      transfers={transfers as any} 
      onRefresh={fetchTransfers}
      allowDelete={true}
    />
  );
}

// Transfer table component
function TransferTable() {
  const [transfers, setTransfers] = useState<TransferWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransfers() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getAllTransfers({
          limit: 50,
          offset: 0
        });

        if (result.data?.success && result.data?.data) {
          setTransfers(result.data.data || []);
        } else {
          const errorMsg = result.serverError || result.data?.error || 'Transferler yüklenirken hata oluştu';
          setError(errorMsg);
          toast.error(errorMsg);
        }
      } catch (e: any) {
        const errorMsg = e.message || "Beklenmedik bir sunucu hatası.";
        setError(errorMsg);
        toast.error(errorMsg);
      }
      setIsLoading(false);
    }
    fetchTransfers();
  }, []);

  const getStatusDisplay = (status: string | null) => {
    if (!status || !statusMap[status]) {
      return <Badge variant="outline">Belirtilmemiş</Badge>;
    }
    const { text, variant } = statusMap[status];
    if (status === 'completed' && variant === 'default') {
        return <Badge className="bg-green-500 hover:bg-green-600 text-white">{text}</Badge>
    }
    if ((status === 'driver_assigned' || status === 'patient_picked_up') && variant === 'default') {
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white">{text}</Badge>
    } 
    return <Badge variant={variant}>{text}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <p className="text-lg">Transferler yükleniyor...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hata</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!transfers || transfers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı Transferler</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 min-h-[200px] flex items-center justify-center">
            <p className="text-gray-500">Henüz görüntülenecek transfer bulunmamaktadır.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kayıtlı Transferler</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableCaption className="py-4">Toplam {transfers.length} transfer kaydı bulunmaktadır.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">Başlık (Hasta Adı)</TableHead>
              <TableHead>Güzergah</TableHead>
              <TableHead>Otel/Konum</TableHead>
              <TableHead>Ajans</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Kalan Süre / Tamamlanma</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell className="font-medium">{transfer.title || transfer.patient_name}</TableCell>
                <TableCell>
                  {transfer.routes?.name || '-'}
                  {transfer.airport && (
                    <div className="text-xs text-gray-500 mt-1">
                      {transfer.routes?.requires_airport ? "Havalimanı:" : "Not:"} {transfer.airport}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {transfer.location_from?.name && <div><span className="font-semibold">K:</span> {transfer.location_from.name}</div>}
                  {transfer.location_to?.name && <div className={transfer.location_from?.name ? 'mt-1' : ''}><span className="font-semibold">V:</span> {transfer.location_to.name}</div>}
                  {!transfer.location_from?.name && !transfer.location_to?.name && '-'}
                </TableCell>
                <TableCell>{transfer.agencies?.name || transfer.agencies?.contact_information?.name || '-'}</TableCell>
                <TableCell>
                  {transfer.deadline_datetime ? (
                    formatDateTime(transfer.deadline_datetime)
                  ) : (
                    'Deadline Belirtilmemiş'
                  )}
                </TableCell>
                <TableCell>
                  <CountdownTimer deadline={transfer.deadline_datetime} status={transfer.status} />
                  <div className="text-xs text-gray-500 mt-0.5">
                    {transfer.deadline_datetime ? (
                      `(${formatDateTime(transfer.deadline_datetime).replace(/\/20/, '/')})`
                    ) : (
                      '(Deadline Yok)'
                    )}
                  </div>
                </TableCell>
                <TableCell>{getStatusDisplay(transfer.status)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/transfers/${transfer.id}`}>Detay</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

 