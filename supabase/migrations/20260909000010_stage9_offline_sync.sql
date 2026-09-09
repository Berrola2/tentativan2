-- ==============================================================================
-- VISTORIA YZZY — ETAPA 09: MOTOR DE SINCRONIZAÇÃO OFFLINE E IDEMPOTÊNCIA
-- ==============================================================================

-- 1. TABELA DE SESSÕES DE SINCRONIZAÇÃO (OBSERVABILIDADE E TELEMETRIA)
CREATE TABLE IF NOT EXISTS public.sync_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    device_instance_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    operations_sent INT DEFAULT 0,
    operations_success INT DEFAULT 0,
    operations_failed INT DEFAULT 0,
    conflicts INT DEFAULT 0,
    sync_protocol_version TEXT DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE LOGS DE OPERAÇÕES PARA IDEMPOTÊNCIA (ZERO DUPLICAÇÃO)
CREATE TABLE IF NOT EXISTS public.sync_operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    operation_id UUID NOT NULL,
    entity_type TEXT NOT NULL, -- 'ROOM', 'ITEM', 'MEDIA'
    entity_id UUID NOT NULL,
    operation_type TEXT NOT NULL, -- 'CREATE_ROOM', 'UPDATE_ROOM', 'CREATE_ITEM', etc.
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID NOT NULL,
    device_instance_id UUID NOT NULL,
    result_status TEXT NOT NULL, -- 'APPLIED', 'ALREADY_APPLIED', 'CONFLICT', 'REJECTED'
    CONSTRAINT unq_sync_operation_per_company UNIQUE (operation_id, company_id)
);

-- Habilitar RLS
ALTER TABLE public.sync_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_operation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS sync_sessions_tenant_policy ON public.sync_sessions;
CREATE POLICY sync_sessions_tenant_policy ON public.sync_sessions
    FOR ALL
    TO authenticated
    USING (company_id = private.current_company_id())
    WITH CHECK (company_id = private.current_company_id());

DROP POLICY IF EXISTS sync_operation_logs_tenant_policy ON public.sync_operation_logs;
CREATE POLICY sync_operation_logs_tenant_policy ON public.sync_operation_logs
    FOR ALL
    TO authenticated
    USING (company_id = private.current_company_id())
    WITH CHECK (company_id = private.current_company_id());

-- 3. RPC DE SINCRONIZAÇÃO EM LOTE: public.sync_inspection_operations
CREATE OR REPLACE FUNCTION public.sync_inspection_operations(
    p_sync_session_id UUID,
    p_device_instance_id UUID,
    p_operations JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_company_id UUID;
    v_user_role TEXT;
    v_results JSONB := '[]'::JSONB;
    v_op JSONB;
    v_op_id UUID;
    v_entity_type TEXT;
    v_entity_id UUID;
    v_op_type TEXT;
    v_payload JSONB;
    v_base_updated_at TIMESTAMPTZ;
    v_inspection_id UUID;
    v_insp RECORD;
    v_room RECORD;
    v_item RECORD;
    v_media RECORD;
    v_already_logged RECORD;
    v_success_count INT := 0;
    v_fail_count INT := 0;
    v_conflict_count INT := 0;
BEGIN
    -- 1. Validações de Contexto e Segurança
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    v_company_id := private.current_company_id();
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Empresa inativa ou usuário desvinculado.' USING ERRCODE = '42501';
    END IF;

    v_user_role := private.current_user_role();
    IF v_user_role NOT IN ('ROLE_MANAGER', 'ROLE_INSPECTOR') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil de visualizador não pode sincronizar alterações.' USING ERRCODE = '42501';
    END IF;

    -- 2. Processar cada operação do lote
    FOR v_op IN SELECT * FROM jsonb_array_elements(p_operations)
    LOOP
        v_op_id := (v_op->>'operation_id')::UUID;
        v_entity_type := v_op->>'entity_type';
        v_entity_id := (v_op->>'entity_id')::UUID;
        v_op_type := v_op->>'operation_type';
        v_payload := v_op->'payload';
        v_base_updated_at := CASE WHEN v_op->>'base_updated_at' IS NOT NULL THEN (v_op->>'base_updated_at')::TIMESTAMPTZ ELSE NULL END;
        v_inspection_id := CASE WHEN v_payload->>'inspection_id' IS NOT NULL THEN (v_payload->>'inspection_id')::UUID ELSE NULL END;

        -- IDEMPOTÊNCIA: Verificar se a operação já foi aplicada
        SELECT * INTO v_already_logged 
        FROM public.sync_operation_logs 
        WHERE operation_id = v_op_id AND company_id = v_company_id;

        IF FOUND THEN
            v_results := v_results || jsonb_build_object(
                'operation_id', v_op_id,
                'status', 'ALREADY_APPLIED',
                'entity_id', v_entity_id,
                'message', 'Operação já processada anteriormente.'
            );
            v_success_count := v_success_count + 1;
            CONTINUE;
        END IF;

        -- VALIDAÇÃO DE STATUS DA VISTORIA
        IF v_inspection_id IS NOT NULL THEN
            SELECT * INTO v_insp FROM public.inspections WHERE id = v_inspection_id AND company_id = v_company_id;
            IF NOT FOUND THEN
                v_results := v_results || jsonb_build_object(
                    'operation_id', v_op_id,
                    'status', 'REJECTED',
                    'entity_id', v_entity_id,
                    'error', 'Vistoria não encontrada ou acesso revogado.'
                );
                v_fail_count := v_fail_count + 1;
                CONTINUE;
            END IF;

            IF v_insp.status = 'COMPLETED' THEN
                v_results := v_results || jsonb_build_object(
                    'operation_id', v_op_id,
                    'status', 'REJECTED',
                    'entity_id', v_entity_id,
                    'error', 'A vistoria foi finalizada no servidor. Alterações locais não foram aplicadas.'
                );
                v_fail_count := v_fail_count + 1;
                CONTINUE;
            END IF;
        END IF;

        -- EXECUÇÃO POR TIPO DE OPERAÇÃO
        BEGIN
            IF v_op_type = 'CREATE_ROOM' THEN
                INSERT INTO public.inspection_rooms (
                    id, company_id, inspection_id, name, room_type, position, notes
                ) VALUES (
                    v_entity_id,
                    v_company_id,
                    (v_payload->>'inspection_id')::UUID,
                    v_payload->>'name',
                    v_payload->>'room_type',
                    COALESCE((v_payload->>'position')::INT, 0),
                    v_payload->>'notes'
                ) ON CONFLICT (id) DO UPDATE 
                SET name = EXCLUDED.name, notes = EXCLUDED.notes, updated_at = NOW();

            ELSIF v_op_type = 'UPDATE_ROOM' THEN
                SELECT * INTO v_room FROM public.inspection_rooms WHERE id = v_entity_id AND company_id = v_company_id;
                IF FOUND THEN
                    -- Checagem Three-Way Conflict
                    IF v_base_updated_at IS NOT NULL AND v_room.updated_at > v_base_updated_at AND v_room.name <> (v_payload->>'name') THEN
                        v_results := v_results || jsonb_build_object(
                            'operation_id', v_op_id,
                            'status', 'CONFLICT',
                            'entity_id', v_entity_id,
                            'server_value', jsonb_build_object('name', v_room.name, 'notes', v_room.notes),
                            'error', 'Conflito de edição no ambiente.'
                        );
                        v_conflict_count := v_conflict_count + 1;
                        CONTINUE;
                    END IF;

                    UPDATE public.inspection_rooms 
                    SET name = COALESCE(v_payload->>'name', name),
                        notes = COALESCE(v_payload->>'notes', notes),
                        position = COALESCE((v_payload->>'position')::INT, position),
                        updated_at = NOW()
                    WHERE id = v_entity_id;
                END IF;

            ELSIF v_op_type = 'DELETE_ROOM' THEN
                DELETE FROM public.inspection_rooms WHERE id = v_entity_id AND company_id = v_company_id;

            ELSIF v_op_type = 'CREATE_ITEM' THEN
                INSERT INTO public.inspection_items (
                    id, company_id, inspection_id, room_id, name, item_type,
                    condition_status, description, requires_repair, repair_notes, position
                ) VALUES (
                    v_entity_id,
                    v_company_id,
                    (v_payload->>'inspection_id')::UUID,
                    (v_payload->>'room_id')::UUID,
                    v_payload->>'name',
                    v_payload->>'item_type',
                    COALESCE(v_payload->>'condition_status', 'GOOD')::public.item_condition,
                    v_payload->>'description',
                    COALESCE((v_payload->>'requires_repair')::BOOLEAN, false),
                    v_payload->>'repair_notes',
                    COALESCE((v_payload->>'position')::INT, 0)
                ) ON CONFLICT (id) DO UPDATE 
                SET description = EXCLUDED.description,
                    condition_status = EXCLUDED.condition_status,
                    requires_repair = EXCLUDED.requires_repair,
                    updated_at = NOW();

            ELSIF v_op_type = 'UPDATE_ITEM' THEN
                SELECT * INTO v_item FROM public.inspection_items WHERE id = v_entity_id AND company_id = v_company_id;
                IF FOUND THEN
                    -- Checagem Three-Way Conflict para Itens
                    IF v_base_updated_at IS NOT NULL AND v_item.updated_at > v_base_updated_at AND v_item.description <> (v_payload->>'description') THEN
                        v_results := v_results || jsonb_build_object(
                            'operation_id', v_op_id,
                            'status', 'CONFLICT',
                            'entity_id', v_entity_id,
                            'server_value', jsonb_build_object(
                                'description', v_item.description,
                                'condition_status', v_item.condition_status,
                                'requires_repair', v_item.requires_repair
                            ),
                            'error', 'Conflito de edição concorrente no item.'
                        );
                        v_conflict_count := v_conflict_count + 1;
                        CONTINUE;
                    END IF;

                    UPDATE public.inspection_items 
                    SET description = COALESCE(v_payload->>'description', description),
                        condition_status = CASE WHEN v_payload->>'condition_status' IS NOT NULL THEN (v_payload->>'condition_status')::public.item_condition ELSE condition_status END,
                        requires_repair = CASE WHEN v_payload->>'requires_repair' IS NOT NULL THEN (v_payload->>'requires_repair')::BOOLEAN ELSE requires_repair END,
                        repair_notes = COALESCE(v_payload->>'repair_notes', repair_notes),
                        name = COALESCE(v_payload->>'name', name),
                        updated_at = NOW()
                    WHERE id = v_entity_id;
                END IF;

            ELSIF v_op_type = 'DELETE_ITEM' THEN
                DELETE FROM public.inspection_items WHERE id = v_entity_id AND company_id = v_company_id;

            ELSIF v_op_type = 'CREATE_MEDIA' THEN
                INSERT INTO public.inspection_media (
                    id, company_id, inspection_id, room_id, item_id,
                    storage_path, media_type, caption, position
                ) VALUES (
                    v_entity_id,
                    v_company_id,
                    (v_payload->>'inspection_id')::UUID,
                    CASE WHEN v_payload->>'room_id' IS NOT NULL THEN (v_payload->>'room_id')::UUID ELSE NULL END,
                    CASE WHEN v_payload->>'item_id' IS NOT NULL THEN (v_payload->>'item_id')::UUID ELSE NULL END,
                    v_payload->>'storage_path',
                    COALESCE(v_payload->>'media_type', 'PHOTO')::public.media_type,
                    v_payload->>'caption',
                    COALESCE((v_payload->>'position')::INT, 0)
                ) ON CONFLICT (id) DO UPDATE 
                SET caption = EXCLUDED.caption, updated_at = NOW();

            ELSIF v_op_type = 'UPDATE_MEDIA_CAPTION' THEN
                UPDATE public.inspection_media 
                SET caption = v_payload->>'caption', updated_at = NOW()
                WHERE id = v_entity_id AND company_id = v_company_id;

            ELSIF v_op_type = 'DELETE_MEDIA' THEN
                DELETE FROM public.inspection_media WHERE id = v_entity_id AND company_id = v_company_id;

            END IF;

            -- Registrar no log de idempotência
            INSERT INTO public.sync_operation_logs (
                company_id, operation_id, entity_type, entity_id, operation_type,
                actor_user_id, device_instance_id, result_status
            ) VALUES (
                v_company_id, v_op_id, v_entity_type, v_entity_id, v_op_type,
                v_user_id, p_device_instance_id, 'APPLIED'
            );

            v_results := v_results || jsonb_build_object(
                'operation_id', v_op_id,
                'status', 'APPLIED',
                'entity_id', v_entity_id
            );
            v_success_count := v_success_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_results := v_results || jsonb_build_object(
                'operation_id', v_op_id,
                'status', 'FAILED',
                'entity_id', v_entity_id,
                'error', SQLERRM
            );
            v_fail_count := v_fail_count + 1;
        END;

    END LOOP;

    -- 3. Atualizar ou criar registro de sessão de sincronização
    IF p_sync_session_id IS NOT NULL THEN
        INSERT INTO public.sync_sessions (
            id, company_id, user_id, device_instance_id,
            operations_sent, operations_success, operations_failed, conflicts, finished_at
        ) VALUES (
            p_sync_session_id, v_company_id, v_user_id, p_device_instance_id,
            jsonb_array_length(p_operations), v_success_count, v_fail_count, v_conflict_count, NOW()
        ) ON CONFLICT (id) DO UPDATE 
        SET operations_sent = sync_sessions.operations_sent + jsonb_array_length(p_operations),
            operations_success = sync_sessions.operations_success + v_success_count,
            operations_failed = sync_sessions.operations_failed + v_fail_count,
            conflicts = sync_sessions.conflicts + v_conflict_count,
            finished_at = NOW();
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'total_processed', jsonb_array_length(p_operations),
        'success_count', v_success_count,
        'failed_count', v_fail_count,
        'conflict_count', v_conflict_count,
        'results', v_results
    );
END;
$$;
