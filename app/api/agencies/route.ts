import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerComponentClient({ cookies: () => cookieStore });

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