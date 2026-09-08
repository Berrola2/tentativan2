-- ==============================================================================
-- SCHEMA SUPABASE PARA VISTORIA YZZY — ETAPA 3.3 (IMPLANTAÇÃO NÃO DESTRUTIVA)
-- ==============================================================================
-- Este script é 100% IDEMPOTENTE e NÃO DESTRUTIVO:
-- Preserva todos os dados existentes nas tabelas 'inspections', 'companies' e 'profiles'.
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

-- 3. Tabela de Empresas (Companies / Multi-Tenant) — Não Destrutiva
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_active ON public.companies(active);

-- 4. Tabela de Perfis de Usuário (Profiles) vinculada a auth.users — Não Destrutiva
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

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active);

-- 5. Tabela Privada de Identidades Internas de Autenticação (Server-Only)
-- ATENÇÃO DE SEGURANÇA: Inacessível por SELECT de anon e authenticated (sem policies, RLS ativado, REVOKE ALL)
CREATE TABLE IF NOT EXISTS public.user_auth_identities (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    username TEXT NOT NULL,
    auth_email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_auth_identities_company_username UNIQUE (company_id, username)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_identities_search ON public.user_auth_identities(company_id, username);
CREATE INDEX IF NOT EXISTS idx_user_auth_identities_email ON public.user_auth_identities(auth_email);

ALTER TABLE public.user_auth_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_auth_identities FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_auth_identities TO service_role;

-- 6. Tabela de Rate Limiting para Autenticação (Server-Side)
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL UNIQUE, -- IP ou combinação "account:slug:username"
    attempt_count INT NOT NULL DEFAULT 1,
    last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.auth_rate_limits(identifier);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_rate_limits TO service_role;

-- 7. Função Utilitária para Atualização de Timestamp (updated_at)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

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

-- 8. Funções Auxiliares Seguras para RLS (Sem recursão e com search_path seguro)
CREATE OR REPLACE FUNCTION public.get_auth_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
          AND role = 'ROLE_MANAGER'::public.app_role 
          AND active = TRUE
    );
$$;

-- 9. Trigger de Proteção contra Escalada de Privilégios e Troca de Empresa em Profiles
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- REGRA 1: O identificador (id) e a empresa (company_id) NUNCA podem ser alterados em UPDATE
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Acesso Negado: O identificador de usuário não pode ser alterado.' USING ERRCODE = '42501';
    END IF;

    IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'Acesso Negado: A empresa vinculada ao perfil não pode ser alterada.' USING ERRCODE = '42501';
    END IF;

    -- REGRA 2: Usuários comuns (não gerentes) NÃO podem alterar role, active ou username
    IF auth.uid() = OLD.id AND NOT public.is_auth_manager() THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Acesso Negado: Usuários comuns não podem alterar o próprio cargo/permissões.' USING ERRCODE = '42501';
        END IF;

        IF NEW.active IS DISTINCT FROM OLD.active THEN
            RAISE EXCEPTION 'Acesso Negado: Usuários comuns não podem alterar o status de ativação do perfil.' USING ERRCODE = '42501';
        END IF;

        IF NEW.username IS DISTINCT FROM OLD.username THEN
            RAISE EXCEPTION 'Acesso Negado: O nome de usuário não pode ser alterado diretamente pelo perfil do usuário.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- REGRA 3: O Gerente não pode desativar a si próprio nem rebaixar o próprio cargo
    IF auth.uid() = OLD.id AND public.is_auth_manager() THEN
        IF NEW.active = FALSE THEN
            RAISE EXCEPTION 'Operação Inválida: O gerente não pode desativar a própria conta.' USING ERRCODE = '42501';
        END IF;
        IF NEW.role IS DISTINCT FROM 'ROLE_MANAGER'::public.app_role THEN
            RAISE EXCEPTION 'Operação Inválida: O gerente não pode rebaixar o próprio cargo.' USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_sensitive_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- 10. Trigger de Consistência entre Profiles e user_auth_identities
CREATE OR REPLACE FUNCTION public.sync_profile_identity_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.user_auth_identities WHERE user_id = NEW.id) THEN
        UPDATE public.user_auth_identities
        SET username = NEW.username,
            company_id = NEW.company_id
        WHERE user_id = NEW.id
          AND (username IS DISTINCT FROM NEW.username OR company_id IS DISTINCT FROM NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_profile_identity_consistency ON public.profiles;
CREATE TRIGGER tr_sync_profile_identity_consistency
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_identity_consistency();

-- 11. Função Segura de Rate Limiting para Autenticação (Server-Side)
CREATE OR REPLACE FUNCTION public.check_and_record_login_attempt(
    p_identifier TEXT,
    p_max_attempts INT DEFAULT 5,
    p_window_seconds INT DEFAULT 300,  -- 5 minutos
    p_lock_seconds INT DEFAULT 900     -- 15 minutos de bloqueio
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record public.auth_rate_limits%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_locked_until TIMESTAMPTZ;
    v_remaining_seconds INT;
BEGIN
    SELECT * INTO v_record FROM public.auth_rate_limits WHERE identifier = p_identifier FOR UPDATE;

    IF FOUND THEN
        -- Verificar se está atualmente bloqueado
        IF v_record.locked_until IS NOT NULL AND v_record.locked_until > v_now THEN
            v_remaining_seconds := EXTRACT(EPOCH FROM (v_record.locked_until - v_now))::INT;
            RETURN jsonb_build_object('allowed', false, 'locked', true, 'retry_after_seconds', v_remaining_seconds);
        END IF;

        -- Se a janela expirou, reseta o contador
        IF v_record.last_attempt + (p_window_seconds || ' seconds')::INTERVAL < v_now THEN
            UPDATE public.auth_rate_limits
            SET attempt_count = 1,
                last_attempt = v_now,
                locked_until = NULL
            WHERE identifier = p_identifier;

            RETURN jsonb_build_object('allowed', true, 'locked', false, 'attempt_count', 1);
        ELSE
            -- Incrementa tentativa
            IF v_record.attempt_count + 1 >= p_max_attempts THEN
                v_locked_until := v_now + (p_lock_seconds || ' seconds')::INTERVAL;
                UPDATE public.auth_rate_limits
                SET attempt_count = v_record.attempt_count + 1,
                    last_attempt = v_now,
                    locked_until = v_locked_until
                WHERE identifier = p_identifier;

                RETURN jsonb_build_object('allowed', false, 'locked', true, 'retry_after_seconds', p_lock_seconds);
            ELSE
                UPDATE public.auth_rate_limits
                SET attempt_count = v_record.attempt_count + 1,
                    last_attempt = v_now,
                    locked_until = NULL
                WHERE identifier = p_identifier;

                RETURN jsonb_build_object('allowed', true, 'locked', false, 'attempt_count', v_record.attempt_count + 1);
            END IF;
        END IF;
    ELSE
        -- Primeiro registro
        INSERT INTO public.auth_rate_limits (identifier, attempt_count, last_attempt, locked_until)
        VALUES (p_identifier, 1, v_now, NULL);

        RETURN jsonb_build_object('allowed', true, 'locked', false, 'attempt_count', 1);
    END IF;
END;
$$;

-- Resetar rate limit após login bem-sucedido
CREATE OR REPLACE FUNCTION public.reset_login_rate_limit(p_identifier TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    DELETE FROM public.auth_rate_limits WHERE identifier = p_identifier;
END;
$$;

-- 12. Função Interna Segura para Resolver Identidade Interna (Apenas Service Role / Edge Functions)
CREATE OR REPLACE FUNCTION public.resolve_user_auth_email(
    p_company_slug TEXT,
    p_username TEXT
)
RETURNS TABLE (
    user_id UUID,
    auth_email TEXT,
    full_name TEXT,
    role public.app_role,
    company_id UUID,
    company_name TEXT,
    company_slug TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT 
        p.id AS user_id,
        uai.auth_email,
        p.full_name,
        p.role,
        c.id AS company_id,
        c.name AS company_name,
        c.slug AS company_slug
    FROM public.user_auth_identities uai
    JOIN public.profiles p ON p.id = uai.user_id
    JOIN public.companies c ON c.id = p.company_id
    WHERE c.slug = LOWER(TRIM(p_company_slug))
      AND c.active = TRUE
      AND uai.username = LOWER(TRIM(p_username))
      AND p.active = TRUE
    LIMIT 1;
$$;

-- 13. RPC Segura para Consulta Pública de Empresa por Slug no Login (Retorna apenas campos públicos)
CREATE OR REPLACE FUNCTION public.get_company_login_info(p_slug TEXT)
RETURNS TABLE (
    name TEXT,
    slug TEXT,
    logo_url TEXT,
    active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT 
        c.name,
        c.slug,
        c.logo_url,
        c.active
    FROM public.companies c
    WHERE c.slug = LOWER(TRIM(p_slug))
      AND c.active = TRUE
    LIMIT 1;
$$;

-- 14. Permissões Granulares (GRANT / REVOKE)
REVOKE ALL ON FUNCTION public.get_auth_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_company_id() TO authenticated;

REVOKE ALL ON FUNCTION public.get_auth_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_auth_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_auth_manager() TO authenticated;

-- Funções de rate limit e resolução de identidade: restritas a service_role
REVOKE ALL ON FUNCTION public.resolve_user_auth_email(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_user_auth_email(TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.check_and_record_login_attempt(TEXT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_login_attempt(TEXT, INT, INT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.reset_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_login_rate_limit(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.get_company_login_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_login_info(TEXT) TO anon, authenticated;

-- 15. Políticas RLS: public.companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir consulta publica de empresas ativas por slug" ON public.companies;
DROP POLICY IF EXISTS "Usuarios autenticados podem ver sua propria empresa" ON public.companies;
DROP POLICY IF EXISTS "Gerentes podem atualizar os dados de sua propria empresa" ON public.companies;

-- Somente membros autenticados podem consultar os dados completos da própria empresa
CREATE POLICY "Usuarios autenticados podem ver sua propria empresa"
    ON public.companies
    FOR SELECT
    TO authenticated
    USING (id = public.get_auth_company_id());

-- Somente gerentes autenticados podem atualizar dados da própria empresa
CREATE POLICY "Gerentes podem atualizar os dados de sua propria empresa"
    ON public.companies
    FOR UPDATE
    TO authenticated
    USING (id = public.get_auth_company_id() AND public.is_auth_manager())
    WITH CHECK (id = public.get_auth_company_id() AND public.is_auth_manager());

-- 16. Políticas RLS: public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfis visiveis somente por membros da mesma empresa" ON public.profiles;
DROP POLICY IF EXISTS "Gerentes podem inserir perfis na sua empresa" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios podem atualizar seu proprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuarios podem atualizar perfil na sua empresa" ON public.profiles;
DROP POLICY IF EXISTS "Gerentes podem excluir membros de sua empresa" ON public.profiles;

-- Visualização: Apenas membros pertencentes à mesma empresa
CREATE POLICY "Perfis visiveis somente por membros da mesma empresa"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (company_id = public.get_auth_company_id());

-- Inserção: Somente gerentes autenticados da empresa
CREATE POLICY "Gerentes podem inserir perfis na sua empresa"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (company_id = public.get_auth_company_id() AND public.is_auth_manager());

-- Atualização: Usuário na sua empresa (protegido adicionalmente pelo trigger de campos sensíveis)
CREATE POLICY "Usuarios podem atualizar perfil na sua empresa"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (company_id = public.get_auth_company_id() AND (id = auth.uid() OR public.is_auth_manager()))
    WITH CHECK (company_id = public.get_auth_company_id());

-- Exclusão / Desativação: Somente gerentes da empresa (sem excluir a si próprio)
CREATE POLICY "Gerentes podem excluir membros de sua empresa"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (company_id = public.get_auth_company_id() AND public.is_auth_manager() AND id <> auth.uid());

-- 17. Preservação Intacta da Tabela de Vistorias (Inspections) — NÃO ALTERAR
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

-- 18. Storage Bucket para Fotos
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
