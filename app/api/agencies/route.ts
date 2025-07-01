import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Kullanıcı kontrolü
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Ajansları getir
    const { data: agencies, error } = await supabase
      .from('agencies')
      .select('*')
      .order('name');

    if (error) {
      console.error('Ajanslar getirilemedi:', error);
      return NextResponse.json(
        { error: 'Ajanslar getirilemedi' },
        { status: 500 }
      );
    }

    return NextResponse.json({ agencies: agencies || [] });
  } catch (error) {
    console.error('API hatası:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    );
  }
} 