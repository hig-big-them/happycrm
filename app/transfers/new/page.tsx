"use client";

import Link from "next/link";
import * as React from "react";
import { format, parse } from "date-fns";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { Calendar } from "../../../components/ui/calendar";
import { Checkbox } from "../../../components/ui/checkbox";
import { cn } from "../../../lib/utils";
import { CalendarIcon, PlusCircle, Loader2, X } from "lucide-react";
import { z } from "zod";
import { createClient } from '../../../lib/supabase/client';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog";
import { tr } from 'date-fns/locale';
import { Badge } from "../../../components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

// Veritabanı tipleri (Supabase'den gelenlere göre daha kesinleştirilebilir)
interface RouteOption {
  id: string;
  name: string;
  requires_airport: boolean;
}

interface LocationOption {
  id: string;
  name: string;
  address: string | null;
}

interface AgencyOption {
    id: string;
    display_name: string;
}

// Ajans veri tipi (handleAddNewAgency içinde kullanılacak)
interface Agency { 
  id: string;
  created_at?: string; // Supabase'den dönebilir ama insert için gerekli değil
  name: string; // Veritabanındaki sütun adı
  contact_information?: { // JSON formatında
    person_name?: string;
    phones?: string[];
  } | null;
  is_active: boolean;
}

// Contact Information tip tanımı
interface ContactInformation {
  person_name?: string;
  phones?: string[];
}

// Transfer statüsü
type TransferStatus = 'pending' | 'completed' | 'canceled';

// Zod Şeması Tanımlaması
const transferFormSchema = z.object({
  patientName: z.string().min(1, { message: "Hasta adı zorunludur." }),
  selectedRouteId: z.string({invalid_type_error: "Güzergah seçimi zorunludur."}).uuid({ message: "Geçersiz güzergah ID formatı." }).min(1, { message: "Güzergah seçimi zorunludur." }),
  selectedAirport: z.string().optional(), // Koşullu zorunluluk refine ile yapılacak
  selectedLocationId: z.string({invalid_type_error: "Konum seçimi zorunludur."}).uuid({ message: "Geçersiz konum ID formatı." }).min(1, { message: "Konum seçimi zorunludur." }),
  // manualHotelName ve manualHotelAddress kaldırıldı, artık locations tablosundan yönetilecek.
  clinic: z.string().optional(),
  transferDateTime: z.date({invalid_type_error: "Transfer tarihi ve saati zorunludur."}),
  deadlineDateTime: z.date({invalid_type_error: "Deadline tarihi ve saati zorunludur."}),
  selectedAgencyId: z.string({ required_error: "Ajans seçimi zorunludur.", invalid_type_error: "Ajans seçimi zorunludur." })
                     .uuid({ message: "Geçersiz ajans ID formatı." })
                     .min(1, { message: "Ajans seçimi zorunludur." }),
  notificationNumbers: z.array(z.string()).optional(),
})
// refine fonksiyonunu daha sonra `availableRoutes` state'i ile güncelleyeceğiz.
// Şimdilik genel bir placeholder olarak bırakıyorum.
// .refine(data => {
//   // Bu kısım, seçilen güzergahın requires_airport değerine göre güncellenecek.
//   // const selectedRoute = availableRoutes.find(r => r.id === data.selectedRouteId);
//   // if (selectedRoute?.requires_airport && !data.selectedAirport) {
//   //   return false;
//   // }
//   return true;
// }, {
//   message: "Havalimanı güzergahı için havalimanı seçimi zorunludur.",
//   path: ["selectedAirport"],
// })
.refine(data => {
  if (data.deadlineDateTime && data.transferDateTime && data.deadlineDateTime <= data.transferDateTime) {
    return false;
  }
  return true;
}, {
  message: "Deadline, transfer tarih ve saatinden sonra olmalıdır.",
  path: ["deadlineDateTime"],
});
// Manuel otel refine'ı kaldırıldı.

type TransferFormValues = z.infer<typeof transferFormSchema>;
interface ExtendedTransferFormValues extends TransferFormValues {
  _form?: string[];
}

// Sabit Havalimanı seçenekleri (veritabanından da gelebilir)
const airportOptions = [
  { id: "sabiha-gokcen", name: "Sabiha Gökçen Havalimanı" },
  { id: "istanbul-havalimani", name: "İstanbul Havalimanı" },
];


export default function NewTransferPage() {
  const supabase = createClient();
  const [patientName, setPatientName] = React.useState("");
  const [selectedRouteId, setSelectedRouteId] = React.useState<string>('');
  const [showAirportSelect, setShowAirportSelect] = React.useState(false);
  const [selectedAirport, setSelectedAirport] = React.useState<string>('');
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>('');
  const [transferDate, setTransferDate] = React.useState<Date | undefined>();
  const [transferTime, setTransferTime] = React.useState("");
  const [deadlineDate, setDeadlineDate] = React.useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = React.useState("");
  
  // Manuel deadline düzenleme flag'i ekle
  const [isManualDeadlineSet, setIsManualDeadlineSet] = React.useState(false);
  
  const [agenciesList, setAgenciesList] = React.useState<AgencyOption[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = React.useState<string>('');
  
  // Bildirim numaraları için state
  const [notificationNumbers, setNotificationNumbers] = React.useState<string[]>([]);
  const [newNotificationNumber, setNewNotificationNumber] = React.useState("");
  
  const [formErrors, setFormErrors] = React.useState<z.ZodError<ExtendedTransferFormValues>["formErrors"]["fieldErrors"] & { _form?: string[] }>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Veritabanından çekilecek listeler için state'ler
  const [availableRoutes, setAvailableRoutes] = React.useState<RouteOption[]>([]);
  const [availableLocations, setAvailableLocations] = React.useState<LocationOption[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = React.useState(true);
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(true);
  const [isLoadingAgencies, setIsLoadingAgencies] = React.useState(true);

  // Yeni Ajans Modal State'leri
  const [isNewAgencyModalOpen, setIsNewAgencyModalOpen] = React.useState(false);
  const [newAgencyName, setNewAgencyName] = React.useState("");
  const [newContactPerson, setNewContactPerson] = React.useState("");
  const [newAgencyPhones, setNewAgencyPhones] = React.useState("");
  const [newAgencyIsActive, setNewAgencyIsActive] = React.useState(true);
  const [isAddingAgency, setIsAddingAgency] = React.useState(false);
  const [newAgencyError, setNewAgencyError] = React.useState<string | null>(null);

  // Yeni Güzergah Modal State'leri
  const [isNewRouteModalOpen, setIsNewRouteModalOpen] = React.useState(false);
  const [newRouteName, setNewRouteName] = React.useState("");
  const [newRouteRequiresAirport, setNewRouteRequiresAirport] = React.useState(false);
  const [isAddingRoute, setIsAddingRoute] = React.useState(false);
  const [newRouteError, setNewRouteError] = React.useState<string | null>(null);

  // Yeni Konum Modal State'leri
  const [isNewLocationModalOpen, setIsNewLocationModalOpen] = React.useState(false);
  const [newLocationName, setNewLocationName] = React.useState("");
  const [newLocationAddress, setNewLocationAddress] = React.useState("");
  const [isAddingLocation, setIsAddingLocation] = React.useState(false);
  const [newLocationError, setNewLocationError] = React.useState<string | null>(null);

  // Bildirim numarası ekleme fonksiyonu
  const addNotificationNumber = () => {
    if (!newNotificationNumber.trim()) return;
    
    // Basit bir E.164 format kontrolü yap
    let formattedNumber = newNotificationNumber.trim();
    if (!formattedNumber.startsWith("+")) {
      formattedNumber = `+${formattedNumber}`;
    }
    
    setNotificationNumbers([...notificationNumbers, formattedNumber]);
    setNewNotificationNumber("");
  };
  
  // Bildirim numarası silme fonksiyonu
  const removeNotificationNumber = (index: number) => {
    const updatedNumbers = [...notificationNumbers];
    updatedNumbers.splice(index, 1);
    setNotificationNumbers(updatedNumbers);
  };

  // Veri Çekme Fonksiyonları
  async function fetchRoutes() {
    setIsLoadingRoutes(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('routes').select('id, name, requires_airport').order('name');
    if (error) {
      console.error('Güzergahlar çekilemedi:', error);
      setFormErrors(prev => ({...prev, _form: ['Güzergahlar yüklenirken bir hata oluştu.']}));
    } else {
      setAvailableRoutes(data || []);
    }
    setIsLoadingRoutes(false);
  }

  async function fetchLocations() {
    setIsLoadingLocations(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('locations').select('id, name, address').order('name');
    if (error) {
      console.error('Konumlar çekilemedi:', error);
      setFormErrors(prev => ({...prev, _form: ['Konumlar yüklenirken bir hata oluştu.']}));
    } else {
      setAvailableLocations(data || []);
    }
    setIsLoadingLocations(false);
  }

  async function fetchAgencies() {
    setIsLoadingAgencies(true);
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, contact_information')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Ajanslar çekilemedi:', error);
        setFormErrors(prev => ({...prev, _form: [`Ajanslar çekilemedi: ${error.message || 'Veritabanı hatası'}`]}));
      } else if (!data || data.length === 0) {
        console.warn('Hiç ajans bulunamadı veya ajans çekme yetkisi yok');
        setFormErrors(prev => ({...prev, _form: ['Aktif ajans bulunamadı veya görüntüleme yetkisi yok']}));
      } else {
        const formattedAgencies = data.map(agency => {
          const contactInfo = agency.contact_information as ContactInformation | null;
          const personName = contactInfo?.person_name || '';
          return {
            id: agency.id,
            display_name: personName ? `${agency.name} (${personName})` : agency.name
          };
        });
        setAgenciesList(formattedAgencies);
        console.log('Ajanslar başarıyla çekildi:', formattedAgencies.length);
      }
    } catch (err) {
      console.error('Beklenmeyen ajans çekme hatası:', err);
      setFormErrors(prev => ({...prev, _form: ['Ajans bilgileri çekilirken beklenmeyen bir hata oluştu']}));
    } finally {
      setIsLoadingAgencies(false);
    }
  }

  React.useEffect(() => {
    fetchRoutes();
    fetchLocations();
    fetchAgencies();
  }, []);

  // Güzergah değiştiğinde havalimanı seçimini kontrol et
  React.useEffect(() => {
    if (selectedRouteId) {
      const selectedRoute = availableRoutes.find(route => route.id === selectedRouteId);
      if (selectedRoute?.requires_airport) {
        setShowAirportSelect(true);
      } else {
        setShowAirportSelect(false);
        setSelectedAirport('');
      }
    } else {
      setShowAirportSelect(false);
      setSelectedAirport('');
    }
  }, [selectedRouteId, availableRoutes]);

  // Transfer saati değiştiğinde otomatik deadline hesapla (sadece manuel düzenleme yapılmamışsa)
  React.useEffect(() => {
    if (transferDate && transferTime && !isManualDeadlineSet) {
      try {
        // Transfer tarih ve saatini birleştir
        const [hours, minutes] = transferTime.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          const transferDateTime = new Date(transferDate);
          transferDateTime.setHours(hours, minutes, 0, 0);
          
          // Deadline için 45 dakika ekle
          const deadlineDateTime = new Date(transferDateTime);
          deadlineDateTime.setMinutes(deadlineDateTime.getMinutes() + 45);
          
          // Deadline tarih ve saati güncelle
          setDeadlineDate(deadlineDateTime);
          setDeadlineTime(
            `${String(deadlineDateTime.getHours()).padStart(2, '0')}:${String(deadlineDateTime.getMinutes()).padStart(2, '0')}`
          );
          
          // Hata varsa temizle
          setFormErrors(prev => ({ ...prev, deadlineDateTime: undefined }));
        }
      } catch (error) {
        console.error('Deadline hesaplama hatası:', error);
      }
    }
  }, [transferDate, transferTime, isManualDeadlineSet]);

  const handleAddNewAgency = async () => {
    if (!newContactPerson.trim() && !newAgencyName.trim()) {
      setNewAgencyError("Ajans adı veya yetkili adı boş bırakılamaz.");
      return;
    }
    setIsAddingAgency(true);
    setNewAgencyError(null);

    const phoneNumbersArray = newAgencyPhones.split(',').map(phone => phone.trim()).filter(phone => phone);

    try {
      // Veritabanı şemasına uygun olarak veri hazırla
      const agencyDataToInsert = { 
        name: newAgencyName.trim() || `${newContactPerson.trim()} Ajansı`, // Boş değilse kullan, yoksa kişi adını kullan
        contact_information: {
          person_name: newContactPerson.trim(),
          phones: phoneNumbersArray.length > 0 ? phoneNumbersArray : undefined
        },
        is_active: newAgencyIsActive
      };

      const { data: newAgency, error: insertError } = await supabase
        .from('agencies') 
        .insert(agencyDataToInsert)
        .select('id, name, contact_information')
        .single();

      if (insertError) {
        console.error('Yeni ajans ekleme hatası:', insertError);
        setNewAgencyError(`Ajans eklenemedi: ${insertError.message}`);
      } else if (newAgency) {
        // Ekranda gösterilecek şekilde format
        const personName = newAgency.contact_information as ContactInformation | null;
        const display_name = `${newAgency.name}${personName?.person_name ? ` (${personName.person_name})` : ''}`;
        
        setAgenciesList(prevAgencies => 
          [...prevAgencies, { id: newAgency.id, display_name }].sort((a, b) => 
            a.display_name.localeCompare(b.display_name)
          )
        ); 
        setSelectedAgencyId(newAgency.id); 
        setFormErrors(prev => ({ ...prev, selectedAgencyId: undefined }));
        setIsNewAgencyModalOpen(false);
        setNewAgencyName("");
        setNewContactPerson("");
        setNewAgencyPhones("");
        setNewAgencyIsActive(true);
      }
    } catch (error) {
      console.error('Beklenmeyen ajans ekleme hatası:', error);
      setNewAgencyError('Beklenmeyen bir hata oluştu.');
    } finally {
      setIsAddingAgency(false);
    }
  };

  const handleAddNewRoute = async () => {
    if (!newRouteName.trim()) {
      setNewRouteError("Güzergah adı boş bırakılamaz.");
      return;
    }
    setIsAddingRoute(true);
    setNewRouteError(null);

    try {
      const routeDataToInsert = {
        name: newRouteName.trim(),
        requires_airport: newRouteRequiresAirport,
      };

      const { data: newRoute, error: insertError } = await supabase
        .from('routes')
        .insert(routeDataToInsert)
        .select('id, name, requires_airport')
        .single();

      if (insertError) {
        console.error('Yeni güzergah ekleme hatası:', insertError);
        setNewRouteError(`Güzergah eklenemedi: ${insertError.message}`);
        setIsAddingRoute(false);
        return;
      }

      if (newRoute) {
        setAvailableRoutes(prevRoutes => [...prevRoutes, newRoute].sort((a,b) => a.name.localeCompare(b.name)));
        setSelectedRouteId(newRoute.id); // Yeni ekleneni seç
        setFormErrors(prev => ({ ...prev, selectedRouteId: undefined, selectedAirport: undefined }));
        setIsNewRouteModalOpen(false);
        setNewRouteName("");
        setNewRouteRequiresAirport(false);
      }
    } catch (error) {
      console.error('Beklenmedik güzergah ekleme hatası:', error);
      setNewRouteError('Beklenmedik bir hata oluştu.');
    } finally {
      setIsAddingRoute(false);
    }
  };

  const handleAddNewLocation = async () => {
    if (!newLocationName.trim()) {
      setNewLocationError("Konum adı boş bırakılamaz.");
      return;
    }
    setIsAddingLocation(true);
    setNewLocationError(null);

    try {
      const locationDataToInsert = {
        name: newLocationName.trim(),
        address: newLocationAddress.trim() ? newLocationAddress.trim() : null,
      };

      const { data: newLocation, error: insertError } = await supabase
        .from('locations')
        .insert(locationDataToInsert)
        .select('id, name, address')
        .single();

      if (insertError) {
        console.error('Yeni konum ekleme hatası:', insertError);
        setNewLocationError(`Konum eklenemedi: ${insertError.message}`);
        setIsAddingLocation(false);
        return;
      }

      if (newLocation) {
        setAvailableLocations(prevLocations => [...prevLocations, newLocation].sort((a,b) => a.name.localeCompare(b.name)));
        setSelectedLocationId(newLocation.id); // Yeni ekleneni seç
        setFormErrors(prev => ({ ...prev, selectedLocationId: undefined }));
        setIsNewLocationModalOpen(false);
        setNewLocationName("");
        setNewLocationAddress("");
      }
    } catch (error) {
      console.error('Beklenmedik konum ekleme hatası:', error);
      setNewLocationError('Beklenmedik bir hata oluştu.');
    } finally {
      setIsAddingLocation(false);
    }
  };
  
  const combineDateAndTime = (date: Date | undefined, time: string): Date | undefined => {
    if (!date) return undefined;
    if (!time) {
      const tempDateOnly = new Date(date);
      tempDateOnly.setHours(0,0,0,0); 
      return tempDateOnly;
    }
    try {
      const [hours, minutes] = time.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        const tempDateInvalidTime = new Date(date);
        tempDateInvalidTime.setHours(0,0,0,0);
        return tempDateInvalidTime;
      }
      const newDate = new Date(date);
      newDate.setHours(hours, minutes, 0, 0);
      return newDate;
    } catch (error) {
      const tempDateError = new Date(date);
      tempDateError.setHours(0,0,0,0);
      return tempDateError;
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    const finalTransferDateTime = combineDateAndTime(transferDate, transferTime);
    const finalDeadlineDateTime = combineDateAndTime(deadlineDate, deadlineTime);
    
    // Zod şeması için havalimanı zorunluluğunu dinamik olarak kontrol et
    const selectedRouteObject = availableRoutes.find(r => r.id === selectedRouteId);
    const currentTransferFormSchema = transferFormSchema.refine(data => {
        if (selectedRouteObject?.requires_airport && !data.selectedAirport) {
            return false;
        }
        return true;
    }, {
        message: "Havalimanı güzergahı için havalimanı seçimi zorunludur.",
        path: ["selectedAirport"],
    });


    const dataToValidate = { 
      patientName: patientName.trim(),
      selectedRouteId, 
      selectedAirport: showAirportSelect ? selectedAirport : undefined,
      selectedLocationId, 
      clinic: "Happy Smile", 
      transferDateTime: finalTransferDateTime,
      deadlineDateTime: finalDeadlineDateTime,
      selectedAgencyId,
      notificationNumbers,
    };

    const validationResult = currentTransferFormSchema.safeParse(dataToValidate);

    if (!validationResult.success) {
      console.error("Validasyon Hataları:", validationResult.error.flatten().fieldErrors);
      setFormErrors(validationResult.error.flatten().fieldErrors as typeof formErrors);
      setIsSubmitting(false);
      return;
    }

    const validatedData = validationResult.data;

    try {
      // Kullanıcı kontrolü ve JWT Debug
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (!user) {
        setFormErrors(prev => ({ ...prev, _form: ['Lütfen önce giriş yapınız'] }));
        setIsSubmitting(false);
        return;
      }

      // Debug için JWT içeriğini loglama
      console.log('Kullanıcı JWT içeriği:', user?.app_metadata);
      
      // Supabase'e gönderilecek verileri hazırla
      const transferDataToInsert = {
        title: validatedData.patientName,
        patient_name: validatedData.patientName,
        route_id: validatedData.selectedRouteId,
        airport: validatedData.selectedAirport || null,
        location_id: validatedData.selectedLocationId,
        clinic: validatedData.clinic || null,
        transfer_datetime: validatedData.transferDateTime.toISOString(),
        deadline_datetime: validatedData.deadlineDateTime.toISOString(),
        status: 'pending' as const,
        assigned_agency_id: validatedData.selectedAgencyId,
        notification_numbers: notificationNumbers,
      };
      
      console.log("Supabase'e gönderilecek transfer verisi:", transferDataToInsert);

      try {
        // Direkt olarak veritabanına ekleme yap
        const { data: insertedData, error: supabaseError } = await supabase
          .from('transfers')
          .insert(transferDataToInsert)
          .select()
          .single();

        if (supabaseError) {
          console.error('Supabase Kayıt Hatası:', supabaseError);
          
          // Daha açıklayıcı hata mesajı göster
          let errorMessage = supabaseError.message || "Bilinmeyen Supabase hatası";
          
          if (supabaseError.code === '42501') {
            errorMessage = 'Bu işlem için yetkiniz yok. RLS politikası engelledi.';
          } else if (supabaseError.code === '23503') {
            errorMessage = 'İlişkili kayıt bulunamadı (Foreign key violation).';
          } else if (supabaseError.code === '23505') {
            errorMessage = 'Bu kayıt zaten mevcut (Unique constraint violation).';
          }
          
          console.error('Supabase Hata Detayı:', JSON.stringify(supabaseError, null, 2));
          alert(`Supabase Hatası: ${errorMessage}`);
          setFormErrors(prev => ({ ...prev, _form: [errorMessage] }));
        } else {
          console.log('Transfer başarıyla kaydedildi!', insertedData);
          alert('Transfer başarıyla kaydedildi!');
          
          // Başarılı kayıt sonrası form alanlarını temizle
          setPatientName("");
          setSelectedRouteId('');
          setSelectedAirport('');
          setSelectedLocationId('');
          setTransferDate(undefined);
          setTransferTime("");
          setDeadlineDate(undefined);
          setDeadlineTime("");
          setSelectedAgencyId('');
          setNotificationNumbers([]);
          setIsManualDeadlineSet(false); // Manuel deadline flag'ini temizle
          setFormErrors({});
        }
      } catch (insertError) {
        // Özel try-catch bloğu ekleniyor - Supabase API hatalarını yakalamak için
        console.error('Supabase API Exception:', insertError);
        alert(`Supabase Insert Exception: ${insertError instanceof Error ? insertError.message : String(insertError)}`);
        setFormErrors(prev => ({ ...prev, _form: [`Supabase API hatası: ${insertError instanceof Error ? insertError.message : String(insertError)}`] }));
      }
    } catch (error) {
      console.error('Beklenmedik Form Gönderim Hatası:', error);
      alert('Beklenmedik bir hata oluştu. Lütfen konsolu kontrol edin.');
      setFormErrors(prev => ({ ...prev, _form: ['Beklenmedik bir hata oluştu.'] }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const overallIsLoading = isLoadingRoutes || isLoadingLocations || isLoadingAgencies;

  if (overallIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Form verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Yeni Transfer Kaydı</h1>
        <Button variant="outline" asChild>
          <Link href="/transfers">Geri Dön</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Bilgileri</CardTitle>
          <CardDescription>
            Lütfen yeni transfer için gerekli tüm bilgileri eksiksiz girin.
            {formErrors._form && <p className="text-sm text-red-500 mt-2">{formErrors._form.join(', ')}</p>}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hasta Adı Soyadı */}
          <div className="space-y-1.5">
            <Label htmlFor="patientName">Hasta Adı Soyadı</Label>
            <Input 
              id="patientName" 
              placeholder="örn. Ahmet Yılmaz" 
              value={patientName}
              onChange={(e) => {
                setPatientName(e.target.value);
                setFormErrors(prev => ({ ...prev, patientName: undefined }));
              }}
              disabled={isSubmitting}
            />
            {formErrors?.patientName && <p className="text-sm text-red-500">{formErrors.patientName[0]}</p>}
          </div>
          
          {/* Güzergah */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="route">Güzergah</Label>
              <Dialog open={isNewRouteModalOpen} onOpenChange={setIsNewRouteModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" type="button" disabled={isAddingRoute}>
                    <PlusCircle className="h-4 w-4" /> Yeni Güzergah
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Yeni Güzergah Ekle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2 pb-4">
                    <div className="space-y-2">
                      <Label htmlFor="newRouteName">Güzergah Adı</Label>
                      <Input id="newRouteName" value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} disabled={isAddingRoute} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="newRouteRequiresAirport" 
                        checked={newRouteRequiresAirport} 
                        onCheckedChange={(checked: boolean | 'indeterminate') => setNewRouteRequiresAirport(checked === true)} 
                        disabled={isAddingRoute} 
                      />
                      <Label htmlFor="newRouteRequiresAirport" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Havalimanı Seçimi Gerektirir
                      </Label>
                    </div>
                    {newRouteError && <p className="text-sm text-red-500">{newRouteError}</p>}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline" type="button" disabled={isAddingRoute}>İptal</Button></DialogClose>
                    <Button type="button" onClick={handleAddNewRoute} disabled={isAddingRoute}>
                      {isAddingRoute ? "Ekleniyor..." : "Güzergah Ekle"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Select 
              value={selectedRouteId} 
              onValueChange={(value) => setSelectedRouteId(value)}
              disabled={isSubmitting || isLoadingRoutes}
            >
              <SelectTrigger id="route">
                <SelectValue placeholder={isLoadingRoutes ? "Güzergahlar yükleniyor..." : "Güzergah seçin"} />
              </SelectTrigger>
              <SelectContent>
                {availableRoutes.length === 0 && !isLoadingRoutes && <p className="p-2 text-sm text-muted-foreground">Uygun güzergah bulunamadı.</p>}
                {availableRoutes.map((route) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors?.selectedRouteId && <p className="text-sm text-red-500">{formErrors.selectedRouteId[0]}</p>}
          </div>

          {/* Havalimanı (Koşullu) */}
          {showAirportSelect && (
            <div className="space-y-1.5">
              <Label htmlFor="airport">Havalimanı</Label>
              <Select 
                value={selectedAirport} 
                onValueChange={(value) => {
                  setSelectedAirport(value);
                  setFormErrors(prev => ({ ...prev, selectedAirport: undefined }));
                }}
                disabled={isSubmitting}
              >
                <SelectTrigger id="airport">
                  <SelectValue placeholder="Havalimanı seçin" />
                </SelectTrigger>
                <SelectContent>
                  {airportOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}> {/* Havalimanı ID'si string (örn: "sabiha-gokcen") */}
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors?.selectedAirport && <p className="text-sm text-red-500">{formErrors.selectedAirport[0]}</p>}
            </div>
          )}

          {/* Otel/Konum */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="location">Otel/Konum</Label>
              <Dialog open={isNewLocationModalOpen} onOpenChange={setIsNewLocationModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1" type="button" disabled={isAddingLocation}>
                    <PlusCircle className="h-4 w-4" /> Yeni Konum
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Yeni Konum Ekle</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2 pb-4">
                    <div className="space-y-2">
                      <Label htmlFor="newLocationName">Konum Adı</Label>
                      <Input id="newLocationName" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} disabled={isAddingLocation} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newLocationAddress">Adres (Opsiyonel)</Label>
                      <Input id="newLocationAddress" value={newLocationAddress} onChange={(e) => setNewLocationAddress(e.target.value)} disabled={isAddingLocation} />
                    </div>
                    {newLocationError && <p className="text-sm text-red-500">{newLocationError}</p>}
                  </div>
                  <DialogFooter>
                     <DialogClose asChild><Button variant="outline" type="button" disabled={isAddingLocation}>İptal</Button></DialogClose>
                    <Button type="button" onClick={handleAddNewLocation} disabled={isAddingLocation}>
                      {isAddingLocation ? "Ekleniyor..." : "Konum Ekle"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Select 
              value={selectedLocationId} 
              onValueChange={(value) => {
                setSelectedLocationId(value);
                setFormErrors(prev => ({ ...prev, selectedLocationId: undefined }));
              }}
              disabled={isSubmitting || isLoadingLocations}
            >
              <SelectTrigger id="location">
                <SelectValue placeholder={isLoadingLocations ? "Konumlar yükleniyor..." : "Konum seçin"} />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.length === 0 && !isLoadingLocations && <p className="p-2 text-sm text-muted-foreground">Uygun konum bulunamadı.</p>}
                {availableLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name} {location.address ? `(${location.address})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors?.selectedLocationId && <p className="text-sm text-red-500">{formErrors.selectedLocationId[0]}</p>}
          </div>

          {/* Klinik (Sabit) */}
          <div className="space-y-1.5">
            <Label htmlFor="clinic">Klinik</Label>
            <Input id="clinic" value="Happy Smile" readOnly disabled={isSubmitting} />
          </div>
          
          {/* Ajans Seçimi (Transfer Kişisi yerine) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label htmlFor="agency">Ajans</Label>
                <Dialog open={isNewAgencyModalOpen} onOpenChange={setIsNewAgencyModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1" type="button" disabled={isAddingAgency}>
                            <PlusCircle className="h-4 w-4" />
                            Yeni Ajans
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                        <DialogTitle>Yeni Ajans Ekle</DialogTitle>
                        <DialogDescription>Yeni ajansın bilgilerini girin.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                             <div className="space-y-2">
                                <Label htmlFor="newAgencyNameModal">Ajans Adı (Opsiyonel)</Label>
                                <Input id="newAgencyNameModal" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} disabled={isAddingAgency} />
                             </div>
                             <div className="space-y-2">
                                <Label htmlFor="newContactPersonModal">Yetkili Adı Soyadı</Label>
                                <Input id="newContactPersonModal" value={newContactPerson} onChange={(e) => setNewContactPerson(e.target.value)} disabled={isAddingAgency} />
                             </div>
                             <div className="space-y-2">
                                <Label htmlFor="newAgencyPhonesModal">Telefon Numaraları (virgülle ayırın)</Label>
                                <Input id="newAgencyPhonesModal" value={newAgencyPhones} onChange={(e) => setNewAgencyPhones(e.target.value)} disabled={isAddingAgency} />
                             </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="newAgencyIsActiveModal" checked={newAgencyIsActive} onCheckedChange={(checked: boolean | 'indeterminate') => setNewAgencyIsActive(checked === true)} disabled={isAddingAgency} />
                                <Label htmlFor="newAgencyIsActiveModal">Aktif Ajans</Label>
                             </div>
                             {newAgencyError && <p className="text-sm text-red-500">{newAgencyError}</p>}
                        </div>
                        <DialogFooter>
                         <DialogClose asChild><Button variant="outline" type="button" disabled={isAddingAgency}>İptal</Button></DialogClose>
                        <Button type="button" onClick={handleAddNewAgency} disabled={isAddingAgency} className="gap-1">
                            {isAddingAgency ? <><Loader2 className="h-4 w-4 animate-spin" /> Ekleniyor...</> : "Ajans Ekle"}
                        </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <Select 
              value={selectedAgencyId}
              onValueChange={(value) => {
                  setSelectedAgencyId(value);
                  setFormErrors(prev => ({ ...prev, selectedAgencyId: undefined }));
              }}
              disabled={isSubmitting || isLoadingAgencies}
            >
              <SelectTrigger id="agency">
                <SelectValue placeholder={isLoadingAgencies ? "Ajanslar yükleniyor..." : (agenciesList.length === 0 ? "Aktif ajans bulunamadı" : "Ajans seçin")} />
              </SelectTrigger>
              <SelectContent>
                {agenciesList.length === 0 && !isLoadingAgencies && (
                    <p className="p-2 text-sm text-muted-foreground">Aktif ajans bulunamadı.</p>
                )}
                {agenciesList.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formErrors?.selectedAgencyId && <p className="text-sm text-red-500">{formErrors.selectedAgencyId[0]}</p>}
          </div>

          {/* Transfer Tarihi ve Saati & Deadline Tarihi ve Saati */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Transfer Tarihi */}
            <div className="space-y-1.5">
              <Label htmlFor="transferDate">Transfer Tarihi ve Saati</Label>
              <div className="flex gap-2 items-start">
                <div className="flex-grow">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal", 
                          !transferDate && "text-muted-foreground"
                        )}
                        disabled={isSubmitting} type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {transferDate ? format(transferDate, "PPP", { locale: tr }) : <span>Tarih seçin</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={transferDate}
                        onSelect={(date) => {
                          setTransferDate(date);
                          setFormErrors(prev => ({ ...prev, transferDateTime: undefined, deadlineDateTime: undefined }));
                        }}
                        initialFocus
                        disabled={isSubmitting}
                        locale={tr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-[100px]"> 
                  <Input 
                    type="time" 
                    value={transferTime}
                    onChange={(e) => {
                      setTransferTime(e.target.value);
                      setFormErrors(prev => ({ ...prev, transferDateTime: undefined, deadlineDateTime: undefined }));
                    }}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              {formErrors?.transferDateTime && <p className="text-sm text-red-500 mt-1">{formErrors.transferDateTime[0]}</p>}
            </div>

            {/* Deadline Tarihi */}
            <div className="space-y-1.5">
              <Label htmlFor="deadlineDate">Deadline Tarihi ve Saati</Label>
              {!isManualDeadlineSet && (
                <p className="text-xs text-muted-foreground">
                  Otomatik olarak transfer saatine +45 dakika eklenir. Manuel düzenleme yapmak için tarih veya saati değiştirin.
                </p>
              )}
              {isManualDeadlineSet && (
                <p className="text-xs text-green-600">
                  Manuel deadline ayarlandı. Otomatik hesaplama devre dışı.
                </p>
              )}
              <div className="flex gap-2 items-start">
                <div className="flex-grow">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !deadlineDate && "text-muted-foreground"
                        )}
                        disabled={isSubmitting} type="button"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadlineDate ? format(deadlineDate, "PPP", { locale: tr }) : <span>Tarih seçin</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={deadlineDate}
                        onSelect={(date) => {
                          setDeadlineDate(date);
                          setIsManualDeadlineSet(true); // Manuel deadline düzenleme flag'ini set et
                          setFormErrors(prev => ({ ...prev, deadlineDateTime: undefined }));
                        }}
                        initialFocus
                        disabled={isSubmitting}
                        locale={tr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-[100px]"> 
                  <Input 
                    type="time" 
                    value={deadlineTime}
                    onChange={(e) => {
                      setDeadlineTime(e.target.value);
                      setIsManualDeadlineSet(true); // Manuel deadline düzenleme flag'ini set et
                      setFormErrors(prev => ({ ...prev, deadlineDateTime: undefined }));
                    }}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              {formErrors?.deadlineDateTime && <p className="text-sm text-red-500 mt-1">{formErrors.deadlineDateTime[0]}</p>}
            </div>
          </div>

          {/* Bildirim Numaraları */}
          <div className="space-y-1.5 border-t pt-4 mt-4">
            <Label htmlFor="notificationNumbers">Bildirim Numaraları</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Transfer ataması yapıldığında bildirim gönderilecek telefon numaralarını ekleyin.
            </p>
            
            {/* Eklenen numaralar */}
            {notificationNumbers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {notificationNumbers.map((number, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {number}
                    <button 
                      type="button" 
                      onClick={() => removeNotificationNumber(index)} 
                      className="ml-1 h-4 w-4 rounded-full hover:bg-muted-foreground/20 inline-flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Yeni numara ekleme */}
            <div className="flex gap-2">
              <Input
                id="notificationNumber"
                placeholder="+90XXXXXXXXXX"
                value={newNotificationNumber}
                onChange={(e) => setNewNotificationNumber(e.target.value)}
                className="flex-1"
                disabled={isSubmitting}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addNotificationNumber}
                disabled={isSubmitting || !newNotificationNumber.trim()}
              >
                Ekle
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Uluslararası format kullanın (örn. +905551234567)
            </p>
          </div>

        </CardContent>
        <CardFooter className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isSubmitting || isLoadingRoutes || isLoadingLocations || isLoadingAgencies || (agenciesList.length === 0 && !selectedAgencyId && !isNewAgencyModalOpen) || availableRoutes.length === 0 || availableLocations.length === 0}
          >
            {isSubmitting ? 'Kaydediliyor...' : 'Transfer Kaydet'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
} 