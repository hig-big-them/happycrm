"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';
import { Button } from '../../components/ui/button';
import { Loader2 } from 'lucide-react';

export default function BypassLoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Bypass giriş deneniyor...');
  const [loading, setLoading] = useState(false);

  const performBypass = async () => {
    setLoading(true);
    setStatus('Session oluşturuluyor...');
    
    try {
      // localStorage'a fake user session ekle
      const fakeUser = {
        id: '6d518f9b-fe4f-4246-942d-420fa780cb58',
        email: 'halilg@gmail.com',
        role: 'superuser',
        created_at: new Date().toISOString()
      };
      
      // Fake session data
      const fakeSession = {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        user: fakeUser,
        expires_at: Date.now() + 86400000 // 24 saat
      };
      
      localStorage.setItem('sb-kvjblasewcrztzcfrkgq-auth-token', JSON.stringify(fakeSession));
      
      setStatus('✅ Başarılı! Dashboard\'a yönlendiriliyor...');
      
      setTimeout(() => {
        window.location.href = '/dashboard?bypass=true';
      }, 1000);
      
    } catch (error) {
      console.error('Bypass error:', error);
      setStatus('❌ Bypass başarısız. Normal giriş yapın.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">🔓 Geçici Bypass</h1>
          <p className="text-gray-600">{status}</p>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="text-sm text-yellow-800">
            <div className="font-semibold">⚠️ Geçici Çözüm</div>
            <div>Sadece geliştirme amaçlı</div>
            <div>Email: halilg@gmail.com</div>
          </div>
        </div>
        
        {!loading && (
          <Button 
            onClick={performBypass}
            className="w-full mb-4"
          >
            Bypass Giriş Yap
          </Button>
        )}
        
        {loading && (
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            İşleniyor...
          </div>
        )}
        
        <Button 
          variant="outline"
          onClick={() => router.push('/login')}
          className="w-full"
        >
          Normal Giriş Sayfasına Dön
        </Button>
      </div>
    </div>
  );
}