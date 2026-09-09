-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000016_readonly_identity_resolver_and_superadmin_repair.sql
-- ==============================================================================
-- 1. Reparo administrativo seguro da identidade do Super Admin em private.user_auth_identities
-- 2. Transformação da RPC resolve_login_yzzy_identity em função 100% READ-ONLY
-- ==============================================================================

-- 1. REPARO ADMINISTRATIVO: Inserir/Atualizar a identidade oficial do Super Admin existente
INSERT INTO private.user_auth_identities (
    user_id,
    company_id,
    login_alias,
    auth_email
)
SELECT 
    p.id AS user_id,
    NULL AS company_id,
    'admin@yzzy.yzzy' AS login_alias,
    u.email AS auth_email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'ROLE_SUPER_ADMIN'
ON CONFLICT (login_alias) DO UPDATE
SET user_id = EXCLUDED.user_id,
    auth_email = EXCLUDED.auth_email,
    updated_at = NOW();

-- 2. RESOLVER 100% READ-ONLY: Sem INSERT, sem UPDATE, sem mutação de confirmed_at
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

    RETURN QUERY
    SELECT 
        uai.user_id,
        u.email::TEXT AS auth_email,
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
    JOIN auth.users u ON u.id = uai.user_id
    LEFT JOIN public.companies c ON c.id = p.company_id
    WHERE LOWER(uai.login_alias) = v_clean_alias
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_login_yzzy_identity(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_yzzy_identity(TEXT) TO service_role, authenticated;
