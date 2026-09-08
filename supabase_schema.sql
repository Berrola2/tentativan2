-- ==============================================================================
-- SCHEMA SUPABASE PARA VISTORIA YZZY (DIRETO E SEM RESTRIÇÃO DE LOGIN)
-- ==============================================================================

-- 1. Extensões essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tabela de Vistorias (Inspections)
CREATE TABLE IF NOT EXISTS public.inspections (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    inspection_type TEXT NOT NULL DEFAULT 'Entrada',
    date TEXT,
    inspector_name TEXT,
    tenant_name TEXT,
    property_address TEXT,
    data_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Habilitar RLS e permitir acesso público/anônimo total para sincronização
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico total para vistorias" ON public.inspections;
DROP POLICY IF EXISTS "Isolamento multi-tenant para vistorias - SELECT" ON public.inspections;
DROP POLICY IF EXISTS "Isolamento multi-tenant para vistorias - INSERT" ON public.inspections;
DROP POLICY IF EXISTS "Isolamento multi-tenant para vistorias - UPDATE" ON public.inspections;
DROP POLICY IF EXISTS "Isolamento multi-tenant para vistorias - DELETE" ON public.inspections;
DROP POLICY IF EXISTS "Permitir acesso publico anonimo para vistorias" ON public.inspections;

CREATE POLICY "Acesso publico total para vistorias"
    ON public.inspections
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Trigger para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_inspections_updated_at ON public.inspections;
CREATE TRIGGER tr_inspections_updated_at
    BEFORE UPDATE ON public.inspections
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Configuração do Storage Bucket para fotos de vistoria (se necessário)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inspection-photos', 'inspection-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Acesso publico storage inspection-photos" ON storage.objects;
CREATE POLICY "Acesso publico storage inspection-photos"
    ON storage.objects
    FOR ALL
    TO anon, authenticated
    USING (bucket_id = 'inspection-photos')
    WITH CHECK (bucket_id = 'inspection-photos');
