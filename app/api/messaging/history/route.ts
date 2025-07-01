/**
 * 📊 Message History API
 * 
 * Tüm kanallardan mesaj geçmişini getir ve filtrele
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/service';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  // Query parameters
  const leadId = searchParams.get('leadId');
  const search = searchParams.get('search');
  const channel = searchParams.get('channel');
  const status = searchParams.get('status');
  const direction = searchParams.get('direction');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const isExport = searchParams.get('export') === 'true';

  try {
    // Build unified message query
    let messages: any[] = [];
    
    // WhatsApp Messages
    let whatsappQuery = supabase
      .from('whatsapp_messages')
      .select(`
        id,
        message_id,
        from_number,
        to_number,
        message_type,
        content,
        status,
        sent_at,
        delivered_at,
        read_at,
        failed_at,
        is_incoming,
        lead_id,
        pricing_info
      `);

    if (leadId) whatsappQuery = whatsappQuery.eq('lead_id', leadId);
    if (status && status !== 'all') whatsappQuery = whatsappQuery.eq('status', status);
    
    const { data: whatsappMessages } = await whatsappQuery.order('sent_at', { ascending: false });

    // SMS Messages
    let smsQuery = supabase
      .from('sms_messages')
      .select(`
        id,
        message_sid,
        from_number,
        to_number,
        content,
        status,
        sent_at,
        delivered_at,
        is_incoming,
        lead_id
      `);

    if (leadId) smsQuery = smsQuery.eq('lead_id', leadId);
    if (status && status !== 'all') smsQuery = smsQuery.eq('status', status);
    
    const { data: smsMessages } = await smsQuery.order('sent_at', { ascending: false });

    // Email Messages
    let emailQuery = supabase
      .from('email_messages')
      .select(`
        id,
        message_id,
        from_email,
        to_email,
        subject,
        content,
        status,
        sent_at,
        delivered_at,
        is_incoming,
        lead_id
      `);

    if (leadId) emailQuery = emailQuery.eq('lead_id', leadId);
    if (status && status !== 'all') emailQuery = emailQuery.eq('status', status);
    
    const { data: emailMessages } = await emailQuery.order('sent_at', { ascending: false });

    // Notes
    let notesQuery = supabase
      .from('lead_notes')
      .select(`
        id,
        content,
        note_type,
        created_at,
        lead_id,
        created_by_profile:user_profiles!created_by(
          display_name,
          email
        )
      `);

    if (leadId) notesQuery = notesQuery.eq('lead_id', leadId);
    
    const { data: notes } = await notesQuery.order('created_at', { ascending: false });

    // Lead bilgilerini çek
    let leadQuery = supabase
      .from('leads')
      .select(`
        id,
        lead_name,
        company:companies(company_name)
      `);

    if (leadId) leadQuery = leadQuery.eq('id', leadId);
    
    const { data: leads } = await leadQuery;
    const leadsMap = new Map(leads?.map(lead => [lead.id, lead]) || []);

    // Normalize messages
    const normalizedMessages: any[] = [];

    // WhatsApp messages
    whatsappMessages?.forEach(msg => {
      const lead = leadsMap.get(msg.lead_id);
      if (!lead) return;

      normalizedMessages.push({
        id: `wa_${msg.id}`,
        channel: 'whatsapp',
        message_id: msg.message_id,
        direction: msg.is_incoming ? 'incoming' : 'outgoing',
        content: {
          text: msg.content?.text,
          template: msg.content?.template,
          media_type: msg.content?.type,
          media_url: msg.content?.media_url
        },
        status: msg.status,
        sent_at: msg.sent_at || msg.delivered_at || msg.read_at,
        delivered_at: msg.delivered_at,
        read_at: msg.read_at,
        failed_at: msg.failed_at,
        from_number: msg.from_number,
        to_number: msg.to_number,
        lead,
        pricing_info: msg.pricing_info
      });
    });

    // SMS messages
    smsMessages?.forEach(msg => {
      const lead = leadsMap.get(msg.lead_id);
      if (!lead) return;

      normalizedMessages.push({
        id: `sms_${msg.id}`,
        channel: 'sms',
        message_id: msg.message_sid,
        direction: msg.is_incoming ? 'incoming' : 'outgoing',
        content: {
          text: msg.content
        },
        status: msg.status,
        sent_at: msg.sent_at,
        delivered_at: msg.delivered_at,
        from_number: msg.from_number,
        to_number: msg.to_number,
        lead
      });
    });

    // Email messages
    emailMessages?.forEach(msg => {
      const lead = leadsMap.get(msg.lead_id);
      if (!lead) return;

      normalizedMessages.push({
        id: `email_${msg.id}`,
        channel: 'email',
        message_id: msg.message_id,
        direction: msg.is_incoming ? 'incoming' : 'outgoing',
        content: {
          subject: msg.subject,
          text: msg.content
        },
        status: msg.status,
        sent_at: msg.sent_at,
        delivered_at: msg.delivered_at,
        from_email: msg.from_email,
        to_email: msg.to_email,
        lead
      });
    });

    // Notes
    notes?.forEach(note => {
      const lead = leadsMap.get(note.lead_id);
      if (!lead) return;

      normalizedMessages.push({
        id: `note_${note.id}`,
        channel: 'note',
        direction: 'outgoing',
        content: {
          text: note.content
        },
        status: 'read',
        sent_at: note.created_at,
        lead,
        created_by: note.created_by_profile
      });
    });

    // Apply filters
    let filteredMessages = normalizedMessages;

    if (channel && channel !== 'all') {
      filteredMessages = filteredMessages.filter(msg => msg.channel === channel);
    }

    if (direction && direction !== 'all') {
      filteredMessages = filteredMessages.filter(msg => msg.direction === direction);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filteredMessages = filteredMessages.filter(msg => 
        msg.content.text?.toLowerCase().includes(searchLower) ||
        msg.content.subject?.toLowerCase().includes(searchLower) ||
        msg.lead.lead_name.toLowerCase().includes(searchLower)
      );
    }

    // Sort by timestamp
    filteredMessages.sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );

    // Calculate stats
    const stats = {
      total: filteredMessages.length,
      by_channel: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      by_direction: {} as Record<string, number>,
      cost_summary: {
        total_cost: 0,
        billable_messages: 0
      }
    };

    filteredMessages.forEach(msg => {
      // Channel stats
      stats.by_channel[msg.channel] = (stats.by_channel[msg.channel] || 0) + 1;
      
      // Status stats
      stats.by_status[msg.status] = (stats.by_status[msg.status] || 0) + 1;
      
      // Direction stats
      stats.by_direction[msg.direction] = (stats.by_direction[msg.direction] || 0) + 1;
      
      // Cost stats
      if (msg.pricing_info?.billable) {
        stats.cost_summary.billable_messages++;
      }
    });

    // Handle export
    if (isExport) {
      const csv = generateCSV(filteredMessages);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="mesaj-gecmisi.csv"'
        }
      });
    }

    // Pagination
    const paginatedMessages = filteredMessages.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      messages: paginatedMessages,
      stats,
      pagination: {
        total: filteredMessages.length,
        limit,
        offset,
        hasMore: filteredMessages.length > offset + limit
      }
    });

  } catch (error) {
    console.error('Message history fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Mesaj geçmişi yüklenirken hata oluştu' },
      { status: 500 }
    );
  }
}

// CSV Export Helper
function generateCSV(messages: any[]): string {
  const headers = [
    'Tarih',
    'Kanal', 
    'Yön',
    'Lead',
    'Şirket',
    'Durum',
    'İçerik',
    'Telefon/Email'
  ];

  const rows = messages.map(msg => [
    new Date(msg.sent_at).toLocaleString('tr-TR'),
    msg.channel.toUpperCase(),
    msg.direction === 'incoming' ? 'Gelen' : 'Giden',
    msg.lead.lead_name,
    msg.lead.company?.company_name || '',
    msg.status,
    msg.content.text || msg.content.subject || 'N/A',
    msg.to_number || msg.to_email || msg.from_number || msg.from_email || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // UTF-8 BOM for Turkish characters
  return '\ufeff' + csvContent;
}