BEGIN;

ALTER TABLE public.user_profiles
ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user';

CREATE OR REPLACE FUNCTION public.handle_role_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users 
  SET raw_app_meta_data = 
    raw_app_meta_data || 
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_role_updated
AFTER UPDATE OF role ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_role_update();

COMMIT; 