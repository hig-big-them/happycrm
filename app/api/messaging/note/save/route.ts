/**
 * 📝 Note Saving API
 * 
 * Internal note kaydetme endpoint'i
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/utils/supabase/service';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { leadId, content, note_type = 'manual', visibility = 'internal' } = body;

    // Input validation
    if (!leadId || !content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Lead ID ve not içeriği gerekli' },
        { status: 400 }
      );
    }

    // Lead'i doğrula
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, lead_name')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead bulunamadı' },
        { status: 404 }
      );
    }

    // Kullanıcı bilgisini al (auth context'ten)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Kimlik doğrulama gerekli' },
        { status: 401 }
      );
    }

    // Not'u veritabanına kaydet
    const { data: savedNote, error: saveError } = await supabase
      .from('lead_notes')
      .insert({
        lead_id: leadId,
        content: content.trim(),
        note_type: note_type,
        visibility: visibility,
        created_by: user.id,
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        created_by_profile:user_profiles!created_by(
          display_name,
          email
        )
      `)
      .single();

    if (saveError) {
      console.error('Failed to save note:', saveError);
      return NextResponse.json(
        { success: false, error: 'Not kaydedilirken hata oluştu' },
        { status: 500 }
      );
    }

    // Activity log ekle
    await supabase.from('activities').insert({
      lead_id: leadId,
      activity_type: 'note_added',
      description: `Yeni not eklendi: ${note_type}`,
      details: {
        note_id: savedNote.id,
        content_preview: content.substring(0, 100),
        note_type: note_type,
        visibility: visibility
      },
      activity_date: new Date().toISOString(),
      user_id: user.id
    });

    return NextResponse.json({
      success: true,
      note: savedNote,
      message: 'Not başarıyla kaydedildi'
    });

  } catch (error) {
    console.error('Note save error:', error);
    return NextResponse.json(
      { success: false, error: 'Not kaydedilirken hata oluştu' },
      { status: 500 }
    );
  }
}

// GET: Lead notlarını listele
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID gerekli' },
        { status: 400 }
      );
    }

    // Lead'i doğrula
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: 'Lead bulunamadı' },
        { status: 404 }
      );
    }

    // Notları getir
    const { data: notes, error: notesError } = await supabase
      .from('lead_notes')
      .select(`
        *,
        created_by_profile:user_profiles!created_by(
          display_name,
          email
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (notesError) {
      console.error('Failed to fetch notes:', notesError);
      return NextResponse.json(
        { success: false, error: 'Notlar yüklenirken hata oluştu' },
        { status: 500 }
      );
    }

    // Toplam not sayısını al
    const { count, error: countError } = await supabase
      .from('lead_notes')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId);

    return NextResponse.json({
      success: true,
      notes: notes || [],
      total: count || 0,
      pagination: {
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('Notes fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Notlar yüklenirken hata oluştu' },
      { status: 500 }
    );
  }
}