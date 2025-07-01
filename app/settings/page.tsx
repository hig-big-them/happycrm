"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { createClient } from '../../lib/supabase/client';
import Link from "next/link";

export default function SettingsPage() {
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
    <div className="space-y-6 container">
      <h1 className="text-3xl font-bold mb-4">Kullanıcı Ayarları</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hesap Ayarları</CardTitle>
            <CardDescription>
              Hesap bilgilerinizi ve şifrenizi buradan yönetebilirsiniz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Kullanıcı adınızı değiştirme ve şifrenizi güncelleme gibi işlemleri buradan yapabilirsiniz.
            </p>
            <Button 
              variant="outline"
              onClick={() => router.push('/account/settings')}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <span>Hesap Ayarlarını Yönet</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Bildirim Ayarları</CardTitle>
            <CardDescription>
              Bildirim tercihlerinizi buradan yönetebilirsiniz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Transfer bildirimleri, arama tercihleri ve diğer bildirim ayarlarınızı buradan düzenleyebilirsiniz.
            </p>
            <Button 
              variant="outline"
              onClick={() => router.push('/notification-settings')}
              className="w-full sm:w-auto flex items-center gap-2"
            >
              <span>Bildirim Ayarlarını Yönet</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
