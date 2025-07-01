-- Transfer işlemlerinin denetim (audit) loglarını tutacak tablo
BEGIN;

-- Transfer audit log tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.transfer_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
  modified_by UUID NOT NULL, -- Değişikliği yapan kullanıcının ID'si
  modified_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- Değişiklik zamanı
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE gibi işlemler
  old_data JSONB, -- Eski data (UPDATE ve DELETE durumunda)
  new_data JSONB, -- Yeni data (INSERT ve UPDATE durumunda)
  
  -- Ek metadata
  ip_address TEXT, -- İsteğin geldiği IP adresi (opsiyonel)
  user_agent TEXT, -- Kullanıcı tarayıcı bilgisi (opsiyonel)
  
  -- İzleme amaçlı zaman damgaları
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log tablosu için indeksler
CREATE INDEX IF NOT EXISTS transfer_audit_log_transfer_id_idx ON public.transfer_audit_log(transfer_id);
CREATE INDEX IF NOT EXISTS transfer_audit_log_modified_by_idx ON public.transfer_audit_log(modified_by);
CREATE INDEX IF NOT EXISTS transfer_audit_log_action_idx ON public.transfer_audit_log(action);
CREATE INDEX IF NOT EXISTS transfer_audit_log_modified_at_idx ON public.transfer_audit_log(modified_at);

-- Transfer audit log için yetkilendirme ve RLS politikaları
ALTER TABLE public.transfer_audit_log ENABLE ROW LEVEL SECURITY;

-- Superuser tüm audit logları görebilir
CREATE POLICY "Superusers can view all audit logs"
  ON public.transfer_audit_log
  FOR SELECT
  USING (auth.jwt() ->> 'role' = 'superuser');

-- Ajans yöneticileri ve editörleri kendi ajanslarına ait transfer loglarını görebilir
CREATE POLICY "Agency users can view their transfers audit logs"
  ON public.transfer_audit_log
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transfers t
    JOIN public.agency_users au ON t.agency_id = au.agency_id
    WHERE t.id = transfer_audit_log.transfer_id
    AND au.user_id = auth.uid()
    AND au.role IN ('agency_admin', 'agency_editor', 'agency_viewer')
  ));

-- Handle_transfer_audit fonksiyonunu güncelle (daha fazla veri kaydedecek şekilde)
CREATE OR REPLACE FUNCTION public.handle_transfer_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO transfer_audit_log (transfer_id, modified_by, action, new_data)
    VALUES (NEW.id, auth.uid(), TG_OP, to_jsonb(NEW));
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO transfer_audit_log (transfer_id, modified_by, action, old_data, new_data)
    VALUES (NEW.id, auth.uid(), TG_OP, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF (TG_OP = 'DELETE') THEN
    INSERT INTO transfer_audit_log (transfer_id, modified_by, action, old_data)
    VALUES (OLD.id, auth.uid(), TG_OP, to_jsonb(OLD));
  END IF;
  RETURN NULL; -- after trigger için return değerinin bir önemi yok
END;
$$ LANGUAGE plpgsql;

COMMIT;
