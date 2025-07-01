-- transfer_audit_log RLS politikalarını düzelt
BEGIN;

-- 1. Fonksiyonu SECURITY DEFINER olarak güncelle
-- Bu sayede fonksiyon tablo sahibinin haklarıyla çalışır, RLS'yi atlar
CREATE OR REPLACE FUNCTION public.handle_transfer_audit()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
BEGIN
  -- auth.uid() NULL ise sistem değeri kullan
  IF auth.uid() IS NULL THEN
    current_user_id := '00000000-0000-0000-0000-000000000000'::UUID; -- Sistem kullanıcısı
  ELSE
    current_user_id := auth.uid();
  END IF;

  -- İşlem türüne göre uygun log kaydını oluştur
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO transfer_audit_log (transfer_id, modified_by, action, new_data)
    VALUES (NEW.id, current_user_id, TG_OP, to_jsonb(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO transfer_audit_log (transfer_id, modified_by, action, old_data, new_data)
    VALUES (NEW.id, current_user_id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO transfer_audit_log (transfer_id, modified_by, action, old_data)
    VALUES (OLD.id, current_user_id, TG_OP, to_jsonb(OLD));
  END IF;
  
  RETURN NULL; -- after trigger için return değerinin bir önemi yok
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. transfer_audit_log tablosuna herkes için INSERT politikası ekle
DROP POLICY IF EXISTS "Allow trigger to insert audit logs" ON transfer_audit_log;
CREATE POLICY "Allow trigger to insert audit logs"
  ON transfer_audit_log
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 3. Önceki INSERT politikasını düzelt veya ekle
DROP POLICY IF EXISTS "Anyone can insert to debug logs" ON transfer_audit_log;
CREATE POLICY "Anyone can insert to debug logs"
  ON transfer_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 4. Acil durum - yedek olarak ROW LEVEL SECURITY geçici olarak devre dışı bırak
-- ÖNEMLİ: Üretim ortamında kullanmayın!
-- Bu satırı yalnızca diğer politikalar işe yaramazsa açın
-- ALTER TABLE transfer_audit_log DISABLE ROW LEVEL SECURITY;

COMMIT;
