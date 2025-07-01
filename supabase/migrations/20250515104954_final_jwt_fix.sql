-- TRANSFER RLS POLİTİKASI: NİHAİ ÇÖZÜM
BEGIN;

-- Diğer RLS politikalarını temizle ve sadece transfer eklemeyi aç
DROP POLICY IF EXISTS "Transfers insert permission" ON public.transfers;

-- Tüm authentike kullanıcılara transfer ekleme izni (SADECE GEÇİCİ ÇÖZÜM)
CREATE POLICY "Transfers insert permission" 
ON public.transfers 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Check fonksiyonu için wrapper function
CREATE OR REPLACE FUNCTION check_is_superuser()
RETURNS BOOLEAN AS $$
BEGIN
  -- Bu fonksiyon tüm JWT token içindeki role kontrolünü yapar
  RETURN (
    (auth.jwt() ->> 'role')::TEXT = 'superuser' OR
    ((auth.jwt() -> 'app_metadata') ->> 'role')::TEXT = 'superuser'
  );
END;
$$ LANGUAGE plpgsql;

-- Tamamen basit ve esnek bir SELECT politikası
DROP POLICY IF EXISTS "Transfers select permission" ON transfers;
CREATE POLICY "Transfers select permission" 
ON public.transfers 
FOR SELECT 
TO authenticated 
USING (true);

-- Test verisi - JWT token içeriğini kontrol
CREATE OR REPLACE FUNCTION log_current_jwt()
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.rls_debug (user_id, timestamp, jwt_data, notes)
  VALUES (auth.uid(), now(), auth.jwt(), 'JWT token içeriği');
END;
$$ LANGUAGE plpgsql;

COMMIT;
