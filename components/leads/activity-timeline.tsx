'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Phone, Mail, FileText, Clock, User, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { getMessagesByLead } from '@/lib/actions/message-actions'
import { Message } from '@/lib/actions/message-types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface ActivityTimelineProps {
  leadId: string
  refreshTrigger?: number
}

export default function ActivityTimeline({ leadId, refreshTrigger }: ActivityTimelineProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMessages()
  }, [leadId, refreshTrigger])

  const loadMessages = async () => {
    try {
      const data = await getMessagesByLead(leadId)
      setMessages(data)
    } catch (error) {
      console.error('Mesajlar yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'sms':
        return <Phone className="h-4 w-4" />
      case 'whatsapp':
        return <MessageSquare className="h-4 w-4" />
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'note':
        return <FileText className="h-4 w-4" />
      case 'call':
        return <Phone className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'sms':
        return 'bg-blue-500'
      case 'whatsapp':
        return 'bg-green-500'
      case 'email':
        return 'bg-purple-500'
      case 'note':
        return 'bg-yellow-500'
      case 'call':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default'
      case 'delivered':
        return 'secondary'
      case 'read':
        return 'outline'
      case 'failed':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'sms':
        return 'SMS'
      case 'whatsapp':
        return 'WhatsApp'
      case 'email':
        return 'E-posta'
      case 'note':
        return 'Not'
      case 'call':
        return 'Arama'
      default:
        return channel
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Gönderildi'
      case 'delivered':
        return 'Teslim Edildi'
      case 'read':
        return 'Okundu'
      case 'failed':
        return 'Başarısız'
      default:
        return status
    }
  }

  const formatMessageContent = (message: Message) => {
    if (message.channel === 'email' && message.metadata?.subject) {
      const lines = message.content.split('\n')
      const subject = lines[0]
      const content = lines.slice(2).join('\n') // Skip subject and empty line
      return { subject, content }
    }
    return { content: message.content }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Aktivite Geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            Yükleniyor...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Aktivite Geçmişi
        </CardTitle>
        <CardDescription>
          Bu lead ile yapılan tüm iletişim ve aktiviteler
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Henüz aktivite bulunmuyor</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => {
                const { subject, content } = formatMessageContent(message)
                
                return (
                  <div key={message.id} className="relative">
                    {index < messages.length - 1 && (
                      <div className="absolute left-4 top-10 bottom-0 w-px bg-border" />
                    )}
                    
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${getChannelColor(message.channel)} flex items-center justify-center text-white`}>
                        {getChannelIcon(message.channel)}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {getChannelLabel(message.channel)}
                            </Badge>
                            
                            <Badge variant={getStatusColor(message.status)}>
                              {getStatusLabel(message.status)}
                            </Badge>
                            
                            {message.direction === 'outbound' && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <ArrowRight className="h-3 w-3" />
                                Giden
                              </Badge>
                            )}
                          </div>
                          
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), 'dd MMM yyyy HH:mm', { locale: tr })}
                          </span>
                        </div>
                        
                        {/* Message content */}
                        <div className="bg-muted p-3 rounded-lg">
                          {subject && (
                            <div className="font-medium mb-2">{subject}</div>
                          )}
                          <div className="text-sm whitespace-pre-wrap">{content}</div>
                          
                          {/* Contact info */}
                          {(message.recipient_phone || message.recipient_email) && (
                            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
                              {message.recipient_phone && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {message.recipient_phone}
                                </div>
                              )}
                              {message.recipient_email && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  {message.recipient_email}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Sender info */}
                          {message.sender && (
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {message.sender.full_name || message.sender.email}
                            </div>
                          )}
                          
                          {/* Metadata info */}
                          {message.metadata && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              {message.metadata.twilio_sid && (
                                <div className="text-xs text-muted-foreground">
                                  Twilio SID: {message.metadata.twilio_sid}
                                </div>
                              )}
                              {message.metadata.content_sid && (
                                <div className="text-xs text-muted-foreground">
                                  Template: {message.metadata.content_sid}
                                </div>
                              )}
                              {message.metadata.template_variables && (
                                <div className="text-xs text-muted-foreground">
                                  Değişkenler: {JSON.stringify(message.metadata.template_variables)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}