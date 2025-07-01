BEGIN;

-- Trigger fonksiyonunu güncelle - auth.uid() NULL ise kullanıcı ID'si yerine sistem değeri kullan
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
$$ LANGUAGE plpgsql;

COMMIT;
