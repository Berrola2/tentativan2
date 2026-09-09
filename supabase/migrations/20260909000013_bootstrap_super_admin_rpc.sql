-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000013_bootstrap_super_admin_rpc.sql
-- ==============================================================================
-- RPC administrativa segura de bootstrap para registrar identidades no schema private
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_bootstrap_super_admin_identity(
    p_user_id UUID,
    p_auth_email TEXT,
    p_login_alias TEXT DEFAULT 'admin@yzzy.yzzy'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_profile RECORD;
BEGIN
    -- 1. Validar que o user_id existe em public.profiles e é ROLE_SUPER_ADMIN
    SELECT id, role, active, company_id INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil não encontrado em public.profiles para o user_id fornecido.' USING ERRCODE = 'P0002';
    END IF;

    IF v_profile.role::text <> 'ROLE_SUPER_ADMIN' THEN
        RAISE EXCEPTION 'O usuário fornecido não possui o papel ROLE_SUPER_ADMIN.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validar formato do alias
    IF p_login_alias !~ '^[a-z0-9._-]+@[a-z0-9._-]+\.yzzy$' THEN
        RAISE EXCEPTION 'Formato de Login YZZY inválido para o alias informado.' USING ERRCODE = '22023';
    END IF;

    -- 3. Inserir na tabela private.user_auth_identities
    INSERT INTO private.user_auth_identities (
        user_id,
        company_id,
        login_alias,
        auth_email
    ) VALUES (
        p_user_id,
        NULL,
        p_login_alias,
        p_auth_email
    )
    ON CONFLICT (login_alias) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        auth_email = EXCLUDED.auth_email,
        updated_at = NOW();

    -- 4. Registrar evento de auditoria
    INSERT INTO public.security_audit_logs (company_id, user_id, event_type, metadata)
    VALUES (
        NULL,
        p_user_id,
        'SUPER_ADMIN_BOOTSTRAP_COMPLETED',
        jsonb_build_object('login_alias', p_login_alias, 'bootstrapped_at', NOW())
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'login_alias', p_login_alias,
        'message', 'Identidade do Super Admin registrada com sucesso no schema private.'
    );
END;
$$;

-- Restringir privilégios da RPC para que apenas service_role e postgres possam executar
REVOKE ALL ON FUNCTION public.admin_bootstrap_super_admin_identity(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_bootstrap_super_admin_identity(UUID, TEXT, TEXT) TO service_role;
