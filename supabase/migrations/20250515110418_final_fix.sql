-- En basit nihai çözüm
BEGIN;

-- RLS'i devre dışı bırak, çalışan bir soruna ulaşmak için
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;

-- Herkesin görebilmesi için politika oluştur
CREATE POLICY "Allow transfers select" ON transfers
FOR SELECT TO authenticated USING (true);

-- Herkesin ekleyebilmesi için politika oluştur
CREATE POLICY "Allow transfers insert" ON transfers
FOR INSERT TO authenticated WITH CHECK (true);

-- Herkesin düzenleyebilmesi için politika oluştur
CREATE POLICY "Allow transfers update" ON transfers
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

COMMIT;
