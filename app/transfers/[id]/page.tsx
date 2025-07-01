import Link from "next/link";
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { formatDateTime } from "../../../lib/utils/date";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NotificationType } from "../../../lib/services/notification-preferences-service";

// Detay sayfası için interface (listeleme sayfasındaki interface'i import etmek daha iyi olabilir)
interface AgencyInfo {
    id: string;
    contact_person_name: string;
    agency_name?: string;
    phone_numbers: string[] | null;
}

// Bildirim tercihleri için interface
interface NotificationPreference {
  id: string;
  notification_type: string;
  notification_description?: string;
  phone_numbers: string[] | null;
  is_enabled: boolean;
}

// TransferDetail arayüzünü güncelleyelim
interface TransferDetail {
  id: string;
  created_at: string;
  patient_name: string;
  airport: string | null; 
  clinic: string | null;
  transfer_datetime: string; 
  deadline_datetime: string;
  status: string | null;
  assigned_officer_id: string | null; // Sorumlu kişi ID'si
  agencies: AgencyInfo | null; 
  routes: { name: string; requires_airport: boolean; } | null; // routes tablosundan gelen veri
  locations: { name: string; address: string | null; } | null; // locations tablosundan gelen veri
  notification_preferences: NotificationPreference[]; // Bildirim tercihleri
  notification_numbers: string[] | null; // Transfer kaydındaki bildirim numaraları
}

// Durumları ve karşılık gelen badge varyantlarını/metinlerini tanımlayalım
const statusMap: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { text: "Beklemede", variant: "secondary" },
  driver_assigned: { text: "Sürücü Atandı", variant: "default" }, 
  patient_picked_up: { text: "Hasta Alındı", variant: "default" },
  completed: { text: "Tamamlandı", variant: "default" },
  delayed: { text: "Gecikti", variant: "destructive" },
  cancelled: { text: "İptal Edildi", variant: "outline" },
};

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

async function getTransferDetail(id: string): Promise<TransferDetail | null> {
  // Server supabase istemcisini kullanarak veri erişimi
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  );
  
  try {
    // Önce transfers tablosunun mevcut sütunlarını kontrol edelim
    const tableStructureQuery = await supabase
      .from("transfers")
      .select('*')
      .limit(1);
    
    const availableTransferColumns = tableStructureQuery.data && tableStructureQuery.data[0]
      ? Object.keys(tableStructureQuery.data[0])
      : ['id', 'created_at', 'patient_name', 'airport', 'clinic', 'transfer_datetime', 'deadline_datetime', 'status'];
    
    // İlişkili verileri de içeren güvenli bir sorgu oluşturalım
    let transferQuery = supabase
      .from("transfers")
      .select(`
        id, 
        created_at,
        ${availableTransferColumns.includes('patient_name') ? 'patient_name,' : ''}
        ${availableTransferColumns.includes('airport') ? 'airport,' : ''}
        ${availableTransferColumns.includes('clinic') ? 'clinic,' : ''}
        ${availableTransferColumns.includes('transfer_datetime') ? 'transfer_datetime,' : ''}
        ${availableTransferColumns.includes('deadline_datetime') ? 'deadline_datetime,' : ''}
        ${availableTransferColumns.includes('status') ? 'status,' : ''}
        ${availableTransferColumns.includes('agency_id') ? 'agency_id,' : ''}
        ${availableTransferColumns.includes('assigned_agency_id') ? 'assigned_agency_id,' : ''}
        ${availableTransferColumns.includes('assigned_officer_id') ? 'assigned_officer_id,' : ''}
        ${availableTransferColumns.includes('route_id') ? 'route_id,' : ''}
        ${availableTransferColumns.includes('related_route_id') ? 'related_route_id,' : ''}
        ${availableTransferColumns.includes('location_id') ? 'location_id,' : ''}
        ${availableTransferColumns.includes('notification_numbers') ? 'notification_numbers,' : ''}
        agencies:${availableTransferColumns.includes('agency_id') ? 'agency_id' : 'assigned_agency_id'}(
          id, 
          name
        ),
        routes:${availableTransferColumns.includes('route_id') ? 'route_id' : 'related_route_id'}(
          id,
          name,
          requires_airport
        ),
        locations:${availableTransferColumns.includes('location_id') ? 'location_id' : 
          availableTransferColumns.includes('location_from_id') ? 'location_from_id' : 
          availableTransferColumns.includes('location_to_id') ? 'location_to_id' : 'location_id'}(
          id,
          name,
          address
        )
      `)
      .eq("id", id)
      .single();

    const { data: transfer, error } = await transferQuery;

    if (error) {
      console.error("Transfer detayı çekilemedi:", error.message);
      return null;
    }

    if (!transfer) {
      return null;
    }
    
    // TypeScript ile uyum için tip dönüşümü yapılıyor
    const transferData = transfer as any;

    // Kullanılan foreign key alanları ve ilişkili tablo verilerini logla 
    console.log("Transfer ID:", id);
    console.log("Kullanılan agency FK:", availableTransferColumns.includes('agency_id') ? 'agency_id' : 'assigned_agency_id');
    console.log("Kullanılan route FK:", availableTransferColumns.includes('route_id') ? 'route_id' : 'related_route_id');
    console.log("Kullanılan location FK:", availableTransferColumns.includes('location_id') ? 'location_id' : 
      availableTransferColumns.includes('location_from_id') ? 'location_from_id' : 
      availableTransferColumns.includes('location_to_id') ? 'location_to_id' : 'location_id');
    
    console.log("Çekilen transfer verisi:", JSON.stringify(transferData, null, 2));
    console.log("Çekilen ilişkili veriler:", {
      agencies: !!transferData.agencies,
      routes: !!transferData.routes,
      locations: !!transferData.locations
    });

    // İlişkili tablolarda veri yoksa varsayılan değerler kullan
    const defaultAgency: AgencyInfo = {
      id: "",
      contact_person_name: "Bilgi Yok",
      agency_name: "Bilinmiyor",
      phone_numbers: null
    };

    const defaultRoute = {
      name: "Bilinmiyor",
      requires_airport: false
    };

    const defaultLocation = {
      name: "Bilinmiyor",
      address: null
    };
    
    // Bildirim tercihlerini çek (eğer assigned_officer_id varsa)
    let notificationPreferences: NotificationPreference[] = [];
    if (transferData.assigned_officer_id) {
      notificationPreferences = await getNotificationPreferences(transferData.assigned_officer_id);
    }

    // Transfer verilerini TransferDetail yapısına dönüştür
    const transferDetail: TransferDetail = {
      id: transferData.id, 
      created_at: transferData.created_at,
      patient_name: transferData.patient_name || "İsimsiz Hasta",
      airport: transferData.airport,
      clinic: transferData.clinic,
      transfer_datetime: transferData.transfer_datetime || transferData.created_at,
      deadline_datetime: transferData.deadline_datetime || transferData.created_at,
      status: transferData.status || "pending",
      assigned_officer_id: transferData.assigned_officer_id,
      notification_numbers: transferData.notification_numbers || null,
      
      // İlişkili veriler
      agencies: transferData.agencies ? {
        id: transferData.agencies.id,
        contact_person_name: "Ajans Yetkilisi",
        agency_name: transferData.agencies.name,
        phone_numbers: null
      } : defaultAgency,
      
      routes: transferData.routes ? {
        name: transferData.routes.name,
        requires_airport: transferData.routes.requires_airport
      } : defaultRoute,
      
      locations: transferData.locations ? {
        name: transferData.locations.name,
        address: transferData.locations.address
      } : defaultLocation,

      notification_preferences: notificationPreferences
    };

    return transferDetail;
  } catch (error) {
    console.error("Beklenmeyen hata:", error);
    return null;
  }
}

// Bildirim tercihlerini çeken fonksiyon
async function getNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  );
  
  try {
    // Bildirim tiplerini string olarak tanımla
    const notificationTypes = [
      'transfer_deadline',
      'transfer_assigned',
      'status_changed'
    ];
    
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('id, notification_type, notification_description, phone_numbers, is_enabled')
      .eq('user_id', userId)
      .in('notification_type', notificationTypes)
      .eq('is_enabled', true);

    if (error) {
      console.error('Bildirim tercihleri çekilemedi:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Bildirim tercihleri çekerken hata:', error);
    return [];
  }
}

// Bildirim tipi açıklamasını döndüren yardımcı fonksiyon
function getNotificationTypeDescription(type: string): string {
  switch (type) {
    case 'transfer_deadline':
      return "Son Teslim Tarihi Yaklaştığında";
    case 'transfer_assigned':
      return "Yeni Transfer Atandığında";
    case 'status_changed':
      return "Transfer Durumu Değiştiğinde";
    default:
      return type;
  }
}

interface TransferDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function TransferDetailPage({ params }: TransferDetailPageProps) {
    const { id } = await params;
    const transfer = await getTransferDetail(id);

    if (!transfer) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Transfer Detayı</h1>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href={`/transfers/${id}/edit`}>Düzenle</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/transfers">Listeye Geri Dön</Link>
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Hasta: {transfer.patient_name}</CardTitle>
                    <CardDescription>
                        Transfer ID: {transfer.id}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Durum</p>
                            <div className="mt-1">{getStatusDisplay(transfer.status)}</div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Güzergah</p>
                            <div className="mt-1">{transfer.routes?.name || '-'}</div>
                        </div>
                        {/* Havalimanı gösterimi, transfer.airport veya transfer.routes?.requires_airport üzerinden kontrol edilebilir */}
                        {transfer.airport && (
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Havalimanı</p>
                                <div className="mt-1">{transfer.airport}</div>
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Otel/Konum</p>
                            <div className="mt-1">
                                {transfer.locations?.name || '-'}
                                {transfer.locations?.address && <span className="text-xs ml-1">({transfer.locations.address})</span>}
                            </div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Klinik</p>
                            <div className="mt-1">{transfer.clinic || '-'}</div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Transfer Tarihi ve Saati</p>
                            <div className="mt-1">{formatDateTime(transfer.transfer_datetime)}</div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Deadline Tarihi ve Saati</p>
                            <div className="mt-1">{formatDateTime(transfer.deadline_datetime)}</div>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Atanan Ajans/Yetkili</p>
                            <div className="mt-1">{transfer.agencies?.agency_name || transfer.agencies?.contact_person_name || 'Atanmadı'}</div>
                        </div>
                        {transfer.agencies?.phone_numbers && transfer.agencies.phone_numbers.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ajans Telefon</p>
                                <div className="mt-1">{transfer.agencies.phone_numbers.join(', ')}</div>
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Kayıt Tarihi</p>
                            <div className="mt-1">{formatDateTime(transfer.created_at)}</div>
                        </div>
                    </div>

                    {/* Transfer Bildirim Numaraları */}
                    {transfer.notification_numbers && transfer.notification_numbers.length > 0 && (
                        <div className="mt-6 pt-6 border-t">
                            <h3 className="text-lg font-medium mb-4">Transfer Bildirim Numaraları</h3>
                            <div className="flex flex-wrap gap-2">
                                {transfer.notification_numbers.map((phone, index) => (
                                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                        📱 {phone}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Yetkili Bildirim Tercihleri */}
                    {transfer.notification_preferences && transfer.notification_preferences.length > 0 && (
                        <div className="mt-6 pt-6 border-t">
                            <h3 className="text-lg font-medium mb-4">Yetkili Bildirim Tercihleri</h3>
                            <div className="space-y-3">
                                {transfer.notification_preferences.map((pref) => (
                                    <div key={pref.id}>
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            {pref.notification_description || getNotificationTypeDescription(pref.notification_type)}
                                        </p>
                                        <div className="mt-1">
                                            {pref.phone_numbers && pref.phone_numbers.length > 0 ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {pref.phone_numbers.map((phone, index) => (
                                                        <Badge key={index} variant="outline" className="flex items-center gap-1">
                                                            📞 {phone}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-500">Telefon numarası belirtilmemiş</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 