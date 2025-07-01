// DTMF Event Logger Service
export interface DTMFLogEntry {
  timestamp: string;
  flowSid: string;
  executionSid: string;
  phoneNumber: string;
  event: string;
  widgetName: string;
  digits?: string;
  action?: string;
  callHash?: string;
  transferId?: string;
  processed: boolean;
  response?: string;
  error?: string;
}

class DTMFLogger {
  private logs: DTMFLogEntry[] = [];
  private handlers: Array<(log: DTMFLogEntry) => void> = [];

  // Add a new DTMF log entry
  log(entry: Omit<DTMFLogEntry, 'timestamp' | 'processed'>): DTMFLogEntry {
    const logEntry: DTMFLogEntry = {
      timestamp: new Date().toISOString(),
      processed: false,
      ...entry
    };

    this.logs.push(logEntry);
    
    // Notify handlers
    this.handlers.forEach(handler => {
      try {
        handler(logEntry);
      } catch (error) {
        console.error('DTMF Logger handler error:', error);
      }
    });

    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }

    return logEntry;
  }

  // Update a log entry
  updateLog(executionSid: string, updates: Partial<DTMFLogEntry>): void {
    const index = this.logs.findIndex(log => log.executionSid === executionSid);
    if (index !== -1) {
      this.logs[index] = { ...this.logs[index], ...updates };
    }
  }

  // Get logs for a specific execution
  getLogsForExecution(executionSid: string): DTMFLogEntry[] {
    return this.logs.filter(log => log.executionSid === executionSid);
  }

  // Get logs for a specific phone number
  getLogsForPhone(phoneNumber: string): DTMFLogEntry[] {
    return this.logs.filter(log => log.phoneNumber === phoneNumber);
  }

  // Get logs for a specific transfer
  getLogsForTransfer(transferId: string): DTMFLogEntry[] {
    return this.logs.filter(log => log.transferId === transferId);
  }

  // Get all recent logs
  getAllLogs(): DTMFLogEntry[] {
    return [...this.logs].reverse(); // Most recent first
  }

  // Add a handler for real-time updates
  addHandler(handler: (log: DTMFLogEntry) => void): void {
    this.handlers.push(handler);
  }

  // Remove a handler
  removeHandler(handler: (log: DTMFLogEntry) => void): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  // Get statistics
  getStats(): {
    totalLogs: number;
    processedLogs: number;
    failedLogs: number;
    recentActivity: number; // logs in last 5 minutes
  } {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    return {
      totalLogs: this.logs.length,
      processedLogs: this.logs.filter(log => log.processed && !log.error).length,
      failedLogs: this.logs.filter(log => log.error).length,
      recentActivity: this.logs.filter(log => log.timestamp > fiveMinutesAgo).length
    };
  }
}

// Singleton instance
export const dtmfLogger = new DTMFLogger();

// Helper function to log DTMF events
export function logDTMFEvent(data: {
  flowSid: string;
  executionSid: string;
  phoneNumber: string;
  event: string;
  widgetName: string;
  digits?: string;
  action?: string;
  callHash?: string;
  transferId?: string;
}): DTMFLogEntry {
  console.log('🔤 DTMF Event:', {
    phone: data.phoneNumber,
    digits: data.digits,
    action: data.action,
    widget: data.widgetName,
    execution: data.executionSid.substring(0, 8) + '...'
  });

  return dtmfLogger.log(data);
}

// Helper function to update DTMF log with processing result
export function updateDTMFLog(executionSid: string, result: {
  processed: boolean;
  response?: string;
  error?: string;
}): void {
  dtmfLogger.updateLog(executionSid, result);
  
  if (result.error) {
    console.error('❌ DTMF Processing Error:', result.error);
  } else if (result.processed) {
    console.log('✅ DTMF Processed:', result.response);
  }
}