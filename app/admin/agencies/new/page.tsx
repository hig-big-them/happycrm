"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { createClient } from "../../../../lib/supabase/client"
import { Button } from "../../../../components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../components/ui/form"
import { Input } from "../../../../components/ui/input"
import { Textarea } from "../../../../components/ui/textarea"
import { toast } from "sonner"
import { Switch } from "../../../../components/ui/switch"

// Form doğrulama şeması
const formSchema = z.object({
  name: z.string().min(2, "Ajans adı en az 2 karakter olmalıdır").max(100),
  contactName: z.string().min(2, "İletişim kişisi adı en az 2 karakter olmalıdır").max(100).optional().nullable(),
  phone: z.string().optional().nullable(),
  details: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

type FormValues = z.infer<typeof formSchema>

export default function NewAgencyPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  // Form durumunu tanımla
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      contactName: "",
      phone: "",
      details: "",
      isActive: true,
    },
  })

  // Form gönderim işleyicisi
  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)

    try {
      // İletişim ve detay bilgilerini JSON formatında sakla
      const contactInformation = {
        name: data.contactName || null,
        phone: data.phone || null,
      }

      const { error } = await supabase.from("agencies").insert({
        name: data.name,
        contact_information: contactInformation,
        details: data.details ? { description: data.details } : null,
        is_active: data.isActive,
      })

      if (error) {
        toast.error("Ajans oluşturulurken bir hata oluştu", {
          description: error.message,
        })
        return
      }

      toast.success("Ajans başarıyla oluşturuldu")
      router.push("/admin/agencies")
      router.refresh()
    } catch (error) {
      toast.error("Ajans oluşturulurken bir hata oluştu")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Yeni Ajans Oluştur</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField<FormValues>
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ajans Adı</FormLabel>
                <FormControl>
                  <Input placeholder="Örn: ABC Transfer" {...field} />
                </FormControl>
                <FormDescription>
                  Ajansın tam adını girin.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField<FormValues>
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>İletişim Kişisi</FormLabel>
                <FormControl>
                  <Input placeholder="Örn: Ahmet Yılmaz" {...field} value={field.value || ""} />
                </FormControl>
                <FormDescription>
                  Ajans iletişim sorumlusunun adı.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField<FormValues>
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefon</FormLabel>
                <FormControl>
                  <Input placeholder="Örn: 0532 123 4567" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField<FormValues>
            control={form.control}
            name="details"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Detaylar</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Ajans hakkında notlar..." 
                    {...field} 
                    value={field.value || ""}
                    rows={4}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField<FormValues>
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Aktif</FormLabel>
                  <FormDescription>
                    Ajansı aktif olarak işaretle.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Oluşturuluyor..." : "Ajans Oluştur"}
          </Button>
        </form>
      </Form>
    </div>
  )
} 