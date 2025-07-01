import { NextRequest } from 'next/server'
import { 
  addWebhookLog as addLog, 
  registerLogHandler, 
  unregisterLogHandler, 
  getWebhookLogs,
  clearWebhookLogs,
  type WebhookLog,
  type LogType 
} from '../../../../lib/services/webhook-logger'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '../../../../lib/services/notification-preferences-service'

// SSE clients
let clients: { id: string; send: (data: string) => void }[] = []

// Note: addWebhookLog is imported from ../../../../../lib/services/webhook-logger
// and used internally in this file

// Function to send log to all SSE clients
function broadcastLog(log: WebhookLog) {
  const message = `data: ${JSON.stringify(log)}\n\n`;
  clients.forEach(client => {
    try {
      client.send(message);
    } catch (error) {
      console.error('Failed to send to client:', error);
    }
  });
}

// Register broadcast handler when module loads
if (typeof window === 'undefined') { // Server-side only
  registerLogHandler(broadcastLog);
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      const clientId = Math.random().toString(36).substr(2, 9)
      
      const client = {
        id: clientId,
        send: (data: string) => {
          try {
            controller.enqueue(encoder.encode(data))
          } catch (error) {
            console.error('SSE enqueue error:', error)
          }
        }
      }
      
      clients.push(client)
      
      // İlk bağlantı mesajı
      addLog('INFO', 'monitor', { 
        message: 'Connected to webhook monitor', 
        clientId,
        activeClients: clients.length 
      });
      
      // Son 20 log'u gönder
      const recentLogs = getWebhookLogs().slice(0, 20);
      recentLogs.forEach(log => {
        client.send(`data: ${JSON.stringify(log)}\n\n`)
      })
      
      // Periyodik keep-alive mesajı
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':keepalive\n\n'))
        } catch (error) {
          clearInterval(keepAliveInterval)
        }
      }, 30000) // Her 30 saniyede bir
      
      // Cleanup function'u kaydet
      (controller as any).clientId = clientId;
      (controller as any).keepAliveInterval = keepAliveInterval;
    },
    
    cancel(controller) {
      // İstemci bağlantısı kesildiğinde temizle
      const clientId = (controller as any).clientId;
      const keepAliveInterval = (controller as any).keepAliveInterval;
      
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
      }
      
      clients = clients.filter(c => c.id !== clientId)
      console.log(`Client ${clientId} disconnected. Active clients: ${clients.length}`);
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Nginx buffering'i devre dışı bırak
    }
  })
} 