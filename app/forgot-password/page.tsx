"use client";

import * as React from "react";
import { createClient } from "../../lib/supabase/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../../components/ui/card";
import { Loader2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const handlePasswordResetRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Lütfen e-posta adresinizi girin.");
      setIsSubmitting(false);
      return;
    }

    // ÖNEMLİ: redirectTo, şifre güncelleme formunun olduğu URL olmalı.
    // Supabase Auth ayarlarınızda da bu URL'in "Additional Redirect URLs" listesinde olması önerilir.
    const redirectUrl = `${window.location.origin}/account/update-password`; 

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectUrl,
    });

    if (resetError) {
      console.error("Şifre sıfırlama linki gönderme hatası:", resetError);
      setError(`Şifre sıfırlama linki gönderilemedi: ${resetError.message}`);
    } else {
      setMessage("Şifre sıfırlama linki e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.");
      setEmail(""); // Başarı sonrası inputu temizle
    }

    setIsSubmitting(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">Şifremi Unuttum</CardTitle>
          <CardDescription>
            Hesabınıza ait e-posta adresini girin. Şifrenizi sıfırlamanız için size bir link göndereceğiz.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordResetRequest}>
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
          <CardFooter className="flex flex-col items-center space-y-3">
            <Button type="submit" className="w-full gap-1" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</> : "Sıfırlama Linki Gönder"}
            </Button>
            <Link href="/login" className="text-sm text-blue-600 hover:underline">
              Giriş sayfasına dön
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 