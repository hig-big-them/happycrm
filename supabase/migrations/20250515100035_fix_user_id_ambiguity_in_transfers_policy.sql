-- Transfer tablosu için RLS politikalarındaki user_id belirsizliğini düzeltme
BEGIN;

-- Transfer ekleme izni politikasını güncelle
DROP POLICY IF EXISTS "Transfers insert permission" ON public.transfers;
CREATE POLICY "Transfers insert permission" 
  ON public.transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Superuser her zaman ekleyebilir
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
    OR
    -- Veya ajansın kendisine transfer ekleniyorsa ve kullanıcı o ajansın üyesiyse
    -- NOT: Tablolar için alias kullanarak user_id belirsizliğini gideriyoruz
    (transfers.agency_id IS NOT NULL AND 
     EXISTS (
       SELECT 1 
       FROM public.agency_users au 
       WHERE au.agency_id = transfers.agency_id 
         AND au.user_id = auth.uid()
     ))
  );

-- UPDATE politikasını da düzeltme
DROP POLICY IF EXISTS "Transfers update permission" ON public.transfers;
CREATE POLICY "Transfers update permission" 
  ON public.transfers
  FOR UPDATE
  TO authenticated
  USING (
    -- Superuser her transferi güncelleyebilir
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
    OR
    -- Veya kullanıcı ilgili ajansın üyesiyse
    (transfers.agency_id IS NOT NULL AND 
     EXISTS (
       SELECT 1 
       FROM public.agency_users au 
       WHERE au.agency_id = transfers.agency_id 
         AND au.user_id = auth.uid()
     ))
  );

-- DELETE politikasını da düzeltme
DROP POLICY IF EXISTS "Transfers delete permission" ON public.transfers;
CREATE POLICY "Transfers delete permission" 
  ON public.transfers
  FOR DELETE
  TO authenticated
  USING (
    -- Sadece Superuser silebilir
    ((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser')
  );

COMMIT;
