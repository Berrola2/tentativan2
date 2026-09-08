-- ==============================================================================
-- SCHEMA SUPABASE PARA VISTORIA YZZY — ETAPA 2.1 (HARDENING DE SEGURANÇA)
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

-- 6. Funções Auxiliares Seguras para RLS (Sem recursão e com search_path seguro)
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

-- 7. Trigger de Proteção contra Escalada de Privilégios e Troca de Empresa em Profiles
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

-- 8. Função Trigger para auth.users (Segura contra metadata fraudulenta)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- SEGURANÇA: raw_user_meta_data NÃO é utilizado para definir company_id ou role.
    -- O provisionamento seguro de perfis com permissões é realizado exclusivamente via RPC de Onboarding (register_company_with_manager)
    -- ou via Edge Function / Backend autenticado com service_role chamado por um ROLE_MANAGER verificado.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 9. RPC Protegida para Onboarding de Empresa e Gerente
CREATE OR REPLACE FUNCTION public.register_company_with_manager(
    p_company_name TEXT,
    p_company_slug TEXT,
    p_full_name TEXT,
    p_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_clean_slug TEXT;
    v_clean_username TEXT;
BEGIN
    -- 1. Obter e validar o usuário autenticado na sessão atual
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Acesso não autenticado.');
    END IF;

    -- 2. Impedir que um usuário já vinculado a uma empresa crie outra empresa
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário já está vinculado a uma empresa.');
    END IF;

    -- 3. Sanitização e validação de formato
    v_clean_slug := LOWER(TRIM(p_company_slug));
    v_clean_username := LOWER(TRIM(p_username));

    IF LENGTH(v_clean_slug) < 3 OR v_clean_slug !~ '^[a-z0-9_-]+$' THEN
        RETURN jsonb_build_object('success', false, 'message', 'O identificador (slug) deve ter no mínimo 3 caracteres alfanuméricos.');
    END IF;

    IF LENGTH(v_clean_username) < 3 OR v_clean_username !~ '^[a-z0-9_.-]+$' THEN
        RETURN jsonb_build_object('success', false, 'message', 'O nome de usuário deve ter no mínimo 3 caracteres alfanuméricos.');
    END IF;

    -- 4. Validar se o slug já está em uso
    IF EXISTS (SELECT 1 FROM public.companies WHERE slug = v_clean_slug) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Este identificador (slug) de empresa já está em uso.');
    END IF;

    -- 5. Criar a empresa
    INSERT INTO public.companies (name, slug, active)
    VALUES (TRIM(p_company_name), v_clean_slug, TRUE)
    RETURNING id INTO v_company_id;

    -- 6. Criar o profile do usuário como ROLE_MANAGER
    INSERT INTO public.profiles (id, company_id, username, full_name, role, active)
    VALUES (v_user_id, v_company_id, v_clean_username, TRIM(p_full_name), 'ROLE_MANAGER'::public.app_role, TRUE);

    RETURN jsonb_build_object(
        'success', true, 
        'company_id', v_company_id,
        'company_slug', v_clean_slug,
        'username', v_clean_username,
        'message', 'Empresa e Gerente cadastrados com sucesso!'
    );
END;
$$;

-- 10. RPC Segura para Consulta Pública de Empresa por Slug no Login (Sem expor dados administrativos)
CREATE OR REPLACE FUNCTION public.get_company_login_info(p_slug TEXT)
RETURNS TABLE (
    id UUID,
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
        c.id,
        c.name,
        c.slug,
        c.logo_url,
        c.active
    FROM public.companies c
    WHERE c.slug = LOWER(TRIM(p_slug))
      AND c.active = TRUE
    LIMIT 1;
$$;

-- 11. Permissões Granulares (GRANT / REVOKE)
REVOKE ALL ON FUNCTION public.get_auth_company_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_company_id() TO authenticated;

REVOKE ALL ON FUNCTION public.get_auth_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_auth_manager() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_auth_manager() TO authenticated;

REVOKE ALL ON FUNCTION public.register_company_with_manager(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_company_with_manager(TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_company_login_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_login_info(TEXT) TO anon, authenticated;

-- 12. Políticas RLS: public.companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Remover qualquer policy anônima permissiva anterior
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

-- 13. Políticas RLS: public.profiles
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

-- 14. Preservação Intacta da Tabela de Vistorias (Inspections)
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

-- 15. Storage Bucket para Fotos
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
