-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000008_stage8_inspection_comparisons.sql
-- ==============================================================================
-- ETAPA 08: Motor de Comparação Automática de Vistoria de Entrada × Saída
-- ==============================================================================

-- 1. ENUMS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_status') THEN
        CREATE TYPE public.comparison_status AS ENUM (
            'DRAFT',
            'PROCESSING',
            'READY_FOR_REVIEW',
            'REVIEWED',
            'FINALIZED',
            'FAILED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_change_type') THEN
        CREATE TYPE public.comparison_change_type AS ENUM (
            'UNCHANGED',
            'CONDITION_IMPROVED',
            'CONDITION_WORSENED',
            'DESCRIPTION_CHANGED',
            'REPAIR_ADDED',
            'REPAIR_REMOVED',
            'ITEM_ADDED',
            'ITEM_REMOVED',
            'ROOM_ADDED',
            'ROOM_REMOVED',
            'POSSIBLE_CHANGE',
            'MANUAL_REVIEW_REQUIRED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_match_method') THEN
        CREATE TYPE public.comparison_match_method AS ENUM (
            'EXACT_NAME',
            'NORMALIZED_NAME',
            'MANUAL',
            'UNMATCHED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_review_status') THEN
        CREATE TYPE public.comparison_review_status AS ENUM (
            'PENDING',
            'CONFIRMED',
            'DISMISSED',
            'EDITED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comparison_event_type') THEN
        CREATE TYPE public.comparison_event_type AS ENUM (
            'COMPARISON_CREATED',
            'COMPARISON_PROCESSED',
            'ITEM_MATCHED_MANUALLY',
            'CHANGE_CONFIRMED',
            'CHANGE_DISMISSED',
            'COMPARISON_FINALIZED',
            'COMPARISON_REOPENED'
        );
    END IF;
END $$;

-- 2. TABELA: public.inspection_comparisons (Comparações Entrada × Saída)
CREATE TABLE IF NOT EXISTS public.inspection_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL,
    check_in_inspection_id UUID NOT NULL,
    check_out_inspection_id UUID NOT NULL,
    status public.comparison_status NOT NULL DEFAULT 'PROCESSING',
    version INT NOT NULL DEFAULT 1,
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    snapshot_json JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reopened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reopened_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Garantia de integridade do tenant com foreign keys compostas
    CONSTRAINT fk_insp_comp_checkin 
        FOREIGN KEY (check_in_inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_insp_comp_checkout 
        FOREIGN KEY (check_out_inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_insp_comp_property 
        FOREIGN KEY (property_id, company_id) 
        REFERENCES public.properties(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_inspection_comparisons_pair 
        UNIQUE (check_in_inspection_id, check_out_inspection_id, version)
);

CREATE INDEX IF NOT EXISTS idx_insp_comp_property_id ON public.inspection_comparisons(property_id);
CREATE INDEX IF NOT EXISTS idx_insp_comp_company_id ON public.inspection_comparisons(company_id);
CREATE INDEX IF NOT EXISTS idx_insp_comp_checkin ON public.inspection_comparisons(check_in_inspection_id);
CREATE INDEX IF NOT EXISTS idx_insp_comp_checkout ON public.inspection_comparisons(check_out_inspection_id);

-- 3. TABELA: public.inspection_comparison_items (Itens e Ambientes Comparados)
CREATE TABLE IF NOT EXISTS public.inspection_comparison_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    comparison_id UUID NOT NULL REFERENCES public.inspection_comparisons(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    check_in_room_id UUID,
    check_out_room_id UUID,
    check_in_item_id UUID,
    check_out_item_id UUID,
    match_method public.comparison_match_method NOT NULL DEFAULT 'EXACT_NAME',
    manual_match BOOLEAN NOT NULL DEFAULT FALSE,
    change_type public.comparison_change_type NOT NULL DEFAULT 'UNCHANGED',
    previous_condition TEXT,
    current_condition TEXT,
    previous_requires_repair BOOLEAN NOT NULL DEFAULT FALSE,
    current_requires_repair BOOLEAN NOT NULL DEFAULT FALSE,
    previous_description TEXT,
    current_description TEXT,
    ai_summary TEXT,
    ai_uncertainty BOOLEAN NOT NULL DEFAULT FALSE,
    review_status public.comparison_review_status NOT NULL DEFAULT 'PENDING',
    reviewer_notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_items_comparison_id ON public.inspection_comparison_items(comparison_id);
CREATE INDEX IF NOT EXISTS idx_comp_items_company_id ON public.inspection_comparison_items(company_id);
CREATE INDEX IF NOT EXISTS idx_comp_items_change_type ON public.inspection_comparison_items(change_type);

-- 4. TABELA: public.inspection_comparison_events (Trilha de Auditoria)
CREATE TABLE IF NOT EXISTS public.inspection_comparison_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    comparison_id UUID NOT NULL REFERENCES public.inspection_comparisons(id) ON DELETE CASCADE,
    event_type public.comparison_event_type NOT NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_events_comparison_id ON public.inspection_comparison_events(comparison_id);

-- 5. POLÍTICAS RLS (Row Level Security)
ALTER TABLE public.inspection_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_comparison_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_comparison_events ENABLE ROW LEVEL SECURITY;

-- 5.1 Políticas para public.inspection_comparisons
DROP POLICY IF EXISTS "inspection_comparisons_select_policy" ON public.inspection_comparisons;
DROP POLICY IF EXISTS "inspection_comparisons_insert_policy" ON public.inspection_comparisons;
DROP POLICY IF EXISTS "inspection_comparisons_update_policy" ON public.inspection_comparisons;
DROP POLICY IF EXISTS "inspection_comparisons_delete_policy" ON public.inspection_comparisons;

CREATE POLICY "inspection_comparisons_select_policy"
    ON public.inspection_comparisons
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "inspection_comparisons_insert_policy"
    ON public.inspection_comparisons
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.current_user_role())::text <> 'ROLE_VIEWER'
            )
        )
    );

CREATE POLICY "inspection_comparisons_update_policy"
    ON public.inspection_comparisons
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.current_user_role())::text <> 'ROLE_VIEWER'
            )
        )
    )
    WITH CHECK (
        company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "inspection_comparisons_delete_policy"
    ON public.inspection_comparisons
    FOR DELETE
    TO authenticated
    USING (false);

-- 5.2 Políticas para public.inspection_comparison_items
DROP POLICY IF EXISTS "inspection_comp_items_select_policy" ON public.inspection_comparison_items;
DROP POLICY IF EXISTS "inspection_comp_items_insert_policy" ON public.inspection_comparison_items;
DROP POLICY IF EXISTS "inspection_comp_items_update_policy" ON public.inspection_comparison_items;
DROP POLICY IF EXISTS "inspection_comp_items_delete_policy" ON public.inspection_comparison_items;

CREATE POLICY "inspection_comp_items_select_policy"
    ON public.inspection_comparison_items
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "inspection_comp_items_insert_policy"
    ON public.inspection_comparison_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR company_id = (SELECT private.current_company_id())
        )
    );

CREATE POLICY "inspection_comp_items_update_policy"
    ON public.inspection_comparison_items
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.current_user_role())::text <> 'ROLE_VIEWER'
            )
        )
    )
    WITH CHECK (
        company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "inspection_comp_items_delete_policy"
    ON public.inspection_comparison_items
    FOR DELETE
    TO authenticated
    USING (false);

-- 5.3 Políticas para public.inspection_comparison_events
DROP POLICY IF EXISTS "inspection_comp_events_select_policy" ON public.inspection_comparison_events;
DROP POLICY IF EXISTS "inspection_comp_events_insert_policy" ON public.inspection_comparison_events;

CREATE POLICY "inspection_comp_events_select_policy"
    ON public.inspection_comparison_events
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "inspection_comp_events_insert_policy"
    ON public.inspection_comparison_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR company_id = (SELECT private.current_company_id())
        )
    );

-- 6. TRIGGERS DE SEGURANÇA E VALIDAÇÃO DE REGRAS

CREATE OR REPLACE FUNCTION private.trg_inspection_comparisons_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_in RECORD;
    v_out RECORD;
    v_user_role TEXT;
    v_user_can_operate BOOLEAN;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Validar usuário ativo
    SELECT active, role::text INTO v_user_can_operate, v_user_role 
    FROM public.profiles WHERE id = v_user_id;

    IF v_user_can_operate IS NOT TRUE THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.' USING ERRCODE = '42501';
    END IF;

    IF v_user_role = 'ROLE_VIEWER' THEN
        RAISE EXCEPTION 'Visualizadores (ROLE_VIEWER) não possuem permissão para criar comparações.' USING ERRCODE = '42501';
    END IF;

    -- 2. Buscar e validar Vistoria de Entrada
    SELECT * INTO v_in FROM public.inspections WHERE id = NEW.check_in_inspection_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vistoria de entrada não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    -- 3. Buscar e validar Vistoria de Saída
    SELECT * INTO v_out FROM public.inspections WHERE id = NEW.check_out_inspection_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vistoria de saída não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    -- 4. Validar que ambas pertencem ao mesmo imóvel
    IF v_in.property_id <> v_out.property_id THEN
        RAISE EXCEPTION 'Não é permitido comparar vistorias de imóveis diferentes (property_id incompatível).' USING ERRCODE = 'P0001';
    END IF;

    -- 5. Validar que ambas pertencem à mesma empresa (Zero Trust)
    IF v_in.company_id <> v_out.company_id THEN
        RAISE EXCEPTION 'Violação de isolamento multi-tenant: vistorias de empresas diferentes.' USING ERRCODE = '42501';
    END IF;

    NEW.company_id := v_in.company_id;
    NEW.property_id := v_in.property_id;

    -- 6. Validar tipos de vistoria (CHECK_IN vs CHECK_OUT)
    IF lower(v_in.inspection_type::text) NOT IN ('check_in', 'entrada') OR
       lower(v_out.inspection_type::text) NOT IN ('check_out', 'saida', 'saída') THEN
        RAISE EXCEPTION 'A comparação requer uma Vistoria de Entrada e uma Vistoria de Saída.' USING ERRCODE = 'P0001';
    END IF;

    -- 7. Validar que ambas estão finalizadas (status = 'COMPLETED')
    IF v_in.status <> 'COMPLETED' OR v_out.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'A comparação automática exige que ambas as vistorias estejam com status CONCLUÍDA (COMPLETED).' USING ERRCODE = 'P0001';
    END IF;

    NEW.created_by := v_user_id;
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_comparisons_before_insert ON public.inspection_comparisons;
CREATE TRIGGER trg_inspection_comparisons_before_insert
    BEFORE INSERT ON public.inspection_comparisons
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_comparisons_before_insert();

-- 7. TRIGGER DE IMUTABILIDADE DA COMPARAÇÃO FINALIZADA
CREATE OR REPLACE FUNCTION private.trg_inspection_comparisons_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status = 'FINALIZED' AND NEW.status = 'FINALIZED' THEN
        IF NEW.check_in_inspection_id <> OLD.check_in_inspection_id OR
           NEW.check_out_inspection_id <> OLD.check_out_inspection_id OR
           NEW.property_id <> OLD.property_id OR
           NEW.company_id <> OLD.company_id OR
           NEW.version <> OLD.version THEN
            RAISE EXCEPTION 'Uma comparação finalizada é estritamente imutável.' USING ERRCODE = '42501';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_comparisons_before_update ON public.inspection_comparisons;
CREATE TRIGGER trg_inspection_comparisons_before_update
    BEFORE UPDATE ON public.inspection_comparisons
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_comparisons_before_update();

-- 8. RPC PRINCIPAL: public.create_and_process_comparison
CREATE OR REPLACE FUNCTION public.create_and_process_comparison(
    p_check_in_inspection_id UUID,
    p_check_out_inspection_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_comp_id UUID;
    v_company_id UUID;
    v_property_id UUID;
    v_in_room RECORD;
    v_out_room RECORD;
    v_in_item RECORD;
    v_out_item RECORD;
    v_change_type public.comparison_change_type;
    v_match_method public.comparison_match_method;
    
    -- Contadores estatísticos
    v_total_rooms INT := 0;
    v_total_items INT := 0;
    v_unchanged INT := 0;
    v_worsened INT := 0;
    v_improved INT := 0;
    v_repairs_added INT := 0;
    v_repairs_removed INT := 0;
    v_items_added INT := 0;
    v_items_removed INT := 0;
    v_manual_review INT := 0;
BEGIN
    -- 1. Inserir a comparação (Trigger valida regras e permissões)
    INSERT INTO public.inspection_comparisons (
        check_in_inspection_id,
        check_out_inspection_id,
        status
    ) VALUES (
        p_check_in_inspection_id,
        p_check_out_inspection_id,
        'READY_FOR_REVIEW'::public.comparison_status
    ) RETURNING id, company_id, property_id INTO v_comp_id, v_company_id, v_property_id;

    -- 2. Processar Cômodos da Vistoria de Entrada
    FOR v_in_room IN 
        SELECT * FROM public.inspection_rooms 
        WHERE inspection_id = p_check_in_inspection_id 
        ORDER BY position
    LOOP
        v_total_rooms := v_total_rooms + 1;

        -- Tentar parear com cômodo de mesmo nome na Saída
        SELECT * INTO v_out_room 
        FROM public.inspection_rooms 
        WHERE inspection_id = p_check_out_inspection_id 
          AND lower(trim(name)) = lower(trim(v_in_room.name))
        LIMIT 1;

        IF FOUND THEN
            -- Cômodo Pareado: Comparar Itens
            FOR v_in_item IN 
                SELECT * FROM public.inspection_items 
                WHERE room_id = v_in_room.id 
                ORDER BY position
            LOOP
                v_total_items := v_total_items + 1;

                -- Buscar item correspondente no cômodo de saída
                SELECT * INTO v_out_item 
                FROM public.inspection_items 
                WHERE room_id = v_out_room.id 
                  AND lower(trim(name)) = lower(trim(v_in_item.name))
                LIMIT 1;

                IF FOUND THEN
                    v_match_method := 'EXACT_NAME'::public.comparison_match_method;

                    -- Determinar tipo de mudança
                    IF v_in_item.requires_repair IS NOT TRUE AND v_out_item.requires_repair IS TRUE THEN
                        v_change_type := 'REPAIR_ADDED'::public.comparison_change_type;
                        v_repairs_added := v_repairs_added + 1;
                    ELSIF v_in_item.requires_repair IS TRUE AND v_out_item.requires_repair IS NOT TRUE THEN
                        v_change_type := 'REPAIR_REMOVED'::public.comparison_change_type;
                        v_repairs_removed := v_repairs_removed + 1;
                    ELSIF v_in_item.condition_status <> v_out_item.condition_status THEN
                        -- Piora ou Melhora
                        IF (v_in_item.condition_status IN ('NEW', 'GOOD') AND v_out_item.condition_status IN ('REGULAR', 'BAD', 'DAMAGED')) OR
                           (v_in_item.condition_status = 'REGULAR' AND v_out_item.condition_status IN ('BAD', 'DAMAGED')) OR
                           (v_in_item.condition_status = 'BAD' AND v_out_item.condition_status = 'DAMAGED') THEN
                            v_change_type := 'CONDITION_WORSENED'::public.comparison_change_type;
                            v_worsened := v_worsened + 1;
                        ELSIF v_in_item.condition_status = 'NOT_APPLICABLE' OR v_out_item.condition_status = 'NOT_APPLICABLE' THEN
                            v_change_type := 'POSSIBLE_CHANGE'::public.comparison_change_type;
                        ELSE
                            v_change_type := 'CONDITION_IMPROVED'::public.comparison_change_type;
                            v_improved := v_improved + 1;
                        END IF;
                    ELSIF COALESCE(trim(v_in_item.description), '') <> COALESCE(trim(v_out_item.description), '') THEN
                        v_change_type := 'DESCRIPTION_CHANGED'::public.comparison_change_type;
                    ELSE
                        v_change_type := 'UNCHANGED'::public.comparison_change_type;
                        v_unchanged := v_unchanged + 1;
                    END IF;

                    -- Inserir item comparado
                    INSERT INTO public.inspection_comparison_items (
                        company_id,
                        comparison_id,
                        room_name,
                        item_name,
                        check_in_room_id,
                        check_out_room_id,
                        check_in_item_id,
                        check_out_item_id,
                        match_method,
                        change_type,
                        previous_condition,
                        current_condition,
                        previous_requires_repair,
                        current_requires_repair,
                        previous_description,
                        current_description
                    ) VALUES (
                        v_company_id,
                        v_comp_id,
                        v_in_room.name,
                        v_in_item.name,
                        v_in_room.id,
                        v_out_room.id,
                        v_in_item.id,
                        v_out_item.id,
                        v_match_method,
                        v_change_type,
                        v_in_item.condition_status,
                        v_out_item.condition_status,
                        COALESCE(v_in_item.requires_repair, false),
                        COALESCE(v_out_item.requires_repair, false),
                        v_in_item.description,
                        v_out_item.description
                    );
                ELSE
                    -- Item existia na Entrada mas não foi encontrado na Saída
                    v_items_removed := v_items_removed + 1;
                    INSERT INTO public.inspection_comparison_items (
                        company_id,
                        comparison_id,
                        room_name,
                        item_name,
                        check_in_room_id,
                        check_out_room_id,
                        check_in_item_id,
                        check_out_item_id,
                        match_method,
                        change_type,
                        previous_condition,
                        previous_requires_repair,
                        previous_description
                    ) VALUES (
                        v_company_id,
                        v_comp_id,
                        v_in_room.name,
                        v_in_item.name,
                        v_in_room.id,
                        v_out_room.id,
                        v_in_item.id,
                        NULL,
                        'UNMATCHED'::public.comparison_match_method,
                        'ITEM_REMOVED'::public.comparison_change_type,
                        v_in_item.condition_status,
                        COALESCE(v_in_item.requires_repair, false),
                        v_in_item.description
                    );
                END IF;
            END LOOP;

            -- Verificar itens novos criados na Saída dentro deste cômodo pareado
            FOR v_out_item IN 
                SELECT * FROM public.inspection_items 
                WHERE room_id = v_out_room.id 
                  AND lower(trim(name)) NOT IN (
                      SELECT lower(trim(name)) FROM public.inspection_items WHERE room_id = v_in_room.id
                  )
            LOOP
                v_total_items := v_total_items + 1;
                v_items_added := v_items_added + 1;

                INSERT INTO public.inspection_comparison_items (
                    company_id,
                    comparison_id,
                    room_name,
                    item_name,
                    check_in_room_id,
                    check_out_room_id,
                    check_in_item_id,
                    check_out_item_id,
                    match_method,
                    change_type,
                    current_condition,
                    current_requires_repair,
                    current_description
                ) VALUES (
                    v_company_id,
                    v_comp_id,
                    v_out_room.name,
                    v_out_item.name,
                    v_in_room.id,
                    v_out_room.id,
                    NULL,
                    v_out_item.id,
                    'UNMATCHED'::public.comparison_match_method,
                    'ITEM_ADDED'::public.comparison_change_type,
                    v_out_item.condition_status,
                    COALESCE(v_out_item.requires_repair, false),
                    v_out_item.description
                );
            END LOOP;

        ELSE
            -- Cômodo inteiro da entrada ausente na saída (ROOM_REMOVED)
            INSERT INTO public.inspection_comparison_items (
                company_id,
                comparison_id,
                room_name,
                item_name,
                check_in_room_id,
                match_method,
                change_type
            ) VALUES (
                v_company_id,
                v_comp_id,
                v_in_room.name,
                'Cômodo Geral',
                v_in_room.id,
                'UNMATCHED'::public.comparison_match_method,
                'ROOM_REMOVED'::public.comparison_change_type
            );
        END IF;
    END LOOP;

    -- Verificar cômodos adicionados na saída que não existiam na entrada (ROOM_ADDED)
    FOR v_out_room IN 
        SELECT * FROM public.inspection_rooms 
        WHERE inspection_id = p_check_out_inspection_id 
          AND lower(trim(name)) NOT IN (
              SELECT lower(trim(name)) FROM public.inspection_rooms WHERE inspection_id = p_check_in_inspection_id
          )
    LOOP
        INSERT INTO public.inspection_comparison_items (
            company_id,
            comparison_id,
            room_name,
            item_name,
            check_out_room_id,
            match_method,
            change_type
        ) VALUES (
            v_company_id,
            v_comp_id,
            v_out_room.name,
            'Cômodo Geral',
            v_out_room.id,
            'UNMATCHED'::public.comparison_match_method,
            'ROOM_ADDED'::public.comparison_change_type
        );
    END LOOP;

    -- 3. Atualizar resumo estruturado na comparação
    UPDATE public.inspection_comparisons
    SET summary_json = jsonb_build_object(
        'total_rooms', v_total_rooms,
        'total_items', v_total_items,
        'unchanged', v_unchanged,
        'worsened', v_worsened,
        'improved', v_improved,
        'repairs_added', v_repairs_added,
        'repairs_removed', v_repairs_removed,
        'items_added', v_items_added,
        'items_removed', v_items_removed,
        'manual_review_required', v_manual_review
    )
    WHERE id = v_comp_id;

    -- Registrar evento pericial
    INSERT INTO public.inspection_comparison_events (
        company_id,
        comparison_id,
        event_type,
        actor_user_id,
        metadata
    ) VALUES (
        v_company_id,
        v_comp_id,
        'COMPARISON_CREATED'::public.comparison_event_type,
        auth.uid(),
        jsonb_build_object('total_items', v_total_items, 'changes', (v_worsened + v_improved + v_repairs_added + v_items_added + v_items_removed))
    );

    RETURN jsonb_build_object(
        'success', true,
        'comparison_id', v_comp_id,
        'total_items', v_total_items,
        'status', 'READY_FOR_REVIEW'
    );
END;
$$;

-- 9. RPC: public.review_comparison_item (Revisão Pericial Humana)
CREATE OR REPLACE FUNCTION public.review_comparison_item(
    p_item_id UUID,
    p_review_status TEXT,
    p_reviewer_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_item RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem revisar itens.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_item FROM public.inspection_comparison_items WHERE id = p_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item de comparação não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.inspection_comparison_items
    SET review_status = p_review_status::public.comparison_review_status,
        reviewer_notes = COALESCE(p_reviewer_notes, reviewer_notes),
        reviewed_by = v_user_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_item_id;

    RETURN jsonb_build_object('success', true, 'item_id', p_item_id, 'review_status', p_review_status);
END;
$$;

-- 10. RPC: public.finalize_comparison (Finalização e Snapshot da Comparação)
CREATE OR REPLACE FUNCTION public.finalize_comparison(
    p_comparison_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_comp RECORD;
    v_pending_count INT;
    v_snapshot JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem finalizar comparações.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_comp FROM public.inspection_comparisons WHERE id = p_comparison_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comparação não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    -- Montar snapshot pericial imutável contendo todos os dados e itens comparados
    SELECT jsonb_build_object(
        'comparison_id', v_comp.id,
        'property_id', v_comp.property_id,
        'check_in_id', v_comp.check_in_inspection_id,
        'check_out_id', v_comp.check_out_inspection_id,
        'finalized_at', NOW(),
        'finalized_by', v_user_id,
        'summary', v_comp.summary_json,
        'items', (
            SELECT jsonb_agg(to_jsonb(i)) 
            FROM public.inspection_comparison_items i 
            WHERE i.comparison_id = v_comp.id
        )
    ) INTO v_snapshot;

    UPDATE public.inspection_comparisons
    SET status = 'FINALIZED'::public.comparison_status,
        snapshot_json = v_snapshot,
        reviewed_by = v_user_id,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_comparison_id;

    -- Registrar evento pericial
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
        v_comp.summary_json
    );

    RETURN jsonb_build_object('success', true, 'status', 'FINALIZED', 'completed_at', NOW());
END;
$$;

-- 11. RPC: public.reopen_comparison (Reabertura Exclusiva por Gerente)
CREATE OR REPLACE FUNCTION public.reopen_comparison(
    p_comparison_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_comp RECORD;
    v_user_role TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem reabrir comparações.' USING ERRCODE = '42501';
    END IF;

    SELECT role::text INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role <> 'ROLE_MANAGER' AND (SELECT private.is_super_admin()) IS NOT TRUE THEN
        RAISE EXCEPTION 'Apenas o Gerente Operacional (ROLE_MANAGER) pode reabrir uma comparação finalizada.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_comp FROM public.inspection_comparisons WHERE id = p_comparison_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Comparação não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.inspection_comparisons
    SET status = 'READY_FOR_REVIEW'::public.comparison_status,
        reopened_by = v_user_id,
        reopened_at = NOW(),
        updated_at = NOW()
    WHERE id = p_comparison_id;

    INSERT INTO public.inspection_comparison_events (
        company_id,
        comparison_id,
        event_type,
        actor_user_id
    ) VALUES (
        v_comp.company_id,
        v_comp.id,
        'COMPARISON_REOPENED'::public.comparison_event_type,
        v_user_id
    );

    RETURN jsonb_build_object('success', true, 'status', 'READY_FOR_REVIEW', 'reopened_at', NOW());
END;
$$;
