import Link from "next/link";
import { notFound } from 'next/navigation';
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import EditTransferForm from "./_components/edit-transfer-form";

// Transfer bilgilerini getir
async function getTransferForEdit(id: string) {
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
  
  const { data, error } = await supabase
    .from("transfers")
    .select(`
      id, patient_name, airport, clinic,
      transfer_datetime, deadline_datetime, status,
      assigned_agency_id, related_route_id, location_from_id,
      notification_numbers
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Transfer düzenleme verileri çekilemedi:", error);
    return null;
  }

  return data;
}

// Ajansları getir 
async function getAgencies() {
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
    // Önce sütun adlarını almaya çalışalım
    const columnsQuery = await supabase
      .from('agencies')
      .select('*')
      .limit(1);
    
    // Gerçekte var olan sütunları belirle
    let availableColumns = columnsQuery.data && columnsQuery.data[0] 
      ? Object.keys(columnsQuery.data[0]) 
      : ['id'];
    
    // Güvenli bir sorgu oluştur
    let queryColumns = 'id';
    if (availableColumns.includes('name')) queryColumns += ', name';
    if (availableColumns.includes('agency_name')) queryColumns += ', agency_name';
    if (availableColumns.includes('contact_person_name')) queryColumns += ', contact_person_name';

    console.log("Ajanslar için sorgu sütunları:", queryColumns);
    
    // Ana sorguyu çalıştır
    const { data, error } = await supabase
      .from('agencies')
      .select(queryColumns);

    if (error) {
      console.error("Ajanslar çekilemedi. Hata:", JSON.stringify(error));
      // Geçici örnek verilerle devam edelim
      return [
        { value: "temp-agency-1", label: "Örnek Ajans 1" },
        { value: "temp-agency-2", label: "Örnek Ajans 2" }
      ];
    }

    // Geçici çözüm: Eğer veri yoksa veya veriye ulaşılamıyorsa
    if (!data || data.length === 0) {
      console.log("Hiç ajans bulunamadı. Geçici veriler kullanılıyor.");
      return [
        { value: "temp-agency-1", label: "Örnek Ajans 1" },
        { value: "temp-agency-2", label: "Örnek Ajans 2" }
      ];
    }

    // Gerçek verileri daha akıllı bir şekilde işle
    return data.map(agency => {
      let label = `Ajans (ID: ${agency.id?.substring(0, 8) || 'Bilinmiyor'})`;
      
      if (typeof agency.name === 'string' && agency.name) {
        label = agency.name;
      } else if (typeof agency.agency_name === 'string' && agency.agency_name) {
        label = agency.agency_name;
      } else if (typeof agency.contact_person_name === 'string' && agency.contact_person_name) {
        label = agency.contact_person_name;
      }
      
      // Ensure value is never null/undefined
      return {
        value: agency.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
        label: label
      };
    }).filter(item => item.value && item.value !== '');
  } catch (error) {
    console.error("Ajanslar çekilirken beklenmeyen hata:", error);
    // Hata durumunda bile geçici verilerle devam et
    return [
      { value: "temp-agency-1", label: "Örnek Ajans 1" },
      { value: "temp-agency-2", label: "Örnek Ajans 2" }
    ];
  }
}

// Rotaları getir
async function getRoutes() {
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
    // Önce sütun adlarını almaya çalışalım
    const columnsQuery = await supabase
      .from('routes')
      .select('*')
      .limit(1);
    
    // Gerçekte var olan sütunları belirle
    let availableColumns = columnsQuery.data && columnsQuery.data[0] 
      ? Object.keys(columnsQuery.data[0]) 
      : ['id'];
    
    // Güvenli bir sorgu oluştur
    let queryColumns = 'id';
    if (availableColumns.includes('name')) queryColumns += ', name';

    console.log("Rotalar için sorgu sütunları:", queryColumns);
    
    // Ana sorguyu çalıştır
    const { data, error } = await supabase
      .from('routes')
      .select(queryColumns);

    if (error) {
      console.error("Rotalar çekilemedi. Hata:", JSON.stringify(error));
      return [
        { value: "temp-route-1", label: "Havalimanı -> Otel" },
        { value: "temp-route-2", label: "Otel -> Klinik" }
      ];
    }

    if (!data || data.length === 0) {
      console.log("Hiç rota bulunamadı. Geçici veriler kullanılıyor.");
      return [
        { value: "temp-route-1", label: "Havalimanı -> Otel" },
        { value: "temp-route-2", label: "Otel -> Klinik" }
      ];
    }

    return data.map(route => {
      let label = `Güzergah (ID: ${route.id?.substring(0, 8) || 'Bilinmiyor'})`;
      
      if (typeof route.name === 'string' && route.name) {
        label = route.name;
      }
      
      // Ensure value is never null/undefined
      return {
        value: route.id || `temp-route-${Math.random().toString(36).substr(2, 9)}`,
        label: label
      };
    }).filter(item => item.value && item.value !== '');
  } catch (error) {
    console.error("Rotalar çekilirken beklenmeyen hata:", error);
    return [
      { value: "temp-route-1", label: "Havalimanı -> Otel" },
      { value: "temp-route-2", label: "Otel -> Klinik" }
    ];
  }
}

// Lokasyonları getir
async function getLocations() {
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
    // Önce sütun adlarını almaya çalışalım
    const columnsQuery = await supabase
      .from('locations')
      .select('*')
      .limit(1);
    
    // Gerçekte var olan sütunları belirle
    let availableColumns = columnsQuery.data && columnsQuery.data[0] 
      ? Object.keys(columnsQuery.data[0]) 
      : ['id'];
    
    // Güvenli bir sorgu oluştur
    let queryColumns = 'id';
    if (availableColumns.includes('name')) queryColumns += ', name';
    if (availableColumns.includes('address')) queryColumns += ', address';

    console.log("Lokasyonlar için sorgu sütunları:", queryColumns);
    
    // Ana sorguyu çalıştır
    const { data, error } = await supabase
      .from('locations')
      .select(queryColumns);

    if (error) {
      console.error("Lokasyonlar çekilemedi. Hata:", JSON.stringify(error));
      return [
        { value: "temp-location-1", label: "Antalya Havalimanı" },
        { value: "temp-location-2", label: "Otel Royal" }
      ];
    }

    if (!data || data.length === 0) {
      console.log("Hiç lokasyon bulunamadı. Geçici veriler kullanılıyor.");
      return [
        { value: "temp-location-1", label: "Antalya Havalimanı" },
        { value: "temp-location-2", label: "Otel Royal" }
      ];
    }

    return data.map(location => {
      let label = `Lokasyon (ID: ${location.id?.substring(0, 8) || 'Bilinmiyor'})`;
      
      if (typeof location.name === 'string' && location.name) {
        label = location.name;
        if (typeof location.address === 'string' && location.address) {
          label += ` (${location.address})`;
        }
      }
      
      // Ensure value is never null/undefined
      return {
        value: location.id || `temp-location-${Math.random().toString(36).substr(2, 9)}`,
        label: label
      };
    }).filter(item => item.value && item.value !== '');
  } catch (error) {
    console.error("Lokasyonlar çekilirken beklenmeyen hata:", error);
    return [
      { value: "temp-location-1", label: "Antalya Havalimanı" },
      { value: "temp-location-2", label: "Otel Royal" }
    ];
  }
}

interface EditTransferPageProps {
  params: { id: string };
}

export default async function EditTransferPage({ params }: EditTransferPageProps) {
  const id = params.id; // ID'yi en başta ve bir kez al

  // Tüm veri çekme işlemlerini paralel olarak başlat
  const [transfer, agencies, routes, locations] = await Promise.all([
    getTransferForEdit(id), // `id` değişkenini kullan
    getAgencies(),
    getRoutes(),
    getLocations(),
  ]);

  // Eğer ana transfer verisi bulunamazsa 404 sayfasına yönlendir
  if (!transfer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Transferi Düzenle</CardTitle>
        </CardHeader>
        <CardContent>
          <EditTransferForm
            transfer={transfer}
            agencies={agencies}
            routes={routes}
            locations={locations}
          />
        </CardContent>
      </Card>
      <Button variant="outline" asChild>
        <Link href={`/transfers/${id}`}>
          Geri Dön
        </Link>
      </Button>
    </div>
  );
} 