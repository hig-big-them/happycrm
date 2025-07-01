import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '../../../lib/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../types/supabase';

// Servis rolü ile Supabase istemcisi
const serviceRoleClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Kullanıcı listesini getir
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Kullanıcı oturumunu kontrol et
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Oturum açmanız gerekiyor' },
        { status: 401 }
      );
    }
    
    // Sadece superuser veya super_admin rolü erişebilir
    const userRole = user.app_metadata?.role;
    if (userRole !== 'superuser' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      );
    }
    
    // Admin API'ye erişim yerine user_profiles tablosundan veri çekiyoruz
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*');
    
    if (error) {
      console.error('Kullanıcı verisi çekilirken hata:', error);
      return NextResponse.json(
        { error: 'Kullanıcılar yüklenirken bir hata oluştu' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      profiles 
    });
    
  } catch (error) {
    console.error('API hata:', error);
    return NextResponse.json(
      { error: 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Kullanıcı oluşturma endpoint'i
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Kullanıcı oturumunu kontrol et
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Oturum açmanız gerekiyor' },
        { status: 401 }
      );
    }
    
    // Sadece superuser veya super_admin rolü erişebilir
    const userRole = user.app_metadata?.role;
    if (userRole !== 'superuser' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      );
    }
    
    // Request body'den kullanıcı bilgilerini al
    const { email, password, role } = await request.json();
    
    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "Tüm alanlar doldurulmalıdır" },
        { status: 400 }
      );
    }

    // Servis rolü ile kullanıcı oluştur (admin API yerine)
    const { data: authData, error: authError } = await serviceRoleClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role }
    });
    
    if (authError) {
      console.error('Kullanıcı oluşturulurken hata:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }
    
    // 2. Kullanıcı oluşturulduktan sonra user_profiles tablosuna da kaydet
    if (authData?.user) {
      // RLS'yi bypass etmek için service role istemcisi kullanıyoruz
      // Upsert kullanarak: kayıt yoksa oluştur, varsa güncelle
      const { error: profileError } = await serviceRoleClient
        .from('user_profiles')
        .upsert({
          id: authData.user.id,        // user.id ile eşleştirilmeli
          username: email,             // username alanı email ile doldurulabilir
          role                         // role alanı
        }, { 
          onConflict: 'id',            // id alanında çakışma olursa
          ignoreDuplicates: false      // güncelle
        });
        
      if (profileError) {
        console.error('Kullanıcı profili oluşturulurken hata:', profileError);
        return NextResponse.json(
          { error: profileError.message },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      user: authData?.user
    });
    
  } catch (error: any) {
    console.error('API hata:', error);
    return NextResponse.json(
      { error: error.message || 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
}

// Kullanıcı silme
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Kullanıcı oturumunu kontrol et
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Oturum açmanız gerekiyor' },
        { status: 401 }
      );
    }
    
    // Sadece superuser veya super_admin rolü erişebilir
    const userRole = user.app_metadata?.role;
    if (userRole !== 'superuser' && userRole !== 'super_admin') {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      );
    }
    
    // Request body'den kullanıcı ID'sini al
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: "Kullanıcı ID'si gereklidir" },
        { status: 400 }
      );
    }
    
    // Önce user_profiles tablosundan sil - RLS bypass için service role client kullanıyoruz
    const { error: profileError } = await serviceRoleClient
      .from('user_profiles')
      .delete()
      .eq('id', userId);
    
    if (profileError) {
      console.error('Kullanıcı profili silinirken hata:', profileError);
      return NextResponse.json(
        { error: 'Kullanıcı silinirken bir hata oluştu' },
        { status: 500 }
      );
    }
    
    // Servis rolü ile kullanıcıyı siliyoruz
    const { error: deleteError } = await serviceRoleClient.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Kullanıcı silinirken hata:', deleteError);
      return NextResponse.json({ 
        error: 'Kullanıcı silinirken bir hata oluştu',
        details: deleteError.message
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Kullanıcı başarıyla silindi'
    });
    
  } catch (error) {
    console.error('API hata:', error);
    return NextResponse.json(
      { error: 'Beklenmeyen bir hata oluştu' },
      { status: 500 }
    );
  }
} 