-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260908000001_initial_foundation.sql
-- ==============================================================================
-- ETAPA 3: Fundação Limpa do Banco Multi-Tenant
-- Criação de:
--  - Schema privado para funções internas (private)
--  - Enum de papéis RBAC (public.app_role)
--  - Tabela de empresas (public.companies)
--  - Tabela de perfis vinculada ao auth.users (public.profiles)
--  - Índices otimizados
--  - Triggers para atualização automática de updated_at
--  - Função de contexto de empresa segura (private.current_company_id)
--  - Políticas de RLS estritas de leitura própria para authenticated
--  - Grants de menor privilégio (sem permissão para anon / sem escrita no frontend)
-- ==============================================================================

-- 1. SCHEMA PRIVADO (Não exposto via API REST / PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

-- 2. ENUM DE PAPÉIS DO SISTEMA (RBAC)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
        CREATE TYPE public.app_role AS ENUM (
            'ROLE_MANAGER',
            'ROLE_INSPECTOR',
            'ROLE_ADMIN_VIEWER',
            'ROLE_TENANT_CLIENT',
            'ROLE_LANDLORD_CLIENT'
        );
    END IF;
END $$;

-- 3. FUNÇÃO GENÉRICA DE ATUALIZAÇÃO AUTOMÁTICA DE updated_at
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC, anon, authenticated;

-- 4. TABELA COMPANIES (Empresas / Multi-Tenant)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_companies_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_companies_slug_format CHECK (slug ~ '^[a-z0-9_-]+$' AND length(slug) >= 2 AND length(slug) <= 100)
);

-- Trigger de updated_at para companies
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION private.set_updated_at();

-- 5. TABELA PROFILES (Perfis de Usuários)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role public.app_role NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_profiles_company_username UNIQUE (company_id, username),
    CONSTRAINT chk_profiles_full_name_not_empty CHECK (length(trim(full_name)) > 0),
    CONSTRAINT chk_profiles_username_format CHECK (username = lower(username) AND username ~ '^[a-z0-9._-]+$' AND length(username) >= 2 AND length(username) <= 50)
);

-- Trigger de updated_at para profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.set_updated_at();

-- 6. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 7. FUNÇÃO AUXILIAR DE SEGURANÇA PARA RLS (private.current_company_id)
-- Retorna o company_id associado ao usuário atualmente autenticado via auth.uid()
CREATE OR REPLACE FUNCTION private.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.company_id
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.active = TRUE
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_company_id() TO authenticated;

-- 8. HABILITAÇÃO EXPLÍCITA DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------
-- RLS: public.companies
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_select_authenticated_own" ON public.companies;
CREATE POLICY "companies_select_authenticated_own"
    ON public.companies
    FOR SELECT
    TO authenticated
    USING (
        id = (SELECT private.current_company_id())
    );

-- ----------------------------------------------------------------------
-- RLS: public.profiles
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_authenticated_own" ON public.profiles;
CREATE POLICY "profiles_select_authenticated_own"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

-- 9. PERMISSÕES E PRIVILÉGIOS (LEAST PRIVILEGE)
-- Revogar acessos públicos e de anon
REVOKE ALL ON TABLE public.companies FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;

-- Conceder apenas SELECT para authenticated (escritas futuras serão administrativas via server-side)
GRANT SELECT ON TABLE public.companies TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION
-- ==============================================================================
