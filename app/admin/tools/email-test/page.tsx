'use client'

import { useState, useEffect } from 'react'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Alert, AlertDescription } from '../../../../components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select'

export default function EmailTestPage() {
  const [emailAddress, setEmailAddress] = useState('')
  const [templateType, setTemplateType] = useState('STATUS_CHANGED')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [smtpConfig, setSmtpConfig] = useState<any>(null)
  const [configLoading, setConfigLoading] = useState(true)

  // SMTP konfigürasyonunu kontrol et
  useEffect(() => {
    const checkSmtpConfig = async () => {
      try {
        const response = await fetch('/api/admin/smtp-config-check')
        const data = await response.json()
        setSmtpConfig(data)
      } catch (error) {
        console.error('SMTP config check error:', error)
        setSmtpConfig({ success: false, error: 'Konfigürasyon kontrol edilemedi' })
      } finally {
        setConfigLoading(false)
      }
    }

    checkSmtpConfig()
  }, [])

  const handleTestEmail = async () => {
    if (!emailAddress.trim()) {
      setResult({ success: false, error: 'E-posta adresi gereklidir' })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/admin/test-email-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailAddress: emailAddress.trim(),
          templateType,
          templateParams: {
            patientName: 'Test Hasta Adı',
            status: 'Test Durumu',
            location: 'Test Lokasyon - Havalimanı',
            transferDateTime: new Date().toLocaleString('tr-TR'),
            transferTitle: 'Test Transfer Başlığı'
          }
        }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error: any) {
      setResult({ success: false, error: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">E-posta Bildirim Testi</h1>
        <p className="text-muted-foreground">
          E-posta bildirim sistemini test etmek için kullanın.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test E-posta Gönder</CardTitle>
          <CardDescription>
            SMTP ayarlarını ve e-posta template'lerini test edin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emailAddress">E-posta Adresi</Label>
            <Input
              id="emailAddress"
              type="email"
              placeholder="test@example.com"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateType">Template Türü</Label>
            <Select value={templateType} onValueChange={setTemplateType}>
              <SelectTrigger>
                <SelectValue placeholder="Template seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STATUS_CHANGED">Durum Değişikliği</SelectItem>
                <SelectItem value="TRANSFER_ASSIGNED">Transfer Ataması</SelectItem>
                <SelectItem value="TRANSFER_DEADLINE">Deadline Uyarısı</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleTestEmail} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Gönderiliyor...' : 'Test E-posta Gönder'}
          </Button>

          {result && (
            <Alert className={result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription>
                {result.success ? (
                  <div>
                    <p className="font-semibold text-green-800">✅ Başarılı!</p>
                    <p className="text-green-700">E-posta başarıyla gönderildi.</p>
                    {result.messageId && (
                      <p className="text-sm text-green-600 mt-1">Message ID: {result.messageId}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-red-800">❌ Hata!</p>
                    <p className="text-red-700">{result.error}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SMTP Ayarları Kontrolü</CardTitle>
          <CardDescription>
            E-posta gönderimi için gerekli ortam değişkenleri:
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configLoading ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground">SMTP ayarları kontrol ediliyor...</p>
            </div>
          ) : smtpConfig?.success ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>SMTP_HOST:</span>
                <span className="text-muted-foreground">
                  {smtpConfig.config.host ? '✅ Tanımlı' : '❌ Tanımlı değil'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SMTP_PORT:</span>
                <span className="text-muted-foreground">
                  {smtpConfig.config.port ? '✅ Tanımlı' : '❌ Tanımlı değil'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SMTP_USER:</span>
                <span className="text-muted-foreground">
                  {smtpConfig.config.user ? '✅ Tanımlı' : '❌ Tanımlı değil'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SMTP_PASSWORD:</span>
                <span className="text-muted-foreground">
                  {smtpConfig.config.password ? '✅ Tanımlı' : '❌ Tanımlı değil'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SMTP_FROM_EMAIL:</span>
                <span className="text-muted-foreground">
                  {smtpConfig.config.fromEmail ? '✅ Tanımlı' : '❌ Tanımlı değil'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SMTP_FROM_NAME:</span>
                <span className="text-muted-foreground">
                  {smtpConfig.config.fromName ? '✅ Tanımlı' : '❌ Tanımlı değil'}
                </span>
              </div>
              
              <div className={`mt-4 p-3 rounded-md ${smtpConfig.allConfigured ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <p className={`text-sm font-medium ${smtpConfig.allConfigured ? 'text-green-800' : 'text-red-800'}`}>
                  {smtpConfig.message}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-red-600">
              <p>SMTP konfigürasyonu kontrol edilemedi: {smtpConfig?.error}</p>
            </div>
          )}
          
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Not:</strong> SMTP ayarlarını .env.local dosyasında tanımlamanız gerekiyor:
            </p>
            <pre className="text-xs mt-2 p-2 bg-background rounded border">
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Happy Transfer System`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 