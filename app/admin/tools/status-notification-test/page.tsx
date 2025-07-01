"use client"

import { useState } from "react"
import { Button } from "../../../../components/ui/button"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
import { Textarea } from "../../../../components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card"
import { Alert, AlertDescription } from "../../../../components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select"

export default function StatusNotificationTestPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [formData, setFormData] = useState({
    transferId: "",
    transferTitle: "",
    newStatus: "",
    recipientUserId: "",
    phoneNumbers: ""
  })

  const statusOptions = [
    { value: "pending", label: "Beklemede" },
    { value: "driver_assigned", label: "Sürücü Atandı" },
    { value: "patient_picked_up", label: "Hasta Alındı" },
    { value: "completed", label: "Tamamlandı" },
    { value: "delayed", label: "Gecikti" },
    { value: "cancelled", label: "İptal Edildi" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setResult(null)

    try {
      const phoneNumbersArray = formData.phoneNumbers 
        ? formData.phoneNumbers.split(',').map(num => num.trim()).filter(num => num)
        : []

      const response = await fetch('/api/admin/test-status-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Authorization header'ı test amaçlı kaldırıldı
        },
        body: JSON.stringify({
          transferId: formData.transferId,
          transferTitle: formData.transferTitle,
          newStatus: formData.newStatus,
          recipientUserId: formData.recipientUserId,
          phoneNumbers: phoneNumbersArray.length > 0 ? phoneNumbersArray : undefined
        })
      })

      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Status Notification Test</h1>
        <p className="text-muted-foreground mt-2">
          Transfer durum değişikliği bildirimlerini test edin
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test Parametreleri</CardTitle>
          <CardDescription>
            Bildirim göndermek için gerekli bilgileri girin
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="transferId">Transfer ID</Label>
              <Input
                id="transferId"
                value={formData.transferId}
                onChange={(e) => handleInputChange('transferId', e.target.value)}
                placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                required
              />
            </div>

            <div>
              <Label htmlFor="transferTitle">Transfer Title</Label>
              <Input
                id="transferTitle"
                value={formData.transferTitle}
                onChange={(e) => handleInputChange('transferTitle', e.target.value)}
                placeholder="e.g. Hastane Transfer"
                required
              />
            </div>

            <div>
              <Label htmlFor="newStatus">Yeni Durum</Label>
              <Select
                value={formData.newStatus}
                onValueChange={(value) => handleInputChange('newStatus', value)}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Durum seçin" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="recipientUserId">Alıcı Kullanıcı ID</Label>
              <Input
                id="recipientUserId"
                value={formData.recipientUserId}
                onChange={(e) => handleInputChange('recipientUserId', e.target.value)}
                placeholder="e.g. 456e7890-e12b-34d5-a678-901234567890"
                required
              />
            </div>

            <div>
              <Label htmlFor="phoneNumbers">
                Manuel Telefon Numaraları (Opsiyonel)
              </Label>
              <Input
                id="phoneNumbers"
                value={formData.phoneNumbers}
                onChange={(e) => handleInputChange('phoneNumbers', e.target.value)}
                placeholder="e.g. +905551234567, +905559876543"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Virgülle ayırarak birden fazla numara girebilirsiniz
              </p>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Test Ediliyor...' : 'Notification Test Et'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Test Sonucu</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant={result.success ? "default" : "destructive"}>
              <AlertDescription>
                <strong>Durum:</strong> {result.success ? 'Başarılı' : 'Başarısız'}
                <br />
                <strong>Mesaj:</strong> {result.message || result.error}
              </AlertDescription>
            </Alert>

            <div className="mt-4">
              <Label>Detaylı Sonuç:</Label>
              <Textarea
                value={JSON.stringify(result, null, 2)}
                readOnly
                className="mt-2 font-mono text-sm"
                rows={10}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 