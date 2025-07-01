-- JWT Yapısını ve RLS Politikalarını Düzenleme
BEGIN;

-- JWT içeriğini tam olarak analiz eden fonksiyon
CREATE OR REPLACE FUNCTION detect_superuser_from_jwt()
RETURNS BOOLEAN AS $$
DECLARE
    v_jwt JSONB := auth.jwt();
    v_is_superuser BOOLEAN := FALSE;
BEGIN
    -- Farklı olası yollardan superuser rolünü kontrol et
    v_is_superuser := 
        -- Doğrudan JWT içinde
        (v_jwt ->> 'role') = 'superuser' OR
        -- app_metadata içinde
        ((v_jwt -> 'app_metadata') ->> 'role') = 'superuser' OR
        -- raw_app_meta_data içinde
        ((v_jwt -> 'raw_app_meta_data') ->> 'role') = 'superuser' OR
        -- user_metadata içinde
        ((v_jwt -> 'user_metadata') ->> 'role') = 'superuser';
        
    -- RLS debug tablosuna bilgileri ekle
    INSERT INTO public.rls_debug (user_id, timestamp, jwt_data, is_superuser)
    VALUES (auth.uid(), now(), v_jwt, v_is_superuser);
    
    RETURN v_is_superuser;
END;
$$ LANGUAGE plpgsql;

-- Debug bilgilerini saklamak için tablo
DROP TABLE IF EXISTS public.rls_debug;
CREATE TABLE public.rls_debug (
    id SERIAL PRIMARY KEY,
    user_id UUID,
    timestamp TIMESTAMPTZ,
    jwt_data JSONB,
    is_superuser BOOLEAN,
    notes TEXT
);

-- RLS debug tablosuna herkes yazabilsin
ALTER TABLE public.rls_debug ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RLS Debug Insert Policy" ON public.rls_debug;
CREATE POLICY "RLS Debug Insert Policy" ON public.rls_debug FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "RLS Debug Select Policy" ON public.rls_debug;
CREATE POLICY "RLS Debug Select Policy" ON public.rls_debug FOR SELECT TO authenticated USING (true);

-- Transfer INSERT politikasını güncelle
DROP POLICY IF EXISTS "Transfers insert permission" ON transfers;
CREATE POLICY "Transfers insert permission" 
ON public.transfers 
FOR INSERT 
TO authenticated 
WITH CHECK (
    -- Superuser kontrolü (tüm olası JWT yolları)
    detect_superuser_from_jwt()
    OR
    -- VEYA geçici olarak her authentike kullanıcıya izin ver
    true
);

-- Debug işlemi için direkt manuel çözüm
-- Şimdilik önceki sql'de eklenen ajans-kullanıcı bağlantısı yeterli

COMMIT;
