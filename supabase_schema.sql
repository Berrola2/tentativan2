-- ==============================================================================
-- SCHEMA SUPABASE PARA VISTORIA YZZY — ETAPA 2 (AUTENTICAÇÃO & MULTI-TENANT)
-- ==============================================================================

-- 1. Extensões Essenciais
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tipo Enum para Cargos e Perfis de Acesso (RBAC)
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM (
        'ROLE_MANAGER',
        'ROLE_INSPECTOR',
        'ROLE_ADMIN_VIEWER',
        'ROLE_TENANT_CLIENT',
        'ROLE_LANDLORD_CLIENT'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Tabela de Empresas (Companies / Multi-Tenant)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de performance para empresas
CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(active);

-- 4. Tabela de Perfis de Usuário (Profiles) vinculada a auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role public.app_role NOT NULL DEFAULT 'ROLE_INSPECTOR',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_profiles_company_username UNIQUE (company_id, username)
);

-- Índices de performance para perfis
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active);

-- 5. Função Utilitária para Atualização de Timestamp (updated_at)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de timestamp
DROP TRIGGER IF EXISTS tr_companies_updated_at ON public.companies;
CREATE TRIGGER tr_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Funções Auxiliares Seguras para RLS (Sem recursão e com SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT company_id 
    FROM public.profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role 
    FROM public.profiles 
    WHERE id = auth.uid() 
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_auth_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
          AND role = 'ROLE_MANAGER' 
          AND active = TRUE
    );
$$;

-- 7. Função Trigger para Criação Segura de Profile a partir de auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_username TEXT;
    v_full_name TEXT;
    v_role_text TEXT;
    v_role public.app_role;
BEGIN
    -- Extração dos metadados fornecidos no cadastro administrativo
    v_company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
    v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', v_username);
    v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'ROLE_INSPECTOR');

    IF v_company_id IS NOT NULL THEN
        BEGIN
            v_role := v_role_text::public.app_role;
        EXCEPTION WHEN OTHERS THEN
            v_role := 'ROLE_INSPECTOR'::public.app_role;
        END;

        INSERT INTO public.profiles (id, company_id, username, full_name, role, active)
        VALUES (NEW.id, v_company_id, LOWER(TRIM(v_username)), TRIM(v_full_name), v_role, TRUE)
        ON CONFLICT (id) DO UPDATE
        SET 
            company_id = EXCLUDED.company_id,
            username = EXCLUDED.username,
            full_name = EXCLUDED.full_name,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 8. RPC para Registro Inicial de Empresa e Gerente (Onboarding)
CREATE OR REPLACE FUNCTION public.register_company_with_manager(
    p_company_name TEXT,
    p_company_slug TEXT,
    p_full_name TEXT,
    p_username TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id UUID;
    v_clean_slug TEXT;
    v_clean_username TEXT;
BEGIN
    v_clean_slug := LOWER(TRIM(p_company_slug));
    v_clean_username := LOWER(TRIM(p_username));

    -- Validação de existência do slug
    IF EXISTS (SELECT 1 FROM public.companies WHERE slug = v_clean_slug) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este identificador (slug) de empresa já está em uso.');
    END IF;

    -- Inserir empresa
    INSERT INTO public.companies (name, slug, active)
    VALUES (TRIM(p_company_name), v_clean_slug, TRUE)
    RETURNING id INTO v_company_id;

    -- Inserir ou atualizar perfil do usuário como Gerente
    INSERT INTO public.profiles (id, company_id, username, full_name, role, active)
    VALUES (p_user_id, v_company_id, v_clean_username, TRIM(p_full_name), 'ROLE_MANAGER', TRUE)
    ON CONFLICT (id) DO UPDATE
    SET company_id = v_company_id,
        username = v_clean_username,
        full_name = TRIM(p_full_name),
        role = 'ROLE_MANAGER',
        active = TRUE,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true, 
        'company_id', v_company_id,
        'company_slug', v_clean_slug,
        'username', v_clean_username,
        'message', 'Empresa e Gerente cadastrados com sucesso!'
    );
END;
$$;

-- 9. Políticas RLS: public.companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados podem ver sua propria empresa" ON public.companies;
CREATE POLICY "Usuarios autenticados podem ver sua propria empresa"
    ON public.companies
    FOR SELECT
    TO authenticated
    USING (id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Permitir consulta publica de empresas ativas por slug" ON public.companies;
CREATE POLICY "Permitir consulta publica de empresas ativas por slug"
    ON public.companies
    FOR SELECT
    TO anon
    USING (active = TRUE);

DROP POLICY IF EXISTS "Gerentes podem atualizar os dados de sua propria empresa" ON public.companies;
CREATE POLICY "Gerentes podem atualizar os dados de sua propria empresa"
    ON public.companies
    FOR UPDATE
    TO authenticated
    USING (id = public.get_auth_company_id() AND public.is_auth_manager())
    WITH CHECK (id = public.get_auth_company_id() AND public.is_auth_manager());

-- 10. Políticas RLS: public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis visiveis somente por membros da mesma empresa" ON public.profiles;
CREATE POLICY "Perfis visiveis somente por membros da mesma empresa"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Gerentes podem inserir perfis na sua empresa" ON public.profiles;
CREATE POLICY "Gerentes podem inserir perfis na sua empresa"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() AND public.is_auth_manager());

DROP POLICY IF EXISTS "Usuarios podem atualizar seu proprio perfil" ON public.profiles;
CREATE POLICY "Usuarios podem atualizar seu proprio perfil"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid() OR (company_id = public.get_auth_company_id() AND public.is_auth_manager()))
    WITH CHECK (company_id = public.get_auth_company_id());

DROP POLICY IF EXISTS "Gerentes podem excluir membros de sua empresa" ON public.profiles;
CREATE POLICY "Gerentes podem excluir membros de sua empresa"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (company_id = public.get_auth_company_id() AND public.is_auth_manager() AND id <> auth.uid());

-- 11. Preservação da Tabela Existente de Vistorias (Inspections)
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

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico total para vistorias" ON public.inspections;
CREATE POLICY "Acesso publico total para vistorias"
    ON public.inspections
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS tr_inspections_updated_at ON public.inspections;
CREATE TRIGGER tr_inspections_updated_at
    BEFORE UPDATE ON public.inspections
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 12. Storage Bucket para Fotos
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
