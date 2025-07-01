-- ACİL DURUM - RLS OVERRIDE
BEGIN;

-- Tüm politikaları sil
DROP POLICY IF EXISTS "Transfers insert permission" ON transfers;
DROP POLICY IF EXISTS "Transfers update permission" ON transfers;
DROP POLICY IF EXISTS "Transfers select permission" ON transfers;
DROP POLICY IF EXISTS "Transfers delete permission" ON transfers;
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies" ON transfers;
DROP POLICY IF EXISTS "Transfers are viewable by assigned agencies or superusers" ON transfers;
DROP POLICY IF EXISTS "Allow agency admins to create transfers for their agency" ON transfers;
DROP POLICY IF EXISTS "Allow assigned officer or agency admin to update transfers" ON transfers;
DROP POLICY IF EXISTS "Allow assigned users and agency members to select transfers" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Insert" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Update" ON transfers;
DROP POLICY IF EXISTS "Agency Transfers Select" ON transfers;

-- RLS tamamen devre dışı bırak
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;

-- Eğer bu işlemden sonra tekrar RLS etkinleştirilmesi gerekirse, aşağıdaki satır kullanılabilir
-- ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

-- Her ihtimale karşı basit bir INSERT politikası ekle
CREATE POLICY "Transfers insert allowed" ON transfers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Transfers select allowed" ON transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Transfers update allowed" ON transfers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMIT;
