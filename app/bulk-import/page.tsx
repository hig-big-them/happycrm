"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  X, 
  AlertCircle, 
  Download,
  Loader2,
  ArrowRight,
  FileText,
  Database
} from "lucide-react";

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  pipeline_id: string | null;
}

interface Company {
  id: string;
  company_name: string;
}

interface ImportData {
  lead_name: string;
  contact_email?: string;
  contact_phone?: string;
  company_name?: string;
  lead_value?: number;
  source?: string;
  priority?: string;
  description?: string;
  [key: string]: any;
}

interface FieldMapping {
  csvField: string;
  dbField: string;
}

// Veritabanı alanları
const dbFields = [
  { value: 'lead_name', label: 'Lead Adı (Zorunlu)' },
  { value: 'contact_email', label: 'E-posta' },
  { value: 'contact_phone', label: 'Telefon' },
  { value: 'company_name', label: 'Şirket Adı' },
  { value: 'lead_value', label: 'Değer' },
  { value: 'source', label: 'Kaynak' },
  { value: 'priority', label: 'Öncelik' },
  { value: 'description', label: 'Açıklama' },
  { value: 'ignore', label: '-- Bu alanı kullanma --' }
];

export default function BulkImportPage() {
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  
  // Import verileri
  const [csvData, setCsvData] = React.useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = React.useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = React.useState<FieldMapping[]>([]);
  const [mappedData, setMappedData] = React.useState<ImportData[]>([]);
  
  // Seçimler
  const [selectedPipeline, setSelectedPipeline] = React.useState<string>("");
  const [selectedStage, setSelectedStage] = React.useState<string>("");
  const [pipelines, setPipelines] = React.useState<Pipeline[]>([]);
  const [stages, setStages] = React.useState<Stage[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  
  // Import sonuçları
  const [importResults, setImportResults] = React.useState<{
    successful: number;
    failed: number;
    errors: string[];
  }>({ successful: 0, failed: 0, errors: [] });

  React.useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    const supabase = createClient();
    
    try {
      const [pipelinesRes, companiesRes] = await Promise.all([
        supabase.from("pipelines").select("*").eq("is_active", true).order("name"),
        supabase.from("companies").select("id, company_name").eq("is_active", true).order("company_name")
      ]);
      
      if (pipelinesRes.data) setPipelines(pipelinesRes.data);
      if (companiesRes.data) setCompanies(companiesRes.data);
    } catch (err) {
      console.error("Veri yükleme hatası:", err);
    }
  }

  React.useEffect(() => {
    if (selectedPipeline) {
      loadStages(selectedPipeline);
    }
  }, [selectedPipeline]);

  async function loadStages(pipelineId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("stages")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("order_position");
      
    if (data) setStages(data);
  }

  // CSV dosyasını işle
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setError(null);
    setSuccess(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setError("CSV dosyası en az başlık ve bir veri satırı içermelidir.");
          return;
        }
        
        // Başlıkları al
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        setCsvHeaders(headers);
        
        // Verileri parse et
        const data = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
        
        setCsvData(data);
        
        // Otomatik mapping önerileri
        const autoMappings: FieldMapping[] = headers.map(header => {
          const lowerHeader = header.toLowerCase();
          let dbField = 'ignore';
          
          if (lowerHeader.includes('name') || lowerHeader.includes('isim') || lowerHeader.includes('ad')) {
            dbField = 'lead_name';
          } else if (lowerHeader.includes('email') || lowerHeader.includes('e-posta') || lowerHeader.includes('eposta')) {
            dbField = 'contact_email';
          } else if (lowerHeader.includes('phone') || lowerHeader.includes('telefon') || lowerHeader.includes('tel')) {
            dbField = 'contact_phone';
          } else if (lowerHeader.includes('company') || lowerHeader.includes('şirket') || lowerHeader.includes('firma')) {
            dbField = 'company_name';
          } else if (lowerHeader.includes('value') || lowerHeader.includes('değer') || lowerHeader.includes('tutar')) {
            dbField = 'lead_value';
          } else if (lowerHeader.includes('source') || lowerHeader.includes('kaynak')) {
            dbField = 'source';
          } else if (lowerHeader.includes('priority') || lowerHeader.includes('öncelik')) {
            dbField = 'priority';
          } else if (lowerHeader.includes('description') || lowerHeader.includes('açıklama') || lowerHeader.includes('not')) {
            dbField = 'description';
          }
          
          return { csvField: header, dbField };
        });
        
        setFieldMappings(autoMappings);
        setSuccess(`${data.length} kayıt başarıyla yüklendi. Lütfen alan eşleştirmelerini kontrol edin.`);
        
      } catch (err) {
        setError("CSV dosyası işlenirken hata oluştu. Lütfen dosya formatını kontrol edin.");
        console.error(err);
      }
    };
    
    reader.readAsText(file);
  };

  // Alan eşleştirmesini güncelle
  const updateFieldMapping = (csvField: string, dbField: string) => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.csvField === csvField ? { ...mapping, dbField } : mapping
      )
    );
  };

  // Verileri eşleştir ve önizle
  const processMapping = () => {
    if (!selectedPipeline || !selectedStage) {
      setError("Lütfen pipeline ve aşama seçin.");
      return;
    }
    
    const leadNameMapping = fieldMappings.find(m => m.dbField === 'lead_name');
    if (!leadNameMapping) {
      setError("Lead Adı alanı zorunludur. Lütfen bir CSV alanını Lead Adı ile eşleştirin.");
      return;
    }
    
    const mapped: ImportData[] = csvData.map(row => {
      const mappedRow: ImportData = { lead_name: '' };
      
      fieldMappings.forEach(mapping => {
        if (mapping.dbField !== 'ignore') {
          const value = row[mapping.csvField];
          
          if (mapping.dbField === 'lead_value' && value) {
            // Sayısal değeri parse et
            const numValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
            mappedRow[mapping.dbField] = isNaN(numValue) ? 0 : numValue;
          } else {
            mappedRow[mapping.dbField] = value || '';
          }
        }
      });
      
      return mappedRow;
    });
    
    setMappedData(mapped);
    setCurrentStep(3);
  };

  // Verileri import et
  const performImport = async () => {
    setIsLoading(true);
    setError(null);
    const supabase = createClient();
    
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    
    for (let i = 0; i < mappedData.length; i++) {
      const lead = mappedData[i];
      
      try {
        // Şirket kontrolü ve oluşturma
        let companyId = null;
        if (lead.company_name) {
          // Mevcut şirketi bul
          const existingCompany = companies.find(
            c => c.company_name.toLowerCase() === lead.company_name!.toLowerCase()
          );
          
          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            // Yeni şirket oluştur
            const { data: newCompany, error: companyError } = await supabase
              .from("companies")
              .insert({ company_name: lead.company_name, is_active: true })
              .select()
              .single();
              
            if (companyError) {
              throw new Error(`Şirket oluşturulamadı: ${companyError.message}`);
            }
            
            companyId = newCompany.id;
            // Yeni şirketi listeye ekle
            setCompanies(prev => [...prev, newCompany]);
          }
        }
        
        // Lead'i oluştur
        const { error: leadError } = await supabase
          .from("leads")
          .insert({
            lead_name: lead.lead_name,
            contact_email: lead.contact_email || null,
            contact_phone: lead.contact_phone || null,
            company_id: companyId,
            lead_value: lead.lead_value || null,
            source: lead.source || 'CSV Import',
            priority: lead.priority || 'Orta',
            description: lead.description || null,
            pipeline_id: selectedPipeline,
            stage_id: selectedStage
          });
          
        if (leadError) {
          throw new Error(leadError.message);
        }
        
        results.successful++;
      } catch (err) {
        const error = err as Error;
        results.failed++;
        results.errors.push(`Satır ${i + 1}: ${error.message}`);
      }
    }
    
    setImportResults(results);
    setCurrentStep(4);
    setIsLoading(false);
  };

  // Örnek CSV indir
  const downloadSampleCSV = () => {
    const sampleData = [
      ['Lead Adı', 'E-posta', 'Telefon', 'Şirket', 'Değer', 'Kaynak', 'Öncelik', 'Açıklama'],
      ['Ahmet Yılmaz', 'ahmet@example.com', '5551234567', 'ABC Teknoloji', '50000', 'Website', 'Yüksek', 'Acil proje'],
      ['Ayşe Demir', 'ayse@example.com', '5559876543', 'XYZ Danışmanlık', '25000', 'Referans', 'Orta', 'Q2 için planlama']
    ];
    
    const csvContent = sampleData.map(row => row.join(',')).join('\\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ornek_lead_import.csv';
    link.click();
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Toplu Lead İçe Aktarma</h1>
        <p className="text-muted-foreground">
          CSV dosyası kullanarak birden fazla lead'i aynı anda sisteme ekleyin
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between max-w-2xl">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-medium
                  ${currentStep >= step 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-gray-200 text-gray-600'}
                `}>
                  {currentStep > step ? <Check className="h-5 w-5" /> : step}
                </div>
                <span className="text-sm mt-2">
                  {step === 1 && "Dosya Yükle"}
                  {step === 2 && "Alan Eşleştir"}
                  {step === 3 && "Önizle"}
                  {step === 4 && "Sonuç"}
                </span>
              </div>
              {step < 4 && (
                <div className={`flex-1 h-1 mx-4 ${
                  currentStep > step ? 'bg-primary' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1: Dosya Yükleme */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>CSV Dosyası Yükle</CardTitle>
              <CardDescription>
                Lead bilgilerini içeren CSV dosyanızı seçin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pipeline">Pipeline Seç *</Label>
                  <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pipeline seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map(pipeline => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="stage">Aşama Seç *</Label>
                  <Select 
                    value={selectedStage} 
                    onValueChange={setSelectedStage}
                    disabled={!selectedPipeline}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aşama seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <Label htmlFor="csv-upload" className="cursor-pointer">
                  <span className="text-primary hover:underline">CSV dosyası seçin</span>
                  <span className="text-muted-foreground"> veya sürükleyip bırakın</span>
                </Label>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={!selectedPipeline || !selectedStage}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Maksimum dosya boyutu: 5MB
                </p>
              </div>
              
              <Button
                variant="outline"
                onClick={downloadSampleCSV}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Örnek CSV İndir
              </Button>
            </CardContent>
          </Card>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Hata</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && csvData.length > 0 && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertTitle>Başarılı</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          {csvData.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => setCurrentStep(2)}>
                Alan Eşleştirmeye Geç
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Alan Eşleştirme */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alan Eşleştirmesi</CardTitle>
              <CardDescription>
                CSV alanlarını veritabanı alanları ile eşleştirin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Alanı</TableHead>
                    <TableHead>Örnek Veri</TableHead>
                    <TableHead>Veritabanı Alanı</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvHeaders.map((header, index) => (
                    <TableRow key={header}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {csvData[0]?.[header] || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={fieldMappings.find(m => m.csvField === header)?.dbField || 'ignore'}
                          onValueChange={(value) => updateFieldMapping(header, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dbFields.map(field => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Geri
              </Button>
              <Button onClick={processMapping}>
                Verileri Önizle
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Hata</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Step 3: Önizleme */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>İçe Aktarma Önizlemesi</CardTitle>
              <CardDescription>
                {mappedData.length} lead içe aktarılacak
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Lead Adı</TableHead>
                      <TableHead>E-posta</TableHead>
                      <TableHead>Telefon</TableHead>
                      <TableHead>Şirket</TableHead>
                      <TableHead>Değer</TableHead>
                      <TableHead>Kaynak</TableHead>
                      <TableHead>Öncelik</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedData.slice(0, 10).map((lead, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{lead.lead_name}</TableCell>
                        <TableCell>{lead.contact_email || '-'}</TableCell>
                        <TableCell>{lead.contact_phone || '-'}</TableCell>
                        <TableCell>{lead.company_name || '-'}</TableCell>
                        <TableCell>{lead.lead_value ? `₺${lead.lead_value}` : '-'}</TableCell>
                        <TableCell>{lead.source || 'CSV Import'}</TableCell>
                        <TableCell>
                          <Badge variant={
                            lead.priority === 'Yüksek' ? 'destructive' :
                            lead.priority === 'Düşük' ? 'secondary' : 'default'
                          }>
                            {lead.priority || 'Orta'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {mappedData.length > 10 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  İlk 10 kayıt gösteriliyor. Toplam {mappedData.length} kayıt içe aktarılacak.
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                Geri
              </Button>
              <Button onClick={performImport} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    İçe Aktarılıyor...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4 mr-2" />
                    İçe Aktarmayı Başlat
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Step 4: Sonuç */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>İçe Aktarma Tamamlandı</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Check className="h-12 w-12 text-green-600 mx-auto mb-2" />
                      <p className="text-3xl font-bold text-green-600">
                        {importResults.successful}
                      </p>
                      <p className="text-sm text-green-700">Başarılı</p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <X className="h-12 w-12 text-red-600 mx-auto mb-2" />
                      <p className="text-3xl font-bold text-red-600">
                        {importResults.failed}
                      </p>
                      <p className="text-sm text-red-700">Başarısız</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {importResults.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>İçe Aktarma Hataları</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {importResults.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="text-sm">{error}</li>
                      ))}
                      {importResults.errors.length > 5 && (
                        <li className="text-sm">
                          ... ve {importResults.errors.length - 5} hata daha
                        </li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex gap-2">
                <Button onClick={() => window.location.href = '/leads'}>
                  Lead Listesine Git
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCurrentStep(1);
                    setCsvData([]);
                    setCsvHeaders([]);
                    setFieldMappings([]);
                    setMappedData([]);
                    setImportResults({ successful: 0, failed: 0, errors: [] });
                  }}
                >
                  Yeni İçe Aktarma
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}