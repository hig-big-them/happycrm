"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { ArrowRight, UserPlus, Loader2, TestTube, Phone, Webhook, Mail, FileText, Settings } from "lucide-react";
import { createClient } from '../../../lib/supabase/client';

export default function AdminSettings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        setIsLoading(true);
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        // Sadece admin erişimi
        const userRole = session.user.app_metadata?.role;
        if (userRole !== 'admin') {
          router.push('/dashboard');
          return;
        }
        
        setUserData(session.user);
      } catch (error) {
        console.error('Auth error:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }
    
    checkAuth();
  }, [router, supabase.auth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="container">
        <h1 className="text-3xl font-bold mb-4">Admin Ayarları</h1>
        <p className="text-muted-foreground mb-6">
          Sistem yönetimi ve kullanıcı işlemleri için admin araçları
        </p>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          {/* Kullanıcı Yönetimi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Kullanıcı Yönetimi
              </CardTitle>
              <CardDescription>
                Kullanıcıları görüntüle ve yönet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline"
                className="w-full justify-start"
                onClick={() => router.push('/admin/manage-users')}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Tüm Kullanıcılar
              </Button>
            </CardContent>
          </Card>

          {/* Ajans Yönetimi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Ajans Yönetimi
              </CardTitle>
              <CardDescription>
                Ajansları yönet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/admin/agencies')}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Ajansları Görüntüle
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/admin/ajans-ve-kullanici-olustur')}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Ajans & Kullanıcı Oluştur
              </Button>
            </CardContent>
          </Card>

          {/* Transfer Yönetimi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="h-5 w-5" />
                Transfer İşlemleri
              </CardTitle>
              <CardDescription>
                Transfer yönetimi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/transfers')}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Tüm Transferler
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/transfers/new')}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Yeni Transfer
              </Button>
            </CardContent>
          </Card>

          {/* Test Araçları */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Test Araçları
              </CardTitle>
              <CardDescription>
                Sistem testleri
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/admin/tools/twilio-test')}
              >
                <Phone className="mr-2 h-4 w-4" />
                Twilio Test
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/admin/tools/email-test')}
              >
                <Mail className="mr-2 h-4 w-4" />
                E-posta Test
              </Button>
            </CardContent>
          </Card>

          {/* Bildirim & Cron İzleme */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Bildirim & Cron İzleme
              </CardTitle>
              <CardDescription>
                Cron işleri ve bildirimleri izleyin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => router.push('/admin/notification-monitor')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Bildirim İzleme
              </Button>
            </CardContent>
          </Card>

          {/* Sistem Bilgileri */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Sistem Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium">Sürüm</h3>
                <p className="text-gray-500">v3.0.0</p>
              </div>
              <div>
                <h3 className="font-medium">Son Güncelleme</h3>
                <p className="text-gray-500">{new Date().toLocaleDateString('tr-TR')}</p>
              </div>
              <div>
                <h3 className="font-medium">Yetki Sistemi</h3>
                <p className="text-gray-500">Basit 3-Rol Sistemi</p>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
} 