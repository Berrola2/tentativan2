-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260910000018_operational_readiness_and_duplicate_checkin_guard.sql
-- ==============================================================================
-- 1. Soft deactivation de empresas e perfis com campos de auditoria
-- 2. Trigger de proteção transacional contra vistoria de entrada duplicada
-- 3. RPC utilitária para verificação de ciclo de vistoria ativo
-- ==============================================================================

-- 1. ADICIONAR CAMPOS DE DESATIVAÇÃO EM COMPANIES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'deactivated_at') THEN
        ALTER TABLE public.companies ADD COLUMN deactivated_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'deactivated_by') THEN
        ALTER TABLE public.companies ADD COLUMN deactivated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'deactivation_reason') THEN
        ALTER TABLE public.companies ADD COLUMN deactivation_reason TEXT;
    END IF;
END $$;

-- 2. ADICIONAR CAMPOS DE DESATIVAÇÃO EM PROFILES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'deactivated_at') THEN
        ALTER TABLE public.profiles ADD COLUMN deactivated_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'deactivated_by') THEN
        ALTER TABLE public.profiles ADD COLUMN deactivated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'deactivation_reason') THEN
        ALTER TABLE public.profiles ADD COLUMN deactivation_reason TEXT;
    END IF;
END $$;

-- 3. FUNÇÃO E TRIGGER: IMPEDIR VISTORIA DE ENTRADA DUPLICADA ATIVA NO MESMO IMÓVEL
CREATE OR REPLACE FUNCTION public.fn_prevent_duplicate_active_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_existing RECORD;
    v_inspector_name TEXT := 'Colaborador';
BEGIN
    -- Valida apenas para vistorias de ENTRADA (CHECK_IN) que não estejam arquivadas
    IF NEW.inspection_type = 'CHECK_IN' AND NEW.status <> 'ARCHIVED' THEN
        
        -- Localiza se já existe um CHECK_IN ativo para este imóvel no mesmo tenant
        SELECT 
            i.id,
            i.title,
            i.status::TEXT AS status_text,
            i.inspector_id,
            i.created_at,
            COALESCE(p.full_name, p.display_name, 'Colaborador')::TEXT AS inspector_name
        INTO v_existing
        FROM public.inspections i
        LEFT JOIN public.profiles p ON p.id = i.inspector_id
        WHERE i.company_id = NEW.company_id
          AND i.property_id = NEW.property_id
          AND i.inspection_type = 'CHECK_IN'
          AND i.status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED')
          AND i.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          -- Verifica se o ciclo anterior NÃO foi concluído por um CHECK_OUT posterior
          AND NOT EXISTS (
              SELECT 1 
              FROM public.inspections co
              WHERE co.company_id = NEW.company_id
                AND co.property_id = NEW.property_id
                AND co.inspection_type = 'CHECK_OUT'
                AND co.status = 'COMPLETED'
                AND co.created_at > i.created_at
          )
        ORDER BY i.created_at DESC
        LIMIT 1;

        IF v_existing.id IS NOT NULL THEN
            -- Registrar evento de bloqueio na auditoria de segurança
            INSERT INTO public.security_audit_logs (
                company_id,
                user_id,
                event_type,
                metadata
            ) VALUES (
                NEW.company_id,
                COALESCE(NEW.inspector_id, NEW.created_by),
                'DUPLICATE_CHECKIN_BLOCKED',
                jsonb_build_object(
                    'property_id', NEW.property_id,
                    'existing_inspection_id', v_existing.id,
                    'existing_inspector', v_existing.inspector_name,
                    'existing_status', v_existing.status_text
                )
            );

            RAISE EXCEPTION 'DUPLICATE_ACTIVE_CHECKIN: Já existe uma vistoria de entrada para este imóvel. Criada por: %, Status: %',
                v_existing.inspector_name,
                CASE 
                    WHEN v_existing.status_text = 'DRAFT' THEN 'Rascunho'
                    WHEN v_existing.status_text = 'IN_PROGRESS' THEN 'Em andamento'
                    WHEN v_existing.status_text = 'COMPLETED' THEN 'Concluída'
                    ELSE v_existing.status_text
                END
                USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_active_checkin ON public.inspections;
CREATE TRIGGER trg_prevent_duplicate_active_checkin
    BEFORE INSERT OR UPDATE OF property_id, inspection_type, status
    ON public.inspections
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_duplicate_active_checkin();

-- 4. RPC DE CONSULTA DE CICLO ATIVO: check_active_checkin
CREATE OR REPLACE FUNCTION public.check_active_checkin(p_property_id UUID)
RETURNS TABLE (
    has_active_checkin BOOLEAN,
    inspection_id UUID,
    title TEXT,
    status TEXT,
    inspector_name TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Obter o company_id do usuário autenticado
    SELECT company_id INTO v_company_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_company_id IS NULL THEN
        -- Super Admin ou usuário sem empresa
        SELECT company_id INTO v_company_id
        FROM public.properties
        WHERE id = p_property_id;
    END IF;

    RETURN QUERY
    SELECT 
        TRUE AS has_active_checkin,
        i.id AS inspection_id,
        i.title,
        i.status::TEXT,
        COALESCE(p.full_name, p.display_name, 'Colaborador')::TEXT AS inspector_name,
        i.created_at
    FROM public.inspections i
    LEFT JOIN public.profiles p ON p.id = i.inspector_id
    WHERE i.company_id = v_company_id
      AND i.property_id = p_property_id
      AND i.inspection_type = 'CHECK_IN'
      AND i.status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED')
      AND NOT EXISTS (
          SELECT 1 
          FROM public.inspections co
          WHERE co.company_id = v_company_id
            AND co.property_id = p_property_id
            AND co.inspection_type = 'CHECK_OUT'
            AND co.status = 'COMPLETED'
            AND co.created_at > i.created_at
      )
    ORDER BY i.created_at DESC
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.check_active_checkin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_active_checkin(UUID) TO authenticated, service_role;
