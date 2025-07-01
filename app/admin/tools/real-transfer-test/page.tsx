'use client'

import { useState, useTransition } from 'react'
import { triggerRealTransferCall } from '../../../../lib/actions/real-transfer-call'
import { Label } from '../../../../components/ui/label'
import { Input } from '../../../../components/ui/input'
import { Textarea } from '../../../../components/ui/textarea'
import { Button } from '../../../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card'
import { useToast } from '../../../../hooks/use-toast'
import { Badge } from '../../../../components/ui/badge'
import { Separator } from '../../../../components/ui/separator'

export default function RealTransferTestPage() {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [results, setResults] = useState<any>(null)
  const [dtmfLogs, setDtmfLogs] = useState<any[]>([])

  const handleSubmit = async (formData: FormData) => {
    const transferId = formData.get('transferId') as string
    const phoneNumbersText = formData.get('phoneNumbers') as string
    const flowSid = formData.get('flowSid') as string

    if (!transferId || !phoneNumbersText || !flowSid) {
      toast({ 
        title: 'Hata', 
        description: 'Tüm alanlar doldurulmalıdır.', 
        variant: 'destructive' 
      })
      return
    }

    const phoneNumbers = phoneNumbersText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (phoneNumbers.length === 0) {
      toast({ 
        title: 'Hata', 
        description: 'En az bir telefon numarası girilmelidir.', 
        variant: 'destructive' 
      })
      return
    }

    startTransition(async () => {
      console.log('🔥 === FRONTEND CALLING ACTION ===');
      console.log('🔥 transferId:', transferId);
      console.log('🔥 phoneNumbers:', phoneNumbers);
      console.log('🔥 flowSid:', flowSid);
      console.log('🔥 Action input:', { transferId, phoneNumbers, flowSid });
      
      const result = await triggerRealTransferCall({
        transferId,
        phoneNumbers,
        flowSid,
      })

      console.log('🔥 Action result:', result);
      
      if (result?.data) {
        setResults(result.data)
        toast({ 
          title: 'Başarılı!', 
          description: result.data.message || 'Transfer çağrısı başlatıldı.'
        })
        
        // Fetch DTMF logs after a short delay
        setTimeout(() => {
          fetchDTMFLogs(transferId)
        }, 2000)
      } else if (result?.serverError) {
        toast({ 
          title: 'Sunucu Hatası!', 
          description: result.serverError, 
          variant: 'destructive' 
        })
      } else {
        toast({ 
          title: 'Bilinmeyen Hata!', 
          description: 'Beklenmedik bir sonuç döndü.', 
          variant: 'destructive' 
        })
      }
    })
  }

  const fetchDTMFLogs = async (transferId?: string) => {
    try {
      const url = transferId 
        ? `/api/admin/dtmf-logs?transfer=${transferId}`
        : '/api/admin/dtmf-logs'
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setDtmfLogs(data.logs || [])
      }
    } catch (error) {
      console.error('DTMF logs fetch error:', error)
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Gerçek Transfer Çağrısı Testi</h1>
        <p className="text-muted-foreground">
          Mevcut bir transfer için gerçek DTMF çağrısı başlatın ve sonuçları izleyin.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Çağrısı Parametreleri</CardTitle>
          <CardDescription>
            Gerçek bir transfer için arama başlatacak parametreleri girin.
          </CardDescription>
        </CardHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          handleSubmit(new FormData(e.currentTarget))
        }}>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="transferId">Transfer ID</Label>
              <Input
                id="transferId"
                name="transferId"
                placeholder="12345"
                required
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="flowSid">Flow SID</Label>
              <Input
                id="flowSid"
                name="flowSid"
                placeholder="FWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                defaultValue="FW4e2b8c3d5f4e6a7b8c9d0e1f2g3h4i5j"
                required
              />
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="phoneNumbers">Telefon Numaraları (Her satırda bir)</Label>
              <Textarea
                id="phoneNumbers"
                name="phoneNumbers"
                placeholder="+905551234567&#10;+905559876543"
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                E.164 formatında telefon numaraları girin (ör: +905551234567)
              </p>
            </div>
          </CardContent>
          
          <CardFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? 'Çağrı Başlatılıyor...' : 'Transfer Çağrısını Başlat'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Çağrı Sonuçları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Badge variant="outline">
                Başarılı: {results.successCount}
              </Badge>
              <Badge variant={results.errorCount > 0 ? "destructive" : "outline"}>
                Hatalı: {results.errorCount}
              </Badge>
            </div>
            
            {results.results && results.results.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Başarılı Çağrılar:</h4>
                <div className="space-y-2">
                  {results.results.map((result: any, index: number) => (
                    <div key={index} className="p-3 border rounded-md">
                      <div className="font-mono text-sm">
                        📞 {result.phoneNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Execution: {result.executionSid}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Call Hash: {result.callHash}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {results.errors && results.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Hatalı Çağrılar:</h4>
                <div className="space-y-2">
                  {results.errors.map((error: any, index: number) => (
                    <div key={index} className="p-3 border rounded-md bg-red-50">
                      <div className="font-mono text-sm">
                        ❌ {error.phoneNumber}
                      </div>
                      <div className="text-xs text-red-600">
                        {error.error}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            DTMF Logları
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchDTMFLogs(results?.transferId)}
            >
              Yenile
            </Button>
          </CardTitle>
          <CardDescription>
            Gerçek zamanlı DTMF olayları ve tuşlama logları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dtmfLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Henüz DTMF logu bulunmuyor.
            </p>
          ) : (
            <div className="space-y-3">
              {dtmfLogs.map((log, index) => (
                <div key={index} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={log.processed ? "default" : log.error ? "destructive" : "secondary"}>
                      {log.event}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Telefon:</span> {log.phoneNumber}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Widget:</span> {log.widgetName}
                    </div>
                    {log.digits && (
                      <div>
                        <span className="text-muted-foreground">Tuşlar:</span> 
                        <code className="ml-1 px-1 bg-gray-100 rounded">{log.digits}</code>
                      </div>
                    )}
                    {log.action && (
                      <div>
                        <span className="text-muted-foreground">Aksiyon:</span> {log.action}
                      </div>
                    )}
                  </div>
                  
                  {log.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      <strong>Hata:</strong> {log.error}
                    </div>
                  )}
                  
                  {log.response && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                      <strong>Yanıt:</strong> {log.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}