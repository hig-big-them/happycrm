"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from '../../../../lib/supabase/client';
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { FormEvent, ChangeEvent } from "react";

export default function NewUser() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "agency", // default role
  });
  
  const supabase = createClient();

  // Oturum ve yetki kontrolü
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        // Sadece superuser rolü erişebilir
        if (session.user.app_metadata?.role !== 'superuser') {
          router.push('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Auth error:', error);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }
    
    checkAuth();
  }, [router, supabase]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData(prev => ({ ...prev, role: value }));
  };
  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    
    try {
      // API route üzerinden kullanıcı oluştur - admin API kullanmak yerine sunucu tarafında işlem yapalım
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: formData.role
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Kullanıcı oluşturulurken bir hata oluştu');
      }
      
      // Başarıyla tamamlandı, kullanıcı listesine dön
      router.push('/admin/users');
    } catch (error: unknown) {
      console.error('Kullanıcı oluşturulurken hata:', error);
      setError(error instanceof Error ? error.message : "Kullanıcı oluşturulurken bir hata oluştu");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <Button 
        variant="ghost" 
        className="mb-6" 
        onClick={() => router.push('/admin/users')}
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Kullanıcılara Dön
      </Button>
      
      <Card>
        <CardHeader>
          <CardTitle>Yeni Kullanıcı Ekle</CardTitle>
          <CardDescription>
            Sisteme yeni bir kullanıcı ekleyin. Kullanıcı bilgileri oluşturulduktan sonra e-posta adresine davet gönderilecektir.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="kullanici@ornek.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Güçlü bir şifre girin"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500">En az 8 karakter uzunluğunda olmalı</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select 
                defaultValue={formData.role} 
                onValueChange={handleRoleChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency">Ajans</SelectItem>
                  <SelectItem value="superuser">Yönetici</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                {error}
              </div>
            )}
          </CardContent>
          
          <CardFooter className="flex justify-end">
            <Button 
              type="submit" 
              disabled={isSaving}
              className="gap-1"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? "Kaydediliyor..." : "Kullanıcı Oluştur"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
} 