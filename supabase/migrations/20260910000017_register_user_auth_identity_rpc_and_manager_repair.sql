-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260910000017_register_user_auth_identity_rpc_and_manager_repair.sql
-- ==============================================================================
-- 1. Reparo idempotente e seguro do primeiro gerente da empresa Tietê Imóveis
-- 2. Criação da RPC administrativa public.admin_register_user_auth_identity
-- ==============================================================================

-- 1. REPARO DA IDENTIDADE DO GERENTE DA TIETÊ IMÓVEIS
INSERT INTO private.user_auth_identities (
    user_id,
    company_id,
    login_alias,
    auth_email
)
SELECT 
    p.id AS user_id,
    p.company_id,
    'ricson.biella@tiete.yzzy' AS login_alias,
    u.email AS auth_email
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'tiete' 
  AND p.role = 'ROLE_MANAGER'
  AND (p.username = 'ricson.biella' OR p.first_name ILIKE '%ricson%' OR p.display_name ILIKE '%ricson%')
ON CONFLICT (login_alias) DO UPDATE
SET user_id = EXCLUDED.user_id,
    company_id = EXCLUDED.company_id,
    auth_email = EXCLUDED.auth_email,
    updated_at = NOW();

-- 2. RPC SEGURA DE REGISTRO DE IDENTIDADE NO SCHEMA PRIVATE
CREATE OR REPLACE FUNCTION public.admin_register_user_auth_identity(
    p_user_id UUID,
    p_company_id UUID,
    p_login_alias TEXT,
    p_auth_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
    v_clean_alias TEXT;
    v_profile RECORD;
    v_auth_user RECORD;
BEGIN
    v_clean_alias := LOWER(TRIM(p_login_alias));

    -- 2.1 Validar formato do alias
    IF v_clean_alias !~ '^[a-z0-9._-]+@[a-z0-9._-]+\.yzzy$' THEN
        RAISE EXCEPTION 'Formato de Login YZZY inválido: %', v_clean_alias USING ERRCODE = '22023';
    END IF;

    -- 2.2 Validar existência em auth.users
    SELECT id, email INTO v_auth_user
    FROM auth.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Usuário não encontrado em auth.users para o user_id fornecido.' USING ERRCODE = 'P0002';
    END IF;

    -- 2.3 Validar existência em public.profiles
    SELECT id, company_id, role, active INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil não encontrado em public.profiles para o user_id fornecido.' USING ERRCODE = 'P0002';
    END IF;

    -- 2.4 Inserir / atualizar de forma idempotente em private.user_auth_identities
    INSERT INTO private.user_auth_identities (
        user_id,
        company_id,
        login_alias,
        auth_email
    ) VALUES (
        p_user_id,
        p_company_id,
        v_clean_alias,
        COALESCE(p_auth_email, v_auth_user.email)
    )
    ON CONFLICT (login_alias) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        company_id = EXCLUDED.company_id,
        auth_email = EXCLUDED.auth_email,
        updated_at = NOW();

    -- 2.5 Registrar auditoria
    INSERT INTO public.security_audit_logs (company_id, user_id, event_type, metadata)
    VALUES (
        p_company_id,
        p_user_id,
        'USER_IDENTITY_REGISTERED',
        jsonb_build_object('login_alias', v_clean_alias, 'role', v_profile.role)
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'login_alias', v_clean_alias,
        'company_id', p_company_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_register_user_auth_identity(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_register_user_auth_identity(UUID, UUID, TEXT, TEXT) TO service_role;
