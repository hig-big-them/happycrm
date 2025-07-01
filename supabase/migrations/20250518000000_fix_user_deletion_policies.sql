BEGIN;

-- Superuser'lar için kullanıcı silme politikası
CREATE POLICY "superuser_delete_users"
ON auth.users
FOR DELETE
USING (
  (auth.jwt()->>'raw_app_meta_data')::jsonb->>'role' = 'superuser'
);

-- Silinen kullanıcıları loglama
CREATE TABLE deleted_users_log (
  id UUID PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID REFERENCES auth.users(id)
);

COMMIT;
