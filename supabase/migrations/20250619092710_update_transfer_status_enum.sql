DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN
        CREATE TYPE public.transfer_status AS ENUM (
            'pending',
            'driver_assigned',
            'patient_picked_up',
            'completed',
            'delayed',
            'cancelled'
        );
    ELSE
        ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'pending';
        ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'driver_assigned';
        ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'patient_picked_up';
        ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'completed';
        ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'delayed';
        ALTER TYPE public.transfer_status ADD VALUE IF NOT EXISTS 'cancelled';
    END IF;
END $$;
