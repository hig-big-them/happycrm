"use client";

import { useEffect, useState } from 'react';
import { createClient } from '../../lib/supabase/client';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

interface SessionDiagnostic {
  timestamp: string;
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  data?: any;
}

export default function SessionDebugPage() {
  const [diagnostics, setDiagnostics] = useState<SessionDiagnostic[]>([]);
  const [loading, setLoading] = useState(false);

  const addDiagnostic = (test: string, status: 'success' | 'error' | 'warning', message: string, data?: any) => {
    setDiagnostics(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      test,
      status,
      message,
      data
    }]);
  };

  const runDiagnostics = async () => {
    setLoading(true);
    setDiagnostics([]);

    // 1. Browser Detection
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    addDiagnostic('Browser', isSafari ? 'warning' : 'success', 
      isSafari ? 'Safari tespit edildi' : 'Chrome/Firefox tespit edildi');

    // 2. Storage Access Test
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      addDiagnostic('localStorage', 'success', 'localStorage erişilebilir');
    } catch (error) {
      addDiagnostic('localStorage', 'error', 'localStorage erişim hatası', error);
    }

    try {
      sessionStorage.setItem('test', 'test');
      sessionStorage.removeItem('test');
      addDiagnostic('sessionStorage', 'success', 'sessionStorage erişilebilir');
    } catch (error) {
      addDiagnostic('sessionStorage', 'error', 'sessionStorage erişim hatası', error);
    }

    // 3. Cookie Support Test
    document.cookie = 'test=test; path=/';
    const cookieExists = document.cookie.includes('test=test');
    addDiagnostic('Cookies', cookieExists ? 'success' : 'error', 
      cookieExists ? 'Cookie desteği var' : 'Cookie desteği yok');

          // 4. Supabase Client Creation
      try {
        const supabase = createClient();
        addDiagnostic('Supabase Client', 'success', 'Supabase client oluşturuldu');
        
        // Safari-specific logging
        if (isSafari) {
          addDiagnostic('Safari Mode', 'warning', 'Safari optimizasyonları aktif');
        }

      // 5. Session Check
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        addDiagnostic('Session Check', 'error', 'Session alınamadı', sessionError);
      } else if (session?.session) {
        addDiagnostic('Session Check', 'success', 'Session mevcut', {
          user: session.session.user?.email,
          expires: session.session.expires_at
        });
      } else {
        addDiagnostic('Session Check', 'warning', 'Session yok');
      }

      // 6. User Check
      const { data: user, error: userError } = await supabase.auth.getUser();
      if (userError) {
        addDiagnostic('User Check', 'error', 'User alınamadı', userError);
      } else if (user?.user) {
        addDiagnostic('User Check', 'success', 'User mevcut', {
          email: user.user.email,
          id: user.user.id
        });
      } else {
        addDiagnostic('User Check', 'warning', 'User yok');
      }

      // 7. Storage Keys Check
      const allKeys = Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('sb-'));
      addDiagnostic('Storage Keys', allKeys.length > 0 ? 'success' : 'warning', 
        `${allKeys.length} Supabase key bulundu`, allKeys);

      // 8. Direct Login Test
      addDiagnostic('Login Test', 'warning', 'Test login deneniyor...');
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'halilg@gmail.com',
        password: 'Seraphan123!'
      });

      if (loginError) {
        addDiagnostic('Login Test', 'error', 'Login başarısız', loginError);
      } else if (loginData?.session) {
        addDiagnostic('Login Test', 'success', 'Login başarılı!', {
          user: loginData.user?.email,
          session: !!loginData.session
        });

        // 9. Session Persistence Test
        setTimeout(async () => {
          const { data: checkSession } = await supabase.auth.getSession();
          addDiagnostic('Session Persistence', 
            checkSession?.session ? 'success' : 'error',
            checkSession?.session ? 'Session kalıcı' : 'Session kayboldu'
          );
        }, 2000);
      }

    } catch (error) {
      addDiagnostic('Supabase Client', 'error', 'Supabase client hatası', error);
    }

    setLoading(false);
  };

  const clearData = () => {
    // Clear all Supabase related data
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
    
    // Clear cookies
    document.cookie.split(";").forEach(cookie => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      if (name.includes('supabase') || name.includes('sb-')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    });

    addDiagnostic('Data Clear', 'success', 'Tüm Supabase verileri temizlendi');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>🔍 Supabase Session Diagnostics</CardTitle>
          <p className="text-sm text-gray-600">Safari login sorunlarını tespit etmek için</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Button onClick={runDiagnostics} disabled={loading}>
              {loading ? 'Test Ediliyor...' : 'Diagnostik Çalıştır'}
            </Button>
            <Button variant="outline" onClick={clearData}>
              Verileri Temizle
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/login'}>
              Login Sayfasına Git
            </Button>
          </div>

          <div className="space-y-2">
            {diagnostics.map((diag, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                diag.status === 'success' ? 'bg-green-50 border-green-200' :
                diag.status === 'error' ? 'bg-red-50 border-red-200' :
                'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{diag.test}</span>
                    <span className="ml-2 text-sm">
                      {diag.status === 'success' ? '✅' : diag.status === 'error' ? '❌' : '⚠️'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{diag.timestamp}</span>
                </div>
                <div className="text-sm mt-1">{diag.message}</div>
                {diag.data && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer">Detayları göster</summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(diag.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 