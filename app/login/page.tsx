"use client";

import * as React from "react";
import { useRouter } from 'next/navigation'; // App Router için
import { Button } from "../../components/ui/button";
import {
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle
} from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { createClient } from '../../lib/supabase/client'
import { useAuth } from '../../components/auth-provider'
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from 'react'

export default function LoginPage() {
  const supabase = createClient()
  const { refreshSession } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [isSafariBrowser, setIsSafariBrowser] = useState(false)
  const router = useRouter()

  // Safari detection
  useEffect(() => {
    const ua = window.navigator.userAgent
    const safari = /^((?!chrome|android).)*safari/i.test(ua)
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsSafariBrowser(safari || ios)
  }, [])

  // Sayfa yüklendiğinde oturum durumunu kontrol et
  useEffect(() => {
    async function checkSession() {
      try {
        // Safari için özel session kontrolü
        if (isSafariBrowser) {
          // Clear any stale auth data
          const authKeys = ['supabase.auth.token', 'sb-auth-token']
          authKeys.forEach(key => {
            try {
              const hasStaleData = localStorage.getItem(key)
              if (hasStaleData) {
                const data = JSON.parse(hasStaleData)
                if (data.expires_at && new Date(data.expires_at * 1000) < new Date()) {
                  localStorage.removeItem(key)
                  sessionStorage.removeItem(key)
                }
              }
            } catch {}
          })
        }
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        // Eğer aktif bir oturum varsa dashboard'a yönlendir
        if (session) {
          router.replace('/dashboard')
        }
      } catch (error) {
        console.error('Session check error:', error)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    
    checkSession()
  }, [router, supabase, isSafariBrowser])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Safari için özel temizlik
      if (isSafariBrowser) {
        console.log('🍎 [LOGIN] Safari pre-login cleanup...')
        try {
          // Clear all auth-related storage
          const authKeys = Object.keys(localStorage).filter(key => 
            key.includes('supabase') || key.includes('auth') || key.includes('sb-')
          )
          console.log('🍎 [LOGIN] Clearing keys:', authKeys)
          authKeys.forEach(key => {
            localStorage.removeItem(key)
            sessionStorage.removeItem(key)
          })
          
          // Clear cookies
          document.cookie.split(";").forEach(cookie => {
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            if (name.includes('sb_') || name.includes('supabase')) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
          });
          
          console.log('🍎 [LOGIN] Safari cleanup complete')
        } catch (err) {
          console.warn('🍎 [LOGIN] Safari cleanup warning:', err)
        }
      }

      console.log('🔐 [LOGIN] Attempting login...', { email, isSafari: isSafariBrowser })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          // Safari için ekstra güvenlik
          ...(isSafariBrowser && {
            captchaToken: undefined, // Safari'de captcha sorunları olabiliyor
          })
        }
      })
      
      console.log('🔐 [LOGIN] Login result:', { 
        hasData: !!data, 
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        userEmail: data?.user?.email,
        error: error?.message 
      })

      if (error) {
        // Rate limit hatası için özel mesaj
        if (error.message?.includes('rate limit') || error.message?.includes('Too many requests')) {
          throw new Error('Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.')
        }
        throw error
      }

      // Oturum başarıyla oluşturulduysa yönlendir
      if (data.session) {
        console.log('✅ [LOGIN] Session created, refreshing auth provider...')
        
        // AuthProvider'ı manuel olarak yenile
        try {
          await refreshSession()
          console.log('✅ [LOGIN] Auth provider refreshed')
        } catch (refreshError) {
          console.warn('⚠️ [LOGIN] Auth provider refresh failed:', refreshError)
        }
        
        // Kısa bir bekleme sonrası yönlendir
        setTimeout(() => {
          console.log('✅ [LOGIN] Redirecting to dashboard...')
          // Router yerine window.location kullan
          window.location.href = '/dashboard'
        }, 1000)
      }
    } catch (error: any) {
      console.error('Login hatası:', error)
      setError(error.message || 'Giriş yapılırken bir hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

  const clearCache = async () => {
    try {
      const response = await fetch('/api/debug/clear-all-cache', { method: 'POST' });
      const result = await response.json();
      console.log('Cache clear result:', result);
      
      // Tüm localStorage ve sessionStorage'ı temizle
      localStorage.clear();
      sessionStorage.clear();
      
      // Service worker cache temizle
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Hard reload
      window.location.reload();
    } catch (error) {
      console.error('Cache clear error:', error);
      // Fallback olarak normal reload
      window.location.reload();
    }
  }

  const bypassLogin = async () => {
    try {
      setIsLoading(true);
      
      // Redirect to bypass login page
      router.push('/bypass-login');
      
    } catch (error) {
      console.error('Bypass login error:', error);
      setError('Bypass login başarısız');
      setIsLoading(false);
    }
  }

  // Oturum durumu kontrol edilirken loading göster
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Giriş Yap</CardTitle>
          <CardDescription>
            Hesabınıza erişmek için email ve şifrenizi girin.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="ornek@mail.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-center space-y-3">
            <Button type="submit" className="w-full gap-1" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Giriş Yapılıyor...</>
              ) : (
                "Giriş Yap"
              )}
            </Button>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
              Şifremi Unuttum?
            </Link>
            
            {/* Safari uyarısı */}
            {isSafariBrowser && (
              <div className="text-xs text-amber-600 text-center p-2 bg-amber-50 rounded">
                Safari tarayıcısı algılandı. Giriş sorunları yaşarsanız Chrome veya Firefox kullanmanızı öneririz.
              </div>
            )}
            
            {/* Debug paneli */}
            <div className="mt-4 space-y-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs"
              >
                {showDebug ? 'Debug Gizle' : 'Debug Göster'}
              </Button>
              
              {showDebug && (
                <div className="space-y-2 p-3 bg-gray-50 rounded border text-xs">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={clearCache}
                    className="w-full text-xs"
                  >
                    Cache Temizle & Yenile
                  </Button>
                  <div className="text-gray-600">
                    Rate limit hatası varsa birkaç dakika bekleyin ve cache temizleyin.
                    <br />
                    <strong>Bypass sistemi geçici olarak devre dışı.</strong>
                  </div>
                </div>
              )}
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 