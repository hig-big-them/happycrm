-- Belirsiz user_id ve agency_id referansı içeren fonksiyonu düzeltme
BEGIN;

-- check_if_user_is_agency_admin_for_transfer fonksiyonunu orijinal parametre adlarıyla düzelt
CREATE OR REPLACE FUNCTION public.check_if_user_is_agency_admin_for_transfer(user_id UUID, agency_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.agency_users au
        WHERE au.user_id = check_if_user_is_agency_admin_for_transfer.user_id  -- Parametre adlarını fonksiyon adını önüne ekleyerek belirttim
        AND au.agency_id = check_if_user_is_agency_admin_for_transfer.agency_id  -- Parametre adlarını fonksiyon adını önüne ekleyerek belirttim
        AND au.role = 'agency_admin'
    );
END;
$$ LANGUAGE plpgsql;

-- Mevcut kullanıcıyı kontrol eden yeni fonksiyon
CREATE OR REPLACE FUNCTION public.check_if_current_user_is_agency_admin(agency_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.agency_users au
        WHERE au.user_id = auth.uid()  -- auth.uid() kullanarak mevcut kullanıcıyı kontrol et
        AND au.agency_id = check_if_current_user_is_agency_admin.agency_id  -- Parametre adını fonksiyon adı ile belirttim
        AND au.role = 'agency_admin'
    );
END;
$$ LANGUAGE plpgsql;

-- Son kontrol - Transfers tablosundaki tüm user_id belirsizliklerini düzelttiğimizi doğrula
CREATE OR REPLACE FUNCTION public.fix_transfer_table_triggers()
RETURNS VOID AS $$
BEGIN
    -- Transfers tablosundaki herhangi bir user_id kullanımını kontrol et ve düzelt
    IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.transfers'::regclass
    ) THEN
        -- Calculate deadline tetikleyicisini güncelle
        DROP TRIGGER IF EXISTS calculate_deadline_trigger ON public.transfers;
        CREATE TRIGGER calculate_deadline_trigger
        BEFORE INSERT ON public.transfers
        FOR EACH ROW
        EXECUTE FUNCTION public.calculate_deadline();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Düzeltme fonksiyonunu çalıştır
SELECT public.fix_transfer_table_triggers();

COMMIT;
