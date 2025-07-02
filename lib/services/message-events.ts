/**
 * Message Event System for Real-time Notifications
 * 
 * Manages message events and provides a polling-based system for real-time updates
 */

import { randomUUID } from 'crypto'

// Event types
export type MessageEventType = 'new_message' | 'status_update' | 'typing' | 'read_receipt'

export interface MessageEvent {
  id: string
  type: MessageEventType
  data: any
  timestamp: string
  leadId?: string
  from?: string
  body?: string
}

// In-memory event store with size limit
const messageEvents = new Map<string, MessageEvent>()
const MAX_EVENTS = 1000
const EVENT_TTL = 5 * 60 * 1000 // 5 minutes

// Add a new message event
export function addMessageEvent(event: Omit<MessageEvent, 'id' | 'timestamp'>) {
  const eventId = `evt_${Date.now()}_${randomUUID()}`
  
  const fullEvent: MessageEvent = {
    ...event,
    id: eventId,
    timestamp: new Date().toISOString()
  }
  
  messageEvents.set(eventId, fullEvent)
  
  // Clean up old events
  cleanupOldEvents()
  
  // Limit event store size
  if (messageEvents.size > MAX_EVENTS) {
    const oldestKey = messageEvents.keys().next().value
    if (oldestKey) {
      messageEvents.delete(oldestKey)
    }
  }
  
  return eventId
}

// Get events since a specific timestamp
export function getEventsSince(since: string | null, leadId?: string): MessageEvent[] {
  const events: MessageEvent[] = []
  const sinceTime = since ? new Date(since).getTime() : 0
  
  for (const event of messageEvents.values()) {
    const eventTime = new Date(event.timestamp).getTime()
    
    // Filter by time and optionally by leadId
    if (eventTime > sinceTime) {
      if (!leadId || event.leadId === leadId) {
        events.push(event)
      }
    }
  }
  
  return events.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

// Get all events for a specific lead
export function getLeadEvents(leadId: string): MessageEvent[] {
  const events: MessageEvent[] = []
  
  for (const event of messageEvents.values()) {
    if (event.leadId === leadId) {
      events.push(event)
    }
  }
  
  return events.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}

// Clean up events older than TTL
function cleanupOldEvents() {
  const now = Date.now()
  const keysToDelete: string[] = []
  
  for (const [key, event] of messageEvents.entries()) {
    const eventTime = new Date(event.timestamp).getTime()
    if (now - eventTime > EVENT_TTL) {
      keysToDelete.push(key)
    }
  }
  
  keysToDelete.forEach(key => messageEvents.delete(key))
}

// Clear all events
export function clearAllEvents() {
  messageEvents.clear()
}

// Get event count
export function getEventCount(): number {
  return messageEvents.size
}

// Webhook integration helpers
export function createNewMessageEvent(data: {
  leadId: string
  messageId: string
  from: string
  body: string
  channel: 'whatsapp' | 'sms'
  mediaUrl?: string
}) {
  return addMessageEvent({
    type: 'new_message',
    data: {
      messageId: data.messageId,
      channel: data.channel,
      mediaUrl: data.mediaUrl
    },
    leadId: data.leadId,
    from: data.from,
    body: data.body
  })
}

export function createStatusUpdateEvent(data: {
  leadId?: string
  messageId: string
  status: string
  errorCode?: string
  errorMessage?: string
}) {
  return addMessageEvent({
    type: 'status_update',
    data: {
      messageId: data.messageId,
      status: data.status,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage
    },
    leadId: data.leadId
  })
}

export function createTypingEvent(data: {
  leadId: string
  userId: string
  isTyping: boolean
}) {
  return addMessageEvent({
    type: 'typing',
    data: {
      userId: data.userId,
      isTyping: data.isTyping
    },
    leadId: data.leadId
  })
}

export function createReadReceiptEvent(data: {
  leadId: string
  messageIds: string[]
  readBy: string
}) {
  return addMessageEvent({
    type: 'read_receipt',
    data: {
      messageIds: data.messageIds,
      readBy: data.readBy
    },
    leadId: data.leadId
  })
}

// Scheduled cleanup
if (typeof global !== 'undefined') {
  // Run cleanup every minute
  setInterval(cleanupOldEvents, 60 * 1000)
}