"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Giriş işlemi kontrol ediliyor...');
  const supabase = createClient();

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        const type = searchParams.get('type');
        const next = searchParams.get('next') || '/dashboard';
        const bypass = searchParams.get('bypass');
        const userId = searchParams.get('user');

        setStatus('Auth callback işleniyor...');

        if (type === 'recovery') {
          setStatus('Recovery token işleniyor...');
          
          // Handle recovery token
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Recovery error:', error);
            setStatus('Recovery hatası, bypass deneniyor...');
          } else if (data.session) {
            setStatus('Recovery başarılı, yönlendiriliyor...');
            router.push(next);
            return;
          }
        }

        if (bypass === 'true' && userId) {
          setStatus('Bypass login aktif, kullanıcı verisi yükleniyor...');
          
          // Check if user exists in localStorage
          const bypassUser = localStorage.getItem('bypass_user');
          if (bypassUser) {
            setStatus('Bypass kullanıcısı bulundu, dashboard\'a yönlendiriliyor...');
            router.push('/dashboard?bypass=true');
            return;
          }
        }

        // Check current session
        setStatus('Mevcut session kontrol ediliyor...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setStatus('Session hatası: ' + sessionError.message);
        } else if (session) {
          setStatus('Session bulundu, yönlendiriliyor...');
          router.push(next);
        } else {
          setStatus('Session bulunamadı, login\'e yönlendiriliyor...');
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('Hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
        
        // Fallback redirect
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    }

    handleAuthCallback();
  }, [router, searchParams, supabase]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">🔐 Giriş İşlemi</h2>
        <p className="text-gray-600 mb-4">{status}</p>
        <div className="text-sm text-gray-500">
          Lütfen bekleyin, otomatik olarak yönlendirileceksiniz...
        </div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">🔐 Giriş İşlemi</h2>
          <p className="text-gray-600 mb-4">Sayfa yükleniyor...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}