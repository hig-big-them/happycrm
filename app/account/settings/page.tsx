"use client";

import * as React from "react";
import { createClient } from "../../../lib/supabase/client";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Separator } from "../../../components/ui/separator";

export default function AccountSettingsPage() {
  // Username states
  const [currentUsername, setCurrentUsername] = React.useState<string | null | undefined>(undefined);
  const [newUsername, setNewUsername] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true); // Genel yükleme (profil için)
  const [isUsernameSubmitting, setIsUsernameSubmitting] = React.useState(false);
  const [usernameError, setUsernameError] = React.useState<string | null>(null);
  const [usernameSuccessMessage, setUsernameSuccessMessage] = React.useState<string | null>(null);
  
  // Password states
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmNewPassword, setConfirmNewPassword] = React.useState("");
  const [isPasswordSubmitting, setIsPasswordSubmitting] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = React.useState<string | null>(null);

  const router = useRouter();

  // Fetch user profile (username)
  React.useEffect(() => {
    async function fetchUserProfile() {
      setIsLoading(true);
      setUsernameError(null);
      setUsernameSuccessMessage(null);
      setPasswordError(null); // Reset password errors on load
      setPasswordSuccessMessage(null);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { 
          console.error("Kullanıcı profili çekilemedi:", profileError);
          setUsernameError("Kullanıcı bilgileriniz yüklenirken bir hata oluştu.");
          setCurrentUsername(null); 
        } else if (profile) {
          setCurrentUsername(profile.username);
          setNewUsername(profile.username || "");
        } else {
          setCurrentUsername(null); 
        }
      } else {
        setUsernameError("Kullanıcı oturumu bulunamadı. Lütfen giriş yapın.");
        // router.push("/login");
      }
      setIsLoading(false);
    }
    fetchUserProfile();
  }, [router]);

  // Handle username update
  const handleUpdateUsername = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsUsernameSubmitting(true);
    setUsernameError(null);
    setUsernameSuccessMessage(null);

    if (!newUsername.trim()) {
      setUsernameError("Kullanıcı adı boş bırakılamaz.");
      setIsUsernameSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('update_username', { new_username: newUsername.trim() });

    if (rpcError) {
      console.error("Kullanıcı adı güncelleme hatası:", rpcError);
      if (rpcError.message.includes("violates unique constraint")) {
        setUsernameError("Bu kullanıcı adı zaten alınmış. Lütfen farklı bir kullanıcı adı deneyin.");
      } else if (rpcError.message.includes("username_validation")) { // Check constraint'i kontrol et
        setUsernameError("Kullanıcı adı formatı geçersiz (sadece harf, rakam, '_').");
      }
      else {
        setUsernameError(`Kullanıcı adı güncellenemedi: ${rpcError.message}`);
      }
    } else {
      setUsernameSuccessMessage("Kullanıcı adınız başarıyla güncellendi!");
      setCurrentUsername(newUsername.trim());
      // setNewUsername(""); // Formu temizle, opsiyonel
      router.refresh(); 
    }
    setIsUsernameSubmitting(false);
  };

  // Handle password change
  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccessMessage(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordError("Yeni şifreler eşleşmiyor.");
      return;
    }
    if (newPassword.length < 6) { 
        setPasswordError("Yeni şifre en az 6 karakter olmalıdır.");
        return;
    }

    setIsPasswordSubmitting(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ 
        password: newPassword 
    });

    if (updateError) {
        console.error("Şifre değiştirme hatası:", updateError);
        setPasswordError(`Şifre değiştirilemedi: ${updateError.message}`);
    } else {
        setPasswordSuccessMessage("Şifreniz başarıyla değiştirildi.");
        setNewPassword("");
        setConfirmNewPassword("");
    }
    setIsPasswordSubmitting(false);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-2">Hesap bilgileriniz yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4 md:px-0">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Username Update Card */}
        <Card>
          <CardHeader>
            <CardTitle>Kullanıcı Adı Ayarları</CardTitle>
            <CardDescription>
              Kullanıcı adınızı buradan güncelleyebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateUsername} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="currentUsername">Mevcut Kullanıcı Adı</Label>
                <Input 
                  id="currentUsername"
                  type="text"
                  value={currentUsername === undefined ? "Yükleniyor..." : (currentUsername || "Henüz tanımlanmamış")}
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newUsername">Yeni Kullanıcı Adı</Label>
                <Input 
                  id="newUsername" 
                  type="text" 
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Yeni kullanıcı adınızı girin"
                  required
                  disabled={isUsernameSubmitting}
                />
              </div>
              {usernameError && <p className="text-sm text-red-500">{usernameError}</p>}
              {usernameSuccessMessage && <p className="text-sm text-green-600">{usernameSuccessMessage}</p>}
              <Button type="submit" className="w-full sm:w-auto gap-1" disabled={isUsernameSubmitting || !newUsername.trim() || newUsername.trim() === currentUsername}>
                {isUsernameSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Güncelleniyor...</> : "Kullanıcı Adını Güncelle"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Separator />

        {/* Password Change Card */}
        <Card>
          <CardHeader>
            <CardTitle>Şifre Değiştir</CardTitle>
            <CardDescription>
              Mevcut şifrenizi buradan değiştirebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-6">
               <div className="space-y-2">
                <Label htmlFor="newPassword">Yeni Şifre</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Yeni şifrenizi girin"
                  required
                  disabled={isPasswordSubmitting}
                />
              </div>
               <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Yeni Şifre (Tekrar)</Label>
                <Input 
                  id="confirmNewPassword" 
                  type="password" 
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Yeni şifrenizi tekrar girin"
                  required
                  disabled={isPasswordSubmitting}
                />
              </div>
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
              {passwordSuccessMessage && <p className="text-sm text-green-600">{passwordSuccessMessage}</p>}
              <Button type="submit" className="w-full sm:w-auto gap-1" disabled={isPasswordSubmitting || !newPassword.trim() || !confirmNewPassword.trim()}>
                {isPasswordSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Güncelleniyor...</> : "Şifreyi Değiştir"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 