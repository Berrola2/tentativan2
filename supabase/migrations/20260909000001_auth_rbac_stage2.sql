-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000001_auth_rbac_stage2.sql
-- ==============================================================================
-- ETAPA 02: Autenticação, Login YZZY, Empresas, Perfis e RBAC
-- ==============================================================================

-- 1. EXTENSÃO DO ENUM DE PAPÉIS (public.app_role)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'ROLE_SUPER_ADMIN'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ROLE_SUPER_ADMIN';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.app_role'::regtype AND enumlabel = 'ROLE_VIEWER'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ROLE_VIEWER';
    END IF;
END $$;

-- 2. AJUSTES NA TABELA public.companies
ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS legal_name TEXT,
    ADD COLUMN IF NOT EXISTS trade_name TEXT,
    ADD COLUMN IF NOT EXISTS document_number TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT;

-- Garantir que trade_name tenha fallback para name
UPDATE public.companies SET trade_name = name WHERE trade_name IS NULL;

-- 3. AJUSTES NA TABELA public.profiles
-- Tornar company_id nullable para permitir que SUPER_ADMIN não pertença a nenhuma empresa específica
ALTER TABLE public.profiles 
    ALTER COLUMN company_id DROP NOT NULL;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS display_name TEXT,
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Atualizar display_name existente
UPDATE public.profiles SET display_name = full_name WHERE display_name IS NULL;

-- 4. TABELA PRIVADA DE IDENTIDADES LOGIN YZZY (private.user_auth_identities)
-- Isolada no schema private, sem exposição via PostgREST
CREATE TABLE IF NOT EXISTS private.user_auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    login_alias TEXT NOT NULL UNIQUE,
    auth_email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_login_alias_format CHECK (login_alias = lower(login_alias) AND login_alias ~ '^[a-z0-9._-]+@[a-z0-9._-]+\.yzzy$')
);

CREATE INDEX IF NOT EXISTS idx_user_auth_identities_login_alias ON private.user_auth_identities(login_alias);
CREATE INDEX IF NOT EXISTS idx_user_auth_identities_user_id ON private.user_auth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_auth_identities_company_id ON private.user_auth_identities(company_id);

REVOKE ALL ON TABLE private.user_auth_identities FROM PUBLIC, anon, authenticated;

-- 5. TABELA DE AUDITORIA DE SEGURANÇA (public.security_audit_logs)
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_audit_event_type CHECK (length(trim(event_type)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_company_id ON public.security_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON public.security_audit_logs(created_at DESC);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. FUNÇÕES SEGURAS DE CONTEXTO NO SCHEMA private (SECURITY DEFINER, SET search_path = '')

-- 6.1 Obter company_id do usuário atual
CREATE OR REPLACE FUNCTION private.current_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.company_id
    FROM public.profiles p
    LEFT JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = (SELECT auth.uid())
      AND p.active = TRUE
      AND (p.company_id IS NULL OR c.active = TRUE)
    LIMIT 1;
$$;

-- 6.2 Obter papel (role) do usuário atual
CREATE OR REPLACE FUNCTION private.current_user_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.role
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.active = TRUE
    LIMIT 1;
$$;

-- 6.3 Verificar se usuário atual é SUPER_ADMIN
CREATE OR REPLACE FUNCTION private.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.active = TRUE
          AND p.role::text = 'ROLE_SUPER_ADMIN'
    );
$$;

-- 6.4 Verificar se usuário atual é COMPANY_MANAGER (ou SUPER_ADMIN)
CREATE OR REPLACE FUNCTION private.is_company_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        LEFT JOIN public.companies c ON c.id = p.company_id
        WHERE p.id = (SELECT auth.uid())
          AND p.active = TRUE
          AND (
            p.role::text = 'ROLE_SUPER_ADMIN'
            OR (p.role::text = 'ROLE_MANAGER' AND c.active = TRUE)
          )
    );
$$;

-- Permissões de execução para as funções de contexto
REVOKE ALL ON FUNCTION private.current_company_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_company_manager() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.current_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_company_manager() TO authenticated;

-- 7. REFINAMENTO DAS POLÍTICAS DE RLS

-- ----------------------------------------------------------------------
-- 7.1 RLS: public.companies
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_select_authenticated_own" ON public.companies;
DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_admin_insert_policy" ON public.companies;
DROP POLICY IF EXISTS "companies_admin_update_policy" ON public.companies;

-- Leitura: Super Admin visualiza todas; outros visualizam apenas a própria empresa ativa
CREATE POLICY "companies_select_policy"
    ON public.companies
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR id = (SELECT private.current_company_id())
    );

-- Escrita: Apenas Super Admin pode inserir/alterar empresas
CREATE POLICY "companies_admin_insert_policy"
    ON public.companies
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT private.is_super_admin()) = TRUE);

CREATE POLICY "companies_admin_update_policy"
    ON public.companies
    FOR UPDATE
    TO authenticated
    USING ((SELECT private.is_super_admin()) = TRUE)
    WITH CHECK ((SELECT private.is_super_admin()) = TRUE);

-- ----------------------------------------------------------------------
-- 7.2 RLS: public.profiles
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_authenticated_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- Leitura:
--  - SUPER_ADMIN visualiza todos os perfis
--  - COMPANY_MANAGER visualiza todos os funcionários de sua própria empresa ativa
--  - INSPECTOR e VIEWER visualizam somente o próprio perfil
CREATE POLICY "profiles_select_policy"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR (
            (SELECT private.is_company_manager()) = TRUE
            AND company_id = (SELECT private.current_company_id())
        )
        OR id = (SELECT auth.uid())
    );

-- ----------------------------------------------------------------------
-- 7.3 RLS: public.security_audit_logs
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.security_audit_logs;

CREATE POLICY "audit_logs_select_policy"
    ON public.security_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR (
            (SELECT private.is_company_manager()) = TRUE
            AND company_id = (SELECT private.current_company_id())
        )
    );

-- 8. GRANTS ESTRITOS (MENOR PRIVILÉGIO)
REVOKE ALL ON TABLE public.companies FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.security_audit_logs FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.companies TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.security_audit_logs TO authenticated;

-- Super Admin recebe permissões de INSERT/UPDATE em companies
GRANT INSERT, UPDATE ON TABLE public.companies TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION
-- ==============================================================================
