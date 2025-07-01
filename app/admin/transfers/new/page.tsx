"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
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
import { useToast } from "../../../../hooks/use-toast"
import { createTransfer } from "../../../../lib/actions/transfer-actions" // Corrected import path
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

// Zod schema for the form (matches the action schema, can be imported)
// For simplicity, redefining here. Ideally, import from action or a shared types file.
const FormSchema = z.object({
  title: z.string().min(3, "Başlık en az 3 karakter olmalıdır."),
  details: z.string().optional(), // For Textarea, then parse to JSON in action or here
  deadline: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Geçerli bir tarih ve saat giriniz.",
  }),
  assigned_agency_id: z.string().uuid("Geçerli bir ajans ID giriniz.").optional().nullable(),
  assigned_officer_id: z.string().uuid("Geçerli bir yetkili ID giriniz.").optional().nullable(),
  // origin_location: z.string().optional(), // For Textarea, parse to JSON
  // destination_location: z.string().optional(), // For Textarea, parse to JSON
  notes: z.string().optional().nullable(),
})

type FormSchemaType = z.infer<typeof FormSchema>

export default function CreateTransferPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<FormSchemaType>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: "",
      details: "",
      deadline: new Date().toISOString().substring(0, 16), // Default to current datetime-local format
      notes: "",
    },
  })

  async function onSubmit(values: FormSchemaType) {
    setError(null)
    startTransition(async () => {
      try {
        const deadlineISO = new Date(values.deadline).toISOString()
        
        const result = await createTransfer({
          ...values,
          deadline: deadlineISO,
          details: values.details ? JSON.parse(values.details) : undefined,
        })

        if (result?.serverError) {
          setError(result.serverError)
          toast({
            variant: "destructive",
            title: "Transfer Oluşturulamadı",
            description: result.serverError,
          })
        } else if (result?.validationErrors) {
          // Simplistic handling of validation errors, can be more granular
          const errorMessages = Object.values(result.validationErrors).flat().join(", ")
          setError(errorMessages)
          toast({
            variant: "destructive",
            title: "Validasyon Hatası",
            description: errorMessages,
          })
        } else if (result?.data?.success && result.data.data) {
          toast({
            title: "Transfer Oluşturuldu",
            description: `Transfer "${result.data.data.title}" başarıyla oluşturuldu.`,
          })
          router.push("/admin/transfers") 
        } else if (result?.data && !result.data.success && (result.data as any).error) {
          // Handle cases where action returns { success: false, error: "..." }
          const actionError = (result.data as any).error
          setError(actionError)
          toast({
            variant: "destructive",
            title: "Transfer Oluşturulamadı",
            description: actionError,
          })
        } else {
          const unknownError = "Bilinmeyen bir hata oluştu."
          setError(unknownError)
          toast({
            variant: "destructive",
            title: "İşlem Başarısız",
            description: unknownError,
          })
        }
      } catch (e: any) {
        const catchError = e.message || "Beklenmedik bir sunucu hatası oluştu."
        setError(catchError)
        toast({
          variant: "destructive",
          title: "Sunucu Hatası",
          description: catchError,
        })
      }
    })
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Yeni Transfer Oluştur</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Başlık</FormLabel>
                <FormControl>
                  <Input placeholder="Transfer başlığı..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="deadline"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Son Teslim Tarihi</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="details"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Detaylar (JSON Formatında)</FormLabel>
                <FormControl>
                  <Textarea placeholder='{"key": "value"}' {...field} />
                </FormControl>
                <FormDescription>
                  Transferle ilgili ek detayları JSON formatında giriniz.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="assigned_agency_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Atanacak Ajans ID (Opsiyonel)</FormLabel>
                <FormControl>
                  <Input placeholder="Ajans UUID..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="assigned_officer_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Atanacak Yetkili ID (Opsiyonel)</FormLabel>
                <FormControl>
                  <Input placeholder="Kullanıcı UUID..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notlar (Opsiyonel)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Ek notlar..." {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Oluşturuluyor..." : "Transfer Oluştur"}
          </Button>
        </form>
      </Form>
    </div>
  )
} 