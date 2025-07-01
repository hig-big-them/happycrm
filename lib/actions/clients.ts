"use server"

// Removed deprecated auth-helpers import
import { cookies } from "next/headers"
import { createClient } from '../utils/supabase/server';
import { Database } from "../../types/supabase"
import { createSafeActionClient } from "next-safe-action"

// getSupabaseClient fonksiyonunu düzeltiyoruz
export async function getSupabaseClient() {
  return createClient();
}

// Bu fonksiyon artık eski cookieStore arg. kullanmıyor
export async function getUser() {
  const supabase = await getSupabaseClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error) {
    console.error('GetUser error:', error.message);
    return null;
  }

  if (!user) {
    console.log('No user found in session');
    return null;
  }

  // Otomatik session yenileme
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.expires_at && session.expires_at < Date.now()/1000 + 60) {
    await supabase.auth.refreshSession();
  }

  return user;
}

// Action clients moved to separate file to avoid "use server" export restrictions 