CREATE OR REPLACE FUNCTION public.check_if_user_is_agency_admin_for_transfer(user_id UUID, agency_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.agency_users
        WHERE user_id = user_id
        AND agency_id = agency_id
        AND role = 'agency_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;