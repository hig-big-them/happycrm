import Link from "next/link"
import { notFound } from "next/navigation"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Button } from "../../../../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../../components/ui/tabs"
import AgencyUsers from "./_components/agency-users"
import { type Metadata } from "next"

export const metadata: Metadata = {
  title: "Ajans Yönetimi",
  description: "Ajans detayları ve yönetim paneli",
}

export default async function ManageAgencyPage({
  params,
}: {
  params: Promise<{ agencyId: string }>
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  // params'i await etme hatasını çözmek için
  const { agencyId } = await params
  
  // Server bileşeninde Supabase istemcisi oluştur
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
  
  // Ajans verilerini getir
  const { data: agency, error } = await supabase
    .from("agencies")
    .select("*")
    .eq("id", agencyId)
    .single()
  
  if (error || !agency) {
    console.error("Ajans detayları getirilemedi:", error)
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{agency.name}</h1>
          <p className="text-muted-foreground mt-1">Ajans detayları ve yönetimi</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/agencies">Ajans Listesine Dön</Link>
          </Button>
          <Button>Düzenle</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="settings">Ayarlar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Ajans Bilgileri</CardTitle>
                <CardDescription>Ajans temel bilgileri</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <div className="text-sm font-medium">Ajans Adı:</div>
                  <div>{agency.name}</div>
                  
                  <div className="text-sm font-medium">Durum:</div>
                  <div>
                    <span className={`px-2 py-1 rounded-full text-xs ${agency.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {agency.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  
                  <div className="text-sm font-medium">Oluşturulma:</div>
                  <div>{new Date(agency.created_at).toLocaleDateString("tr-TR")}</div>
                  
                  <div className="text-sm font-medium">İletişim Kişisi:</div>
                  <div>
                    {agency.contact_information && typeof agency.contact_information === 'object'
                      ? (agency.contact_information as any).name || '-'
                      : '-'}
                  </div>
                  
                  <div className="text-sm font-medium">Telefon:</div>
                  <div>
                    {agency.contact_information && typeof agency.contact_information === 'object'
                      ? (agency.contact_information as any).phone || '-'
                      : '-'}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Detaylar</CardTitle>
                <CardDescription>Ajans hakkında ek bilgiler</CardDescription>
              </CardHeader>
              <CardContent>
                {agency.details && typeof agency.details === 'object'
                  ? (agency.details as any).description || 'Detay bilgisi bulunmuyor.'
                  : 'Detay bilgisi bulunmuyor.'}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="users" className="space-y-4 pt-4">
          <AgencyUsers agencyId={agencyId} />
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Ajans Ayarları</CardTitle>
              <CardDescription>Ajans ile ilgili temel ayarlar</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Bu bölüm henüz geliştirme aşamasındadır.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 