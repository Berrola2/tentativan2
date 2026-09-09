-- ==============================================================================
-- VISTORIA YZZY — ETAPA 10: ADMINISTRAÇÃO SaaS, PLANOS, LIMITES E BILLING
-- ==============================================================================

-- 1. TABELA DE PLANOS SaaS
CREATE TABLE IF NOT EXISTS public.saas_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- 'STARTER', 'PROFESSIONAL', 'BUSINESS', 'ENTERPRISE'
    name TEXT NOT NULL,
    description TEXT,
    billing_interval TEXT NOT NULL DEFAULT 'MONTHLY', -- 'MONTHLY', 'YEARLY'
    price_cents INT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT true,
    trial_days INT NOT NULL DEFAULT 14,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE ENTITLEMENTS (LIMITES E RECURSOS DO PLANO)
CREATE TABLE IF NOT EXISTS public.plan_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.saas_plans(id) ON DELETE CASCADE,
    entitlement_key TEXT NOT NULL,
    value_type TEXT NOT NULL, -- 'BOOLEAN', 'INTEGER', 'DECIMAL', 'TEXT', 'JSON'
    value_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_plan_entitlement UNIQUE (plan_id, entitlement_key)
);

-- 3. TABELA DE ASSINATURAS DAS EMPRESAS
CREATE TABLE IF NOT EXISTS public.company_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.saas_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'TRIALING', -- 'TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED'
    trial_started_at TIMESTAMPTZ DEFAULT NOW(),
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    provider TEXT DEFAULT 'INTERNAL',
    provider_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TABELA DE OVERRIDES MANUAIS DE ENTITLEMENT (SUPER ADMIN)
CREATE TABLE IF NOT EXISTS public.company_entitlement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    entitlement_key TEXT NOT NULL,
    value_type TEXT NOT NULL,
    value_json JSONB NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_company_override UNIQUE (company_id, entitlement_key)
);

-- 5. TABELA DE CONTADORES DE CONSUMO ATÔMICO
CREATE TABLE IF NOT EXISTS public.usage_counters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL, -- 'ACTIVE_USERS', 'INSPECTIONS_CREATED', 'AI_OPERATIONS', 'PDF_REPORTS', 'COMPARISON_REPORTS', 'EXTERNAL_SIGNATURES', 'STORAGE_BYTES'
    period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', NOW()),
    period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),
    used_quantity NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unq_usage_counter UNIQUE (company_id, metric_key, period_start)
);

-- 6. TABELA DE CLIENTES DE BILLING
CREATE TABLE IF NOT EXISTS public.billing_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_customer_id TEXT NOT NULL,
    billing_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABELA DE FATURAS (INVOICES)
CREATE TABLE IF NOT EXISTS public.billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    provider_invoice_id TEXT NOT NULL,
    amount_due_cents INT NOT NULL,
    amount_paid_cents INT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'BRL',
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE', 'FAILED'
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    invoice_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABELA DE EVENTOS E WEBHOOKS IDEMPOTENTES
CREATE TABLE IF NOT EXISTS public.billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,
    provider_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    processing_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSED', 'FAILED', 'IGNORED'
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    CONSTRAINT unq_billing_event UNIQUE (provider, provider_event_id)
);

-- 9. TABELA DE AUDITORIA COMERCIAL
CREATE TABLE IF NOT EXISTS public.commercial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'TRIAL_STARTED', 'TRIAL_EXTENDED', 'PLAN_CHANGED', 'SUBSCRIPTION_ACTIVATED', 'SUBSCRIPTION_SUSPENDED', 'ENTITLEMENT_OVERRIDDEN', 'LIMIT_REACHED', 'WEBHOOK_PROCESSED'
    actor_user_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_subs_company ON public.company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON public.company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_comp_metric ON public.usage_counters(company_id, metric_key);
CREATE INDEX IF NOT EXISTS idx_invoices_comp ON public.billing_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_events_prov_id ON public.billing_events(provider, provider_event_id);
CREATE INDEX IF NOT EXISTS idx_audit_comm_comp ON public.commercial_audit_logs(company_id, created_at DESC);

-- HABILITAR RLS
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_audit_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS
-- Planos são públicos para leitura por autenticados; edição somente Super Admin
DROP POLICY IF EXISTS saas_plans_read_policy ON public.saas_plans;
CREATE POLICY saas_plans_read_policy ON public.saas_plans
    FOR SELECT TO authenticated
    USING (active = true OR private.is_super_admin());

DROP POLICY IF EXISTS plan_entitlements_read_policy ON public.plan_entitlements;
CREATE POLICY plan_entitlements_read_policy ON public.plan_entitlements
    FOR SELECT TO authenticated
    USING (true);

-- Assinaturas: Empresa lê a sua própria; Super Admin lê todas
DROP POLICY IF EXISTS company_subscriptions_tenant_policy ON public.company_subscriptions;
CREATE POLICY company_subscriptions_tenant_policy ON public.company_subscriptions
    FOR SELECT TO authenticated
    USING (company_id = private.current_company_id() OR private.is_super_admin());

-- Usage Counters: Empresa lê os seus; Super Admin lê todos
DROP POLICY IF EXISTS usage_counters_tenant_policy ON public.usage_counters;
CREATE POLICY usage_counters_tenant_policy ON public.usage_counters
    FOR SELECT TO authenticated
    USING (company_id = private.current_company_id() OR private.is_super_admin());

-- Invoices: Empresa lê as suas; Super Admin lê todas
DROP POLICY IF EXISTS billing_invoices_tenant_policy ON public.billing_invoices;
CREATE POLICY billing_invoices_tenant_policy ON public.billing_invoices
    FOR SELECT TO authenticated
    USING (company_id = private.current_company_id() OR private.is_super_admin());

-- Billing Events e Overrides: Apenas Super Admin
DROP POLICY IF EXISTS billing_events_admin_policy ON public.billing_events;
CREATE POLICY billing_events_admin_policy ON public.billing_events
    FOR ALL TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());

DROP POLICY IF EXISTS overrides_admin_policy ON public.company_entitlement_overrides;
CREATE POLICY overrides_admin_policy ON public.company_entitlement_overrides
    FOR ALL TO authenticated
    USING (private.is_super_admin())
    WITH CHECK (private.is_super_admin());

DROP POLICY IF EXISTS comm_audit_admin_policy ON public.commercial_audit_logs;
CREATE POLICY comm_audit_admin_policy ON public.commercial_audit_logs
    FOR SELECT TO authenticated
    USING (company_id = private.current_company_id() OR private.is_super_admin());

-- ==============================================================================
-- SEED DE PLANOS INICIAIS E ENTITLEMENTS
-- ==============================================================================
DO $$
DECLARE
    v_starter_id UUID;
    v_pro_id UUID;
    v_business_id UUID;
    v_enterprise_id UUID;
BEGIN
    -- 1. STARTER
    INSERT INTO public.saas_plans (code, name, description, price_cents, trial_days)
    VALUES ('STARTER', 'Plano Starter', 'Ideal para vistoriadores autônomos e pequenas operações.', 9900, 14)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price_cents = EXCLUDED.price_cents
    RETURNING id INTO v_starter_id;

    -- Entitlements STARTER
    INSERT INTO public.plan_entitlements (plan_id, entitlement_key, value_type, value_json) VALUES
    (v_starter_id, 'max_users', 'INTEGER', '2'::JSONB),
    (v_starter_id, 'max_properties', 'INTEGER', '20'::JSONB),
    (v_starter_id, 'max_inspections_month', 'INTEGER', '30'::JSONB),
    (v_starter_id, 'storage_gb', 'INTEGER', '5'::JSONB),
    (v_starter_id, 'monthly_ai_operations', 'INTEGER', '50'::JSONB),
    (v_starter_id, 'monthly_pdf_reports', 'INTEGER', '30'::JSONB),
    (v_starter_id, 'external_signatures', 'BOOLEAN', 'true'::JSONB),
    (v_starter_id, 'offline_mode', 'BOOLEAN', 'true'::JSONB),
    (v_starter_id, 'comparison_enabled', 'BOOLEAN', 'false'::JSONB),
    (v_starter_id, 'ai_enabled', 'BOOLEAN', 'true'::JSONB),
    (v_starter_id, 'custom_branding', 'BOOLEAN', 'false'::JSONB)
    ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value_json = EXCLUDED.value_json;

    -- 2. PROFESSIONAL
    INSERT INTO public.saas_plans (code, name, description, price_cents, trial_days)
    VALUES ('PROFESSIONAL', 'Plano Profissional', 'Para imobiliárias e equipes com vistorias frequentes.', 19900, 14)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price_cents = EXCLUDED.price_cents
    RETURNING id INTO v_pro_id;

    -- Entitlements PROFESSIONAL
    INSERT INTO public.plan_entitlements (plan_id, entitlement_key, value_type, value_json) VALUES
    (v_pro_id, 'max_users', 'INTEGER', '5'::JSONB),
    (v_pro_id, 'max_properties', 'INTEGER', '100'::JSONB),
    (v_pro_id, 'max_inspections_month', 'INTEGER', '150'::JSONB),
    (v_pro_id, 'storage_gb', 'INTEGER', '25'::JSONB),
    (v_pro_id, 'monthly_ai_operations', 'INTEGER', '300'::JSONB),
    (v_pro_id, 'monthly_pdf_reports', 'INTEGER', '150'::JSONB),
    (v_pro_id, 'external_signatures', 'BOOLEAN', 'true'::JSONB),
    (v_pro_id, 'offline_mode', 'BOOLEAN', 'true'::JSONB),
    (v_pro_id, 'comparison_enabled', 'BOOLEAN', 'true'::JSONB),
    (v_pro_id, 'ai_enabled', 'BOOLEAN', 'true'::JSONB),
    (v_pro_id, 'custom_branding', 'BOOLEAN', 'true'::JSONB)
    ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value_json = EXCLUDED.value_json;

    -- 3. BUSINESS
    INSERT INTO public.saas_plans (code, name, description, price_cents, trial_days)
    VALUES ('BUSINESS', 'Plano Business', 'Para grandes imobiliárias e redes com alta demanda operacional.', 39900, 14)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price_cents = EXCLUDED.price_cents
    RETURNING id INTO v_business_id;

    -- Entitlements BUSINESS
    INSERT INTO public.plan_entitlements (plan_id, entitlement_key, value_type, value_json) VALUES
    (v_business_id, 'max_users', 'INTEGER', '15'::JSONB),
    (v_business_id, 'max_properties', 'INTEGER', '500'::JSONB),
    (v_business_id, 'max_inspections_month', 'INTEGER', '600'::JSONB),
    (v_business_id, 'storage_gb', 'INTEGER', '100'::JSONB),
    (v_business_id, 'monthly_ai_operations', 'INTEGER', '1500'::JSONB),
    (v_business_id, 'monthly_pdf_reports', 'INTEGER', '600'::JSONB),
    (v_business_id, 'external_signatures', 'BOOLEAN', 'true'::JSONB),
    (v_business_id, 'offline_mode', 'BOOLEAN', 'true'::JSONB),
    (v_business_id, 'comparison_enabled', 'BOOLEAN', 'true'::JSONB),
    (v_business_id, 'ai_enabled', 'BOOLEAN', 'true'::JSONB),
    (v_business_id, 'custom_branding', 'BOOLEAN', 'true'::JSONB)
    ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value_json = EXCLUDED.value_json;

    -- 4. ENTERPRISE
    INSERT INTO public.saas_plans (code, name, description, price_cents, trial_days)
    VALUES ('ENTERPRISE', 'Plano Enterprise', 'Personalizado para frotas de vistoriadores e integrações dedicadas.', 99900, 30)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price_cents = EXCLUDED.price_cents
    RETURNING id INTO v_enterprise_id;

    -- Entitlements ENTERPRISE
    INSERT INTO public.plan_entitlements (plan_id, entitlement_key, value_type, value_json) VALUES
    (v_enterprise_id, 'max_users', 'INTEGER', '9999'::JSONB),
    (v_enterprise_id, 'max_properties', 'INTEGER', '99999'::JSONB),
    (v_enterprise_id, 'max_inspections_month', 'INTEGER', '99999'::JSONB),
    (v_enterprise_id, 'storage_gb', 'INTEGER', '1000'::JSONB),
    (v_enterprise_id, 'monthly_ai_operations', 'INTEGER', '99999'::JSONB),
    (v_enterprise_id, 'monthly_pdf_reports', 'INTEGER', '99999'::JSONB),
    (v_enterprise_id, 'external_signatures', 'BOOLEAN', 'true'::JSONB),
    (v_enterprise_id, 'offline_mode', 'BOOLEAN', 'true'::JSONB),
    (v_enterprise_id, 'comparison_enabled', 'BOOLEAN', 'true'::JSONB),
    (v_enterprise_id, 'ai_enabled', 'BOOLEAN', 'true'::JSONB),
    (v_enterprise_id, 'custom_branding', 'BOOLEAN', 'true'::JSONB)
    ON CONFLICT (plan_id, entitlement_key) DO UPDATE SET value_json = EXCLUDED.value_json;

    -- Criar assinatura padrão para todas as empresas existentes que não possuírem
    INSERT INTO public.company_subscriptions (company_id, plan_id, status)
    SELECT c.id, v_pro_id, 'ACTIVE'
    FROM public.companies c
    WHERE NOT EXISTS (SELECT 1 FROM public.company_subscriptions sub WHERE sub.company_id = c.id);

END $$;

-- ==============================================================================
-- FUNÇÕES INTERNAS DE ENTITLEMENT E LIMITES
-- ==============================================================================

-- 1. Obter valor efetivo de um entitlement (considera Overrides do Super Admin)
CREATE OR REPLACE FUNCTION private.company_get_entitlement_value(
    p_company_id UUID,
    p_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_override RECORD;
    v_plan_val JSONB;
BEGIN
    -- 1. Checar override do Super Admin
    SELECT * INTO v_override 
    FROM public.company_entitlement_overrides 
    WHERE company_id = p_company_id 
      AND entitlement_key = p_key
      AND (expires_at IS NULL OR expires_at > NOW());

    IF FOUND THEN
        RETURN v_override.value_json;
    END IF;

    -- 2. Buscar no plano da assinatura ativa
    SELECT pe.value_json INTO v_plan_val
    FROM public.company_subscriptions cs
    JOIN public.plan_entitlements pe ON pe.plan_id = cs.plan_id
    WHERE cs.company_id = p_company_id
      AND pe.entitlement_key = p_key;

    RETURN COALESCE(v_plan_val, 'null'::JSONB);
END;
$$;

-- 2. Verificar se empresa possui recurso booleano
CREATE OR REPLACE FUNCTION private.company_has_entitlement(
    p_company_id UUID,
    p_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_val JSONB;
    v_sub RECORD;
BEGIN
    -- Checar estado da assinatura (SUSPENDED ou EXPIRED bloqueia recursos pagos)
    SELECT * INTO v_sub FROM public.company_subscriptions WHERE company_id = p_company_id;
    IF FOUND AND v_sub.status IN ('SUSPENDED', 'EXPIRED') THEN
        RETURN false;
    END IF;

    v_val := private.company_get_entitlement_value(p_company_id, p_key);
    IF v_val IS NULL OR v_val = 'null'::JSONB THEN
        RETURN false;
    END IF;

    RETURN (v_val::TEXT = 'true');
END;
$$;

-- 3. Reserva Atômica de Consumo (Atomic Increment com Row Lock)
CREATE OR REPLACE FUNCTION private.reserve_usage(
    p_company_id UUID,
    p_metric_key TEXT,
    p_quantity INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_period_start TIMESTAMPTZ := date_trunc('month', NOW());
    v_period_end TIMESTAMPTZ := (date_trunc('month', NOW()) + INTERVAL '1 month');
    v_limit JSONB;
    v_max_val NUMERIC;
    v_current_val NUMERIC;
    v_sub RECORD;
BEGIN
    -- Validar status comercial da empresa
    SELECT * INTO v_sub FROM public.company_subscriptions WHERE company_id = p_company_id;
    IF FOUND AND v_sub.status IN ('SUSPENDED', 'EXPIRED') THEN
        RAISE EXCEPTION 'A empresa está comercialmente suspensa ou com assinatura expirada (Read-Only).' USING ERRCODE = '55000';
    END IF;

    -- Obter limite contratado
    v_limit := private.company_get_entitlement_value(p_company_id, p_metric_key);
    IF v_limit IS NOT NULL AND v_limit <> 'null'::JSONB THEN
        v_max_val := (v_limit#>>'{}')::NUMERIC;
    ELSE
        v_max_val := 999999;
    END IF;

    -- Bloqueio concorrencial atômico no contador do mês
    INSERT INTO public.usage_counters (
        company_id, metric_key, period_start, period_end, used_quantity
    ) VALUES (
        p_company_id, p_metric_key, v_period_start, v_period_end, 0
    ) ON CONFLICT (company_id, metric_key, period_start) DO NOTHING;

    SELECT used_quantity INTO v_current_val
    FROM public.usage_counters
    WHERE company_id = p_company_id 
      AND metric_key = p_metric_key 
      AND period_start = v_period_start
    FOR UPDATE;

    IF (v_current_val + p_quantity) > v_max_val THEN
        -- Registrar limite atingido na auditoria comercial
        INSERT INTO public.commercial_audit_logs (company_id, event_type, details)
        VALUES (p_company_id, 'LIMIT_REACHED', jsonb_build_object(
            'metric', p_metric_key,
            'current', v_current_val,
            'max', v_max_val,
            'requested', p_quantity
        ));

        RAISE EXCEPTION 'Limite do plano atingido para a métrica % (% / % contratados).', p_metric_key, v_current_val, v_max_val USING ERRCODE = '54000';
    END IF;

    -- Incrementar contador atômico
    UPDATE public.usage_counters
    SET used_quantity = used_quantity + p_quantity, updated_at = NOW()
    WHERE company_id = p_company_id 
      AND metric_key = p_metric_key 
      AND period_start = v_period_start;

    RETURN true;
END;
$$;

-- 4. Reconciliação Periódica de Consumo
CREATE OR REPLACE FUNCTION private.recalculate_company_usage(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_period_start TIMESTAMPTZ := date_trunc('month', NOW());
    v_period_end TIMESTAMPTZ := (date_trunc('month', NOW()) + INTERVAL '1 month');
    v_user_count INT;
    v_inspection_count INT;
    v_storage_bytes BIGINT;
BEGIN
    -- 1. Contar usuários ativos
    SELECT COUNT(*) INTO v_user_count
    FROM public.profiles
    WHERE company_id = p_company_id AND is_active = true;

    -- 2. Contar vistorias criadas no mês corrente
    SELECT COUNT(*) INTO v_inspection_count
    FROM public.inspections
    WHERE company_id = p_company_id 
      AND created_at >= v_period_start 
      AND created_at < v_period_end;

    -- 3. Somar bytes de mídias e fotos
    SELECT COALESCE(SUM(file_size), 0) INTO v_storage_bytes
    FROM public.inspection_media
    WHERE company_id = p_company_id;

    -- Atualizar contadores
    INSERT INTO public.usage_counters (company_id, metric_key, period_start, period_end, used_quantity)
    VALUES 
        (p_company_id, 'ACTIVE_USERS', v_period_start, v_period_end, v_user_count),
        (p_company_id, 'INSPECTIONS_CREATED', v_period_start, v_period_end, v_inspection_count),
        (p_company_id, 'STORAGE_BYTES', v_period_start, v_period_end, v_storage_bytes)
    ON CONFLICT (company_id, metric_key, period_start) DO UPDATE
    SET used_quantity = EXCLUDED.used_quantity, updated_at = NOW();

    RETURN jsonb_build_object(
        'company_id', p_company_id,
        'active_users', v_user_count,
        'inspections_this_month', v_inspection_count,
        'storage_bytes', v_storage_bytes,
        'storage_mb', ROUND(v_storage_bytes / (1024.0 * 1024.0), 2)
    );
END;
$$;

-- ==============================================================================
-- RPCs PÚBLICAS PARA FRONTEND E SUPER ADMIN
-- ==============================================================================

-- 1. Obter Plano, Limites e Consumo da Empresa
CREATE OR REPLACE FUNCTION public.get_company_plan_and_usage(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_caller_role TEXT;
    v_sub RECORD;
    v_plan RECORD;
    v_entitlements JSONB := '{}'::JSONB;
    v_usage JSONB := '{}'::JSONB;
    v_ent RECORD;
    v_rec RECORD;
BEGIN
    -- Validar contexto do caller
    IF NOT private.is_super_admin() AND p_company_id <> private.current_company_id() THEN
        RAISE EXCEPTION 'Acesso negado: Isolamento multi-tenant violado.' USING ERRCODE = '42501';
    END IF;

    -- Reconciliar contadores para retorno preciso
    PERFORM private.recalculate_company_usage(p_company_id);

    -- Buscar Assinatura
    SELECT * INTO v_sub FROM public.company_subscriptions WHERE company_id = p_company_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assinatura não encontrada para a empresa.' USING ERRCODE = 'P0002';
    END IF;

    -- Buscar Plano
    SELECT * INTO v_plan FROM public.saas_plans WHERE id = v_sub.plan_id;

    -- Montar Entitlements
    FOR v_ent IN 
        SELECT pe.entitlement_key, pe.value_type, 
               COALESCE(ov.value_json, pe.value_json) as effective_val,
               (ov.id IS NOT NULL) as is_overridden
        FROM public.plan_entitlements pe
        LEFT JOIN public.company_entitlement_overrides ov 
          ON ov.company_id = p_company_id 
         AND ov.entitlement_key = pe.entitlement_key
         AND (ov.expires_at IS NULL OR ov.expires_at > NOW())
        WHERE pe.plan_id = v_plan.id
    LOOP
        v_entitlements := v_entitlements || jsonb_build_object(
            v_ent.entitlement_key, jsonb_build_object(
                'value', v_ent.effective_val,
                'type', v_ent.value_type,
                'overridden', v_ent.is_overridden
            )
        );
    END LOOP;

    -- Montar Consumo Atual
    FOR v_rec IN 
        SELECT metric_key, used_quantity 
        FROM public.usage_counters 
        WHERE company_id = p_company_id 
          AND period_start = date_trunc('month', NOW())
    LOOP
        v_usage := v_usage || jsonb_build_object(v_rec.metric_key, v_rec.used_quantity);
    END LOOP;

    RETURN jsonb_build_object(
        'company_id', p_company_id,
        'subscription', jsonb_build_object(
            'id', v_sub.id,
            'status', v_sub.status,
            'trial_ends_at', v_sub.trial_ends_at,
            'current_period_end', v_sub.current_period_end,
            'cancel_at_period_end', v_sub.cancel_at_period_end,
            'provider', v_sub.provider
        ),
        'plan', jsonb_build_object(
            'id', v_plan.id,
            'code', v_plan.code,
            'name', v_plan.name,
            'description', v_plan.description,
            'price_cents', v_plan.price_cents,
            'currency', v_plan.currency,
            'billing_interval', v_plan.billing_interval
        ),
        'entitlements', v_entitlements,
        'usage', v_usage
    );
END;
$$;

-- 2. Métricas Agregadas do Super Admin (Sem N+1)
CREATE OR REPLACE FUNCTION public.admin_get_saas_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_total_companies INT;
    v_active_subs INT;
    v_trial_subs INT;
    v_past_due_subs INT;
    v_suspended_subs INT;
    v_total_mrr_cents BIGINT := 0;
    v_total_storage_bytes BIGINT := 0;
    v_total_inspections INT := 0;
BEGIN
    IF NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'Acesso restrito ao Super Admin YZZY.' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*) INTO v_total_companies FROM public.companies;
    
    SELECT 
        COUNT(*) FILTER (WHERE status = 'ACTIVE'),
        COUNT(*) FILTER (WHERE status = 'TRIALING'),
        COUNT(*) FILTER (WHERE status = 'PAST_DUE'),
        COUNT(*) FILTER (WHERE status = 'SUSPENDED')
    INTO v_active_subs, v_trial_subs, v_past_due_subs, v_suspended_subs
    FROM public.company_subscriptions;

    SELECT COALESCE(SUM(p.price_cents), 0) INTO v_total_mrr_cents
    FROM public.company_subscriptions s
    JOIN public.saas_plans p ON p.id = s.plan_id
    WHERE s.status = 'ACTIVE';

    SELECT COALESCE(SUM(file_size), 0) INTO v_total_storage_bytes FROM public.inspection_media;
    SELECT COUNT(*) INTO v_total_inspections FROM public.inspections;

    RETURN jsonb_build_object(
        'total_companies', v_total_companies,
        'active_subscriptions', v_active_subs,
        'trials_active', v_trial_subs,
        'past_due_subscriptions', v_past_due_subs,
        'suspended_subscriptions', v_suspended_subs,
        'mrr_cents', v_total_mrr_cents,
        'mrr_formatted', 'R$ ' || TO_CHAR(v_total_mrr_cents / 100.0, 'FM999G999G990D00'),
        'arr_cents', v_total_mrr_cents * 12,
        'arr_formatted', 'R$ ' || TO_CHAR((v_total_mrr_cents * 12) / 100.0, 'FM999G999G990D00'),
        'total_storage_bytes', v_total_storage_bytes,
        'total_storage_gb', ROUND(v_total_storage_bytes / (1024.0 * 1024.0 * 1024.0), 2),
        'total_inspections', v_total_inspections
    );
END;
$$;

-- 3. Super Admin: Alterar Plano da Empresa com Auditoria
CREATE OR REPLACE FUNCTION public.admin_update_company_plan(
    p_company_id UUID,
    p_plan_code TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_plan RECORD;
    v_actor UUID := auth.uid();
BEGIN
    IF NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'Acesso restrito ao Super Admin YZZY.' USING ERRCODE = '42501';
    END IF;

    IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
        RAISE EXCEPTION 'É obrigatório informar o motivo comercial da alteração de plano.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_plan FROM public.saas_plans WHERE code = p_plan_code AND active = true;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plano "%" não encontrado ou inativo.', p_plan_code USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.company_subscriptions
    SET plan_id = v_plan.id,
        status = 'ACTIVE',
        updated_at = NOW()
    WHERE company_id = p_company_id;

    -- Registrar na auditoria comercial
    INSERT INTO public.commercial_audit_logs (company_id, event_type, actor_user_id, details)
    VALUES (p_company_id, 'PLAN_CHANGED', v_actor, jsonb_build_object(
        'new_plan_code', p_plan_code,
        'plan_name', v_plan.name,
        'reason', p_reason
    ));

    RETURN jsonb_build_object('success', true, 'message', 'Plano atualizado com sucesso.');
END;
$$;

-- 4. Super Admin: Estender Trial com Auditoria
CREATE OR REPLACE FUNCTION public.admin_extend_trial(
    p_company_id UUID,
    p_additional_days INT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_new_end TIMESTAMPTZ;
BEGIN
    IF NOT private.is_super_admin() THEN
        RAISE EXCEPTION 'Acesso restrito ao Super Admin YZZY.' USING ERRCODE = '42501';
    END IF;

    IF p_additional_days <= 0 THEN
        RAISE EXCEPTION 'A quantidade de dias adicionais deve ser maior que zero.' USING ERRCODE = '22023';
    END IF;

    UPDATE public.company_subscriptions
    SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + (p_additional_days || ' days')::INTERVAL,
        status = 'TRIALING',
        updated_at = NOW()
    WHERE company_id = p_company_id
    RETURNING trial_ends_at INTO v_new_end;

    -- Auditoria comercial
    INSERT INTO public.commercial_audit_logs (company_id, event_type, actor_user_id, details)
    VALUES (p_company_id, 'TRIAL_EXTENDED', v_actor, jsonb_build_object(
        'additional_days', p_additional_days,
        'new_trial_ends_at', v_new_end,
        'reason', p_reason
    ));

    RETURN jsonb_build_object('success', true, 'new_trial_ends_at', v_new_end);
END;
$$;

-- 5. Processador de Webhook Idempotente
CREATE OR REPLACE FUNCTION public.process_billing_webhook(
    p_provider TEXT,
    p_event_id TEXT,
    p_event_type TEXT,
    p_payload JSONB,
    p_signature TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
    v_existing RECORD;
    v_company_id UUID;
    v_plan_code TEXT;
    v_plan RECORD;
    v_sub_status TEXT;
BEGIN
    -- 1. Idempotência: Checar se o evento já foi recebido/processado
    SELECT * INTO v_existing FROM public.billing_events
    WHERE provider = p_provider AND provider_event_id = p_event_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'status', 'ALREADY_PROCESSED',
            'message', 'Evento de cobrança já processado anteriormente.'
        );
    END IF;

    -- 2. Registrar evento na fila
    INSERT INTO public.billing_events (
        provider, provider_event_id, event_type, payload_hash, processing_status, received_at
    ) VALUES (
        p_provider, p_event_id, p_event_type, md5(p_payload::TEXT), 'PENDING', NOW()
    );

    -- 3. Processar por Tipo de Evento
    v_company_id := (p_payload->>'company_id')::UUID;

    IF v_company_id IS NOT NULL THEN
        IF p_event_type IN ('subscription.created', 'subscription.updated', 'invoice.paid', 'payment.succeeded') THEN
            v_plan_code := p_payload->>'plan_code';
            IF v_plan_code IS NOT NULL THEN
                SELECT * INTO v_plan FROM public.saas_plans WHERE code = v_plan_code;
                IF FOUND THEN
                    UPDATE public.company_subscriptions
                    SET plan_id = v_plan.id,
                        status = 'ACTIVE',
                        current_period_end = NOW() + INTERVAL '30 days',
                        updated_at = NOW()
                    WHERE company_id = v_company_id;
                END IF;
            ELSE
                UPDATE public.company_subscriptions
                SET status = 'ACTIVE',
                    current_period_end = NOW() + INTERVAL '30 days',
                    updated_at = NOW()
                WHERE company_id = v_company_id;
            END IF;

        ELSIF p_event_type IN ('invoice.payment_failed', 'subscription.past_due') THEN
            UPDATE public.company_subscriptions
            SET status = 'PAST_DUE', updated_at = NOW()
            WHERE company_id = v_company_id;

        ELSIF p_event_type IN ('subscription.canceled', 'subscription.deleted') THEN
            UPDATE public.company_subscriptions
            SET status = 'CANCELED', canceled_at = NOW(), updated_at = NOW()
            WHERE company_id = v_company_id;
        END IF;

        -- Registrar Fatura se houver dados
        IF p_payload->>'amount_cents' IS NOT NULL THEN
            INSERT INTO public.billing_invoices (
                company_id, provider_invoice_id, amount_due_cents, amount_paid_cents,
                currency, status, paid_at
            ) VALUES (
                v_company_id,
                COALESCE(p_payload->>'invoice_id', p_event_id),
                (p_payload->>'amount_cents')::INT,
                CASE WHEN p_event_type = 'invoice.paid' THEN (p_payload->>'amount_cents')::INT ELSE 0 END,
                COALESCE(p_payload->>'currency', 'BRL'),
                CASE WHEN p_event_type = 'invoice.paid' THEN 'PAID' ELSE 'OPEN' END,
                CASE WHEN p_event_type = 'invoice.paid' THEN NOW() ELSE NULL END
            );
        END IF;
    END IF;

    -- Atualizar status do evento
    UPDATE public.billing_events
    SET processing_status = 'PROCESSED', processed_at = NOW()
    WHERE provider = p_provider AND provider_event_id = p_event_id;

    -- Auditoria comercial
    INSERT INTO public.commercial_audit_logs (company_id, event_type, details)
    VALUES (v_company_id, 'WEBHOOK_PROCESSED', jsonb_build_object(
        'provider', p_provider,
        'event_id', p_event_id,
        'event_type', p_event_type
    ));

    RETURN jsonb_build_object('success', true, 'status', 'PROCESSED');
EXCEPTION WHEN OTHERS THEN
    UPDATE public.billing_events
    SET processing_status = 'FAILED', error_message = SQLERRM, processed_at = NOW()
    WHERE provider = p_provider AND provider_event_id = p_event_id;

    RETURN jsonb_build_object('success', false, 'status', 'FAILED', 'error', SQLERRM);
END;
$$;
