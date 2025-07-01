'use server'

import { z } from 'zod'
import { Twilio } from 'twilio'
import { actionClient } from '../clients/action-clients'
import { makeCall, makeSequentialCalls } from "../services/twilio-service"
import { addWebhookLog } from "../services/webhook-logger"

// Zod şeması ile giriş parametrelerini tanımla
const TriggerNotificationFlowSchema = z.object({
  flowSid: z.string().min(1, 'Flow SID gereklidir.'),
  to: z.string().min(1, 'Hedef numara gereklidir.'), // E.164 formatında olmalı
  parameters: z.record(z.string(), z.any()).optional(), // Flow'a gönderilecek ek parametreler
})

export const triggerNotificationFlow = actionClient
  .schema(TriggerNotificationFlowSchema)
  // Explicitly type the action to match what useActionState expects for its async function
  .action(async ({ ctx, input }) => {
    const { flowSid, to, parameters } = input

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !twilioPhoneNumber) {
      return {
        serverError: 'Twilio yapılandırma bilgileri eksik. Lütfen .env dosyanızı kontrol edin.',
      }
    }

    const client = new Twilio(accountSid, authToken)

    try {
      // Örnek: Tek bir numarayı arama
      // await makeCall(to, parameters?.message)
      
      // Örnek: Sıralı aramalar
      const results = await makeSequentialCalls(to, parameters?.message)

      await addWebhookLog({
        channel: 'twilio_action',
        log_level: 'info',
        content: `Sıralı arama başarıyla tamamlandı: ${JSON.stringify(results)}`
      })
      
      return { success: true, results }
    } catch (error: any) {
      console.error("Twilio action error:", error)
       await addWebhookLog({
        channel: 'twilio_action',
        log_level: 'error',
        content: `Sıralı arama hatası: ${error.message}`
      })
      return { success: false, error: error.message }
    }
  })

// Kullanım Örneği (bir React bileşeninde veya başka bir server action'da):
/*
async function handleTrigger() {
  const result = await triggerNotificationFlow({
    flowSid: 'FWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Gerçek Flow SID'niz
    to: '+1234567890', // Hedef numara
    parameters: {
      name: 'Ahmet',
      order_id: '12345'
    }
  })

  if (result?.success) {
    console.log('Flow başarıyla tetiklendi, Execution SID:', result.data.executionSid)
  } else {
    console.error('Flow tetikleme hatası:', result?.error)
  }
}
*/ 