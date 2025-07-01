"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Loader2 } from "lucide-react";
// import { useRouter } from "next/navigation"; 

import { createAgencyAndUserAction } from "../../actions/admin-actions";
import { CreateAgencyUserSchema } from "../../../lib/actions/schemas";

type CreateAgencyUserFormValues = z.infer<typeof CreateAgencyUserSchema>;

export default function CreateAgencyAndUserPage() {
  // const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [serverActionError, setServerActionError] = React.useState<string | null>(null);

  const form = useForm<CreateAgencyUserFormValues>({
    resolver: zodResolver(CreateAgencyUserSchema),
    defaultValues: {
      email: "",
      password: "",
      agencyName: "",
      username: "",
    },
  });

  const onSubmit = async (values: CreateAgencyUserFormValues) => {
    setIsSubmitting(true);
    setServerActionError(null);
    form.clearErrors(); // Önceki RHF hatalarını temizle

    const result = await createAgencyAndUserAction(values);

    setIsSubmitting(false);

    if (!result) {
      const unknownError = "Action çağrısından bir sonuç alınamadı.";
      toast.error(unknownError);
      setServerActionError(unknownError);
      return;
    }

    if (result.validationErrors) {
      Object.entries(result.validationErrors).forEach(([key, fieldErrors]) => {
        const message = Array.isArray(fieldErrors) ? fieldErrors.join(", ") : (typeof fieldErrors === 'string' ? fieldErrors : "Geçersiz değer");
        if (key === "_root" || key === "_form") { 
            setServerActionError(message);
        } else {
            form.setError(key as keyof CreateAgencyUserFormValues, {
                type: "server",
                message: message,
            });
        }
      });
      toast.error("Lütfen formdaki hataları düzeltin.");
      return;
    }

    if (result.serverError) {
      toast.error(result.serverError);
      setServerActionError(result.serverError);
      return;
    }

    if (result.data?.success) {
      toast.success(result.data.success);
      form.reset();
    } else if (result.data?.failure) {
      toast.error(result.data.failure);
      setServerActionError(result.data.failure);
    } else {
      const unknownError = "Ajans ve kullanıcı oluşturulurken bilinmeyen bir sonuç alındı.";
      toast.error(unknownError);
      setServerActionError(unknownError);
    }
  };
  
  const [pageError, setPageError] = React.useState<string | null>(null);

  // Örnek: Superuser kontrolü (middleware zaten yapmalı ama UI'da da bir katman olabilir)
  // React.useEffect(() => {
  //   async function checkUserRole() {
  //     const supabase = createClientComponentClient(); // veya context'ten al
  //     const { data: { user } } = await supabase.auth.getUser();
  //     if (user?.app_metadata?.role !== 'superuser') {
  //       setPageError("Bu sayfaya erişim yetkiniz yok.");
  //       // router.push("/"); // Ana sayfaya yönlendir
  //     }
  //   }
  //   checkUserRole();
  // }, []);

  // if (pageError) {
  //   return <div className="container mx-auto py-10"><p className="text-red-500">{pageError}</p></div>;
  // }

  return (
    <div className="container mx-auto max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Yeni Ajans ve Kullanıcı Oluştur</CardTitle>
          <CardDescription>
            Yeni bir ajans ve bu ajans için birincil kullanıcı hesabı oluşturun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <h3 className="text-lg font-medium">Kullanıcı Bilgileri</h3>
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" type="email" {...form.register("email")} placeholder="kullanici@example.com" disabled={isSubmitting} />
              {form.formState.errors.email && <p className="text-sm text-red-500" role="alert">{form.formState.errors.email.message}</p>} 
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Kullanıcı Adı</Label>
              <Input id="username" type="text" {...form.register("username")} placeholder="ornek_kullanici_adi" disabled={isSubmitting} />
              {form.formState.errors.username && <p className="text-sm text-red-500" role="alert">{form.formState.errors.username.message}</p>} 
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input id="password" type="password" {...form.register("password")} placeholder="••••••••" disabled={isSubmitting} />
              {form.formState.errors.password && <p className="text-sm text-red-500" role="alert">{form.formState.errors.password.message}</p>} 
            </div>
            
            <h3 className="text-lg font-medium mt-6">Ajans Bilgileri</h3>
            <div className="space-y-2">
              <Label htmlFor="agencyName">Ajans Adı</Label>
              <Input id="agencyName" type="text" {...form.register("agencyName")} placeholder="Örnek Ajans A.Ş." disabled={isSubmitting}/>
              {form.formState.errors.agencyName && <p className="text-sm text-red-500" role="alert">{form.formState.errors.agencyName.message}</p>} 
            </div>

            {serverActionError && (
              <p className="text-sm text-red-500 mt-2" role="alert">{serverActionError}</p>
            )}

            <Button type="submit" className="w-full sm:w-auto gap-1" disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Oluşturuluyor...</> : "Ajans ve Kullanıcı Oluştur"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 