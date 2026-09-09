-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000014_login_yzzy_identity_resolution.sql
-- ==============================================================================
-- Resolução atômica de identidade Login YZZY e diagnóstico seguro de autenticação
-- ==============================================================================

-- 1. Função segura para resolver identidade Login YZZY e obter o auth_email real de auth.users
CREATE OR REPLACE FUNCTION public.resolve_login_yzzy_identity(p_login_alias TEXT)
RETURNS TABLE (
    user_id UUID,
    auth_email TEXT,
    company_id UUID,
    company_name TEXT,
    company_slug TEXT,
    company_active BOOLEAN,
    username TEXT,
    full_name TEXT,
    display_name TEXT,
    role TEXT,
    active BOOLEAN,
    must_change_password BOOLEAN,
    email_confirmed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
    v_clean_alias TEXT;
BEGIN
    v_clean_alias := LOWER(TRIM(p_login_alias));

    -- Auto-confirmação segura caso email_confirmed_at esteja nulo para usuário com identidade cadastrada
    UPDATE auth.users u
    SET email_confirmed_at = NOW(),
        confirmed_at = NOW(),
        updated_at = NOW()
    FROM private.user_auth_identities uai
    WHERE u.id = uai.user_id
      AND LOWER(uai.login_alias) = v_clean_alias
      AND u.email_confirmed_at IS NULL;

    RETURN QUERY
    SELECT 
        uai.user_id,
        COALESCE(u.email, uai.auth_email)::TEXT AS auth_email,
        p.company_id,
        c.name::TEXT AS company_name,
        c.slug::TEXT AS company_slug,
        COALESCE(c.active, true) AS company_active,
        p.username::TEXT,
        p.full_name::TEXT,
        COALESCE(p.display_name, p.full_name)::TEXT AS display_name,
        p.role::TEXT,
        p.active,
        p.must_change_password,
        (u.email_confirmed_at IS NOT NULL) AS email_confirmed
    FROM private.user_auth_identities uai
    JOIN public.profiles p ON p.id = uai.user_id
    LEFT JOIN public.companies c ON c.id = p.company_id
    LEFT JOIN auth.users u ON u.id = uai.user_id
    WHERE LOWER(uai.login_alias) = v_clean_alias
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_yzzy_identity(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_yzzy_identity(TEXT) TO service_role, authenticated;

-- 2. Função segura de diagnóstico do Super Admin (somente acessível por service_role)
CREATE OR REPLACE FUNCTION public.admin_diagnose_super_admin()
RETURNS TABLE (
    profile_id UUID,
    auth_user_id UUID,
    identity_user_id UUID,
    role TEXT,
    company_id UUID,
    profile_active BOOLEAN,
    must_change_password BOOLEAN,
    login_alias TEXT,
    identity_auth_email TEXT,
    auth_users_email TEXT,
    is_email_confirmed BOOLEAN,
    is_banned BOOLEAN,
    is_link_consistent BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS profile_id,
        u.id AS auth_user_id,
        uai.user_id AS identity_user_id,
        p.role::TEXT,
        p.company_id,
        p.active AS profile_active,
        p.must_change_password,
        uai.login_alias,
        uai.auth_email AS identity_auth_email,
        u.email::TEXT AS auth_users_email,
        (u.email_confirmed_at IS NOT NULL) AS is_email_confirmed,
        (u.banned_until IS NOT NULL AND u.banned_until > NOW()) AS is_banned,
        (p.id = u.id AND p.id = uai.user_id AND uai.auth_email = u.email) AS is_link_consistent
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    LEFT JOIN private.user_auth_identities uai ON uai.user_id = p.id
    WHERE p.role = 'ROLE_SUPER_ADMIN'
    LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_diagnose_super_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_diagnose_super_admin() TO service_role;
