-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260910000022_permanent_company_deletion_rpc.sql
-- ==============================================================================
-- 1. RPC de Exclusão Definitiva de Empresa (Hard Delete) com Múltiplas Barreiras de Segurança
-- 2. Funções de Consulta de Auditoria de Segurança para o Super Admin
-- ==============================================================================

-- 1. FUNÇÃO: admin_delete_company_permanently
CREATE OR REPLACE FUNCTION public.admin_delete_company_permanently(
    p_company_id UUID,
    p_confirmation_name TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth, pg_temp
AS $$
DECLARE
    v_caller_uid UUID;
    v_is_super_admin BOOLEAN;
    v_company RECORD;
    v_deleted_users_count INT := 0;
    v_user_ids UUID[];
BEGIN
    -- 1. Obter e validar autenticação do chamador
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validar que o chamador é ROLE_SUPER_ADMIN
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = v_caller_uid 
          AND role = 'ROLE_SUPER_ADMIN' 
          AND active = TRUE
    ) INTO v_is_super_admin;

    IF NOT v_is_super_admin THEN
        RAISE EXCEPTION 'Apenas Super Administradores podem excluir empresas permanentemente.' USING ERRCODE = '42501';
    END IF;

    -- 3. Validar parâmetros de entrada
    IF p_company_id IS NULL THEN
        RAISE EXCEPTION 'ID da empresa não informado.' USING ERRCODE = '22023';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'O motivo da exclusão definitiva é obrigatório.' USING ERRCODE = '22023';
    END IF;

    -- 4. Buscar a empresa alvo
    SELECT id, name, slug, active, trade_name, legal_name 
    INTO v_company
    FROM public.companies
    WHERE id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    -- 5. BARREIRA DE SEGURANÇA 1: A empresa precisa estar DESATIVADA
    IF v_company.active = TRUE THEN
        RAISE EXCEPTION 'A empresa precisa estar previamente desativada antes da exclusão permanente.' USING ERRCODE = '22000';
    END IF;

    -- 6. BARREIRA DE SEGURANÇA 2: Confirmação exata pelo nome da empresa
    IF trim(p_confirmation_name) <> trim(v_company.name) AND 
       trim(p_confirmation_name) <> COALESCE(trim(v_company.trade_name), '') THEN
        RAISE EXCEPTION 'O nome digitado para confirmação não corresponde ao nome da empresa.' USING ERRCODE = '22000';
    END IF;

    -- 7. Coletar IDs de usuários vinculados à empresa (EXCLUINDO QUALQUER SUPER ADMIN)
    SELECT array_agg(id) INTO v_user_ids
    FROM public.profiles
    WHERE company_id = p_company_id
      AND role <> 'ROLE_SUPER_ADMIN';

    IF v_user_ids IS NOT NULL THEN
        v_deleted_users_count := array_length(v_user_ids, 1);
    END IF;

    -- 8. REGISTRAR AUDITORIA PERMANENTE (Salva na tabela system_audit_logs que sobrevive à exclusão do tenant)
    INSERT INTO public.system_audit_logs (
        event_type,
        severity,
        actor_id,
        details
    ) VALUES (
        'DELETE_COMPANY_PERMANENTLY',
        'SEV-2',
        v_caller_uid,
        jsonb_build_object(
            'deleted_company_id', p_company_id,
            'company_name', v_company.name,
            'company_slug', v_company.slug,
            'reason', trim(p_reason),
            'deleted_users_count', v_deleted_users_count,
            'deleted_by', v_caller_uid,
            'deleted_at', NOW()
        )
    );

    -- 9. Excluir dados relacionados em cascata segura
    -- 9.1 Sincronização offline
    DELETE FROM public.sync_operation_logs WHERE session_id IN (SELECT id FROM public.sync_sessions WHERE company_id = p_company_id);
    DELETE FROM public.sync_sessions WHERE company_id = p_company_id;

    -- 9.2 Inteligência Artificial & Transcrições
    DELETE FROM public.ai_processing_logs WHERE company_id = p_company_id;
    DELETE FROM public.inspection_transcriptions WHERE company_id = p_company_id;

    -- 9.3 Comparações
    DELETE FROM public.inspection_comparison_events WHERE comparison_id IN (SELECT id FROM public.inspection_comparisons WHERE company_id = p_company_id);
    DELETE FROM public.inspection_comparison_items WHERE comparison_id IN (SELECT id FROM public.inspection_comparisons WHERE company_id = p_company_id);
    DELETE FROM public.inspection_comparisons WHERE company_id = p_company_id;

    -- 9.4 Documentos e Assinaturas
    DELETE FROM public.document_events WHERE document_id IN (SELECT id FROM public.inspection_documents WHERE company_id = p_company_id);
    DELETE FROM public.document_signature_requests WHERE document_id IN (SELECT id FROM public.inspection_documents WHERE company_id = p_company_id);
    DELETE FROM public.document_signatures WHERE document_id IN (SELECT id FROM public.inspection_documents WHERE company_id = p_company_id);
    DELETE FROM public.inspection_documents WHERE company_id = p_company_id;

    -- 9.5 Mídias, Itens, Cômodos e Vistorias
    DELETE FROM public.inspection_media WHERE company_id = p_company_id;
    DELETE FROM public.inspection_items WHERE inspection_id IN (SELECT id FROM public.inspections WHERE company_id = p_company_id);
    DELETE FROM public.inspection_rooms WHERE inspection_id IN (SELECT id FROM public.inspections WHERE company_id = p_company_id);
    DELETE FROM public.inspections WHERE company_id = p_company_id;

    -- 9.6 Imóveis
    DELETE FROM public.properties WHERE company_id = p_company_id;

    -- 9.7 Auditorias comerciais e segurança locais (já registradas no system_audit_logs)
    DELETE FROM public.commercial_audit_logs WHERE company_id = p_company_id;
    DELETE FROM public.security_audit_logs WHERE company_id = p_company_id;
    DELETE FROM public.lgpd_data_requests WHERE company_id = p_company_id;

    -- 9.8 Faturamento e Cobrança
    DELETE FROM public.billing_events WHERE company_id = p_company_id;
    DELETE FROM public.billing_invoices WHERE company_id = p_company_id;
    DELETE FROM public.billing_customers WHERE company_id = p_company_id;
    DELETE FROM public.usage_counters WHERE company_id = p_company_id;
    DELETE FROM public.company_entitlement_overrides WHERE company_id = p_company_id;
    DELETE FROM public.company_subscriptions WHERE company_id = p_company_id;

    -- 9.9 Identidades privadas de login
    DELETE FROM private.user_auth_identities WHERE company_id = p_company_id;

    -- 9.10 Perfis de usuários
    DELETE FROM public.profiles WHERE company_id = p_company_id;

    -- 9.11 Auth Users (Excluir usuários auth da empresa que não sejam Super Admin)
    IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
        DELETE FROM auth.users WHERE id = ANY(v_user_ids);
    END IF;

    -- 9.12 Excluir o registro principal da Empresa
    DELETE FROM public.companies WHERE id = p_company_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Empresa excluída permanentemente com sucesso.',
        'companyId', p_company_id,
        'companyName', v_company.name,
        'deletedUsersCount', v_deleted_users_count
    );
END;
$$;

-- Permissões de Execução
REVOKE ALL ON FUNCTION public.admin_delete_company_permanently(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_company_permanently(UUID, TEXT, TEXT) TO authenticated;

-- 2. FUNÇÃO: get_security_audit_logs
CREATE OR REPLACE FUNCTION public.get_security_audit_logs(p_limit INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_is_super_admin BOOLEAN;
    v_result JSONB;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role = 'ROLE_SUPER_ADMIN' 
          AND active = TRUE
    ) INTO v_is_super_admin;

    IF NOT v_is_super_admin THEN
        RAISE EXCEPTION 'Acesso restrito ao Super Administrador.' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_agg(r) INTO v_result
    FROM (
        SELECT 
            sal.id,
            sal.company_id,
            c.name as company_name,
            c.slug as company_slug,
            sal.user_id,
            p.full_name as user_full_name,
            p.username as user_username,
            sal.event_type,
            sal.ip_address,
            sal.metadata,
            sal.created_at
        FROM public.security_audit_logs sal
        LEFT JOIN public.companies c ON c.id = sal.company_id
        LEFT JOIN public.profiles p ON p.id = sal.user_id
        ORDER BY sal.created_at DESC
        LIMIT LEAST(p_limit, 500)
    ) r;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_security_audit_logs(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_security_audit_logs(INT) TO authenticated;

-- 3. FUNÇÃO: get_system_audit_logs
CREATE OR REPLACE FUNCTION public.get_system_audit_logs(p_limit INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_is_super_admin BOOLEAN;
    v_result JSONB;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role = 'ROLE_SUPER_ADMIN' 
          AND active = TRUE
    ) INTO v_is_super_admin;

    IF NOT v_is_super_admin THEN
        RAISE EXCEPTION 'Acesso restrito ao Super Administrador.' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_agg(r) INTO v_result
    FROM (
        SELECT 
            syl.id,
            syl.event_type,
            syl.severity,
            syl.actor_id,
            p.full_name as actor_name,
            p.username as actor_username,
            syl.details,
            syl.created_at
        FROM public.system_audit_logs syl
        LEFT JOIN public.profiles p ON p.id = syl.actor_id
        ORDER BY syl.created_at DESC
        LIMIT LEAST(p_limit, 500)
    ) r;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_system_audit_logs(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_audit_logs(INT) TO authenticated;
