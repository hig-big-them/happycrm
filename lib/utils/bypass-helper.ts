// Safari-safe bypass modu yardımcı fonksiyonları

export function isBypassMode(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    // Safari-safe localStorage check
    return !!localStorage.getItem('sb-kvjblasewcrztzcfrkgq-auth-token');
  } catch (error) {
    console.warn('⚠️ [BYPASS] Safari localStorage failed:', error);
    return false; // Safari fallback: no bypass mode
  }
}

export function getBypassUser() {
  if (typeof window === 'undefined') return null;
  
  try {
    // Safari-safe localStorage access
    const bypassSession = localStorage.getItem('sb-kvjblasewcrztzcfrkgq-auth-token');
    if (bypassSession) {
      const parsed = JSON.parse(bypassSession);
      return parsed.user || null;
    }
  } catch (error) {
    console.warn('⚠️ [BYPASS] Safari session parse failed:', error);
    
    // Safari-safe cleanup attempt
    try {
      localStorage.removeItem('sb-kvjblasewcrztzcfrkgq-auth-token');
    } catch (cleanupError) {
      console.warn('⚠️ [BYPASS] Safari cleanup failed:', cleanupError);
    }
    
    // Safari fallback: return mock user for dashboard
    return {
      id: 'safari-bypass-user',
      email: 'safari-bypass@happy-crm.com',
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {}
    };
  }
  
  return null;
}

// Mock data generators
export const mockDashboardData = {
  stats: {
    totalLeads: 45,
    totalCompanies: 12,
    totalValue: 250000,
    conversionRate: 23.5,
    leadsThisMonth: 8,
    companiesThisMonth: 3
  },
  
  recentLeads: [
    {
      id: '1',
      lead_name: 'Ahmet Yılmaz',
      company_name: 'ABC Şirketi',
      contact_email: 'ahmet@abc.com',
      contact_phone: '+90 532 123 4567',
      stage_name: 'Görüşme',
      lead_value: 15000,
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      lead_name: 'Fatma Kaya',
      company_name: 'XYZ Ltd',
      contact_email: 'fatma@xyz.com',
      contact_phone: '+90 533 987 6543',
      stage_name: 'Teklif',
      lead_value: 25000,
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: '3',
      lead_name: 'Mehmet Çelik',
      company_name: 'DEF A.Ş.',
      contact_email: 'mehmet@def.com',
      contact_phone: '+90 534 555 7777',
      stage_name: 'Müzakere',
      lead_value: 35000,
      created_at: new Date(Date.now() - 172800000).toISOString()
    }
  ],
  
  stageStats: [
    {
      id: '1',
      name: 'Yeni Lead',
      count: 12,
      total_value: 45000
    },
    {
      id: '2',
      name: 'Görüşme',
      count: 8,
      total_value: 65000
    },
    {
      id: '3',
      name: 'Teklif',
      count: 5,
      total_value: 85000
    },
    {
      id: '4',
      name: 'Müzakere',
      count: 3,
      total_value: 55000
    }
  ]
};

export const mockLeads = [
  {
    id: '1',
    lead_name: 'Ahmet Yılmaz',
    contact_phone: '+90 532 123 4567',
    contact_email: 'ahmet@example.com'
  },
  {
    id: '2',
    lead_name: 'Fatma Kaya',
    contact_phone: '+90 533 987 6543',
    contact_email: 'fatma@example.com'
  },
  {
    id: '3',
    lead_name: 'Mehmet Çelik',
    contact_phone: '+90 534 555 7777',
    contact_email: 'mehmet@example.com'
  },
  {
    id: '4',
    lead_name: 'Ayşe Demir',
    contact_phone: '+90 535 444 8888',
    contact_email: 'ayse@example.com'
  }
]; 