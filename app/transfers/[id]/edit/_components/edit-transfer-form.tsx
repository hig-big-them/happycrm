"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { format } from "date-fns"
import { CalendarIcon, PlusCircle, X } from "lucide-react"
import { Button } from "../../../../../components/ui/button"
import { Input } from "../../../../../components/ui/input"
import { Textarea } from "../../../../../components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../../../../components/ui/popover"
import { Calendar } from "../../../../../components/ui/calendar"
import { cn } from "../../../../../lib/utils"
import { updateTransfer } from "../../../../../lib/actions/transfer-actions"
import { Badge } from "../../../../../components/ui/badge"

// Form şeması
const formSchema = z.object({
  patient_name: z.string().min(2, "En az 2 karakter girilmelidir"),
  airport: z.string().optional(),
  clinic: z.string().optional(),
  transfer_datetime: z.date({
    required_error: "Transfer tarihi gereklidir",
  }),
  deadline_datetime: z.date({
    required_error: "Deadline tarihi gereklidir", 
  }),
  status: z.enum(["pending", "driver_assigned", "patient_picked_up", "completed", "delayed", "cancelled"]),
  assigned_agency_id: z.string().optional(),
  related_route_id: z.string().optional(),
  location_from_id: z.string().optional(),
  notification_numbers: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof formSchema>

// Props tiplerini tanımla
interface EditTransferFormProps {
  transfer: any // Transfer veri tipini genişletin
  agencies: { value: string; label: string }[]
  routes: { value: string; label: string }[]
  locations: { value: string; label: string }[]
}

// Form durumları
const statuses = [
  { value: "pending", label: "Beklemede" },
  { value: "driver_assigned", label: "Sürücü Atandı" },
  { value: "patient_picked_up", label: "Hasta Alındı" },
  { value: "completed", label: "Tamamlandı" },
  { value: "delayed", label: "Gecikti" },
  { value: "cancelled", label: "İptal Edildi" },
]

export default function EditTransferForm({ transfer, agencies, routes, locations }: EditTransferFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Bildirim numaraları için state
  const [notificationNumbers, setNotificationNumbers] = useState<string[]>(transfer.notification_numbers || [])
  const [newNotificationNumber, setNewNotificationNumber] = useState("")
  
  // Bildirim numarası ekleme fonksiyonu
  const addNotificationNumber = () => {
    if (!newNotificationNumber.trim()) return
    
    let formattedNumber = newNotificationNumber.trim()
    if (!formattedNumber.startsWith("+")) {
      formattedNumber = `+${formattedNumber}`
    }
    
    setNotificationNumbers([...notificationNumbers, formattedNumber])
    setNewNotificationNumber("")
  }
  
  // Bildirim numarası silme fonksiyonu
  const removeNotificationNumber = (index: number) => {
    const updatedNumbers = [...notificationNumbers]
    updatedNumbers.splice(index, 1)
    setNotificationNumbers(updatedNumbers)
  }
  
  // Form başlangıç değerlerini ayarla
  const defaultValues: Partial<FormValues> = {
    patient_name: transfer.patient_name || "",
    airport: transfer.airport || "",
    clinic: transfer.clinic || "",
    transfer_datetime: new Date(transfer.transfer_datetime),
    deadline_datetime: new Date(transfer.deadline_datetime),
    status: (transfer.status as "pending" | "driver_assigned" | "patient_picked_up" | "completed" | "delayed" | "cancelled") || "pending",
    assigned_agency_id: transfer.assigned_agency_id || undefined,
    related_route_id: transfer.related_route_id || undefined,
    location_from_id: transfer.location_from_id || undefined,
    notification_numbers: transfer.notification_numbers || [],
  }
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })
  
  // Form gönderildiğinde
  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    
    try {
      console.log('[EditForm] Transfer güncelleme başlatılıyor...');
      console.log('[EditForm] Form data:', data);
      console.log('[EditForm] Notification numbers:', notificationNumbers);
      console.log('[EditForm] Transfer ID:', transfer.id);
      
      const result = await updateTransfer({
        id: transfer.id,
        ...data,
        assigned_agency_id: data.assigned_agency_id === "none" ? null : data.assigned_agency_id,
        related_route_id: data.related_route_id === "none" ? null : data.related_route_id,
        location_from_id: data.location_from_id === "none" ? null : data.location_from_id,
        notification_numbers: notificationNumbers,
      });

      console.log('[EditForm] Transfer güncelleme sonucu:', result);

      // next-safe-action'dan gelen yanıtı doğru işle
      if (result.serverError) {
        console.error('[EditForm] Server error:', result.serverError);
        toast.error(`Transfer güncellenemedi: ${result.serverError}`);
      } else if (result.validationErrors) {
        console.error('[EditForm] Validation errors:', result.validationErrors);
        const errorMessages = Object.values(result.validationErrors).flat().join(", ");
        toast.error(`Validasyon hatası: ${errorMessages}`);
      } else if (result.data) {
        console.log('[EditForm] Action result data:', result.data);
        // Asıl sunucu yanıtı result.data içindedir
        const actionResult = result.data;
        if (actionResult.success) {
          if (actionResult.warning) {
            console.warn('[EditForm] Warning:', actionResult.warning);
            toast.warning(actionResult.warning);
          } else {
            console.log('[EditForm] Transfer başarıyla güncellendi');
            toast.success("Transfer başarıyla güncellendi");
          }
          router.push(`/transfers/${transfer.id}`);
          router.refresh();
        } else {
           // Bu durum normalde yaşanmamalı, ama güvenlik için ekliyoruz
           console.error('[EditForm] Unexpected server response');
           toast.error("Sunucudan beklenmedik bir yanıt alındı.");
        }
      } else {
        console.error('[EditForm] No data received');
        toast.error("Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.");
      }

    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error("Transfer güncelleme hatası:", error);
      toast.error(`Bir hata oluştu: ${error.message}`);
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="patient_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hasta Adı</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Hasta adını giriniz" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Durum</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Durum seçiniz" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
                      <FormField
            control={form.control}
            name="assigned_agency_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ajans</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value || "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Ajans seçiniz" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Seçilmedi</SelectItem>
                    {agencies.filter(agency => agency.value && agency.value !== '').map((agency) => (
                      <SelectItem key={agency.value} value={agency.value}>
                        {agency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="related_route_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Güzergah</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value || "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Güzergah seçiniz" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Seçilmedi</SelectItem>
                    {routes.filter(route => route.value && route.value !== '').map((route) => (
                      <SelectItem key={route.value} value={route.value}>
                        {route.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="location_from_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Konum</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value || "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Konum seçiniz" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">Seçilmedi</SelectItem>
                    {locations.filter(location => location.value && location.value !== '').map((location) => (
                      <SelectItem key={location.value} value={location.value}>
                        {location.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="airport"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Havalimanı</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    value={field.value || ""} 
                    placeholder="Havalimanı bilgisi girin" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="clinic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Klinik</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    value={field.value || ""} 
                    placeholder="Klinik adını girin" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="transfer_datetime"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Transfer Tarihi ve Saati</FormLabel>
                <div className="flex gap-2">
                  <div className="flex-grow">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Transfer tarihini seçin</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date && field.value) {
                              // Mevcut saati koru
                              const newDate = new Date(date);
                              newDate.setHours(field.value.getHours(), field.value.getMinutes());
                              field.onChange(newDate);
                            } else if (date) {
                              field.onChange(date);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="w-[100px]">
                    <Input 
                      type="time" 
                      value={field.value ? format(field.value, "HH:mm") : ""}
                      onChange={(e) => {
                        if (field.value && e.target.value) {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const newDate = new Date(field.value);
                          newDate.setHours(hours, minutes);
                          field.onChange(newDate);
                        }
                      }}
                    />
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="deadline_datetime"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Deadline Tarihi ve Saati</FormLabel>
                <div className="flex gap-2">
                  <div className="flex-grow">
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Deadline tarihini seçin</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date && field.value) {
                              // Mevcut saati koru
                              const newDate = new Date(date);
                              newDate.setHours(field.value.getHours(), field.value.getMinutes());
                              field.onChange(newDate);
                            } else if (date) {
                              field.onChange(date);
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="w-[100px]">
                    <Input 
                      type="time" 
                      value={field.value ? format(field.value, "HH:mm") : ""}
                      onChange={(e) => {
                        if (field.value && e.target.value) {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const newDate = new Date(field.value);
                          newDate.setHours(hours, minutes);
                          field.onChange(newDate);
                        }
                      }}
                    />
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* Bildirim Numaraları */}
        <div className="border-t pt-4">
          <FormLabel className="mb-2 block">Bildirim Numaraları</FormLabel>
          <p className="text-sm text-muted-foreground mb-3">
            Transfer durum değişikliğinde bildirim gönderilecek telefon numaralarını ekleyin.
          </p>
          
          {/* Eklenen numaralar */}
          {notificationNumbers.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {notificationNumbers.map((number, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {number}
                  <button 
                    type="button" 
                    onClick={() => removeNotificationNumber(index)} 
                    className="ml-1 h-4 w-4 rounded-full hover:bg-muted-foreground/20 inline-flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          
          {/* Yeni numara ekleme */}
          <div className="flex gap-2">
            <Input
              placeholder="+90XXXXXXXXXX"
              value={newNotificationNumber}
              onChange={(e) => setNewNotificationNumber(e.target.value)}
              className="flex-1"
              disabled={isSubmitting}
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={addNotificationNumber}
              disabled={isSubmitting || !newNotificationNumber.trim()}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Ekle
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Uluslararası format kullanın (örn. +905551234567)
          </p>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push(`/transfers/${transfer.id}`)}
          >
            İptal
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </form>
    </Form>
  )
} 