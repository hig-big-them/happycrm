/**
 * 🎨 WhatsApp Template Builder - Enterprise Edition
 * 
 * Görsel template editörü ve WhatsApp onay sistemine entegrasyon
 */

"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, 
  Trash2, 
  Eye, 
  Send, 
  Save, 
  FileText, 
  MessageSquare, 
  Smartphone, 
  AlertCircle,
  CheckCircle,
  Clock,
  X,
  Edit,
  Copy,
  Globe,
  Zap,
  Settings,
  Play,
  Pause,
  RefreshCw,
  Download,
  Upload
} from 'lucide-react';

// 📋 Type Definitions
interface TemplateComponent {
  type: 'header' | 'body' | 'footer' | 'buttons';
  text?: string;
  parameters?: Array<{
    key: string;
    type: 'text' | 'number' | 'date' | 'currency';
    placeholder?: string;
    required?: boolean;
  }>;
  buttons?: Array<{
    type: 'quick_reply' | 'url' | 'phone';
    text: string;
    url?: string;
    phone?: string;
  }>;
}

interface Template {
  id?: string;
  name: string;
  language: string;
  category: 'marketing' | 'utility' | 'authentication';
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  components: TemplateComponent[];
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// 🎨 Template Categories
const TEMPLATE_CATEGORIES = [
  { value: 'utility', label: 'Utility (İş)', description: 'Fatura, sipariş, rezervasyon bildirimleri' },
  { value: 'marketing', label: 'Marketing', description: 'Promosyon ve pazarlama mesajları' },
  { value: 'authentication', label: 'Authentication', description: 'OTP ve doğrulama mesajları' }
];

// 🎨 Status Colors
const STATUS_CONFIG = {
  draft: { color: 'bg-gray-100 text-gray-800', icon: <Edit className="h-3 w-3" />, label: 'Taslak' },
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" />, label: 'Onay Bekliyor' },
  approved: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" />, label: 'Onaylandı' },
  rejected: { color: 'bg-red-100 text-red-800', icon: <X className="h-3 w-3" />, label: 'Reddedildi' }
};

// 🔧 Template Component Editor
function ComponentEditor({ 
  component, 
  onUpdate, 
  onDelete 
}: { 
  component: TemplateComponent; 
  onUpdate: (component: TemplateComponent) => void;
  onDelete: () => void;
}) {
  const [localComponent, setLocalComponent] = useState<TemplateComponent>(component);

  useEffect(() => {
    onUpdate(localComponent);
  }, [localComponent]);

  const addParameter = () => {
    setLocalComponent(prev => ({
      ...prev,
      parameters: [
        ...(prev.parameters || []),
        { key: '', type: 'text', placeholder: '', required: true }
      ]
    }));
  };

  const updateParameter = (index: number, field: string, value: any) => {
    setLocalComponent(prev => ({
      ...prev,
      parameters: prev.parameters?.map((param, i) => 
        i === index ? { ...param, [field]: value } : param
      ) || []
    }));
  };

  const removeParameter = (index: number) => {
    setLocalComponent(prev => ({
      ...prev,
      parameters: prev.parameters?.filter((_, i) => i !== index) || []
    }));
  };

  const addButton = () => {
    setLocalComponent(prev => ({
      ...prev,
      buttons: [
        ...(prev.buttons || []),
        { type: 'quick_reply', text: '' }
      ]
    }));
  };

  const updateButton = (index: number, field: string, value: any) => {
    setLocalComponent(prev => ({
      ...prev,
      buttons: prev.buttons?.map((button, i) => 
        i === index ? { ...button, [field]: value } : button
      ) || []
    }));
  };

  const removeButton = (index: number) => {
    setLocalComponent(prev => ({
      ...prev,
      buttons: prev.buttons?.filter((_, i) => i !== index) || []
    }));
  };

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{component.type.toUpperCase()}</Badge>
            <span className="text-sm text-gray-600">
              {component.type === 'header' && 'Başlık'}
              {component.type === 'body' && 'Ana Metin'}
              {component.type === 'footer' && 'Alt Bilgi'}
              {component.type === 'buttons' && 'Butonlar'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-800"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Text Content */}
        {(component.type === 'header' || component.type === 'body' || component.type === 'footer') && (
          <div>
            <Label>Metin İçeriği</Label>
            <Textarea
              value={localComponent.text || ''}
              onChange={(e) => setLocalComponent(prev => ({ ...prev, text: e.target.value }))}
              placeholder={`${component.type} metni girin... Değişkenler için {{variable_name}} kullanın`}
              rows={component.type === 'body' ? 4 : 2}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              {component.type === 'header' && 'Maksimum 60 karakter'}
              {component.type === 'body' && 'Maksimum 1024 karakter'}
              {component.type === 'footer' && 'Maksimum 60 karakter'}
            </p>
          </div>
        )}

        {/* Parameters */}
        {(component.type === 'header' || component.type === 'body') && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Değişkenler (Parameters)</Label>
              <Button variant="outline" size="sm" onClick={addParameter}>
                <Plus className="h-4 w-4 mr-1" />
                Ekle
              </Button>
            </div>
            
            {localComponent.parameters?.map((param, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3">
                  <Input
                    placeholder="Değişken adı"
                    value={param.key}
                    onChange={(e) => updateParameter(index, 'key', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <Select 
                    value={param.type} 
                    onValueChange={(value) => updateParameter(index, 'type', value)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Metin</SelectItem>
                      <SelectItem value="number">Sayı</SelectItem>
                      <SelectItem value="date">Tarih</SelectItem>
                      <SelectItem value="currency">Para</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    placeholder="Açıklama"
                    value={param.placeholder || ''}
                    onChange={(e) => updateParameter(index, 'placeholder', e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParameter(index)}
                    className="h-8 w-8 p-0 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        {component.type === 'buttons' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Butonlar</Label>
              <Button variant="outline" size="sm" onClick={addButton}>
                <Plus className="h-4 w-4 mr-1" />
                Buton Ekle
              </Button>
            </div>
            
            {localComponent.buttons?.map((button, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 mb-2 p-3 bg-gray-50 rounded">
                <div className="col-span-3">
                  <Select 
                    value={button.type} 
                    onValueChange={(value) => updateButton(index, 'type', value)}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quick_reply">Hızlı Yanıt</SelectItem>
                      <SelectItem value="url">Web Sitesi</SelectItem>
                      <SelectItem value="phone">Telefon</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    placeholder="Buton metni"
                    value={button.text}
                    onChange={(e) => updateButton(index, 'text', e.target.value)}
                    className="text-sm"
                  />
                </div>
                {button.type === 'url' && (
                  <div className="col-span-3">
                    <Input
                      placeholder="URL"
                      value={button.url || ''}
                      onChange={(e) => updateButton(index, 'url', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}
                {button.type === 'phone' && (
                  <div className="col-span-3">
                    <Input
                      placeholder="Telefon"
                      value={button.phone || ''}
                      onChange={(e) => updateButton(index, 'phone', e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}
                <div className="col-span-2 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeButton(index)}
                    className="h-8 w-8 p-0 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 📱 Template Preview
function TemplatePreview({ template, variables }: { template: Template; variables: Record<string, string> }) {
  const renderComponent = (component: TemplateComponent) => {
    let text = component.text || '';
    
    // Replace variables
    Object.entries(variables).forEach(([key, value]) => {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    switch (component.type) {
      case 'header':
        return (
          <div className="bg-blue-500 text-white p-3 rounded-t-lg">
            <p className="font-semibold text-sm">{text}</p>
          </div>
        );
      
      case 'body':
        return (
          <div className="p-3 bg-white">
            <p className="text-sm whitespace-pre-wrap">{text}</p>
          </div>
        );
      
      case 'footer':
        return (
          <div className="px-3 pb-2 bg-white text-xs text-gray-500">
            <p>{text}</p>
          </div>
        );
      
      case 'buttons':
        return (
          <div className="px-3 pb-3 bg-white space-y-1">
            {component.buttons?.map((button, index) => (
              <button
                key={index}
                className="w-full py-2 px-3 text-sm border border-gray-300 rounded text-blue-600 hover:bg-gray-50"
              >
                {button.type === 'url' && '🔗 '}
                {button.type === 'phone' && '📞 '}
                {button.text}
              </button>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium">WhatsApp Business</span>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border">
          {template.components.map((component, index) => (
            <div key={index}>
              {renderComponent(component)}
            </div>
          ))}
        </div>
        
        <div className="text-xs text-gray-500 mt-2 text-center">
          Template Önizlemesi
        </div>
      </div>
    </div>
  );
}

// 🎯 Main Component
interface TemplateBuilderProps {
  template?: Template;
  onSave?: (template: Template) => void;
  onCancel?: () => void;
}

export default function TemplateBuilder({ template, onSave, onCancel }: TemplateBuilderProps) {
  // 🔄 State Management
  const [currentTemplate, setCurrentTemplate] = useState<Template>(template || {
    name: '',
    language: 'tr',
    category: 'utility',
    status: 'draft',
    components: []
  });
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');

  // 🔄 Auto-generate preview variables
  useEffect(() => {
    const variables: Record<string, string> = {};
    
    currentTemplate.components.forEach(component => {
      component.parameters?.forEach(param => {
        if (!variables[param.key]) {
          switch (param.type) {
            case 'text':
              variables[param.key] = param.placeholder || 'Örnek Metin';
              break;
            case 'number':
              variables[param.key] = '123';
              break;
            case 'date':
              variables[param.key] = new Date().toLocaleDateString('tr-TR');
              break;
            case 'currency':
              variables[param.key] = '₺1,234';
              break;
          }
        }
      });
    });
    
    setPreviewVariables(variables);
  }, [currentTemplate.components]);

  // 🔧 Template Management
  const addComponent = (type: TemplateComponent['type']) => {
    const newComponent: TemplateComponent = {
      type,
      text: '',
      parameters: type === 'buttons' ? undefined : [],
      buttons: type === 'buttons' ? [] : undefined
    };

    setCurrentTemplate(prev => ({
      ...prev,
      components: [...prev.components, newComponent]
    }));
  };

  const updateComponent = (index: number, component: TemplateComponent) => {
    setCurrentTemplate(prev => ({
      ...prev,
      components: prev.components.map((comp, i) => i === index ? component : comp)
    }));
  };

  const removeComponent = (index: number) => {
    setCurrentTemplate(prev => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index)
    }));
  };

  const moveComponent = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentTemplate.components.length) return;

    setCurrentTemplate(prev => {
      const newComponents = [...prev.components];
      [newComponents[index], newComponents[newIndex]] = [newComponents[newIndex], newComponents[index]];
      return { ...prev, components: newComponents };
    });
  };

  // 💾 Save & Submit
  const handleSave = async (submitForReview = false) => {
    if (!currentTemplate.name.trim()) {
      toast({
        title: 'Hata',
        description: 'Template adı gerekli',
        variant: 'destructive'
      });
      return;
    }

    if (currentTemplate.components.length === 0) {
      toast({
        title: 'Hata',
        description: 'En az bir component gerekli',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const templateData = {
        ...currentTemplate,
        status: submitForReview ? 'pending' : 'draft'
      };

      const endpoint = template?.id ? '/api/templates/update' : '/api/templates/create';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Başarılı',
          description: submitForReview 
            ? 'Template onaya gönderildi' 
            : 'Template kaydedildi'
        });
        
        onSave?.(result.data);
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Template kaydedilirken hata oluştu',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 📋 Template Validation
  const validateTemplate = () => {
    const errors: string[] = [];
    
    if (!currentTemplate.name.trim()) errors.push('Template adı gerekli');
    if (currentTemplate.components.length === 0) errors.push('En az bir component gerekli');
    
    // Body component required
    const hasBody = currentTemplate.components.some(c => c.type === 'body');
    if (!hasBody) errors.push('Body component zorunludur');
    
    // Check text limits
    currentTemplate.components.forEach((component, index) => {
      if (component.type === 'header' && (component.text?.length || 0) > 60) {
        errors.push(`Header ${index + 1}: Maksimum 60 karakter`);
      }
      if (component.type === 'body' && (component.text?.length || 0) > 1024) {
        errors.push(`Body ${index + 1}: Maksimum 1024 karakter`);
      }
      if (component.type === 'footer' && (component.text?.length || 0) > 60) {
        errors.push(`Footer ${index + 1}: Maksimum 60 karakter`);
      }
    });

    return errors;
  };

  const errors = validateTemplate();
  const isValid = errors.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                WhatsApp Template Builder
              </CardTitle>
              <CardDescription>
                Enterprise-grade template editörü ve onay sistemi
              </CardDescription>
            </div>
            
            {template?.status && (
              <Badge className={STATUS_CONFIG[template.status].color}>
                {STATUS_CONFIG[template.status].icon}
                {STATUS_CONFIG[template.status].label}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label htmlFor="template-name">Template Adı *</Label>
              <Input
                id="template-name"
                value={currentTemplate.name}
                onChange={(e) => setCurrentTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Örn: welcome_message"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="template-category">Kategori *</Label>
              <Select 
                value={currentTemplate.category} 
                onValueChange={(value) => setCurrentTemplate(prev => ({ ...prev, category: value as any }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div>
                        <div className="font-medium">{cat.label}</div>
                        <div className="text-xs text-gray-500">{cat.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="template-language">Dil</Label>
              <Select 
                value={currentTemplate.language} 
                onValueChange={(value) => setCurrentTemplate(prev => ({ ...prev, language: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tr">Türkçe</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="template-description">Açıklama (Opsiyonel)</Label>
            <Textarea
              id="template-description"
              value={currentTemplate.description || ''}
              onChange={(e) => setCurrentTemplate(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Template'in ne için kullanılacağını açıklayın"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Builder */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Components</CardTitle>
              <CardDescription>
                WhatsApp mesaj bileşenlerini oluşturun ve düzenleyin
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {/* Add Component Buttons */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button
                  variant="outline"
                  onClick={() => addComponent('header')}
                  disabled={currentTemplate.components.some(c => c.type === 'header')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Header
                </Button>
                <Button
                  variant="outline"
                  onClick={() => addComponent('body')}
                  disabled={currentTemplate.components.some(c => c.type === 'body')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Body *
                </Button>
                <Button
                  variant="outline"
                  onClick={() => addComponent('footer')}
                  disabled={currentTemplate.components.some(c => c.type === 'footer')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Footer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => addComponent('buttons')}
                  disabled={currentTemplate.components.some(c => c.type === 'buttons')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Buttons
                </Button>
              </div>

              {/* Components */}
              <div className="space-y-3">
                {currentTemplate.components.map((component, index) => (
                  <ComponentEditor
                    key={index}
                    component={component}
                    onUpdate={(comp) => updateComponent(index, comp)}
                    onDelete={() => removeComponent(index)}
                  />
                ))}
                
                {currentTemplate.components.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Henüz component eklenmedi</p>
                    <p className="text-sm">Başlamak için yukarıdaki butonları kullanın</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Validation Errors */}
          {errors.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Düzeltilmesi Gerekenler
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-700 flex items-center gap-2">
                      <X className="h-3 w-3" />
                      {error}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Canlı Önizleme</CardTitle>
              <CardDescription>
                Template'in WhatsApp'ta nasıl görüneceği
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {currentTemplate.components.length > 0 ? (
                <TemplatePreview 
                  template={currentTemplate} 
                  variables={previewVariables}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Smartphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Component ekleyince önizleme görünecek</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Variable Preview */}
          {Object.keys(previewVariables).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Önizleme Değişkenleri</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(previewVariables).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-2 gap-2">
                      <Input
                        value={key}
                        disabled
                        className="text-xs"
                      />
                      <Input
                        value={value}
                        onChange={(e) => setPreviewVariables(prev => ({
                          ...prev,
                          [key]: e.target.value
                        }))}
                        className="text-xs"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isValid ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Hazır
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Eksikler var
                </Badge>
              )}
              <span className="text-sm text-gray-600">
                {currentTemplate.components.length} component
              </span>
            </div>

            <div className="flex gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  İptal
                </Button>
              )}
              
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Taslak Kaydet
              </Button>
              
              <Button
                onClick={() => handleSave(true)}
                disabled={!isValid || isSubmitting}
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Onaya Gönder
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}