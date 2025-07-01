-- Transfers tablosuna deadline confirmation alanları ekleyelim
BEGIN;

-- Transfers tablosuna deadline confirmation alanları ekle
DO $$ 
BEGIN
  -- deadline_confirmation_received: Kullanıcıdan onay alındı mı?
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'deadline_confirmation_received'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN deadline_confirmation_received BOOLEAN DEFAULT FALSE;
  END IF;

  -- deadline_confirmation_datetime: Onay alınan tarih-saat
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'deadline_confirmation_datetime'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN deadline_confirmation_datetime TIMESTAMPTZ;
  END IF;

  -- deadline_confirmation_source: Onayın geldiği kaynak (flow execution sid)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'deadline_confirmation_source'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN deadline_confirmation_source TEXT;
  END IF;

  -- deadline_flow_execution_sid: Studio Flow execution ID
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transfers' AND column_name = 'deadline_flow_execution_sid'
  ) THEN
    ALTER TABLE public.transfers ADD COLUMN deadline_flow_execution_sid TEXT;
  END IF;
END $$;

-- Index'ler ekle
DO $$ 
BEGIN
  -- Onay alınan transferler için index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'transfers' AND indexname = 'transfers_deadline_confirmation_received_idx'
  ) THEN
    CREATE INDEX transfers_deadline_confirmation_received_idx ON public.transfers (deadline_confirmation_received);
  END IF;

  -- Flow execution ID için index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'transfers' AND indexname = 'transfers_deadline_flow_execution_sid_idx'
  ) THEN
    CREATE INDEX transfers_deadline_flow_execution_sid_idx ON public.transfers (deadline_flow_execution_sid);
  END IF;
END $$;

COMMIT; 