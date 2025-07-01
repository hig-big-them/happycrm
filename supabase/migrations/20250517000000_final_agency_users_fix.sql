-- Yeni bir migration dosyası: 20250517000000_final_agency_users_fix.sql

-- Tüm eski politikaları temizle
DROP POLICY IF EXISTS "comprehensive_view_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "superuser_delete_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "superuser_insert_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "superuser_update_agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "Allow superuser full access on agency_users" ON public.agency_users;
DROP POLICY IF EXISTS "Allow insert with superuser role" ON public.agency_users;
DROP POLICY IF EXISTS "view_own_agency_memberships" ON public.agency_users;

-- Sadece tek bir policy ile superuser tam erişim izni ver
CREATE POLICY "superuser_all_agency_users"
ON public.agency_users
FOR ALL
USING (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser')
WITH CHECK (((auth.jwt()->>'raw_app_meta_data')::jsonb->>'role') = 'superuser');

-- Diğer kullanıcılara sadece görüntüleme izni ver
CREATE POLICY "view_agency_users_for_authenticated"
ON public.agency_users
FOR SELECT
USING (auth.role() = 'authenticated');
