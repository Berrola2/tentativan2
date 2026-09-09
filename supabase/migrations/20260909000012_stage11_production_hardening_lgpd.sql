-- ==============================================================================
-- VISTORIA YZZY — ETAPA 11: HARDENING DE PRODUÇÃO, OBSERVABILIDADE & LGPD
-- ==============================================================================

-- 1. TABELA DE FEATURE FLAGS & KILL SWITCHES GLOBAIS
CREATE TABLE IF NOT EXISTS public.system_feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

-- Seed de flags do sistema
INSERT INTO public.system_feature_flags (key, is_enabled, description)
VALUES 
    ('AI_ENABLED_GLOBALLY', true, 'Controle global de chamadas ao assistente de IA Gemini'),
    ('EXTERNAL_SIGNATURES_ENABLED', true, 'Controle global de solicitações de assinatura e aceite externo'),
    ('BILLING_ENABLED', true, 'Controle global do módulo de pagamentos, checkout e faturamento'),
    ('UPLOADS_ENABLED', true, 'Controle global de uploads para Supabase Storage'),
    ('OFFLINE_SYNC_ENABLED', true, 'Controle global do motor de sincronização offline')
ON CONFLICT (key) DO NOTHING;

-- 2. TABELA DE SOLICITAÇÕES LGPD (DATA SUBJECT REQUESTS)
CREATE TABLE IF NOT EXISTS public.lgpd_data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL,
    request_type TEXT NOT NULL, -- 'EXPORT_DATA', 'ANONYMIZE_USER', 'RECTIFY_DATA', 'DELETE_ACCOUNT'
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 3. TABELA DE AUDITORIA DE SISTEMA & INCIDENTES (SEV-1, SEV-2, SEV-3)
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'SEV-1', 'SEV-2', 'SEV-3'
    actor_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES DE PERFORMANCE E CONSULTA
CREATE INDEX IF NOT EXISTS idx_flags_key ON public.system_feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_lgpd_req_comp ON public.lgpd_data_requests(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_sev ON public.system_audit_logs(severity, created_at DESC);

-- HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.system_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS

-- Feature Flags: Leitura para todos autenticados; Edição apenas Super Admin
DROP POLICY IF EXISTS flags_read_policy ON public.system_feature_flags;
CREATE POLICY flags_read_policy ON public.system_feature_flags
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS flags_admin_policy ON public.system_feature_flags;
CREATE POLICY flags_admin_policy ON public.system_feature_flags
    FOR ALL TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());

-- LGPD Requests: Empresa lê e cria suas próprias; Super Admin lê todas
DROP POLICY IF EXISTS lgpd_tenant_policy ON public.lgpd_data_requests;
CREATE POLICY lgpd_tenant_policy ON public.lgpd_data_requests
    FOR SELECT TO authenticated
    USING (company_id = private.current_company_id() OR private.is_super_admin());

DROP POLICY IF EXISTS lgpd_insert_policy ON public.lgpd_data_requests;
CREATE POLICY lgpd_insert_policy ON public.lgpd_data_requests
    FOR INSERT TO authenticated
    WITH CHECK (company_id = private.current_company_id() OR private.is_super_admin());

-- System Audit Logs: Apenas Super Admin
DROP POLICY IF EXISTS sys_audit_admin_policy ON public.system_audit_logs;
CREATE POLICY sys_audit_admin_policy ON public.system_audit_logs
    FOR SELECT TO authenticated
    USING (private.is_super_admin());

-- ==============================================================================
-- RPCs PÚBLICAS E ADMINISTRATIVAS DE PRODUÇÃO
-- ==============================================================================

-- 1. Health Check Controlado do Sistema (Sem Expor Secrets)
CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_db_time TIMESTAMPTZ := NOW();
    v_flags JSONB := '{}'::JSONB;
    v_rec RECORD;
    v_active_companies INT;
    v_total_inspections INT;
BEGIN
    FOR v_rec IN SELECT key, is_enabled FROM public.system_feature_flags LOOP
        v_flags := v_flags || jsonb_build_object(v_rec.key, v_rec.is_enabled);
    END LOOP;

    SELECT COUNT(*) INTO v_active_companies FROM public.companies WHERE active = true;
    SELECT COUNT(*) INTO v_total_inspections FROM public.inspections;

    RETURN jsonb_build_object(
        'status', 'HEALTHY',
        'timestamp', v_db_time,
        'database', jsonb_build_object(
            'connected', true,
            'latency_ms', 0,
            'active_tenants', v_active_companies,
            'total_inspections', v_total_inspections
        ),
        'feature_flags', v_flags,
        'version', '1.0.0-prod'
    );
END;
$$;

-- 2. Listagem de Feature Flags para o Frontend
CREATE OR REPLACE FUNCTION public.get_system_feature_flags()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_flags JSONB := '{}'::JSONB;
    v_rec RECORD;
BEGIN
    FOR v_rec IN SELECT key, is_enabled, description FROM public.system_feature_flags LOOP
        v_flags := v_flags || jsonb_build_object(
            v_rec.key, jsonb_build_object(
                'enabled', v_rec.is_enabled,
                'description', v_rec.description
            )
        );
    END LOOP;

    RETURN v_flags;
END;
$$;

-- 3. Super Admin: Alternar Feature Flag / Kill Switch com Auditoria
CREATE OR REPLACE FUNCTION public.admin_toggle_feature_flag(
    p_key TEXT,
    p_enabled BOOLEAN,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'Acesso restrito ao Super Admin YZZY.' USING ERRCODE = '42501';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'Justificativa operacional obrigatória para alternar flags.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.system_feature_flags
    SET is_enabled = p_enabled,
        updated_at = NOW(),
        updated_by = v_actor
    WHERE key = p_key;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Flag "%" não encontrada.', p_key USING ERRCODE = 'P0002';
    END IF;

    -- Registrar log de auditoria operacional
    INSERT INTO public.system_audit_logs (event_type, severity, actor_id, details)
    VALUES ('FLAG_TOGGLED', 'WARNING', v_actor, jsonb_build_object(
        'flag_key', p_key,
        'new_state', p_enabled,
        'reason', p_reason
    ));

    RETURN jsonb_build_object('success', true, 'key', p_key, 'is_enabled', p_enabled);
END;
$$;

-- 4. Exportação Estruturada de Dados para Conformidade LGPD (DSR Export)
CREATE OR REPLACE FUNCTION public.export_company_lgpd_data(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_comp RECORD;
    v_profiles JSONB;
    v_properties JSONB;
    v_inspections JSONB;
BEGIN
    -- Validação de isolamento tenant
    IF NOT private.is_super_admin() AND p_company_id <> private.current_company_id() THEN
        RAISE EXCEPTION 'Acesso negado: Isolamento multi-tenant violado.' USING ERRCODE = '42501';
    END IF;

    SELECT id, name, trade_name, slug, document_number, phone, email, created_at
    INTO v_comp
    FROM public.companies WHERE id = p_company_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Empresa não encontrada.' USING ERRCODE = 'P0002';
    END IF;

    -- Perfis dos funcionários (sem expor senhas)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'first_name', first_name,
        'last_name', last_name,
        'role', role,
        'login_alias', login_alias,
        'is_active', is_active,
        'created_at', created_at
    )), '[]'::JSONB) INTO v_profiles
    FROM public.profiles
    WHERE company_id = p_company_id;

    -- Imóveis cadastrados
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'title', title,
        'address_street', address_street,
        'address_number', address_number,
        'address_neighborhood', address_neighborhood,
        'address_city', address_city,
        'address_state', address_state,
        'address_zipcode', address_zipcode,
        'created_at', created_at
    )), '[]'::JSONB) INTO v_properties
    FROM public.properties
    WHERE company_id = p_company_id;

    -- Metadados de vistorias
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'property_id', property_id,
        'type', type,
        'status', status,
        'scheduled_for', scheduled_for,
        'completed_at', completed_at,
        'created_at', created_at
    )), '[]'::JSONB) INTO v_inspections
    FROM public.inspections
    WHERE company_id = p_company_id;

    -- Registrar evento LGPD
    INSERT INTO public.lgpd_data_requests (company_id, requested_by, request_type, status, details, completed_at)
    VALUES (
        p_company_id, 
        auth.uid(), 
        'EXPORT_DATA', 
        'COMPLETED', 
        jsonb_build_object('exported_at', NOW()), 
        NOW()
    );

    RETURN jsonb_build_object(
        'company', row_to_json(v_comp),
        'profiles', v_profiles,
        'properties', v_properties,
        'inspections', v_inspections,
        'exported_at', NOW()
    );
END;
$$;
