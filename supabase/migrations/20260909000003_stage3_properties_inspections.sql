-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000003_stage3_properties_inspections.sql
-- ==============================================================================
-- ETAPA 03: Motor de Imóveis e Vistorias (Imóveis, Vistorias, Ambientes e Itens)
-- ==============================================================================

-- 1. ENUMS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'property_type') THEN
        CREATE TYPE public.property_type AS ENUM (
            'HOUSE',
            'APARTMENT',
            'COMMERCIAL',
            'OFFICE',
            'LAND',
            'OTHER'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_type') THEN
        CREATE TYPE public.inspection_type AS ENUM (
            'CHECK_IN',
            'CHECK_OUT'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status') THEN
        CREATE TYPE public.inspection_status AS ENUM (
            'DRAFT',
            'IN_PROGRESS',
            'COMPLETED',
            'ARCHIVED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_condition') THEN
        CREATE TYPE public.item_condition AS ENUM (
            'NEW',
            'GOOD',
            'REGULAR',
            'BAD',
            'DAMAGED',
            'NOT_APPLICABLE'
        );
    END IF;
END $$;

-- 2. TABELA: public.properties (Imóveis)
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    internal_code TEXT,
    property_type public.property_type NOT NULL DEFAULT 'APARTMENT',
    street TEXT NOT NULL,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT,
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Garantir unicidade de id + company_id para foreign keys compostas anti-cross-tenant
    CONSTRAINT uq_properties_id_company UNIQUE (id, company_id)
);

-- Unicidade de código interno por empresa quando preenchido
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_company_internal_code 
    ON public.properties(company_id, lower(trim(internal_code))) 
    WHERE internal_code IS NOT NULL AND trim(internal_code) <> '';

CREATE INDEX IF NOT EXISTS idx_properties_company_id ON public.properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties(company_id, city);
CREATE INDEX IF NOT EXISTS idx_properties_active ON public.properties(company_id, active);

-- 3. TABELA: public.inspections (Vistorias)
CREATE TABLE IF NOT EXISTS public.inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    property_id UUID NOT NULL,
    inspection_type public.inspection_type NOT NULL DEFAULT 'CHECK_IN',
    status public.inspection_status NOT NULL DEFAULT 'DRAFT',
    title TEXT NOT NULL,
    inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scheduled_date DATE,
    inspector_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    reopened_at TIMESTAMPTZ,
    reopened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Foreign key composta que GARANTE que o imóvel pertence estritamente à mesma empresa
    CONSTRAINT fk_inspections_property_company 
        FOREIGN KEY (property_id, company_id) 
        REFERENCES public.properties(id, company_id) 
        ON DELETE RESTRICT,
    -- Garantir unicidade de id + company_id para as foreign keys de rooms
    CONSTRAINT uq_inspections_id_company UNIQUE (id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_inspections_company_id ON public.inspections(company_id);
CREATE INDEX IF NOT EXISTS idx_inspections_property_id ON public.inspections(property_id);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector_id ON public.inspections(inspector_id);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON public.inspections(company_id, status);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON public.inspections(company_id, inspection_date DESC);

-- 4. TABELA: public.inspection_rooms (Ambientes)
CREATE TABLE IF NOT EXISTS public.inspection_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    name TEXT NOT NULL,
    room_type TEXT,
    position INT NOT NULL DEFAULT 1,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Foreign key composta que GARANTE consistência com a vistoria e com o tenant
    CONSTRAINT fk_inspection_rooms_inspection_company 
        FOREIGN KEY (inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_inspection_rooms_id_insp_comp UNIQUE (id, inspection_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_inspection_rooms_inspection_id ON public.inspection_rooms(inspection_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_inspection_rooms_company_id ON public.inspection_rooms(company_id);

-- 5. TABELA: public.inspection_items (Itens do Ambiente)
CREATE TABLE IF NOT EXISTS public.inspection_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    room_id UUID NOT NULL,
    name TEXT NOT NULL,
    item_type TEXT,
    condition_status public.item_condition NOT NULL DEFAULT 'GOOD',
    description TEXT,
    requires_repair BOOLEAN NOT NULL DEFAULT FALSE,
    repair_notes TEXT,
    position INT NOT NULL DEFAULT 1,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Foreign key composta que GARANTE que o item pertence ao mesmo room, mesma inspection e mesma empresa
    CONSTRAINT fk_inspection_items_room_insp_comp 
        FOREIGN KEY (room_id, inspection_id, company_id) 
        REFERENCES public.inspection_rooms(id, inspection_id, company_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inspection_items_room_id ON public.inspection_items(room_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_inspection_items_inspection_id ON public.inspection_items(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_items_company_id ON public.inspection_items(company_id);

-- 6. TRIGGERS DE SEGURANÇA E DERIVAÇÃO DE TENANT / AUDITORIA SERVER-SIDE

-- 6.1 Trigger BEFORE INSERT para Properties
CREATE OR REPLACE FUNCTION private.trg_properties_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_company_id UUID;
    v_is_super BOOLEAN;
BEGIN
    v_is_super := (SELECT private.is_super_admin());
    v_user_company_id := (SELECT private.current_company_id());

    -- Se não for super admin, forçar company_id do contexto
    IF NOT v_is_super THEN
        IF v_user_company_id IS NULL THEN
            RAISE EXCEPTION 'Usuário não possui empresa ativa vinculada.';
        END IF;
        NEW.company_id := v_user_company_id;
    ELSIF NEW.company_id IS NULL THEN
        NEW.company_id := v_user_company_id;
    END IF;

    -- Validar capacidade operacional
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida: perfil inativo, empresa inativa ou troca de senha pendente.';
    END IF;

    NEW.created_by := (SELECT auth.uid());
    NEW.updated_by := (SELECT auth.uid());
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_bi ON public.properties;
CREATE TRIGGER trg_properties_bi
    BEFORE INSERT ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_properties_before_insert();

-- 6.2 Trigger BEFORE INSERT para Inspections
CREATE OR REPLACE FUNCTION private.trg_inspections_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_company_id UUID;
    v_is_super BOOLEAN;
BEGIN
    v_is_super := (SELECT private.is_super_admin());
    v_user_company_id := (SELECT private.current_company_id());

    IF NOT v_is_super THEN
        IF v_user_company_id IS NULL THEN
            RAISE EXCEPTION 'Usuário não possui empresa ativa vinculada.';
        END IF;
        NEW.company_id := v_user_company_id;
    ELSIF NEW.company_id IS NULL THEN
        NEW.company_id := v_user_company_id;
    END IF;

    -- Validar capacidade operacional
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida: perfil inativo, empresa inativa ou troca de senha pendente.';
    END IF;

    -- Se inspector_id não for informado, atribuir o criador se for inspector/manager
    IF NEW.inspector_id IS NULL THEN
        NEW.inspector_id := (SELECT auth.uid());
    END IF;

    NEW.created_by := (SELECT auth.uid());
    NEW.last_edited_by := (SELECT auth.uid());
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspections_bi ON public.inspections;
CREATE TRIGGER trg_inspections_bi
    BEFORE INSERT ON public.inspections
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspections_before_insert();

-- 6.3 Trigger BEFORE INSERT para Inspection Rooms
CREATE OR REPLACE FUNCTION private.trg_inspection_rooms_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_company_id UUID;
    v_is_super BOOLEAN;
    v_insp_company_id UUID;
    v_insp_status public.inspection_status;
BEGIN
    v_is_super := (SELECT private.is_super_admin());
    v_user_company_id := (SELECT private.current_company_id());

    -- Buscar dados da vistoria pai
    SELECT company_id, status INTO v_insp_company_id, v_insp_status
    FROM public.inspections
    WHERE id = NEW.inspection_id;

    IF v_insp_company_id IS NULL THEN
        RAISE EXCEPTION 'Vistoria pai inexistente.';
    END IF;

    IF NOT v_is_super AND v_insp_company_id <> v_user_company_id THEN
        RAISE EXCEPTION 'Não é permitido adicionar ambiente em vistoria de outra empresa.';
    END IF;

    IF v_insp_status = 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'Não é permitido alterar ambientes de uma vistoria já concluída.';
    END IF;

    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida.';
    END IF;

    NEW.company_id := v_insp_company_id;
    NEW.created_by := (SELECT auth.uid());
    NEW.updated_by := (SELECT auth.uid());
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_rooms_bi ON public.inspection_rooms;
CREATE TRIGGER trg_inspection_rooms_bi
    BEFORE INSERT ON public.inspection_rooms
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_rooms_before_insert();

-- 6.4 Trigger BEFORE INSERT para Inspection Items
CREATE OR REPLACE FUNCTION private.trg_inspection_items_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_company_id UUID;
    v_is_super BOOLEAN;
    v_room_comp_id UUID;
    v_room_insp_id UUID;
    v_insp_status public.inspection_status;
BEGIN
    v_is_super := (SELECT private.is_super_admin());
    v_user_company_id := (SELECT private.current_company_id());

    -- Buscar dados do room pai
    SELECT company_id, inspection_id INTO v_room_comp_id, v_room_insp_id
    FROM public.inspection_rooms
    WHERE id = NEW.room_id;

    IF v_room_comp_id IS NULL THEN
        RAISE EXCEPTION 'Ambiente inexistente.';
    END IF;

    IF NOT v_is_super AND v_room_comp_id <> v_user_company_id THEN
        RAISE EXCEPTION 'Não é permitido adicionar item em ambiente de outra empresa.';
    END IF;

    -- Validar se inspection_id bate com o room
    IF NEW.inspection_id IS NULL OR NEW.inspection_id <> v_room_insp_id THEN
        NEW.inspection_id := v_room_insp_id;
    END IF;

    SELECT status INTO v_insp_status
    FROM public.inspections
    WHERE id = NEW.inspection_id;

    IF v_insp_status = 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'Não é permitido alterar itens de uma vistoria já concluída.';
    END IF;

    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida.';
    END IF;

    NEW.company_id := v_room_comp_id;
    NEW.created_by := (SELECT auth.uid());
    NEW.updated_by := (SELECT auth.uid());
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_items_bi ON public.inspection_items;
CREATE TRIGGER trg_inspection_items_bi
    BEFORE INSERT ON public.inspection_items
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_items_before_insert();

-- 6.5 Triggers BEFORE UPDATE genéricas para carimbo de updated_at e updated_by
CREATE OR REPLACE FUNCTION private.trg_entity_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_by := (SELECT auth.uid());
    NEW.updated_at := NOW();
    -- Imutabilidade do company_id e id
    NEW.id := OLD.id;
    NEW.company_id := OLD.company_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_bu ON public.properties;
CREATE TRIGGER trg_properties_bu
    BEFORE UPDATE ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_entity_before_update();

DROP TRIGGER IF EXISTS trg_inspections_bu ON public.inspections;
CREATE TRIGGER trg_inspections_bu
    BEFORE UPDATE ON public.inspections
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_entity_before_update();

DROP TRIGGER IF EXISTS trg_inspection_rooms_bu ON public.inspection_rooms;
CREATE TRIGGER trg_inspection_rooms_bu
    BEFORE UPDATE ON public.inspection_rooms
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_entity_before_update();

DROP TRIGGER IF EXISTS trg_inspection_items_bu ON public.inspection_items;
CREATE TRIGGER trg_inspection_items_bu
    BEFORE UPDATE ON public.inspection_items
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_entity_before_update();

-- 7. FUNÇÕES DE TRANSIÇÃO DE ESTADO DE VISTORIA (RPCs)

-- 7.1 Finalizar Vistoria (COMPLETED)
CREATE OR REPLACE FUNCTION public.finalize_inspection(p_inspection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_user_role public.app_role;
    v_user_comp UUID;
    v_insp RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.';
    END IF;

    IF NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Usuário inativo ou com troca de senha pendente.';
    END IF;

    v_user_role := (SELECT private.current_user_role());
    v_user_comp := (SELECT private.current_company_id());

    SELECT * INTO v_insp FROM public.inspections WHERE id = p_inspection_id;

    IF v_insp IS NULL THEN
        RAISE EXCEPTION 'Vistoria não encontrada.';
    END IF;

    -- Validar isolamento de empresa
    IF v_user_role::text <> 'ROLE_SUPER_ADMIN' AND v_insp.company_id <> v_user_comp THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- Validar permissão de vistoriador
    IF v_user_role::text = 'ROLE_VIEWER' THEN
        RAISE EXCEPTION 'Visualizador não pode finalizar vistorias.';
    END IF;

    IF v_user_role::text = 'ROLE_INSPECTOR' AND v_insp.created_by <> v_user_id AND v_insp.inspector_id <> v_user_id THEN
        RAISE EXCEPTION 'Vistoriador só pode finalizar vistorias próprias ou a ele atribuídas.';
    END IF;

    IF v_insp.status = 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'A vistoria já está concluída.';
    END IF;

    UPDATE public.inspections
    SET status = 'COMPLETED'::public.inspection_status,
        completed_at = NOW(),
        last_edited_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_inspection_id;

    -- Auditoria
    INSERT INTO public.security_audit_logs (company_id, user_id, event_type, metadata)
    VALUES (
        v_insp.company_id,
        v_user_id,
        'INSPECTION_COMPLETED',
        jsonb_build_object('inspection_id', p_inspection_id, 'title', v_insp.title)
    );

    RETURN jsonb_build_object('success', true, 'status', 'COMPLETED', 'completed_at', NOW());
END;
$$;

-- 7.2 Reabrir Vistoria (Apenas ROLE_MANAGER ou SUPER_ADMIN)
CREATE OR REPLACE FUNCTION public.reopen_inspection(p_inspection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_user_role public.app_role;
    v_user_comp UUID;
    v_insp RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.';
    END IF;

    IF NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Usuário inativo ou com troca de senha pendente.';
    END IF;

    v_user_role := (SELECT private.current_user_role());
    v_user_comp := (SELECT private.current_company_id());

    -- Somente Gerente ou Super Admin pode reabrir
    IF v_user_role::text NOT IN ('ROLE_MANAGER', 'ROLE_SUPER_ADMIN') THEN
        RAISE EXCEPTION 'Apenas Gerentes podem reabrir uma vistoria concluída.';
    END IF;

    SELECT * INTO v_insp FROM public.inspections WHERE id = p_inspection_id;

    IF v_insp IS NULL THEN
        RAISE EXCEPTION 'Vistoria não encontrada.';
    END IF;

    IF v_user_role::text <> 'ROLE_SUPER_ADMIN' AND v_insp.company_id <> v_user_comp THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    UPDATE public.inspections
    SET status = 'IN_PROGRESS'::public.inspection_status,
        reopened_at = NOW(),
        reopened_by = v_user_id,
        last_edited_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_inspection_id;

    -- Auditoria de negócio
    INSERT INTO public.security_audit_logs (company_id, user_id, event_type, metadata)
    VALUES (
        v_insp.company_id,
        v_user_id,
        'INSPECTION_REOPENED',
        jsonb_build_object('inspection_id', p_inspection_id, 'title', v_insp.title)
    );

    RETURN jsonb_build_object('success', true, 'status', 'IN_PROGRESS', 'reopened_at', NOW());
END;
$$;

-- 7.3 Arquivar Vistoria
CREATE OR REPLACE FUNCTION public.archive_inspection(p_inspection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := (SELECT auth.uid());
    v_user_role public.app_role;
    v_user_comp UUID;
    v_insp RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autenticado.';
    END IF;

    v_user_role := (SELECT private.current_user_role());
    v_user_comp := (SELECT private.current_company_id());

    IF v_user_role::text NOT IN ('ROLE_MANAGER', 'ROLE_SUPER_ADMIN') THEN
        RAISE EXCEPTION 'Apenas Gerentes podem arquivar vistorias.';
    END IF;

    SELECT * INTO v_insp FROM public.inspections WHERE id = p_inspection_id;

    IF v_insp IS NULL THEN
        RAISE EXCEPTION 'Vistoria não encontrada.';
    END IF;

    IF v_user_role::text <> 'ROLE_SUPER_ADMIN' AND v_insp.company_id <> v_user_comp THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    UPDATE public.inspections
    SET status = 'ARCHIVED'::public.inspection_status,
        last_edited_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_inspection_id;

    RETURN jsonb_build_object('success', true, 'status', 'ARCHIVED');
END;
$$;

-- Permissões de RPC
REVOKE ALL ON FUNCTION public.finalize_inspection(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reopen_inspection(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.archive_inspection(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.finalize_inspection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_inspection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_inspection(UUID) TO authenticated;

-- 8. ROW LEVEL SECURITY (RLS)

-- 8.1 RLS: public.properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "properties_select_policy" ON public.properties;
DROP POLICY IF EXISTS "properties_insert_policy" ON public.properties;
DROP POLICY IF EXISTS "properties_update_policy" ON public.properties;
DROP POLICY IF EXISTS "properties_delete_policy" ON public.properties;

CREATE POLICY "properties_select_policy"
    ON public.properties
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR (
            (SELECT private.current_user_role())::text IN ('ROLE_MANAGER', 'ROLE_INSPECTOR')
            AND company_id = (SELECT private.current_company_id())
        )
    );

CREATE POLICY "properties_insert_policy"
    ON public.properties
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.current_user_role())::text IN ('ROLE_MANAGER', 'ROLE_INSPECTOR')
                AND company_id = (SELECT private.current_company_id())
            )
        )
    );

CREATE POLICY "properties_update_policy"
    ON public.properties
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.current_user_role())::text IN ('ROLE_MANAGER', 'ROLE_INSPECTOR')
                AND company_id = (SELECT private.current_company_id())
            )
        )
    )
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.current_user_role())::text IN ('ROLE_MANAGER', 'ROLE_INSPECTOR')
                AND company_id = (SELECT private.current_company_id())
            )
        )
    );

-- 8.2 RLS: public.inspections
ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspections_select_policy" ON public.inspections;
DROP POLICY IF EXISTS "inspections_insert_policy" ON public.inspections;
DROP POLICY IF EXISTS "inspections_update_policy" ON public.inspections;

CREATE POLICY "inspections_select_policy"
    ON public.inspections
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR (
            (SELECT private.is_company_manager()) = TRUE
            AND company_id = (SELECT private.current_company_id())
        )
        OR (
            (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
            AND company_id = (SELECT private.current_company_id())
            AND (created_by = (SELECT auth.uid()) OR inspector_id = (SELECT auth.uid()))
        )
        OR (
            (SELECT private.current_user_role())::text = 'ROLE_VIEWER'
            AND company_id = (SELECT private.current_company_id())
            AND status = 'COMPLETED'::public.inspection_status
        )
    );

CREATE POLICY "inspections_insert_policy"
    ON public.inspections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.current_user_role())::text IN ('ROLE_MANAGER', 'ROLE_INSPECTOR')
                AND company_id = (SELECT private.current_company_id())
            )
        )
    );

CREATE POLICY "inspections_update_policy"
    ON public.inspections
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND (created_by = (SELECT auth.uid()) OR inspector_id = (SELECT auth.uid()))
                AND status <> 'COMPLETED'::public.inspection_status
            )
        )
    )
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND (created_by = (SELECT auth.uid()) OR inspector_id = (SELECT auth.uid()))
                AND status <> 'COMPLETED'::public.inspection_status
            )
        )
    );

-- 8.3 RLS: public.inspection_rooms
ALTER TABLE public.inspection_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_rooms_select_policy" ON public.inspection_rooms;
DROP POLICY IF EXISTS "inspection_rooms_insert_policy" ON public.inspection_rooms;
DROP POLICY IF EXISTS "inspection_rooms_update_policy" ON public.inspection_rooms;
DROP POLICY IF EXISTS "inspection_rooms_delete_policy" ON public.inspection_rooms;

CREATE POLICY "inspection_rooms_select_policy"
    ON public.inspection_rooms
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.inspections i
            WHERE i.id = inspection_rooms.inspection_id
        )
    );

CREATE POLICY "inspection_rooms_insert_policy"
    ON public.inspection_rooms
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_rooms.inspection_id
                      AND (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      AND i.status <> 'COMPLETED'::public.inspection_status
                )
            )
        )
    );

CREATE POLICY "inspection_rooms_update_policy"
    ON public.inspection_rooms
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_rooms.inspection_id
                      AND (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      AND i.status <> 'COMPLETED'::public.inspection_status
                )
            )
        )
    );

CREATE POLICY "inspection_rooms_delete_policy"
    ON public.inspection_rooms
    FOR DELETE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_rooms.inspection_id
                      AND (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      AND i.status <> 'COMPLETED'::public.inspection_status
                )
            )
        )
    );

-- 8.4 RLS: public.inspection_items
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_items_select_policy" ON public.inspection_items;
DROP POLICY IF EXISTS "inspection_items_insert_policy" ON public.inspection_items;
DROP POLICY IF EXISTS "inspection_items_update_policy" ON public.inspection_items;
DROP POLICY IF EXISTS "inspection_items_delete_policy" ON public.inspection_items;

CREATE POLICY "inspection_items_select_policy"
    ON public.inspection_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.inspections i
            WHERE i.id = inspection_items.inspection_id
        )
    );

CREATE POLICY "inspection_items_insert_policy"
    ON public.inspection_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_items.inspection_id
                      AND (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      AND i.status <> 'COMPLETED'::public.inspection_status
                )
            )
        )
    );

CREATE POLICY "inspection_items_update_policy"
    ON public.inspection_items
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_items.inspection_id
                      AND (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      AND i.status <> 'COMPLETED'::public.inspection_status
                )
            )
        )
    );

CREATE POLICY "inspection_items_delete_policy"
    ON public.inspection_items
    FOR DELETE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (SELECT private.is_company_manager()) = TRUE
                AND company_id = (SELECT private.current_company_id())
            )
            OR (
                (SELECT private.current_user_role())::text = 'ROLE_INSPECTOR'
                AND company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_items.inspection_id
                      AND (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      AND i.status <> 'COMPLETED'::public.inspection_status
                )
            )
        )
    );

-- 9. GRANTS
REVOKE ALL ON TABLE public.properties FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.inspections FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.inspection_rooms FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.inspection_items FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inspections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inspection_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inspection_items TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION DA ETAPA 03
-- ==============================================================================
