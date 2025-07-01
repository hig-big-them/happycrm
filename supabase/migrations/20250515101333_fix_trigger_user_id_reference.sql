-- Transfers tablosundaki tetikleyici ve fonksiyonlardaki user_id referanslarını düzeltme
BEGIN;

-- Eğer varsa trigger'ı düzenleyelim
CREATE OR REPLACE FUNCTION public.handle_transfer_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- Belirsiz user_id yerine auth.uid() kullan
  INSERT INTO transfer_audit_log (transfer_id, modified_by, action)
  VALUES (NEW.id, auth.uid(), TG_OP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Varsa diğer fonksiyonlardaki user_id referanslarını düzelt
CREATE OR REPLACE FUNCTION public.calculate_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- transfers tablosundaki user_id yerine auth.uid() kullan
  NEW.deadline_datetime = NEW.transfer_datetime + INTERVAL '45 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Transfers tablosundaki tüm user_id referanslarını tablo alias'larıyla birlikte kullan
DROP TRIGGER IF EXISTS transfers_audit_trigger ON public.transfers;
CREATE TRIGGER transfers_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.handle_transfer_audit();

DROP TRIGGER IF EXISTS calculate_deadline_trigger ON public.transfers;
CREATE TRIGGER calculate_deadline_trigger
BEFORE INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.calculate_deadline();

COMMIT;
