"use client";

import React, { useState, useEffect } from "react";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Label } from "../../../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "../../../../components/ui/alert";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "../../../../components/ui/select";
import { CheckCircle, PhoneCall, AlertCircle, Settings, Clock, List, Download, Filter } from "lucide-react";

// Sayfanın kullanıcı arayüzü 
export default function TwilioTestPage() {
  // Test için durum değişkenleri
  const [phoneNumbers, setPhoneNumbers] = useState<string>("");
  const [message, setMessage] = useState<string>("Bu bir Twilio API test aramasıdır. Transfer hatırlatma sistemi test edilmektedir.");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [transferId, setTransferId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("manual");
  interface WebhookLog {
    id: string;
    timestamp: string;
    type: 'DTMF' | 'STATUS' | 'TEST_FLOW' | 'TEST_CALL' | 'FLOW_START' | 'CALL_START' | 'CALL_ERROR' | 'CALL_SUMMARY' | 'ERROR' | 'INFO' | 'DEBUG';
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

  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logTypeFilter, setLogTypeFilter] = useState<string>("all");

  // Polling-based webhook monitoring (more reliable than SSE on Vercel)
  useEffect(() => {
    if (!isMonitoring) return;

    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/admin/webhook-logs');
        const data = await response.json();
        if (data.success && data.logs) {
          setWebhookLogs(data.logs.slice(0, 50)); // Son 50 log
        }
      } catch (error) {
        console.error('Failed to fetch webhook logs:', error);
      }
    };

    // İlk yükleme
    fetchLogs();
    
    // Her 2 saniyede bir yenile
    const interval = setInterval(fetchLogs, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring]);

  // Tek numara arama işlevi
  const handleSingleCall = async () => {
    if (!phoneNumbers.trim()) {
      setResult({
        success: false,
        error: "Lütfen en az bir telefon numarası girin"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Test araması yapılıyor
      const response = await fetch("/api/admin/test-twilio-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumbers: phoneNumbers.split(",").map(p => p.trim()),
          message,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Belirli bir transfer için arama testi
  const handleTransferCall = async () => {
    if (!transferId.trim()) {
      setResult({
        success: false,
        error: "Lütfen bir transfer ID girin"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/test-transfer-deadline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transferId
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Transfer deadline kontrolünü başlatma işlevi
  const runDeadlineCheck = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const apiToken = prompt("API Token girin:");
      if (!apiToken) {
        setResult({
          success: false,
          error: "API Token gerekli"
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/cron/check-transfer-deadlines?token=${apiToken}`, {
        method: "GET",
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Flow test işlevi
  const handleFlowTest = async () => {
    if (!phoneNumbers.trim()) {
      setResult({
        success: false,
        error: "Lütfen en az bir telefon numarası girin"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/test-twilio-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumbers: phoneNumbers.split(",").map(p => p.trim()),
          transferId: transferId || "test-transfer-id",
          testType: "bulk"
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Export logs function
  const exportLogs = () => {
    const filteredLogs = logTypeFilter === "all" 
      ? webhookLogs 
      : webhookLogs.filter(log => log.type === logTypeFilter);
    
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileName = `webhook-logs-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  };

  // Studio Flow test işlevi
  const handleStudioFlowTest = async () => {
    if (!phoneNumbers.trim()) {
      setResult({
        success: false,
        error: "Lütfen en az bir telefon numarası girin"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/test-twilio-flow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: phoneNumbers.split(",")[0].trim(), // İlk numarayı al
          transferId: transferId || undefined,
          testType: "single"
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Twilio Arama Test Paneli</h1>
      
      <Tabs defaultValue="regular" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="regular">Regular Call</TabsTrigger>
          <TabsTrigger value="flow">Studio Flow</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Calls</TabsTrigger>
          <TabsTrigger value="monitor">Monitor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="regular">
          <Card>
            <CardHeader>
              <CardTitle>Manuel Arama Testi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phoneNumbers">Telefon Numaraları (virgülle ayırın)</Label>
                <Input
                  id="phoneNumbers"
                  placeholder="+905551234567, +905551234568"
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Arama Mesajı</Label>
                <Textarea
                  id="message"
                  placeholder="Arama yapıldığında okunacak mesaj"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleSingleCall}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Aranıyor..." : "Aramayı Başlat"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Arama Testi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="transferId">Transfer ID</Label>
                <Input
                  id="transferId"
                  placeholder="Örn: 550e8400-e29b-41d4-a716-446655440000"
                  value={transferId}
                  onChange={(e) => setTransferId(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleTransferCall}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Transfere Ait Telefon Aranıyor..." : "Transfer Aramasını Başlat"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="flow">
          <Card>
            <CardHeader>
              <CardTitle>Studio Flow Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertTitle>Flow Bilgisi</AlertTitle>
                <AlertDescription>
                  Environment'ta TWILIO_DEADLINE_FLOW_SID tanımlı olmalıdır. 
                  Bu test deadline flow'unu manuel olarak tetikler.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="flowTransferId">Transfer ID</Label>
                <Input
                  id="flowTransferId"
                  placeholder="550e8400-e29b-41d4-a716-446655440000"
                  value={transferId}
                  onChange={(e) => setTransferId(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="flowPhoneNumbers">Telefon Numaraları (virgülle ayırın)</Label>
                <Input
                  id="flowPhoneNumbers"
                  placeholder="+905327994223, +905321234567"
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                />
              </div>
              
              <Button 
                onClick={handleFlowTest}
                disabled={isLoading}
                className="w-full"
                variant="secondary"
              >
                {isLoading ? "Flow Başlatılıyor..." : "Deadline Flow Testini Başlat"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="studio">
          <Card>
            <CardHeader>
              <CardTitle>Studio Flow Direkt Test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertTitle>Studio Flow Testi</AlertTitle>
                <AlertDescription>
                  Bu test mevcut Studio Flow JSON'unuza uygun webhook endpoint'leri ile doğrudan test yapar.
                  Studio Flow'da NGROK_URL değişkeni güncellenmelidir.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="studioPhoneNumber">Telefon Numarası</Label>
                <Input
                  id="studioPhoneNumber"
                  placeholder="+905327994223"
                  value={phoneNumbers}
                  onChange={(e) => setPhoneNumbers(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="studioTransferId">Transfer ID (opsiyonel)</Label>
                <Input
                  id="studioTransferId"
                  placeholder="Boş bırakılırsa test ID kullanılır"
                  value={transferId}
                  onChange={(e) => setTransferId(e.target.value)}
                />
              </div>
              
              <div className="bg-gray-50 p-3 rounded text-sm">
                <strong>Test senaryosu:</strong>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Studio Flow çağrısı başlatılır</li>
                  <li>Webhook endpoint'leri test edilir</li>
                  <li>1-9-9-7 tuşlayarak onaylayabilirsiniz</li>
                  <li>Database güncellemeleri kontrol edilir</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleStudioFlowTest}
                disabled={isLoading}
                className="w-full"
                variant="secondary"
              >
                {isLoading ? "Studio Flow Başlatılıyor..." : "Studio Flow Test Başlat"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="check">
          <Card>
            <CardHeader>
              <CardTitle>Deadline Kontrolü</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertTitle>Dikkat</AlertTitle>
                <AlertDescription>
                  Bu işlem tüm deadline'ı geçmiş transferleri kontrol edecek ve 
                  gerekli aramaları yapacaktır. Sadece test ortamında kullanın.
                </AlertDescription>
              </Alert>
              
              <Button 
                onClick={runDeadlineCheck}
                disabled={isLoading}
                variant="destructive"
                className="w-full"
              >
                {isLoading ? "Kontrol Ediliyor..." : "Tüm Gecikmeli Transferleri Kontrol Et"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="monitor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Real-time Webhook Monitor
                <div className="flex gap-2 items-center">
                  <Select value={logTypeFilter} onValueChange={setLogTypeFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filter logs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="DTMF">DTMF</SelectItem>
                      <SelectItem value="STATUS">Status</SelectItem>
                      <SelectItem value="TEST_FLOW">Test Flow</SelectItem>
                      <SelectItem value="TEST_CALL">Test Call</SelectItem>
                      <SelectItem value="FLOW_START">Flow Start</SelectItem>
                      <SelectItem value="CALL_START">Call Start</SelectItem>
                      <SelectItem value="CALL_ERROR">Call Error</SelectItem>
                      <SelectItem value="CALL_SUMMARY">Call Summary</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                      <SelectItem value="INFO">Info</SelectItem>
                      <SelectItem value="DEBUG">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button
                    onClick={exportLogs}
                    variant="outline"
                    size="sm"
                    disabled={webhookLogs.length === 0}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                  
                  <Button
                    onClick={() => setWebhookLogs([])}
                    variant="outline"
                    size="sm"
                    disabled={webhookLogs.length === 0}
                  >
                    Clear Logs
                  </Button>
                  
                  <Button
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    variant={isMonitoring ? "destructive" : "default"}
                    size="sm"
                  >
                    {isMonitoring ? "Stop Monitor" : "Start Monitor"}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {webhookLogs.length > 0 && (
                <div className="mb-4 text-sm text-muted-foreground">
                  Showing {webhookLogs.filter(log => logTypeFilter === "all" || log.type === logTypeFilter).length} of {webhookLogs.length} logs
                </div>
              )}
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {webhookLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {isMonitoring ? "Waiting for webhook events..." : "Click 'Start Monitor' to begin"}
                  </p>
                ) : (
                  webhookLogs
                    .filter(log => logTypeFilter === "all" || log.type === logTypeFilter)
                    .map((log) => {
                    // Log type'a göre renk belirle
                    const typeColors = {
                      'DTMF': 'text-blue-600 bg-blue-50',
                      'STATUS': 'text-green-600 bg-green-50',
                      'TEST_FLOW': 'text-purple-600 bg-purple-50',
                      'TEST_CALL': 'text-orange-600 bg-orange-50',
                      'FLOW_START': 'text-indigo-600 bg-indigo-50',
                      'CALL_START': 'text-cyan-600 bg-cyan-50',
                      'CALL_ERROR': 'text-red-600 bg-red-50',
                      'CALL_SUMMARY': 'text-teal-600 bg-teal-50',
                      'ERROR': 'text-red-600 bg-red-50',
                      'INFO': 'text-gray-600 bg-gray-50',
                      'DEBUG': 'text-yellow-600 bg-yellow-50'
                    };
                    
                    const typeClass = typeColors[log.type] || 'text-gray-600 bg-gray-50';
                    
                    return (
                      <div key={log.id} className="border rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${typeClass}`}>
                              {log.type}
                            </span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {log.endpoint}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        
                        {/* Metadata bilgileri */}
                        {log.metadata && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {log.metadata.transferId && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                Transfer: {log.metadata.transferId}
                              </span>
                            )}
                            {log.metadata.phoneNumber && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                Phone: {log.metadata.phoneNumber}
                              </span>
                            )}
                            {log.metadata.executionSid && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                SID: {log.metadata.executionSid.slice(-8)}
                              </span>
                            )}
                            {log.metadata.callStatus && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                Status: {log.metadata.callStatus}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Data içeriği */}
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                            Click to view data
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto max-h-40">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {result && (
        <div className="mt-8">
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? "İşlem Başarılı" : "Hata"}
            </AlertTitle>
            <AlertDescription>
              {result.message || result.error || "Sonuç aşağıda görüntüleniyor."}
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
            <pre className="whitespace-pre-wrap overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
} 