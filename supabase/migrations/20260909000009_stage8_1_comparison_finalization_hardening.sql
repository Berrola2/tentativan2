-- ==============================================================================
-- VISTORIA YZZY — ETAPA 08.1: HARDENING DA FINALIZAÇÃO DA COMPARAÇÃO
-- ==============================================================================
-- Objetivo: Garantir autoridade absoluta do backend contra finalização de
-- comparações que possuam QUALQUER item com review_status = 'PENDING' ou
-- change_type = 'MANUAL_REVIEW_REQUIRED' sem revisão humana.
-- ==============================================================================

-- 1. HARDENING DO TRIGGER: private.trg_inspection_comparisons_before_update
CREATE OR REPLACE FUNCTION private.trg_inspection_comparisons_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_curr_company_id UUID;
    v_user_role TEXT;
    v_pending_count INT;
BEGIN
    v_curr_company_id := private.current_company_id();
    v_user_role := private.current_user_role();

    -- Validação de Tenant
    IF v_curr_company_id IS NULL OR OLD.company_id <> v_curr_company_id THEN
        RAISE EXCEPTION 'Acesso negado: Comparação pertence a outra empresa.' USING ERRCODE = '42501';
    END IF;

    -- Impedir alteração de chaves estruturais
    IF NEW.company_id <> OLD.company_id THEN
        RAISE EXCEPTION 'Não é permitido transferir comparações entre empresas.' USING ERRCODE = '42501';
    END IF;
    IF NEW.property_id <> OLD.property_id THEN
        RAISE EXCEPTION 'Não é permitido alterar o imóvel da comparação.' USING ERRCODE = '42501';
    END IF;
    IF NEW.check_in_inspection_id <> OLD.check_in_inspection_id OR NEW.check_out_inspection_id <> OLD.check_out_inspection_id THEN
        RAISE EXCEPTION 'Não é permitido alterar as vistorias de origem da comparação.' USING ERRCODE = '42501';
    END IF;

    -- HARDENING: Se a comparação está sendo finalizada (status -> FINALIZED)
    IF NEW.status = 'FINALIZED'::public.comparison_status AND (OLD.status IS NULL OR OLD.status <> 'FINALIZED'::public.comparison_status) THEN
        
        -- Verificar se existem itens pendentes de revisão
        SELECT COUNT(*) INTO v_pending_count
        FROM public.inspection_comparison_items
        WHERE comparison_id = OLD.id
          AND review_status = 'PENDING'::public.comparison_review_status;

        IF v_pending_count > 0 THEN
            RAISE EXCEPTION 'Não é permitido finalizar uma comparação que possua itens com revisão pendente (% itens pendentes).', v_pending_count USING ERRCODE = '22023';
        END IF;

        -- Verificar permissão de finalização (ROLE_MANAGER ou ROLE_INSPECTOR)
        IF v_user_role NOT IN ('ROLE_MANAGER', 'ROLE_INSPECTOR') THEN
            RAISE EXCEPTION 'Apenas Gerentes e Vistoriadores podem finalizar comparações.' USING ERRCODE = '42501';
        END IF;

    END IF;

    -- Proteção de Imutabilidade para comparações já FINALIZADAS (a menos que seja reabertura formal por Gerente)
    IF OLD.status = 'FINALIZED'::public.comparison_status THEN
        IF NEW.status = 'FINALIZED'::public.comparison_status THEN
            IF NEW.summary_json <> OLD.summary_json OR
               NEW.snapshot_json <> OLD.snapshot_json OR
               NEW.property_id <> OLD.property_id OR
               NEW.company_id <> OLD.company_id OR
               NEW.version <> OLD.version THEN
                RAISE EXCEPTION 'Uma comparação finalizada é estritamente imutável.' USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

-- 2. HARDENING DA RPC: public.finalize_comparison
CREATE OR REPLACE FUNCTION public.finalize_comparison(
    p_comparison_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_company_id UUID;
    v_comp RECORD;
    v_pending_count INT;
    v_pending_manual_count INT;
    v_snapshot JSONB;
BEGIN
    -- 1. Autenticação e Contexto
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem finalizar comparações.' USING ERRCODE = '42501';
    END IF;

    v_company_id := private.current_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Empresa inativa ou usuário desvinculado.' USING ERRCODE = '42501';
    END IF;

    v_user_role := private.current_user_role();
    IF v_user_role NOT IN ('ROLE_MANAGER', 'ROLE_INSPECTOR') THEN
        RAISE EXCEPTION 'Apenas Gerentes e Vistoriadores possuem permissão para finalizar comparações.' USING ERRCODE = '42501';
    END IF;

    -- 2. Buscar Comparação
    SELECT * INTO v_comp 
    FROM public.inspection_comparisons 
    WHERE id = p_comparison_id 
      AND company_id = v_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comparação não encontrada ou acesso não autorizado.' USING ERRCODE = 'P0002';
    END IF;

    -- Impedir refinalização sem reabertura
    IF v_comp.status = 'FINALIZED'::public.comparison_status THEN
        RAISE EXCEPTION 'Esta comparação já se encontra finalizada.' USING ERRCODE = '22023';
    END IF;

    -- 3. HARDENING PERICIAL: Verificar se há QUALQUER item com status PENDING
    SELECT COUNT(*) INTO v_pending_count
    FROM public.inspection_comparison_items
    WHERE comparison_id = p_comparison_id
      AND review_status = 'PENDING'::public.comparison_review_status;

    IF v_pending_count > 0 THEN
        RAISE EXCEPTION 'Não é permitido finalizar a comparação. Existem % item(ns) pendente(s) de revisão pericial.', v_pending_count USING ERRCODE = '22023';
    END IF;

    -- 4. HARDENING PERICIAL: Verificar especificamente itens com MANUAL_REVIEW_REQUIRED
    SELECT COUNT(*) INTO v_pending_manual_count
    FROM public.inspection_comparison_items
    WHERE comparison_id = p_comparison_id
      AND change_type = 'MANUAL_REVIEW_REQUIRED'::public.comparison_change_type
      AND review_status = 'PENDING'::public.comparison_review_status;

    IF v_pending_manual_count > 0 THEN
        RAISE EXCEPTION 'Não é permitido finalizar a comparação. Existem % item(ns) com match ambíguo ou revisão manual obrigatória pendente.', v_pending_manual_count USING ERRCODE = '22023';
    END IF;

    -- 5. Montar snapshot pericial imutável congelado com todos os dados consolidados
    SELECT jsonb_build_object(
        'comparison_id', v_comp.id,
        'company_id', v_comp.company_id,
        'property_id', v_comp.property_id,
        'check_in_id', v_comp.check_in_inspection_id,
        'check_out_id', v_comp.check_out_inspection_id,
        'version', v_comp.version,
        'finalized_at', NOW(),
        'finalized_by', v_user_id,
        'summary', v_comp.summary_json,
        'items', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', i.id,
                    'room_name', i.room_name,
                    'item_name', i.item_name,
                    'match_method', i.match_method,
                    'manual_match', i.manual_match,
                    'change_type', i.change_type,
                    'previous_condition', i.previous_condition,
                    'current_condition', i.current_condition,
                    'previous_requires_repair', i.previous_requires_repair,
                    'current_requires_repair', i.current_requires_repair,
                    'previous_description', i.previous_description,
                    'current_description', i.current_description,
                    'ai_summary', i.ai_summary,
                    'review_status', i.review_status,
                    'reviewer_notes', i.reviewer_notes,
                    'reviewed_by', i.reviewed_by,
                    'reviewed_at', i.reviewed_at
                ) ORDER BY i.created_at ASC
            )
            FROM public.inspection_comparison_items i 
            WHERE i.comparison_id = v_comp.id
        )
    ) INTO v_snapshot;

    -- 6. Atualizar para status FINALIZED com snapshot
    UPDATE public.inspection_comparisons
    SET status = 'FINALIZED'::public.comparison_status,
        snapshot_json = v_snapshot,
        reviewed_by = v_user_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_comparison_id;

    -- 7. Registrar evento pericial na trilha de auditoria
    INSERT INTO public.inspection_comparison_events (
        company_id,
        comparison_id,
        event_type,
        actor_user_id,
        metadata
    ) VALUES (
        v_comp.company_id,
        v_comp.id,
        'COMPARISON_FINALIZED'::public.comparison_event_type,
        v_user_id,
        jsonb_build_object(
            'finalized_at', NOW(),
            'total_items', (v_comp.summary_json->>'total_items')::INT,
            'summary', v_comp.summary_json
        )
    );

    RETURN jsonb_build_object(
        'success', true, 
        'status', 'FINALIZED', 
        'completed_at', NOW(),
        'comparison_id', p_comparison_id
    );
END;
$$;
