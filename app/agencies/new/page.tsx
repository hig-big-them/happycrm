'use client';

import Link from 'next/link';
import * as React from 'react';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { createClient } from '../../../lib/supabase/client';
import { Trash2 } from 'lucide-react';

const driverFormSchema = z.object({
  name: z.string().min(1, { message: 'Sürücü adı zorunludur.' }),
  phoneNumbers: z.array(z.string().min(10, { message: 'Telefon numarası en az 10 karakter olmalıdır.' }))
                  .min(1, { message: 'En az bir telefon numarası zorunludur.' }),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

export default function NewDriverPage() {
  const [name, setName] = React.useState('');
  const [phoneNumbers, setPhoneNumbers] = React.useState<string[]>(['']);
  const [formErrors, setFormErrors] = React.useState<z.ZodError<DriverFormValues>['formErrors']['fieldErrors']>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handlePhoneNumberChange = (index: number, value: string) => {
    const newPhoneNumbers = [...phoneNumbers];
    newPhoneNumbers[index] = value;
    setPhoneNumbers(newPhoneNumbers);
    setFormErrors((prev) => ({ ...prev, phoneNumbers: undefined }));
  };

  const addPhoneNumberField = () => {
    setPhoneNumbers([...phoneNumbers, '']);
  };

  const removePhoneNumberField = (index: number) => {
    if (phoneNumbers.length <= 1) return;
    const newPhoneNumbers = phoneNumbers.filter((_, i) => i !== index);
    setPhoneNumbers(newPhoneNumbers);
    setFormErrors((prev) => ({ ...prev, phoneNumbers: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);

    const dataToValidate = {
      name: name.trim(),
      phoneNumbers: phoneNumbers.map(num => num.trim()).filter(num => num !== ''),
    };

    const validationResult = driverFormSchema.safeParse(dataToValidate);

    if (!validationResult.success) {
      console.error('Validasyon Hataları:', validationResult.error.flatten().fieldErrors);
      const zodErrors = validationResult.error.flatten().fieldErrors;
      const errorsToShow: { name?: string[]; phoneNumbers?: string[] } = {};
      if (zodErrors.name) errorsToShow.name = zodErrors.name;
      if (zodErrors.phoneNumbers) {
        let phoneErrorMessages = zodErrors.phoneNumbers._errors;
        if (phoneErrorMessages.length === 0) {
           Object.values(zodErrors.phoneNumbers).forEach(fieldError => {
               if (fieldError && fieldError._errors.length > 0) {
                   phoneErrorMessages = phoneErrorMessages.concat(fieldError._errors);
               }
           });
        }
        errorsToShow.phoneNumbers = phoneErrorMessages;
      }
       setFormErrors(errorsToShow);
      setIsSubmitting(false);
      return;
    }

    const validatedData = validationResult.data;

    try {
      const driverDataToInsert = {
        name: validatedData.name,
        phone_numbers: validatedData.phoneNumbers,
      };

      const supabase = createClient();
      const { error: supabaseError } = await supabase
        .from('drivers')
        .insert([driverDataToInsert]);

      if (supabaseError) {
        console.error('Supabase Kayıt Hatası:', supabaseError);
        alert(`Supabase Hatası: ${supabaseError.message}`);
      } else {
        console.log('Sürücü başarıyla kaydedildi!', validatedData);
        alert('Sürücü başarıyla kaydedildi!');
        setName('');
        setPhoneNumbers(['']);
      }
    } catch (error) {
      console.error('Form gönderim hatası:', error);
      alert('Beklenmedik bir hata oluştu. Lütfen konsolu kontrol edin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Yeni Transfer Kişisi Ekle</h1>
        <Button variant="outline" asChild>
          <Link href="/drivers">Geri Dön</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sürücü Bilgileri</CardTitle>
          <CardDescription>
            Lütfen yeni transfer kişisi için gerekli bilgileri girin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Adı Soyadı</Label>
            <Input
              id="name"
              placeholder="örn. Mehmet Kaya"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFormErrors((prev) => ({ ...prev, name: undefined }));
              }}
              disabled={isSubmitting}
            />
            {formErrors?.name && (
              <p className="text-sm text-red-500">{formErrors.name[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Telefon Numaraları</Label>
            {phoneNumbers.map((phoneNumber, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="tel"
                  placeholder={`Telefon Numarası ${index + 1}`}
                  value={phoneNumber}
                  onChange={(e) => handlePhoneNumberChange(index, e.target.value)}
                  disabled={isSubmitting}
                />
                {phoneNumbers.length > 1 && (
                  <Button 
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removePhoneNumberField(index)}
                    disabled={isSubmitting}
                    aria-label="Telefon numarasını sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {formErrors?.phoneNumbers && (
                <p className="text-sm text-red-500">{Array.isArray(formErrors.phoneNumbers) ? formErrors.phoneNumbers[0] : formErrors.phoneNumbers}</p>
            )}
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={addPhoneNumberField}
              disabled={isSubmitting}
              className="mt-2"
            >
              Telefon Ekle
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Kaydediliyor...' : 'Sürücü Kaydet'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
} 