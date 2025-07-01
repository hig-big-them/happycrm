-- Nihai RLS çözümü
BEGIN;

-- Tüm politikaları temizle
DROP POLICY IF EXISTS "Allow superuser to manage users" ON agency_users;
DROP POLICY IF EXISTS "Agency owner can modify users" ON agency_users;
DROP POLICY IF EXISTS "Agency members can view" ON agency_users;
DROP POLICY IF EXISTS "Agency members can view transfers" ON transfers;
DROP POLICY IF EXISTS "Agency admins can create transfers" ON transfers;
DROP POLICY IF EXISTS "Agency admins can update transfers" ON transfers;
DROP POLICY IF EXISTS "Allow agency access to transfers" ON transfers;
DROP POLICY IF EXISTS "Allow agency inserts" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Insert" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Update" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Select" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Delete" ON transfers;
DROP POLICY IF EXISTS "Allow all authenticated inserts" ON transfers;
DROP POLICY IF EXISTS "Transfers insert allowed" ON transfers;
DROP POLICY IF EXISTS "Transfers select allowed" ON transfers;
DROP POLICY IF EXISTS "Transfers update allowed" ON transfers;

-- En basit RLS çözümü - Herkese açık transfer ekleme
CREATE POLICY "Transfers insert allowed" ON transfers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Transfers select allowed" ON transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Transfers update allowed" ON transfers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- JWT içinde rol ve app_metadata için yardımcı fonksiyonlar
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

CREATE OR REPLACE FUNCTION debug_jwt_full_content()
RETURNS jsonb AS $$
BEGIN
  RETURN (SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb);
END;
$$ LANGUAGE plpgsql;

COMMIT; 