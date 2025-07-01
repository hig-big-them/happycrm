"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { createUserAction, CreateUserFormState } from "../../../lib/actions/user-actions";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";

const availableRoles = [
  { value: "user", label: "User (Kullanıcı)" },
  { value: "agency_user", label: "Agency User (Ajans Kullanıcısı)" },
  { value: "agency_admin", label: "Agency Admin (Ajans Yöneticisi)" },
  { value: "admin", label: "Admin (Yönetici)" },
  { value: "super_admin", label: "Super Admin (Süper Yönetici)" },
  { value: "superuser", label: "Superuser (Tam Yetkili)" },
];

const initialState: CreateUserFormState = {
  message: null,
  type: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Kullanıcı Oluşturuluyor..." : "Kullanıcı Oluştur"}
    </Button>
  );
}

const CreateUserPage: React.FC = () => {
  const router = useRouter();
  const [state, formAction] = useActionState(createUserAction, initialState);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state.type === "success") {
      formRef.current?.reset();
      const timer = setTimeout(() => {
        router.push("/admin/manage-users");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <div className="container mx-auto max-w-xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Yeni Kullanıcı Oluştur</CardTitle>
          <CardDescription>
            Yeni bir kullanıcı için gerekli bilgileri girin. Kullanıcı adı ve telefon numarası isteğe bağlıdır.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="space-y-6">
            <div>
              <Label htmlFor="email">E-posta Adresi</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="kullanici@example.com"
                required
                aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
              />
              {state.fieldErrors?.email && (
                <p id="email-error" className="text-sm text-red-500 mt-1">
                  {state.fieldErrors.email.join(", ")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="username">Kullanıcı Adı (İsteğe Bağlı)</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="kullanici_adi"
                aria-describedby={state.fieldErrors?.username ? "username-error" : undefined}
              />
              {state.fieldErrors?.username && (
                <p id="username-error" className="text-sm text-red-500 mt-1">
                  {state.fieldErrors.username.join(", ")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Telefon Numarası (İsteğe Bağlı)</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+905551234567"
                aria-describedby={state.fieldErrors?.phone ? "phone-error" : undefined}
              />
              {state.fieldErrors?.phone && (
                <p id="phone-error" className="text-sm text-red-500 mt-1">
                  {state.fieldErrors.phone.join(", ")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="role">Kullanıcı Rolü</Label>
              <Select name="role" required>
                <SelectTrigger id="role" aria-describedby={state.fieldErrors?.role ? "role-error" : undefined}>
                  <SelectValue placeholder="Bir rol seçin" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.fieldErrors?.role && (
                <p id="role-error" className="text-sm text-red-500 mt-1">
                  {state.fieldErrors.role.join(", ")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
              />
              {state.fieldErrors?.password && (
                <p id="password-error" className="text-sm text-red-500 mt-1">
                  {state.fieldErrors.password.join(", ")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                aria-describedby={state.fieldErrors?.confirmPassword ? "confirmPassword-error" : undefined}
              />
              {state.fieldErrors?.confirmPassword && (
                <p id="confirmPassword-error" className="text-sm text-red-500 mt-1">
                  {state.fieldErrors.confirmPassword.join(", ")}
                </p>
              )}
            </div>

            {state.message && (
              <Alert variant={state.type === "error" ? "destructive" : "default"}>
                {state.type === "error" ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                <AlertTitle>{state.type === "error" ? "Hata" : "Başarılı"}</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}

            <SubmitButton />
            <Button variant="outline" type="button" onClick={() => router.back()} className="w-full mt-2">
              Geri Dön
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateUserPage;