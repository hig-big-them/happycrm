"use client";

import * as React from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "../../components/ui/dialog";
import { createClient } from "../../lib/supabase/client";
import { PlusCircle, Edit3, ToggleLeft, ToggleRight, Trash2, Loader2, Users, Building, Mail, Phone, Globe, MapPin } from "lucide-react";
import { Checkbox } from "../../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

// Şirket veri tipi
interface Company {
  id: string;
  company_name: string;
  primary_contact?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  industry?: string | null;
  size_category?: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

// Şirket Kartı Komponenti
function CompanyCard({ 
  company, 
  onToggleActive, 
  onDeleteCompany 
}: { 
  company: Company; 
  onToggleActive: (companyId: string, currentStatus: boolean) => Promise<void>; 
  onDeleteCompany: (companyId: string) => Promise<void>; 
}) {
  const [isToggling, setIsToggling] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleToggle = async () => {
    setIsToggling(true);
    await onToggleActive(company.id, company.is_active || false);
    setIsToggling(false);
  };

  const handleDelete = async () => {
    if (window.confirm(`'${company.company_name}' şirketini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)){
        setIsDeleting(true);
        await onDeleteCompany(company.id);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{company.company_name}</CardTitle>
            </div>
            <Badge variant={company.is_active ? "default" : "secondary"} className={company.is_active ? "bg-green-500 hover:bg-green-600" : ""}>
                {company.is_active ? "Aktif" : "Pasif"}
            </Badge>
        </div>
        <CardDescription className="space-y-2 mt-3">
          {company.primary_contact && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{company.primary_contact}</span>
            </div>
          )}
          {company.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{company.email}</span>
            </div>
          )}
          {company.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{company.phone}</span>
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-blue-600 hover:underline">
                <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer">
                  {company.website}
                </a>
              </span>
            </div>
          )}
          {company.address && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{company.address}</span>
            </div>
          )}
          {company.industry && (
            <div className="mt-2">
              <Badge variant="outline">{company.industry}</Badge>
              {company.size_category && (
                <Badge variant="outline" className="ml-2">{company.size_category}</Badge>
              )}
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleToggle} disabled={isToggling || isDeleting} className="gap-1">
          {isToggling ? "Değiştiriliyor..." : (company.is_active ? <><ToggleLeft className="h-4 w-4"/> Pasif Yap</> : <><ToggleRight className="h-4 w-4"/> Aktif Yap</>)}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting || isToggling} className="gap-1">
            {isDeleting ? "Siliniyor..." : <><Trash2 className="h-4 w-4"/> Sil</>}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function CompaniesPage() {
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [newCompanyName, setNewCompanyName] = React.useState("");
  const [newPrimaryContact, setNewPrimaryContact] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [newWebsite, setNewWebsite] = React.useState("");
  const [newAddress, setNewAddress] = React.useState("");
  const [newIndustry, setNewIndustry] = React.useState("");
  const [newSizeCategory, setNewSizeCategory] = React.useState("");
  const [newIsActive, setNewIsActive] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [modalError, setModalError] = React.useState<string | null>(null);

  const [currentUserRole, setCurrentUserRole] = React.useState<string | undefined>(undefined);

  async function getCurrentUserRole() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserRole(user?.app_metadata?.role);
  }

  async function fetchCompanies() {
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("companies")
      .select(`
        id,
        company_name,
        primary_contact,
        email,
        phone,
        website,
        address,
        industry,
        size_category,
        is_active,
        created_at
      `)
      .order("company_name", { ascending: true });

    if (fetchError) {
      console.error("Şirketler çekilemedi:", fetchError);
      setError("Şirketler yüklenirken bir hata oluştu: " + (fetchError.message || "Detaylı bilgi yok."));
      setCompanies([]);
      return null;
    } else {
      setError(null);
      setCompanies(data as Company[] || []);
      return data || [];
    }
  }

  React.useEffect(() => {
    async function initialLoad() {
      setIsLoading(true);
      setError(null);
      await getCurrentUserRole();

      const fetchedCompanies = await fetchCompanies();

      if (fetchedCompanies === null) {
        setIsLoading(false);
        return;
      }

      setCompanies(fetchedCompanies);
      setIsLoading(false);
    }
    initialLoad();
  }, []);

  const handleAddNewCompany = async () => {
    const companyNameFromForm = newCompanyName.trim(); 

    if (!companyNameFromForm) {
      setModalError("Şirket adı girilmelidir.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    const companyDataToInsert = { 
      company_name: companyNameFromForm,
      primary_contact: newPrimaryContact.trim() || null,
      email: newEmail.trim() || null,
      phone: newPhone.trim() || null,
      website: newWebsite.trim() || null,
      address: newAddress.trim() || null,
      industry: newIndustry.trim() || null,
      size_category: newSizeCategory.trim() || null,
      is_active: newIsActive,
    };

    try {
      const supabase = createClient();
      const { data: newCompanyData, error: insertError } = await supabase
        .from('companies') 
        .insert(companyDataToInsert)
        .select()
        .single();

      if (insertError) {
        console.error('Yeni şirket ekleme hatası:', insertError);
        setModalError(`Şirket eklenemedi: ${insertError.message}`);
      } else if (newCompanyData) {
        await fetchCompanies(); 
        setIsModalOpen(false);
        setNewCompanyName("");
        setNewPrimaryContact("");
        setNewEmail("");
        setNewPhone("");
        setNewWebsite("");
        setNewAddress("");
        setNewIndustry("");
        setNewSizeCategory("");
        setNewIsActive(true);
      }
    } catch (err) {
      const R_err = err as Error;
      console.error('Beklenmedik şirket ekleme hatası:', R_err);
      setModalError(`Beklenmedik bir hata oluştu: ${R_err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (companyId: string, currentStatus: boolean) => {
    setError(null); 
    const originalCompanies = [...companies];
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, is_active: !currentStatus } : c));

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('companies')
      .update({ is_active: !currentStatus })
      .eq('id', companyId);

    if (updateError) {
      console.error('Şirket durumu güncelleme hatası:', updateError);
      setError("Şirket durumu güncellenirken bir hata oluştu: " + updateError.message);
      setCompanies(originalCompanies); 
    } 
  };
  
  const handleDeleteCompany = async (companyId: string) => {
    setError(null);
    const originalCompanies = [...companies];
    setCompanies(prev => prev.filter(c => c.id !== companyId));

    const supabase = createClient();
    const { error: deleteError } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

    if (deleteError) {
        console.error('Şirket silme hatası:', deleteError);
        setError("Şirket silinirken bir hata oluştu: " + deleteError.message);
        setCompanies(originalCompanies);
    } 
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Şirketler yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Şirket Yönetimi</h1>
        {currentUserRole === 'superuser' && (
          <Dialog open={isModalOpen} onOpenChange={(isOpen) => {
            setIsModalOpen(isOpen);
            if (!isOpen) { 
              setModalError(null);
              setNewCompanyName("");
              setNewPrimaryContact("");
              setNewEmail("");
              setNewPhone("");
              setNewWebsite("");
              setNewAddress("");
              setNewIndustry("");
              setNewSizeCategory("");
              setNewIsActive(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-1 px-4 py-2">
                <PlusCircle className="h-5 w-5" /> Yeni Şirket Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Yeni Şirket Ekle</DialogTitle>
                <DialogDescription>
                  Yeni şirketin bilgilerini girin. Şirket kaydedildikten sonra müşteri adayları bu şirkete bağlanabilir.
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Şirket Adı *</Label>
                  <Input 
                    id="companyName" 
                    value={newCompanyName} 
                    onChange={(e) => setNewCompanyName(e.target.value)} 
                    placeholder="Örn: Teknoloji A.Ş." 
                    disabled={isSubmitting} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryContact">Yetkili Kişi</Label>
                  <Input 
                    id="primaryContact" 
                    value={newPrimaryContact} 
                    onChange={(e) => setNewPrimaryContact(e.target.value)} 
                    placeholder="Örn: Ahmet Yılmaz" 
                    disabled={isSubmitting} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newEmail} 
                    onChange={(e) => setNewEmail(e.target.value)} 
                    placeholder="Örn: info@sirket.com" 
                    disabled={isSubmitting} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input 
                    id="phone" 
                    value={newPhone} 
                    onChange={(e) => setNewPhone(e.target.value)} 
                    placeholder="Örn: +90 212 555 00 00" 
                    disabled={isSubmitting} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input 
                    id="website" 
                    value={newWebsite} 
                    onChange={(e) => setNewWebsite(e.target.value)} 
                    placeholder="Örn: www.sirket.com" 
                    disabled={isSubmitting} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Sektör</Label>
                  <Input 
                    id="industry" 
                    value={newIndustry} 
                    onChange={(e) => setNewIndustry(e.target.value)} 
                    placeholder="Örn: Teknoloji" 
                    disabled={isSubmitting} 
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Adres</Label>
                  <Input 
                    id="address" 
                    value={newAddress} 
                    onChange={(e) => setNewAddress(e.target.value)} 
                    placeholder="Örn: Maslak Mahallesi, İstanbul" 
                    disabled={isSubmitting} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sizeCategory">Şirket Büyüklüğü</Label>
                  <Select value={newSizeCategory} onValueChange={setNewSizeCategory} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Büyüklük seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Küçük">Küçük (1-50 çalışan)</SelectItem>
                      <SelectItem value="Orta">Orta (51-250 çalışan)</SelectItem>
                      <SelectItem value="Büyük">Büyük (250+ çalışan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isActive" 
                    checked={newIsActive} 
                    onCheckedChange={(checked) => setNewIsActive(checked as boolean)} 
                    disabled={isSubmitting} 
                  />
                  <Label htmlFor="isActive" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Aktif Şirket
                  </Label>
                </div>
              </div>
              {modalError && <p className="text-sm text-red-500">{modalError}</p>}
              <DialogFooter>
                <DialogClose asChild><Button variant="outline" type="button" disabled={isSubmitting}>İptal</Button></DialogClose>
                <Button type="button" onClick={handleAddNewCompany} disabled={isSubmitting} className="gap-1">
                  {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Ekleniyor...</> : "Şirket Ekle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && <div className="mb-6 p-4 bg-red-100 text-red-700 border border-red-400 rounded-lg">{error}</div>}

      {companies.length === 0 && !isLoading && !error ? (
        <div className="text-center text-gray-500 py-16 px-6 border border-dashed rounded-lg">
          <Building size={48} className="mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold mb-2">Henüz Kayıtlı Şirket Yok</h2>
          <p className="text-base mb-6">Sistemde görüntülenecek bir şirket bulunmamaktadır.</p>
          {currentUserRole === 'superuser' && 
            <p className="text-sm">Yukarıdaki "Yeni Şirket Ekle" butonu ile ilk şirketinizi ekleyebilirsiniz.</p> } 
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} onToggleActive={handleToggleActive} onDeleteCompany={handleDeleteCompany} />
          ))}
        </div>
      )}
    </div>
  );
} 