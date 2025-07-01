/**
 * 📋 WhatsApp Template Management Actions
 * 
 * Template oluşturma, onaylama ve yönetimi için server actions
 */

"use server";

import { z } from "zod";
import { authActionClient } from "../safe-action/auth-client";
import { createClient } from "../utils/supabase/service";
import { createWhatsAppService } from "../services/whatsapp-cloud-service";
import { revalidatePath } from "next/cache";

// 📋 Template Validation Schemas
const templateComponentSchema = z.object({
  type: z.enum(['header', 'body', 'footer', 'buttons']),
  text: z.string().optional(),
  parameters: z.array(z.object({
    key: z.string(),
    value: z.string(),
    type: z.enum(['text', 'number', 'date', 'currency'])
  })).optional()
});

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template adı gerekli").max(512),
  language: z.string().default('tr'),
  category: z.enum(['marketing', 'utility', 'authentication']),
  components: z.array(templateComponentSchema),
  description: z.string().optional()
});

const updateTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(512).optional(),
  description: z.string().optional(),
  components: z.array(templateComponentSchema).optional()
});

const deleteTemplateSchema = z.object({
  id: z.string()
});

const submitTemplateSchema = z.object({
  id: z.string()
});

// 📨 Template Actions

/**
 * Yeni WhatsApp template oluştur
 */
export const createTemplate = authActionClient
  .schema(createTemplateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();
    const whatsappService = createWhatsAppService();

    try {
      // Template'i WhatsApp API'ye gönder ve veritabanına kaydet
      const result = await whatsappService.createTemplate({
        name: parsedInput.name,
        language: parsedInput.language,
        status: 'pending' as const,
        category: parsedInput.category,
        components: parsedInput.components
      });

      if (!result.success) {
        throw new Error(result.error || 'Template oluşturulamadı');
      }

      // İsteğe bağlı açıklama ile veritabanını güncelle
      if (parsedInput.description) {
        await supabase
          .from('whatsapp_templates')
          .update({ description: parsedInput.description })
          .eq('id', result.templateId);
      }

      revalidatePath('/admin/templates');
      
      return {
        success: true,
        data: {
          templateId: result.templateId,
          message: 'Template oluşturuldu ve onay için gönderildi'
        }
      };

    } catch (error) {
      console.error('Template creation error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Template oluşturulurken hata oluştu'
      );
    }
  });

/**
 * Template listesini getir
 */
export const getTemplates = authActionClient
  .schema(z.object({
    filters: z.object({
      status: z.string().optional(),
      category: z.string().optional(),
      language: z.string().optional(),
      search: z.string().optional()
    }).optional()
  }).optional())
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();

    try {
      let query = supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false });

      // Filtreleri uygula
      if (parsedInput?.filters) {
        const { status, category, language, search } = parsedInput.filters;
        
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        if (category && category !== 'all') {
          query = query.eq('category', category);
        }
        if (language && language !== 'all') {
          query = query.eq('language', language);
        }
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      console.error('Get templates error:', error);
      throw new Error('Template'lar yüklenirken hata oluştu');
    }
  });

/**
 * Template detayını getir
 */
export const getTemplateById = authActionClient
  .schema(z.object({ id: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('id', parsedInput.id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Template bulunamadı');

      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('Get template error:', error);
      throw new Error('Template detayı yüklenirken hata oluştu');
    }
  });

/**
 * Template'i güncelle
 */
export const updateTemplate = authActionClient
  .schema(updateTemplateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();

    try {
      const updateData: any = {};
      
      if (parsedInput.name) updateData.name = parsedInput.name;
      if (parsedInput.description !== undefined) updateData.description = parsedInput.description;
      if (parsedInput.components) updateData.components = parsedInput.components;
      
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('whatsapp_templates')
        .update(updateData)
        .eq('id', parsedInput.id)
        .select()
        .single();

      if (error) throw error;

      revalidatePath('/admin/templates');
      
      return {
        success: true,
        data,
        message: 'Template güncellendi'
      };

    } catch (error) {
      console.error('Update template error:', error);
      throw new Error('Template güncellenirken hata oluştu');
    }
  });

/**
 * Template'i sil
 */
export const deleteTemplate = authActionClient
  .schema(deleteTemplateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();

    try {
      // Önce template'in kullanımda olup olmadığını kontrol et
      const { data: messageCount } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('message_type', 'template')
        .like('content->template', `%${parsedInput.id}%`);

      if (messageCount && messageCount > 0) {
        throw new Error('Bu template aktif kullanımda olduğu için silinemez');
      }

      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', parsedInput.id);

      if (error) throw error;

      revalidatePath('/admin/templates');
      
      return {
        success: true,
        message: 'Template silindi'
      };

    } catch (error) {
      console.error('Delete template error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Template silinirken hata oluştu'
      );
    }
  });

/**
 * Template'i onaya gönder
 */
export const submitTemplateForReview = authActionClient
  .schema(submitTemplateSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();
    const whatsappService = createWhatsAppService();

    try {
      // Template'i veritabanından getir
      const { data: template, error: fetchError } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('id', parsedInput.id)
        .single();

      if (fetchError || !template) {
        throw new Error('Template bulunamadı');
      }

      if (template.status !== 'draft') {
        throw new Error('Sadece taslak template'lar onaya gönderilebilir');
      }

      // WhatsApp API'ye gönder (eğer henüz gönderilmemişse)
      if (!template.whatsapp_template_id) {
        const result = await whatsappService.createTemplate({
          name: template.name,
          language: template.language,
          status: 'pending' as const,
          category: template.category,
          components: template.components
        });

        if (!result.success) {
          throw new Error(result.error || 'WhatsApp API\'ye gönderilirken hata oluştu');
        }

        // WhatsApp template ID'sini kaydet
        await supabase
          .from('whatsapp_templates')
          .update({ 
            whatsapp_template_id: result.templateId,
            status: 'pending',
            submitted_at: new Date().toISOString()
          })
          .eq('id', parsedInput.id);
      } else {
        // Sadece durumu güncelle
        await supabase
          .from('whatsapp_templates')
          .update({ 
            status: 'pending',
            submitted_at: new Date().toISOString()
          })
          .eq('id', parsedInput.id);
      }

      revalidatePath('/admin/templates');
      
      return {
        success: true,
        message: 'Template onaya gönderildi'
      };

    } catch (error) {
      console.error('Submit template error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Template onaya gönderilirken hata oluştu'
      );
    }
  });

/**
 * Template performansını getir
 */
export const getTemplatePerformance = authActionClient
  .schema(z.object({
    templateId: z.string(),
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }).optional()
  }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();

    try {
      const { templateId, dateRange } = parsedInput;
      
      let query = supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('message_type', 'template')
        .like('content->template', `%${templateId}%`);

      if (dateRange) {
        query = query
          .gte('sent_at', dateRange.start)
          .lte('sent_at', dateRange.end);
      }

      const { data: messages, error } = await query;

      if (error) throw error;

      // Performans metriklerini hesapla
      const performance = {
        total_sent: messages?.length || 0,
        total_delivered: messages?.filter(m => m.status === 'delivered').length || 0,
        total_read: messages?.filter(m => m.status === 'read').length || 0,
        total_failed: messages?.filter(m => m.status === 'failed').length || 0,
        delivery_rate: 0,
        read_rate: 0,
        daily_stats: {} as Record<string, { sent: number; delivered: number; read: number; failed: number }>
      };

      if (performance.total_sent > 0) {
        performance.delivery_rate = (performance.total_delivered / performance.total_sent) * 100;
        performance.read_rate = (performance.total_read / performance.total_sent) * 100;
      }

      // Günlük istatistikler
      messages?.forEach(message => {
        if (message.sent_at) {
          const date = new Date(message.sent_at).toISOString().split('T')[0];
          if (!performance.daily_stats[date]) {
            performance.daily_stats[date] = { sent: 0, delivered: 0, read: 0, failed: 0 };
          }
          
          performance.daily_stats[date].sent++;
          if (message.status === 'delivered') performance.daily_stats[date].delivered++;
          if (message.status === 'read') performance.daily_stats[date].read++;
          if (message.status === 'failed') performance.daily_stats[date].failed++;
        }
      });

      return {
        success: true,
        data: performance
      };

    } catch (error) {
      console.error('Get template performance error:', error);
      throw new Error('Template performansı yüklenirken hata oluştu');
    }
  });

/**
 * Template önizlemesi oluştur
 */
export const previewTemplate = authActionClient
  .schema(z.object({
    name: z.string(),
    components: z.array(templateComponentSchema),
    variables: z.record(z.string()).optional()
  }))
  .action(async ({ parsedInput, ctx }) => {
    try {
      const { name, components, variables = {} } = parsedInput;
      
      // Template içeriğini render et
      const preview = {
        name,
        rendered_components: components.map(component => {
          if (component.type === 'body' && component.text) {
            // Değişkenleri yerine koy
            let renderedText = component.text;
            Object.entries(variables).forEach(([key, value]) => {
              renderedText = renderedText.replace(new RegExp(`{{${key}}}`, 'g'), value);
            });
            
            return {
              ...component,
              rendered_text: renderedText
            };
          }
          
          return {
            ...component,
            rendered_text: component.text
          };
        })
      };

      return {
        success: true,
        data: preview
      };

    } catch (error) {
      console.error('Preview template error:', error);
      throw new Error('Template önizlemesi oluşturulurken hata oluştu');
    }
  });

/**
 * Template kullanım istatistiklerini getir
 */
export const getTemplateUsageStats = authActionClient
  .schema(z.object({
    period: z.enum(['7d', '30d', '90d', '1y']).default('30d')
  }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = createClient();

    try {
      const { period } = parsedInput;
      
      // Tarih aralığını hesapla
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Template kullanım verilerini çek
      const { data: templateMessages, error } = await supabase
        .from('whatsapp_messages')
        .select('content, status, sent_at')
        .eq('message_type', 'template')
        .gte('sent_at', startDate.toISOString())
        .lte('sent_at', endDate.toISOString());

      if (error) throw error;

      // Template'lara göre grupla
      const templateStats = {} as Record<string, {
        name: string;
        sent: number;
        delivered: number;
        read: number;
        failed: number;
        conversion_rate: number;
      }>;

      templateMessages?.forEach(message => {
        const templateName = message.content?.template || 'unknown';
        
        if (!templateStats[templateName]) {
          templateStats[templateName] = {
            name: templateName,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0,
            conversion_rate: 0
          };
        }
        
        templateStats[templateName].sent++;
        if (message.status === 'delivered') templateStats[templateName].delivered++;
        if (message.status === 'read') templateStats[templateName].read++;
        if (message.status === 'failed') templateStats[templateName].failed++;
      });

      // Conversion rate'leri hesapla
      Object.values(templateStats).forEach(stats => {
        if (stats.sent > 0) {
          stats.conversion_rate = (stats.read / stats.sent) * 100;
        }
      });

      return {
        success: true,
        data: {
          period,
          templates: Object.values(templateStats).sort((a, b) => b.sent - a.sent),
          total_templates_used: Object.keys(templateStats).length,
          total_messages: templateMessages?.length || 0
        }
      };

    } catch (error) {
      console.error('Get template usage stats error:', error);
      throw new Error('Template kullanım istatistikleri yüklenirken hata oluştu');
    }
  });