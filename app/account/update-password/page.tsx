"use client";

import * as React from "react";
import { createClient } from "../../../lib/supabase/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../../components/ui/card";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation"; // useSearchParams eklendi (gerçi # fragment için doğrudan işe yaramaz)
import Link from "next/link";

export default function UpdatePasswordPage() {
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isValidSession, setIsValidSession] = React.useState(false); // Recovery session geçerli mi?
  const [isLoading, setIsLoading] = React.useState(true); // Sayfa yüklenme durumu
  const router = useRouter();

  React.useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = createClient();
      
      // Handle hash fragments for password recovery
      if (typeof window !== 'undefined') {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        if (accessToken && refreshToken && type === 'recovery') {
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) throw error;
            
            setIsValidSession(true);
            setIsLoading(false);
            return;
          } catch (error) {
            console.error('Recovery session error:', error);
            setError('Şifre sıfırlama linki geçersiz veya süresi dolmuş.');
            setIsLoading(false);
            return;
          }
        }
      }
      
      // Check existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValidSession(true);
      } else {
        setError("Geçersiz veya süresi dolmuş şifre sıfırlama linki. Lütfen tekrar deneyin.");
      }
        setIsLoading(false);
    }
    
    handleAuthCallback();
  }, [router]);

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    if (password.length < 6) { // Supabase varsayılan olarak min 6 karakter ister
        setError("Şifre en az 6 karakter olmalıdır.");
        return;
    }

    setIsSubmitting(true);

    // Recovery session'ı olduğu için updateUser doğrudan çalışacaktır.
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ 
        password: password 
    });

    if (updateError) {
      console.error("Şifre güncelleme hatası:", updateError);
      setError(`Şifre güncellenemedi: ${updateError.message}`);
    } else {
      setMessage("Şifreniz başarıyla güncellendi. Şimdi giriş yapabilirsiniz.");
      // Başarı sonrası şifre alanlarını temizle
      setPassword("");
      setConfirmPassword("");
      // Kullanıcıyı login sayfasına yönlendir
      setTimeout(() => router.push('/login'), 2000); 
    }

    setIsSubmitting(false);
  };
  
  if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="ml-2">Oturum kontrol ediliyor...</p>
        </div>
      );
  }

  if (!isValidSession) {
      return (
        <div className="container mx-auto py-10 px-4 md:px-0 text-center">
          <Card className="max-w-md mx-auto">
               <CardHeader>
                   <CardTitle>Geçersiz İstek</CardTitle>
               </CardHeader>
               <CardContent>
                   <p className="text-red-600">Şifre sıfırlama linki geçersiz veya süresi dolmuş. Lütfen şifre sıfırlama işlemini tekrar başlatın.</p>
               </CardContent>
               <CardFooter>
                   <Link href="/forgot-password" className="w-full" legacyBehavior>
                       <Button variant="outline" className="w-full">Şifre Sıfırlama Sayfasına Git</Button>
                   </Link>
               </CardFooter>
          </Card>
        </div>
      );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Yeni Şifre Belirle</CardTitle>
          <CardDescription>
            Lütfen yeni şifrenizi girin.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdatePassword}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Yeni Şifre</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            {message && (
              <p className="text-sm text-green-600 text-center">{message}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full gap-1" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Güncelleniyor...</> : "Şifreyi Güncelle"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 