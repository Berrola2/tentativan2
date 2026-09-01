-- =======================================================
-- SCRIPT SQL PARA O SUPABASE - VISTORIAPRO
-- Como usar:
-- 1. Abra o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. No menu lateral esquerdo, clique em "SQL Editor"
-- 3. Clique em "New Query", cole todo este código e clique em "RUN" (ou CTRL + ENTER)
-- =======================================================

-- 1. Criar a tabela de vistorias (inspections)
CREATE TABLE IF NOT EXISTS public.inspections (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    inspection_type TEXT NOT NULL DEFAULT 'Entrada',
    date TEXT,
    inspector_name TEXT,
    tenant_name TEXT,
    property_address TEXT,
    data_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Criar índices para buscas rápidas por endereço, inquilino ou tipo
CREATE INDEX IF NOT EXISTS idx_inspections_updated_at ON public.inspections (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_tenant_name ON public.inspections (tenant_name);
CREATE INDEX IF NOT EXISTS idx_inspections_type ON public.inspections (inspection_type);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas de acesso (Permitir leitura, inserção e atualização com anon key)
DROP POLICY IF EXISTS "Permitir acesso público anonimo para vistorias" ON public.inspections;

CREATE POLICY "Permitir acesso público anonimo para vistorias"
ON public.inspections
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 5. Criar bucket de fotos no Supabase Storage (opcional)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Política pública para o bucket de fotos
DROP POLICY IF EXISTS "Permitir upload publico de fotos de vistoria" ON storage.objects;
CREATE POLICY "Permitir upload publico de fotos de vistoria"
ON storage.objects FOR ALL
TO anon, authenticated
USING (bucket_id = 'inspection-photos')
WITH CHECK (bucket_id = 'inspection-photos');

-- Finalizado com sucesso!
