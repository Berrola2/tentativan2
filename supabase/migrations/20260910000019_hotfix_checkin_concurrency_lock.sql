-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260910000019_hotfix_checkin_concurrency_lock.sql
-- ==============================================================================
-- HOTFIX DE CONCORRÊNCIA: SERIALIZAÇÃO POR IMÓVEL (ROW-LEVEL LOCK)
-- 1. Executa SELECT ... FROM public.properties WHERE id = NEW.property_id AND company_id = NEW.company_id FOR UPDATE
--    garantindo que inserções simultâneas para o mesmo imóvel sejam estritamente serializadas.
-- 2. Remove tentativa inócua de INSERT em security_audit_logs antes de RAISE EXCEPTION,
--    pois em PostgreSQL o RAISE EXCEPTION aborta a transação e reverte qualquer INSERT na mesma transação.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_prevent_duplicate_active_checkin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_existing RECORD;
    v_prop_exists BOOLEAN;
BEGIN
    -- Valida apenas para vistorias de ENTRADA (CHECK_IN) que não estejam arquivadas
    IF NEW.inspection_type = 'CHECK_IN' AND NEW.status <> 'ARCHIVED' THEN
        
        -- 1. SERIALIZAÇÃO TRANSACIONAL A NÍVEL DE LINHA NO IMÓVEL (ROW-LEVEL LOCK)
        -- Trava a tupla do imóvel para a transação corrente.
        -- Transações concorrentes para o MESMO (property_id, company_id) aguardarão
        -- o commit/rollback da primeira transação antes de executar a verificação.
        -- Imóveis distintos NÃO se bloqueiam mutuamente.
        SELECT TRUE INTO v_prop_exists
        FROM public.properties
        WHERE id = NEW.property_id
          AND company_id = NEW.company_id
        FOR UPDATE;

        IF v_prop_exists IS NOT TRUE THEN
            RAISE EXCEPTION 'PROPERTY_NOT_FOUND: Imóvel % não encontrado para a empresa %', 
                NEW.property_id, NEW.company_id
                USING ERRCODE = 'P0002';
        END IF;

        -- 2. VERIFICAÇÃO DE VISTORIA DE ENTRADA ATIVA NO MESMO CICLO
        -- Executada de forma estritamente serializada após obter o lock na linha do imóvel.
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
            -- O bloqueio aborta a transação com código de erro 23505 (unique_violation)
            -- e mensagem com o prefixo semântico DUPLICATE_ACTIVE_CHECKIN.
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
