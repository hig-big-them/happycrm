"use client";

import * as React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "../../components/ui/dialog";
import { createClient } from "../../lib/supabase/client";
import { PlusCircle, Edit3, ToggleLeft, ToggleRight, Trash2, Loader2, Users, Building } from "lucide-react";
import { Checkbox } from "../../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

// Ajans veri tipi
interface Agency {
  id: string;
  created_at: string;
  name: string | null;
  is_active: boolean;
  created_by?: string | null;
  contact_information?: {
    name?: string | null;
    phones?: string[] | null;
  } | null;
  details?: {
    company_name?: string | null;
  } | null;
}

// Supabase'den çekilecek kullanıcılar için interface güncellendi
interface SupabaseUser {
  id: string;
  email?: string | null;    // Linter hatasını gidermek için null kabul edildi
  username?: string | null; 
}

// Ajans Kartı Komponenti
function AgencyCard({ agency, onToggleActive, onDeleteAgency }: { agency: Agency; onToggleActive: (agencyId: string, currentStatus: boolean) => Promise<void>; onDeleteAgency: (agencyId: string) => Promise<void>; }) {
  const [isToggling, setIsToggling] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const companyNameFromDetails = agency.details?.company_name;
  const contactNameFromInfo = agency.contact_information?.name;
  const phoneNumbersFromInfo = agency.contact_information?.phones;
  const displayName = agency.name || companyNameFromDetails || contactNameFromInfo || "İsimsiz Ajans";

  const userDisplay = "Detaylarda Yönetilir";

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggleActive(agency.id, agency.is_active);
    setIsToggling(false);
  };

  const handleDelete = async () => {
    if (window.confirm(`'${displayName}' adlı ajansı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)){
        setIsDeleting(true);
        await onDeleteAgency(agency.id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle>{displayName}</CardTitle>
            <Badge variant={agency.is_active ? "default" : "secondary"} className={agency.is_active ? "bg-green-500 hover:bg-green-600" : ""}>
                {agency.is_active ? "Aktif" : "Pasif"}
            </Badge>
        </div>
        <CardDescription className="space-y-1 mt-2">
          {companyNameFromDetails && companyNameFromDetails !== displayName &&
            <p className="text-sm text-muted-foreground">Firma Adı: {companyNameFromDetails}</p>}
          {contactNameFromInfo && contactNameFromInfo !== displayName && contactNameFromInfo !== companyNameFromDetails &&
            <p className="text-sm text-muted-foreground">Yetkili: {contactNameFromInfo}</p>}
          <p className="text-sm text-muted-foreground">
            Tel: {phoneNumbersFromInfo && phoneNumbersFromInfo.length > 0
                ? phoneNumbersFromInfo.join(", ")
                : "-"}
          </p>
          <p className="text-sm text-muted-foreground">Kullanıcılar: {userDisplay}</p>
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleToggle} disabled={isToggling || isDeleting} className="gap-1">
          {isToggling ? "Değiştiriliyor..." : (agency.is_active ? <><ToggleLeft className="h-4 w-4"/> Pasif Yap</> : <><ToggleRight className="h-4 w-4"/> Aktif Yap</>)}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting || isToggling} className="gap-1">
            {isDeleting ? "Siliniyor..." : <><Trash2 className="h-4 w-4"/> Sil</>}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AgenciesPage() {
  const [agencies, setAgencies] = React.useState<Agency[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newAgencyName, setNewAgencyName] = React.useState("");
  const [newContactPerson, setNewContactPerson] = React.useState("");
  const [newAgencyPhones, setNewAgencyPhones] = React.useState("");
  const [newAgencyIsActive, setNewAgencyIsActive] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);

  const [currentUserRole, setCurrentUserRole] = React.useState<string | undefined>(undefined);

  async function getCurrentUserRole() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserRole(user?.app_metadata?.role);
  }

  async function fetchAgencies() {
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("agencies")
      .select(`
        id,
        created_at,
        name,
        is_active,
        contact_information, 
        details,
        created_by 
      `)
      .order("name", { ascending: true });

    if (fetchError) {
      console.error("Ajanslar çekilemedi:", fetchError);
      setError("Ajanslar yüklenirken bir hata oluştu: " + (fetchError.message || "Detaylı bilgi yok."));
      setAgencies([]);
      return null;
    } else {
      setError(null);
      setAgencies(data as Agency[] || []);
      return data || [];
    }
  }

  React.useEffect(() => {
    async function initialLoad() {
      setIsLoading(true);
      setError(null);
      await getCurrentUserRole();

      const fetchedAgencies = await fetchAgencies();

      if (fetchedAgencies === null) {
        setIsLoading(false);
        return;
      }

      setAgencies(fetchedAgencies);

      setIsLoading(false);
    }
    initialLoad();
  }, []);

  const handleAddNewAgency = async () => {
    const agencyNameFromForm = newAgencyName.trim(); 
    const contactPersonNameFromForm = newContactPerson.trim();

    if (!agencyNameFromForm && !contactPersonNameFromForm) {
      setModalError("Ajans adı veya yetkili adı girilmelidir.");
      return;
    }
    
    const nameValueForTable = agencyNameFromForm || contactPersonNameFromForm;

    setIsSubmitting(true);
    setModalError(null);

    const phoneNumbersArray = newAgencyPhones.split(',').map(phone => phone.trim()).filter(phone => phone);

    const currentContactInfo = contactPersonNameFromForm ? { name: contactPersonNameFromForm } : {};
    const contactInfoWithPhones = {
      ...currentContactInfo,
      ...(phoneNumbersArray.length > 0 && { phones: phoneNumbersArray })
    };
    
    const finalContactInformation = Object.keys(contactInfoWithPhones).length > 0 ? contactInfoWithPhones : null;

    const agencyDataToInsert: Omit<Agency, 'id' | 'created_at'> = { 
      name: nameValueForTable,
      contact_information: finalContactInformation,
      details: agencyNameFromForm ? { company_name: agencyNameFromForm } : null,
      is_active: newAgencyIsActive,
      created_by: null,
    };
    
    if (currentUserRole === 'superuser') {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
          agencyDataToInsert.created_by = user.id;
      } else {
         setModalError("Mevcut kullanıcı bilgisi (created_by için) alınamadı.");
         setIsSubmitting(false);
         return;
      }
    }

    try {
      const supabase = createClient();
      const { data: newAgencyData, error: insertError } = await supabase
        .from('agencies') 
        .insert(agencyDataToInsert)
        .select()
        .single();

      if (insertError) {
        console.error('Yeni ajans ekleme hatası:', insertError);
        let errorMessage = "Bilinmeyen bir veritabanı hatası oluştu.";
        if (insertError.message) {
          if (insertError.message.includes("violates not-null constraint")) {
               const columnNameMatch = insertError.message.match(/column \"(.*?)\"/);
               const missingColumn = columnNameMatch ? columnNameMatch[1] : "bilinmeyen";
               errorMessage = `'${missingColumn}' alanı boş bırakılamaz.`;
          } else if (insertError.message.includes("unique constraint")) {
               const columnNameMatch = insertError.message.match(/constraint \"(.*?)\"/);
               const constraintName = columnNameMatch ? columnNameMatch[1] : "bilinmeyen";
               if (constraintName.includes("name_key")) { // agencies_name_key gibi
                errorMessage = "Bu ajans adı zaten mevcut. Lütfen farklı bir ad deneyin.";
               } else {
                errorMessage = "Benzersizlik kısıtlaması ihlal edildi: " + constraintName;
               }
          } else {
               errorMessage = insertError.message;
          }
        } else if (Object.keys(insertError).length === 0) {
           errorMessage = "Supabase'den beklenmedik bir yanıt alındı (boş hata nesnesi).";
        }
        setModalError(`Ajans eklenemedi: ${errorMessage}`);
      } else if (newAgencyData) {
        await fetchAgencies(); 
        setIsModalOpen(false);
        setNewAgencyName("");
        setNewContactPerson("");
        setNewAgencyPhones("");
        setNewAgencyIsActive(true);
      }
    } catch (err) {
      const R_err = err as Error;
      console.error('Beklenmedik ajans ekleme hatası:', R_err);
      setModalError(`Beklenmedik bir hata oluştu: ${R_err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (agencyId: string, currentStatus: boolean) => {
    setError(null); 
    const originalAgencies = [...agencies];
    setAgencies(prev => prev.map(a => a.id === agencyId ? { ...a, is_active: !currentStatus } : a));

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('agencies')
      .update({ is_active: !currentStatus })
      .eq('id', agencyId);

    if (updateError) {
      console.error('Ajans durumu güncelleme hatası:', updateError);
      setError("Ajans durumu güncellenirken bir hata oluştu: " + updateError.message);
      setAgencies(originalAgencies); 
    } 
  };
  
  const handleDeleteAgency = async (agencyId: string) => {
    setError(null);
    const originalAgencies = [...agencies];
    setAgencies(prev => prev.filter(a => a.id !== agencyId));

    const supabase = createClient();
    const { error: deleteError } = await supabase
        .from('agencies')
        .delete()
        .eq('id', agencyId);

    if (deleteError) {
        console.error('Ajans silme hatası:', deleteError);
        setError("Ajans silinirken bir hata oluştu: " + deleteError.message);
        setAgencies(originalAgencies);
    } 
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Ajanslar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Ajans Yönetimi</h1>
        {currentUserRole === 'superuser' && (
          <Dialog open={isModalOpen} onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) { 
              setModalError(null);
              setNewAgencyName("");
              setNewContactPerson("");
              setNewAgencyPhones("");
              setNewAgencyIsActive(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-1 px-4 py-2">
                <PlusCircle className="h-5 w-5" /> Yeni Ajans Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni Ajans Ekle</DialogTitle>
                <DialogDescription>
                  Yeni ajansın bilgilerini girin. Ajansa kullanıcı atamaları daha sonra ajans detaylarından yapılacaktır.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2 pb-4">
                <div className="space-y-2">
                  <Label htmlFor="dialogNewAgencyName">Ajans Adı (Opsiyonel)</Label>
                  <Input id="dialogNewAgencyName" value={newAgencyName} onChange={(e) => setNewAgencyName(e.target.value)} placeholder="Örn: Global Turizm" disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dialogNewContactPerson">Yetkili Adı Soyadı</Label>
                  <Input id="dialogNewContactPerson" value={newContactPerson} onChange={(e) => setNewContactPerson(e.target.value)} placeholder="Örn: Ahmet Yılmaz" disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dialogNewAgencyPhones">Telefon Numaraları (virgülle ayırın)</Label>
                  <Input id="dialogNewAgencyPhones" value={newAgencyPhones} onChange={(e) => setNewAgencyPhones(e.target.value)} placeholder="örn. 5551234567" disabled={isSubmitting} />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox id="newAgencyIsActive" checked={newAgencyIsActive} onCheckedChange={(checked) => setNewAgencyIsActive(checked as boolean)} disabled={isSubmitting} />
                  <Label htmlFor="newAgencyIsActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Aktif Ajans
                  </Label>
                </div>
                {modalError && <p className="text-sm text-red-500">{modalError}</p>}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button" disabled={isSubmitting}>İptal</Button></DialogClose>
                <Button type="button" onClick={handleAddNewAgency} disabled={isSubmitting} className="gap-1">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Ekleniyor...</> : "Ajans Ekle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 border border-red-400 rounded-lg">{error}</div>}

      {agencies.length === 0 && !isLoading && !error ? (
        <div className="text-center text-gray-500 py-16 px-6 border border-dashed rounded-lg">
          <Building size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold mb-2">Henüz Kayıtlı Ajans Yok</h2>
          <p className="text-base mb-6">Sistemde görüntülenecek bir ajans bulunmamaktadır.</p>
          {currentUserRole === 'superuser' && 
            <p className="text-sm">Yukarıdaki "Yeni Ajans Ekle" butonu ile ilk ajansınızı ekleyebilirsiniz.</p> } 
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agencies.map((agency) => (
            <AgencyCard key={agency.id} agency={agency} onToggleActive={handleToggleActive} onDeleteAgency={handleDeleteAgency} />
          ))}
        </div>
      )}
    </div>
  );
} 