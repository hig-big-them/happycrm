'use client'

import { useState, useEffect } from 'react'
import { Send, MessageSquare, Phone, Mail, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { 
  sendSMS, 
  sendWhatsApp, 
  sendEmail, 
  createMessage,
  getTwilioContentTemplates 
} from '@/lib/actions/message-actions'
import { TwilioContentTemplate } from '@/lib/actions/message-types'

interface MessageComposerProps {
  leadId: string
  leadName: string
  defaultPhone?: string
  defaultEmail?: string
  onMessageSent?: () => void
}

export default function MessageComposer({ 
  leadId, 
  leadName, 
  defaultPhone, 
  defaultEmail, 
  onMessageSent 
}: MessageComposerProps) {
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<TwilioContentTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<TwilioContentTemplate | null>(null)
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  
  // SMS Form Data
  const [smsData, setSmsData] = useState({
    recipient_phone: defaultPhone || '',
    content_sid: '',
    custom_message: ''
  })
  
  // WhatsApp Form Data
  const [whatsappData, setWhatsappData] = useState({
    recipient_phone: defaultPhone || '',
    content_sid: '',
    custom_message: ''
  })
  
  // Email Form Data
  const [emailData, setEmailData] = useState({
    recipient_email: defaultEmail || '',
    subject: '',
    content: ''
  })
  
  // Note Form Data
  const [noteData, setNoteData] = useState({
    content: ''
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    if (selectedTemplate && selectedTemplate.variables) {
      // Varsayılan değişken değerlerini ayarla
      const defaultVars: Record<string, string> = {}
      selectedTemplate.variables.forEach(variable => {
        if (variable === 'lead_name' || variable === 'name') {
          defaultVars[variable] = leadName
        } else {
          defaultVars[variable] = ''
        }
      })
      setTemplateVariables(defaultVars)
    }
  }, [selectedTemplate, leadName])

  const loadTemplates = async () => {
    try {
      const templatesData = await getTwilioContentTemplates()
      setTemplates(templatesData)
    } catch (error) {
      console.error('Template\'ler yüklenemedi:', error)
    }
  }

  const handleSendSMS = async () => {
    if (!smsData.recipient_phone) {
      toast({
        title: 'Hata',
        description: 'Telefon numarası gerekli',
        variant: 'destructive'
      })
      return
    }

    if (!smsData.content_sid && !smsData.custom_message) {
      toast({
        title: 'Hata',
        description: 'Template seçin veya özel mesaj yazın',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const result = await sendSMS({
        lead_id: leadId,
        recipient_phone: smsData.recipient_phone,
        content_sid: smsData.content_sid || undefined,
        template_variables: Object.keys(templateVariables).length > 0 ? templateVariables : undefined,
        custom_message: smsData.custom_message || undefined
      })

      if (result?.success) {
        toast({
          title: 'Başarılı',
          description: 'SMS gönderildi'
        })
        setSmsData({ ...smsData, custom_message: '', content_sid: '' })
        setSelectedTemplate(null)
        setTemplateVariables({})
        onMessageSent?.()
      }
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'SMS gönderilirken hata oluştu',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendWhatsApp = async () => {
    if (!whatsappData.recipient_phone) {
      toast({
        title: 'Hata',
        description: 'Telefon numarası gerekli',
        variant: 'destructive'
      })
      return
    }

    if (!whatsappData.content_sid && !whatsappData.custom_message) {
      toast({
        title: 'Hata',
        description: 'Template seçin veya özel mesaj yazın',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const result = await sendWhatsApp({
        lead_id: leadId,
        recipient_phone: whatsappData.recipient_phone,
        content_sid: whatsappData.content_sid || undefined,
        template_variables: Object.keys(templateVariables).length > 0 ? templateVariables : undefined,
        custom_message: whatsappData.custom_message || undefined
      })

      if (result?.success) {
        toast({
          title: 'Başarılı',
          description: 'WhatsApp mesajı gönderildi'
        })
        setWhatsappData({ ...whatsappData, custom_message: '', content_sid: '' })
        setSelectedTemplate(null)
        setTemplateVariables({})
        onMessageSent?.()
      }
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'WhatsApp mesajı gönderilirken hata oluştu',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!emailData.recipient_email || !emailData.subject || !emailData.content) {
      toast({
        title: 'Hata',
        description: 'Tüm email alanları gerekli',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const result = await sendEmail({
        lead_id: leadId,
        recipient_email: emailData.recipient_email,
        subject: emailData.subject,
        content: emailData.content
      })

      if (result?.success) {
        toast({
          title: 'Başarılı',
          description: 'E-posta gönderildi'
        })
        setEmailData({ recipient_email: defaultEmail || '', subject: '', content: '' })
        onMessageSent?.()
      }
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'E-posta gönderilirken hata oluştu',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!noteData.content) {
      toast({
        title: 'Hata',
        description: 'Not içeriği gerekli',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const result = await createMessage({
        lead_id: leadId,
        content: noteData.content,
        direction: 'outbound',
        channel: 'note'
      })

      if (result?.success) {
        toast({
          title: 'Başarılı',
          description: 'Not eklendi'
        })
        setNoteData({ content: '' })
        onMessageSent?.()
      }
    } catch (error) {
      toast({
        title: 'Hata',
        description: 'Not eklenirken hata oluştu',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (templateSid: string, channel: 'sms' | 'whatsapp') => {
    const template = templates.find(t => t.sid === templateSid)
    setSelectedTemplate(template || null)
    
    if (channel === 'sms') {
      setSmsData({ ...smsData, content_sid: templateSid })
    } else {
      setWhatsappData({ ...whatsappData, content_sid: templateSid })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Mesaj Gönder
        </CardTitle>
        <CardDescription>
          {leadName} ile iletişime geçin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sms" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sms" className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              E-posta
            </TabsTrigger>
            <TabsTrigger value="note" className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Not
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sms" className="space-y-4">
            <div>
              <Label htmlFor="sms-phone">Telefon Numarası</Label>
              <Input
                id="sms-phone"
                type="tel"
                value={smsData.recipient_phone}
                onChange={(e) => setSmsData({ ...smsData, recipient_phone: e.target.value })}
                placeholder="+90 555 123 4567"
              />
            </div>

            <div>
              <Label htmlFor="sms-template">Template Seç</Label>
              <Select 
                value={smsData.content_sid} 
                onValueChange={(value) => handleTemplateSelect(value, 'sms')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Template seçin (isteğe bağlı)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Template kullanma</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.sid} value={template.sid}>
                      {template.friendly_name} 
                      <Badge variant="outline" className="ml-2">
                        {template.language}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Template Değişkenleri</Label>
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable}>
                    <Label htmlFor={`var-${variable}`} className="text-sm">
                      {variable}
                    </Label>
                    <Input
                      id={`var-${variable}`}
                      value={templateVariables[variable] || ''}
                      onChange={(e) => setTemplateVariables({
                        ...templateVariables,
                        [variable]: e.target.value
                      })}
                      placeholder={`${variable} değeri`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="sms-message">Özel Mesaj</Label>
              <Textarea
                id="sms-message"
                value={smsData.custom_message}
                onChange={(e) => setSmsData({ ...smsData, custom_message: e.target.value })}
                placeholder="Template kullanmıyorsanız buraya mesajınızı yazın..."
                rows={3}
              />
            </div>

            <Button onClick={handleSendSMS} disabled={loading} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {loading ? 'Gönderiliyor...' : 'SMS Gönder'}
            </Button>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4">
            <div>
              <Label htmlFor="wa-phone">Telefon Numarası</Label>
              <Input
                id="wa-phone"
                type="tel"
                value={whatsappData.recipient_phone}
                onChange={(e) => setWhatsappData({ ...whatsappData, recipient_phone: e.target.value })}
                placeholder="+90 555 123 4567"
              />
            </div>

            <div>
              <Label htmlFor="wa-template">Template Seç</Label>
              <Select 
                value={whatsappData.content_sid} 
                onValueChange={(value) => handleTemplateSelect(value, 'whatsapp')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Template seçin (isteğe bağlı)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Template kullanma</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.sid} value={template.sid}>
                      {template.friendly_name}
                      <Badge variant="outline" className="ml-2">
                        {template.language}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div className="space-y-2">
                <Label>Template Değişkenleri</Label>
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable}>
                    <Label htmlFor={`wa-var-${variable}`} className="text-sm">
                      {variable}
                    </Label>
                    <Input
                      id={`wa-var-${variable}`}
                      value={templateVariables[variable] || ''}
                      onChange={(e) => setTemplateVariables({
                        ...templateVariables,
                        [variable]: e.target.value
                      })}
                      placeholder={`${variable} değeri`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div>
              <Label htmlFor="wa-message">Özel Mesaj</Label>
              <Textarea
                id="wa-message"
                value={whatsappData.custom_message}
                onChange={(e) => setWhatsappData({ ...whatsappData, custom_message: e.target.value })}
                placeholder="Template kullanmıyorsanız buraya mesajınızı yazın..."
                rows={3}
              />
            </div>

            <Button onClick={handleSendWhatsApp} disabled={loading} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {loading ? 'Gönderiliyor...' : 'WhatsApp Gönder'}
            </Button>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <div>
              <Label htmlFor="email-to">E-posta Adresi</Label>
              <Input
                id="email-to"
                type="email"
                value={emailData.recipient_email}
                onChange={(e) => setEmailData({ ...emailData, recipient_email: e.target.value })}
                placeholder="ornek@email.com"
              />
            </div>

            <div>
              <Label htmlFor="email-subject">Konu</Label>
              <Input
                id="email-subject"
                value={emailData.subject}
                onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                placeholder="E-posta konusu"
              />
            </div>

            <div>
              <Label htmlFor="email-content">İçerik</Label>
              <Textarea
                id="email-content"
                value={emailData.content}
                onChange={(e) => setEmailData({ ...emailData, content: e.target.value })}
                placeholder="E-posta içeriği..."
                rows={6}
              />
            </div>

            <Button onClick={handleSendEmail} disabled={loading} className="w-full">
              <Send className="mr-2 h-4 w-4" />
              {loading ? 'Gönderiliyor...' : 'E-posta Gönder'}
            </Button>
          </TabsContent>

          <TabsContent value="note" className="space-y-4">
            <div>
              <Label htmlFor="note-content">Not</Label>
              <Textarea
                id="note-content"
                value={noteData.content}
                onChange={(e) => setNoteData({ content: e.target.value })}
                placeholder="Lead hakkında not ekleyin..."
                rows={4}
              />
            </div>

            <Button onClick={handleAddNote} disabled={loading} className="w-full">
              <FileText className="mr-2 h-4 w-4" />
              {loading ? 'Ekleniyor...' : 'Not Ekle'}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}