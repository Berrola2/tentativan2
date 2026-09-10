-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260910000020_test_concurrency_helper_rpc.sql
-- ==============================================================================
-- RPC utilitária para teste determinístico de concorrência com controle de timing (pg_sleep)
-- Permite simular transações longas que mantêm o lock na linha do imóvel enquanto outra transação tenta inserir.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_slow_insert_inspection(
    p_property_id UUID,
    p_company_id UUID,
    p_delay_seconds INT DEFAULT 2
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_new_id UUID := gen_random_uuid();
    v_inspector_id UUID := auth.uid();
BEGIN
    -- 1. Se auth.uid() for nulo, pega o primeiro profile da empresa para o teste
    IF v_inspector_id IS NULL THEN
        SELECT id INTO v_inspector_id FROM public.profiles WHERE company_id = p_company_id LIMIT 1;
    END IF;

    -- 2. Adquire lock FOR UPDATE na linha do imóvel e aguarda o delay antes do insert
    PERFORM 1 FROM public.properties WHERE id = p_property_id AND company_id = p_company_id FOR UPDATE;
    
    IF p_delay_seconds > 0 THEN
        PERFORM pg_sleep(p_delay_seconds);
    END IF;

    -- 3. Insere a vistoria de entrada (vai disparar a trigger normalmente dentro da transação)
    INSERT INTO public.inspections (
        id, company_id, property_id, inspection_type, title, status, inspector_id
    ) VALUES (
        v_new_id, p_company_id, p_property_id, 'CHECK_IN', 'Vistoria Concorrente Determinística', 'IN_PROGRESS', v_inspector_id
    );

    RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.test_slow_insert_inspection(UUID, UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.test_slow_insert_inspection(UUID, UUID, INT) TO authenticated, service_role;
