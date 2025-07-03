"use client"

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../components/auth-provider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { 
  Loader2, 
  Users, 
  Building, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Plus,
  Target,
  Calendar,
  Mail,
  Phone
} from 'lucide-react'
import Link from 'next/link'
import { isBypassMode, getBypassUser, mockDashboardData } from '../../lib/utils/bypass-helper'

interface DashboardStats {
  totalLeads: number
  totalCompanies: number
  totalValue: number
  conversionRate: number
  leadsThisMonth: number
  companiesThisMonth: number
}

interface RecentLead {
  id: string
  lead_name: string
  company_name?: string
  contact_email?: string
  contact_phone?: string
  stage_name?: string
  lead_value?: number
  created_at: string
}

interface StageStats {
  id: string
  name: string
  count: number
  total_value: number
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading, refreshSession } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([])
  const [stageStats, setStageStats] = useState<StageStats[]>([])

  useEffect(() => {
    async function checkAuthAndLoadData() {
      console.log('📊 [DASHBOARD] Auth state:', { user: !!user, authLoading })
      
      // Auth loading durumunda bekle
      if (authLoading) {
        return
      }
      
      // User yoksa login'e yönlendir
      if (!user) {
        console.log('❌ [DASHBOARD] No user, redirecting to login')
        router.replace('/login')
        return
      }
      
      console.log('✅ [DASHBOARD] User authenticated, loading data')
      
      try {
        // Bypass modu kontrolü
        if (isBypassMode()) {
          const bypassUser = getBypassUser();
          if (bypassUser) {
            console.log('🔓 [DASHBOARD] Bypass mode detected, using mock data');
            await loadMockDashboardData();
            setIsLoading(false);
            return;
          }
        }
        
        // Normal dashboard data yükleme
        await loadDashboardData()
        setIsLoading(false)
        
      } catch (error) {
        console.error("❌ [DASHBOARD] Data loading error:", error)
        // Session refresh deneme
        try {
          await refreshSession()
        } catch (refreshError) {
          console.error("❌ [DASHBOARD] Session refresh failed:", refreshError)
          router.replace('/login')
        }
        setIsLoading(false)
      }
    }
    
    checkAuthAndLoadData()
  }, [user, authLoading, router, refreshSession])

  async function loadMockDashboardData() {
    // Mock data'yı state'e set et
    setStats(mockDashboardData.stats);
    setRecentLeads(mockDashboardData.recentLeads);
    setStageStats(mockDashboardData.stageStats);
  }

  async function loadDashboardData() {
    try {
      // Dashboard istatistiklerini çek
      const [leadsResponse, companiesResponse, stagesResponse] = await Promise.all([
        // Leads verisi
        supabase
          .from('leads')
          .select(`
            id,
            lead_name,
            lead_value,
            created_at,
            contact_email,
            contact_phone,
            company:companies(company_name),
            stage:stages(name)
          `)
          .order('created_at', { ascending: false }),
        
        // Companies verisi  
        supabase
          .from('companies')
          .select('id, created_at')
          .eq('is_active', true),
          
        // Stage istatistikleri
        supabase
          .from('leads')
          .select(`
            stage_id,
            lead_value,
            stage:stages(id, name)
          `)
      ])

      if (leadsResponse.error || companiesResponse.error || stagesResponse.error) {
        console.error("Dashboard data fetch error:", {
          leads: leadsResponse.error,
          companies: companiesResponse.error,
          stages: stagesResponse.error
        })
        return
      }

      const leads = leadsResponse.data || []
      const companies = companiesResponse.data || []
      const leadsWithStages = stagesResponse.data || []

      // Bu ayın başlangıcı
      const thisMonthStart = new Date()
      thisMonthStart.setDate(1)
      thisMonthStart.setHours(0, 0, 0, 0)

      // İstatistikleri hesapla
      const totalLeads = leads.length
      const totalCompanies = companies.length
      const totalValue = leads.reduce((sum, lead) => sum + (lead.lead_value || 0), 0)
      
      const leadsThisMonth = leads.filter(lead => 
        new Date(lead.created_at || '') >= thisMonthStart
      ).length
      
      const companiesThisMonth = companies.filter(company => 
        new Date(company.created_at || '') >= thisMonthStart
      ).length

      // Conversion rate hesapla (basit örnek)
      const wonLeads = leadsWithStages.filter(lead => 
        lead.stage?.name?.toLowerCase().includes('kazanıldı') || 
        lead.stage?.name?.toLowerCase().includes('won')
      ).length
      const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0

      setStats({
        totalLeads,
        totalCompanies,
        totalValue,
        conversionRate,
        leadsThisMonth,
        companiesThisMonth
      })

      // Son 5 lead'i hazırla
      const recentLeadsData = leads.slice(0, 5).map(lead => ({
        id: lead.id,
        lead_name: lead.lead_name,
        company_name: lead.company?.company_name,
        contact_email: lead.contact_email,
        contact_phone: lead.contact_phone,
        stage_name: lead.stage?.name,
        lead_value: lead.lead_value,
        created_at: lead.created_at || ''
      }))
      setRecentLeads(recentLeadsData)

      // Stage istatistiklerini hesapla
      const stageStatsMap = new Map<string, {id: string, name: string, count: number, total_value: number}>()
      
      leadsWithStages.forEach(lead => {
        if (lead.stage) {
          const stageId = lead.stage.id
          const existing = stageStatsMap.get(stageId)
          
          if (existing) {
            existing.count += 1
            existing.total_value += lead.lead_value || 0
          } else {
            stageStatsMap.set(stageId, {
              id: stageId,
              name: lead.stage.name,
              count: 1,
              total_value: lead.lead_value || 0
            })
          }
        }
      })
      
      setStageStats(Array.from(stageStatsMap.values()))

    } catch (error) {
      console.error("Dashboard data loading error:", error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { 
      style: 'currency', 
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('tr-TR', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString))
  }

  // Loading state - auth loading veya data loading
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">
            {authLoading ? 'Kimlik doğrulanıyor...' : 'Dashboard yükleniyor...'}
          </p>
        </div>
      </div>
    )
  }
  
  // Auth guard
  if (!user) {
    return null
  }
  
  return (
    <div className="container mx-auto py-8 px-4 md:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Hoş geldiniz, {user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/pipelines">
              <Building className="h-4 w-4 mr-2" />
              Pipeline (Şehirler)
            </Link>
          </Button>
          <Button asChild>
            <Link href="/leads">
              <Users className="h-4 w-4 mr-2" />
              Müşteri Adayları
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Müşteri Adayı</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLeads || 0}</div>
            <p className="text-xs text-muted-foreground">
              Bu ay +{stats?.leadsThisMonth || 0} yeni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktif Pipeline</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stageStats.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Toplam stage sayısı
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Değer</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.totalValue || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Tüm pipeline değeri
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dönüşüm Oranı</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">%{(stats?.conversionRate || 0).toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              Kazanılan/Toplam lead
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Pipeline Overview */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Pipeline Özeti</CardTitle>
            <CardDescription>
              Her aşamadaki müşteri adayları ve toplam değerleri
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stageStats.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{stage.name}</p>
                      <p className="text-sm text-muted-foreground">{stage.count} müşteri adayı</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(stage.total_value)}</p>
                    <Badge variant="outline">{stage.count}</Badge>
                  </div>
                </div>
              ))}
              
              {stageStats.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Henüz pipeline verisi yok</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Leads */}
        <Card className="col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Son Müşteri Adayları</CardTitle>
              <CardDescription>
                En son eklenen 5 müşteri adayı
              </CardDescription>
            </div>
            <Button size="sm" asChild>
              <Link href="/leads/new">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{lead.lead_name}</p>
                    {lead.company_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        {lead.company_name}
                      </p>
                    )}
                    {lead.contact_email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {lead.contact_email}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(lead.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    {lead.lead_value && (
                      <p className="text-sm font-medium text-green-600">
                        {formatCurrency(lead.lead_value)}
                      </p>
                    )}
                    {lead.stage_name && (
                      <Badge variant="outline" className="text-xs">
                        {lead.stage_name}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              
              {recentLeads.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Henüz müşteri adayı yok</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Hızlı İşlemler</CardTitle>
          <CardDescription>
            Sık kullanılan işlemlere hızlı erişim
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href="/leads/new">
                <Plus className="h-6 w-6" />
                <span>Yeni Müşteri Adayı</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href="/pipelines">
                <Building className="h-6 w-6" />
                <span>Pipeline Yönetimi</span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href="/leads">
                <Target className="h-6 w-6" />
                <span>Pipeline Görünümü</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}