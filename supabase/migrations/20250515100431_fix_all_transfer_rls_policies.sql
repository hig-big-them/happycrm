-- Transfer tablosu için TÜM RLS politikalarını sıfırdan düzenleme
BEGIN;

-- Önce transfers tablosundan tüm politikaları kaldır
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies or superusers" ON public.transfers;
DROP POLICY IF EXISTS "Transfers insert permission" ON public.transfers;
DROP POLICY IF EXISTS "Transfers update permission" ON public.transfers;
DROP POLICY IF EXISTS "Transfers delete permission" ON public.transfers;

-- 1. SELECT politikası - Görüntüleme yetkilerini düzenle
CREATE POLICY "Transfers are viewable by assigned agencies or superusers" 
  ON public.transfers
  FOR SELECT
  TO authenticated
  USING (
    (
      transfers.agency_id IS NOT NULL AND 
      EXISTS (
        SELECT 1 
        FROM public.agency_users au
        WHERE au.agency_id = transfers.agency_id 
          AND au.user_id = auth.uid()
      )
    )
    OR
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
  );

-- 2. INSERT politikası - Ekleme yetkilerini düzenle
CREATE POLICY "Transfers insert permission" 
  ON public.transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Superuser her zaman ekleyebilir
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
    OR
    -- Veya ajansın kendisine transfer ekleniyorsa ve kullanıcı o ajansın üyesiyse
    (
      transfers.agency_id IS NOT NULL AND 
      EXISTS (
        SELECT 1 
        FROM public.agency_users au 
        WHERE au.agency_id = transfers.agency_id 
          AND au.user_id = auth.uid()
      )
    )
  );

-- 3. UPDATE politikası - Güncelleme yetkilerini düzenle
CREATE POLICY "Transfers update permission" 
  ON public.transfers
  FOR UPDATE
  TO authenticated
  USING (
    -- Superuser her transferi güncelleyebilir
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
    OR
    -- Veya kullanıcı ilgili ajansın üyesiyse
    (
      transfers.agency_id IS NOT NULL AND 
      EXISTS (
        SELECT 1 
        FROM public.agency_users au 
        WHERE au.agency_id = transfers.agency_id 
          AND au.user_id = auth.uid()
      )
    )
  );

-- 4. DELETE politikası - Silme yetkilerini düzenle
CREATE POLICY "Transfers delete permission" 
  ON public.transfers
  FOR DELETE
  TO authenticated
  USING (
    -- Sadece Superuser silebilir
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
  );

-- RLS'yi yeniden etkinleştir
ALTER TABLE public.transfers FORCE ROW LEVEL SECURITY;

COMMIT;
