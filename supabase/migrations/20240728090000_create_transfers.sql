CREATE TABLE public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assigned_agency_id UUID NOT NULL, -- Gerekirse FOREIGN KEY ekleyin
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    -- Diğer sütunları ihtiyacınıza göre ekleyin
);