// Webhook Logger Service
// This service provides centralized logging functionality for webhooks

// Log türleri
export type LogType = 'DTMF' | 'STATUS' | 'TEST_FLOW' | 'TEST_CALL' | 'FLOW_START' | 'CALL_START' | 'CALL_ERROR' | 'CALL_SUMMARY' | 'ERROR' | 'INFO' | 'DEBUG';

// Log yapısı
export interface WebhookLog {
  id: string;
  timestamp: string;
  type: LogType;
  endpoint: string;
  data: any;
  metadata?: {
    transferId?: string;
    phoneNumber?: string;
    executionSid?: string;
    callStatus?: string;
    error?: string;
  };
}

// Global log storage
let webhookLogs: WebhookLog[] = [];
let logHandlers: ((log: WebhookLog) => void)[] = [];

// Log ID üretici
function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Register a log handler
export function registerLogHandler(handler: (log: WebhookLog) => void) {
  logHandlers.push(handler);
}

// Unregister a log handler
export function unregisterLogHandler(handler: (log: WebhookLog) => void) {
  logHandlers = logHandlers.filter(h => h !== handler);
}

// Get all logs
export function getWebhookLogs(): WebhookLog[] {
  return [...webhookLogs];
}

// Clear logs
export function clearWebhookLogs() {
  webhookLogs = [];
}

// Add a new log
export function addWebhookLog(
  type: LogType, 
  endpoint: string, 
  data: any,
  metadata?: WebhookLog['metadata']
) {
  const log: WebhookLog = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    type,
    endpoint,
    data,
    metadata
  };

  // Logu sakla (maksimum 100 log)
  webhookLogs.unshift(log);
  if (webhookLogs.length > 100) {
    webhookLogs = webhookLogs.slice(0, 100);
  }

  // Console'a da logla
  const metadataStr = metadata ? ` [${Object.entries(metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}]` : '';
  const timeStr = new Date().toISOString();
  console.log(`\n=== WEBHOOK LOG [${type}] ${timeStr} ===`);
  console.log(`📡 Endpoint: ${endpoint}${metadataStr}`);
  console.log(`📊 Data:`, JSON.stringify(data, null, 2));
  console.log(`=== END WEBHOOK LOG ===\n`);

  // Notify all handlers
  logHandlers.forEach(handler => {
    try {
      handler(log);
    } catch (error) {
      console.error('Log handler error:', error);
    }
  });

  return log;
}