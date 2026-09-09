-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000015_auto_healing_login_yzzy_identity.sql
-- ==============================================================================
-- Auto-healing determinístico para identidade do Super Admin e resolução resiliente
-- ==============================================================================

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
    v_super_admin_id UUID;
    v_super_admin_email TEXT;
BEGIN
    v_clean_alias := LOWER(TRIM(p_login_alias));

    -- AUTO-HEALING: Se for o login do Super Admin (admin@yzzy.yzzy) e não existir mapeamento em private.user_auth_identities
    IF v_clean_alias = 'admin@yzzy.yzzy' AND NOT EXISTS (
        SELECT 1 FROM private.user_auth_identities WHERE LOWER(login_alias) = 'admin@yzzy.yzzy'
    ) THEN
        -- Localizar o Super Admin em public.profiles
        SELECT p.id, u.email INTO v_super_admin_id, v_super_admin_email
        FROM public.profiles p
        JOIN auth.users u ON u.id = p.id
        WHERE p.role = 'ROLE_SUPER_ADMIN'
        LIMIT 1;

        IF v_super_admin_id IS NOT NULL THEN
            -- Inserir/Auto-reparar o vínculo na tabela privada
            INSERT INTO private.user_auth_identities (
                user_id,
                company_id,
                login_alias,
                auth_email
            ) VALUES (
                v_super_admin_id,
                NULL,
                'admin@yzzy.yzzy',
                v_super_admin_email
            )
            ON CONFLICT (login_alias) DO UPDATE
            SET user_id = EXCLUDED.user_id,
                auth_email = EXCLUDED.auth_email,
                updated_at = NOW();
        END IF;
    END IF;

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
