-- agency_role enum düzeltmesi
BEGIN;

-- Tüm RLS politikalarını devre dışı bırak
-- Önce tablo üzerindeki RLS'yi tamamen devre dışı bırak
ALTER TABLE agency_users DISABLE ROW LEVEL SECURITY;

-- Ardından tüm politikaları belirterek kaldır
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

-- İlgili tüm RLS politikalarını görüntüle ve kaldır
DO $$
DECLARE
  policy_row RECORD;
BEGIN
  FOR policy_row IN 
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'agency_users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON agency_users', policy_row.policyname);
  END LOOP;
END
$$;

-- Enum tipini doğrudan genişlet
-- NOT: ALTER TYPE ADD VALUE ile enum'a yeni değerler ekleyebiliriz,
-- ancak enum değerleri sıraya bağlı olduğu için sonuna eklenir
DO $$
BEGIN
  -- Mevcut enum değerlerini kontrol et
  IF NOT EXISTS (
    SELECT 1 FROM pg_type 
    WHERE typname = 'agency_role'
  ) THEN
    -- Eğer enum yoksa, oluştur
    CREATE TYPE agency_role AS ENUM (
      'admin',
      'editor',
      'viewer',
      'superuser',
      'agency_admin',
      'agency_editor',
      'agency_viewer'
    );
  ELSE
    -- Eğer enum varsa, yeni değerleri ekle (var olan değerler dışında)
    -- Bu işlemi güvenli bir şekilde yapmak için her değer için kontrol yapıyoruz
    BEGIN
      ALTER TYPE agency_role ADD VALUE IF NOT EXISTS 'superuser';
      EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE agency_role ADD VALUE IF NOT EXISTS 'agency_admin';
      EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE agency_role ADD VALUE IF NOT EXISTS 'agency_editor';
      EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
      ALTER TYPE agency_role ADD VALUE IF NOT EXISTS 'agency_viewer';
      EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Kullanıcının RLS politikalarında kullanabileceği ajans rollerini kontrol eder
CREATE OR REPLACE FUNCTION check_agency_role_access(user_id uuid, agency_id uuid, allowed_roles text[])
RETURNS BOOLEAN AS $$
DECLARE
  user_role text;
BEGIN
  -- Kullanıcının belirtilen ajans için rolünü al
  SELECT role::text INTO user_role FROM agency_users 
  WHERE user_id = $1 AND agency_id = $2;
  
  -- Kullanıcının rolü izin verilen roller içinde mi?
  RETURN user_role = ANY(allowed_roles);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Kullanıcının ajansla ilişkisini ve rollerini kontrol eder
CREATE OR REPLACE FUNCTION check_user_agency_roles(user_id uuid, agency_id uuid)
RETURNS TABLE(role text) AS $$
BEGIN
  RETURN QUERY
  SELECT agency_users.role::text FROM agency_users
  WHERE agency_users.user_id = $1 AND agency_users.agency_id = $2;
END;
$$ LANGUAGE plpgsql;

-- RLS'yi tekrar etkinleştir
ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;

COMMIT;
