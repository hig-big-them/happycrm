-- Transfer insert işlemleri için geçici çözüm
BEGIN;

-- Önceki aynı isimli politikaları temizle
DROP POLICY IF EXISTS "Allow all authenticated inserts" ON transfers;
DROP POLICY IF EXISTS "Allow agency inserts" ON transfers;

-- Tüm kullanıcılara geçici INSERT izni
CREATE POLICY "Allow all authenticated inserts" ON transfers
FOR INSERT TO authenticated WITH CHECK (true);

-- Superuser kontrolü için güncellenmiş fonksiyon
CREATE OR REPLACE FUNCTION is_superuser()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT (current_setting('request.jwt.claims', true)::json->>'role') = 'superuser');
END;
$$ LANGUAGE plpgsql;

-- JWT debug fonksiyonu
CREATE OR REPLACE FUNCTION debug_jwt_full_content()
RETURNS jsonb AS $$
BEGIN
  RETURN (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb);
END;
$$ LANGUAGE plpgsql;

-- JWT içindeki role değerini kontrol etmek için
CREATE OR REPLACE FUNCTION get_jwt_role()
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  BEGIN
    -- Ana metottaki role alanı
    result := (SELECT (current_setting('request.jwt.claims', true)::json->>'role'));
    
    -- Eğer null ise app_metadata içindeki role'ü dene
    IF result IS NULL THEN
      result := (SELECT (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role'));
    END IF;
    
    -- Eğer halen null ise raw_app_meta_data içindeki role'ü dene
    IF result IS NULL THEN
      result := (SELECT (current_setting('request.jwt.claims', true)::json->'raw_app_meta_data'->>'role'));
    END IF;
    
    RETURN result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql;

COMMIT;
