'use client'

import { useState } from 'react'
import { Button } from '../../../../components/ui/button'
import { Input } from '../../../../components/ui/input'
import { Label } from '../../../../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Textarea } from '../../../../components/ui/textarea'
import { Badge } from '../../../../components/ui/badge'

export default function WebhookTestPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [transferId, setTransferId] = useState('test-transfer-123')
  const [confirmationCode, setConfirmationCode] = useState('CONFIRMED')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testWebhook = async () => {
    if (!webhookUrl) {
      alert('Webhook URL gerekli')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const formData = new URLSearchParams({
        transfer_id: transferId,
        confirmation_code: confirmationCode,
        ExecutionSid: 'EX' + Math.random().toString(36).substr(2, 9),
        FlowSid: 'FW' + Math.random().toString(36).substr(2, 9),
        ExecutionStatus: 'ended',
        From: '+905327994223',
        To: '+905327994223',
        CallStatus: 'completed'
      })

      console.log('Gönderilen data:', formData.toString())

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TwilioProxy/1.1'
        },
        body: formData.toString()
      })

      const responseText = await response.text()
      
      try {
        const jsonResult = JSON.parse(responseText)
        setResult({
          status: response.status,
          statusText: response.statusText,
          data: jsonResult
        })
      } catch {
        setResult({
          status: response.status,
          statusText: response.statusText,
          data: responseText
        })
      }
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      })
    } finally {
      setLoading(false)
    }
  }

  const testLocalWebhook = () => {
    setWebhookUrl('http://localhost:3000/api/twilio/test-webhook')
  }

  const getCurrentUrl = () => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin
      setWebhookUrl(`${baseUrl}/api/twilio/test-webhook`)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Webhook Test Tool</h1>
        <p className="text-gray-600 mt-2">
          Twilio webhook'larını test etmek için bu aracı kullanın
        </p>
      </div>

      <div className="grid gap-6">
        {/* URL Setup */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook URL Ayarları</CardTitle>
            <CardDescription>
              Test edilecek webhook URL'ini girin
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-ngrok-url.ngrok.io/api/twilio/status-webhook"
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={testLocalWebhook} variant="outline">
                Local Test URL Kullan
              </Button>
              <Button onClick={getCurrentUrl} variant="outline">
                Current Domain Kullan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Parameters */}
        <Card>
          <CardHeader>
            <CardTitle>Test Parametreleri</CardTitle>
            <CardDescription>
              Webhook'a gönderilecek test verileri
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="transferId">Transfer ID</Label>
              <Input
                id="transferId"
                value={transferId}
                onChange={(e) => setTransferId(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="confirmationCode">Confirmation Code</Label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setConfirmationCode('CONFIRMED')}
                  variant={confirmationCode === 'CONFIRMED' ? 'default' : 'outline'}
                  size="sm"
                >
                  CONFIRMED
                </Button>
                <Button
                  onClick={() => setConfirmationCode('REJECTED')}
                  variant={confirmationCode === 'REJECTED' ? 'default' : 'outline'}
                  size="sm"
                >
                  REJECTED
                </Button>
              </div>
              <Input
                className="mt-2"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Action */}
        <Card>
          <CardHeader>
            <CardTitle>Test Çalıştır</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={testWebhook} 
              disabled={loading || !webhookUrl}
              className="w-full"
            >
              {loading ? 'Test Çalışıyor...' : 'Webhook Test Et'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Test Sonucu 
                {result.status && (
                  <Badge variant={result.status === 200 ? 'default' : 'destructive'}>
                    {result.status}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={JSON.stringify(result, null, 2)}
                readOnly
                rows={10}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Kullanım Talimatları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">1. Ngrok ile Test:</h3>
              <p className="text-sm text-gray-600">
                Terminal'de <code>ngrok http 3000</code> çalıştırın ve verilen URL'i kullanın
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-sm">2. Local Test:</h3>
              <p className="text-sm text-gray-600">
                "Local Test URL Kullan" butonuna basarak localhost üzerinden test edin
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-sm">3. Production Test:</h3>
              <p className="text-sm text-gray-600">
                Deployed URL'inizi girerek production webhook'unu test edin
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 