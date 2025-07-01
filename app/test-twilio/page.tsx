'use client'

import { useState, useTransition } from 'react'
import { triggerNotificationFlow } from '../../lib/actions/twilio-actions'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { useToast } from '../../hooks/use-toast'
import { z } from 'zod'

// triggerNotificationFlow içindeki schema ve action'dan dönen data tipi
const TriggerNotificationFlowInputSchema = z.object({
  flowSid: z.string(), // Validasyonlar action içinde yapılıyor
  to: z.string(),
  parameters: z.record(z.string(), z.any()).optional(),
})
const FlowExecutionDataSchema = z.object({
  executionSid: z.string(),
  message: z.string(),
})

// next-safe-action'dan dönen genel sonuç tipi için basitleştirilmiş bir arayüz
// Bu, linter'a yardımcı olabilir.
interface MySafeActionResult {
  data?: z.infer<typeof FlowExecutionDataSchema>
  serverError?: string
  validationErrors?: z.ZodError<z.infer<typeof TriggerNotificationFlowInputSchema>>['formErrors']['fieldErrors']
}

interface FormState extends MySafeActionResult {
  formError?: string // Sadece client-side form hataları için
}

const initialState: FormState = {}

export default function TestTwilioPage() {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<FormState>(initialState)

  const handleSubmit = async (formData: FormData) => {
    const flowSid = formData.get('flowSid') as string
    const to = formData.get('to') as string
    const parametersString = formData.get('parameters') as string

    let parameters = {}
    if (parametersString) {
      try {
        parameters = JSON.parse(parametersString)
      } catch (e) {
        const errorMsg = 'Parametreler geçerli bir JSON formatında değil.'
        toast({ title: 'Giriş Hatası', description: errorMsg, variant: 'destructive' })
        setState({ formError: errorMsg })
        return
      }
    }

    if (!flowSid || !to) {
      const errorMsg = 'Flow SID ve Hedef Numara alanları zorunludur.'
      toast({ title: 'Giriş Hatası', description: errorMsg, variant: 'destructive' })
      setState({ formError: errorMsg })
      return
    }

    startTransition(async () => {
      const result = await triggerNotificationFlow({
        flowSid,
        to,
        parameters,
      })

      if (!result) {
        const errorMsg = 'Action sonucu tanımsız döndü. Bu beklenmedik bir durumdur.'
        toast({ title: 'Sistem Hatası!', description: errorMsg, variant: 'destructive' })
        setState({ serverError: errorMsg })
        return
      }

      const safeResult = result as MySafeActionResult;

      if (safeResult.data) {
        toast({ title: 'Başarılı!', description: safeResult.data.message })
        setState({ data: safeResult.data })
      } else if (safeResult.serverError) {
        toast({ title: 'Sunucu Hatası!', description: safeResult.serverError, variant: 'destructive' })
        setState({ serverError: safeResult.serverError })
      } else if (safeResult.validationErrors) {
        let errorMessages = 'Giriş alanlarında validasyon hataları var:';
        for (const field in safeResult.validationErrors) {
          const fieldErrors = safeResult.validationErrors[field as keyof typeof safeResult.validationErrors];
          if (fieldErrors) {
            errorMessages += `\n- ${field}: ${fieldErrors.join(', ')}`;
          }
        }
        toast({ title: 'Validasyon Hatası!', description: errorMessages, variant: 'destructive', duration: 7000 })
        setState({ validationErrors: safeResult.validationErrors })
      } else {
        const errorMsg = 'Bilinmeyen bir hata oluştu veya action sonucu anlaşılamadı.'
        toast({ title: 'Beklenmedik Hata!', description: errorMsg, variant: 'destructive' })
        setState({ serverError: errorMsg })
      }
    })
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle>Twilio Studio Flow Tetikleme Testi</CardTitle>
          <CardDescription>
            Bu sayfa üzerinden `triggerNotificationFlow` server action'ını test
            edebilirsiniz.
          </CardDescription>
        </CardHeader>
        <form onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(new FormData(e.currentTarget));
        }}>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="flowSid">Flow SID</Label>
              <Input
                id="flowSid"
                name="flowSid"
                placeholder="FWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                required
                className={state.validationErrors?.flowSid ? 'border-destructive' : ''}
              />
              {state.validationErrors?.flowSid && (
                <p className="text-xs text-destructive mt-1">
                  {state.validationErrors.flowSid.join(', ')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">Hedef Numara (E.164)</Label>
              <Input
                id="to"
                name="to"
                placeholder="+1234567890"
                required
                className={state.validationErrors?.to ? 'border-destructive' : ''}
              />
              {state.validationErrors?.to && (
                <p className="text-xs text-destructive mt-1">
                  {state.validationErrors.to.join(', ')}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="parameters">Parametreler (JSON Formatında)</Label>
              <Textarea
                id="parameters"
                name="parameters"
                placeholder='{ "name": "Ahmet", "order_id": "12345" }'
                rows={3}
                className={state.formError?.includes('JSON') ? 'border-destructive' : ''}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-start space-y-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Tetikleniyor...' : 'Flowu Tetikle'}
            </Button>
            {state.formError && (
              <p className="text-sm font-medium text-destructive">
                Form Hatası: {state.formError}
              </p>
            )}
            {state.serverError && (
              <p className="text-sm font-medium text-destructive">
                Sunucu Hatası: {state.serverError}
              </p>
            )}
            {state.data && (
              <p className="text-sm font-medium text-green-600">
                {state.data.message}
              </p>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
} 