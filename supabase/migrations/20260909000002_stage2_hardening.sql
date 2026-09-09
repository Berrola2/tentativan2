-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000002_stage2_hardening.sql
-- ==============================================================================
-- ETAPA 02.1: Hardening de Segurança, Rate Limiting, Contexto Operacional e RLS
-- ==============================================================================

-- 1. TABELA DE RATE LIMITING NO SCHEMA PRIVADO (private.auth_rate_limits)
CREATE TABLE IF NOT EXISTS private.auth_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL UNIQUE,
    attempts INT NOT NULL DEFAULT 1,
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_identifier ON private.auth_rate_limits(identifier);
REVOKE ALL ON TABLE private.auth_rate_limits FROM PUBLIC, anon, authenticated;

-- 2. FUNÇÃO ATÔMICA DE RATE LIMITING (private.check_and_record_login_attempt)
CREATE OR REPLACE FUNCTION private.check_and_record_login_attempt(
    p_identifier TEXT,
    p_max_attempts INT DEFAULT 5,
    p_window_seconds INT DEFAULT 300,
    p_lock_seconds INT DEFAULT 900
)
RETURNS TABLE (
    allowed BOOLEAN,
    attempts INT,
    retry_after_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := NOW();
    v_rec RECORD;
    v_new_attempts INT;
    v_retry_after INT := 0;
BEGIN
    -- Limpar identificadores expirados periodicamente (mais de 24h)
    DELETE FROM private.auth_rate_limits 
    WHERE last_attempt_at < (v_now - INTERVAL '24 hours');

    SELECT * INTO v_rec 
    FROM private.auth_rate_limits 
    WHERE identifier = p_identifier 
    FOR UPDATE;

    IF v_rec IS NULL THEN
        -- Primeiro registro de tentativa
        INSERT INTO private.auth_rate_limits (identifier, attempts, first_attempt_at, last_attempt_at, locked_until)
        VALUES (p_identifier, 1, v_now, v_now, NULL);
        RETURN QUERY SELECT TRUE, 1, 0;
        RETURN;
    END IF;

    -- Verificar se está atualmente bloqueado
    IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > v_now THEN
        v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_rec.locked_until - v_now)))::INT;
        RETURN QUERY SELECT FALSE, v_rec.attempts, v_retry_after;
        RETURN;
    END IF;

    -- Verificar se a janela de contagem expirou
    IF v_now > (v_rec.first_attempt_at + (p_window_seconds || ' seconds')::INTERVAL) THEN
        -- Reiniciar janela
        UPDATE private.auth_rate_limits
        SET attempts = 1,
            first_attempt_at = v_now,
            last_attempt_at = v_now,
            locked_until = NULL
        WHERE identifier = p_identifier;
        RETURN QUERY SELECT TRUE, 1, 0;
        RETURN;
    END IF;

    -- Incrementar tentativas dentro da janela
    v_new_attempts := v_rec.attempts + 1;

    IF v_new_attempts > p_max_attempts THEN
        -- Bloquear
        UPDATE private.auth_rate_limits
        SET attempts = v_new_attempts,
            last_attempt_at = v_now,
            locked_until = v_now + (p_lock_seconds || ' seconds')::INTERVAL
        WHERE identifier = p_identifier;
        RETURN QUERY SELECT FALSE, v_new_attempts, p_lock_seconds;
        RETURN;
    ELSE
        UPDATE private.auth_rate_limits
        SET attempts = v_new_attempts,
            last_attempt_at = v_now
        WHERE identifier = p_identifier;
        RETURN QUERY SELECT TRUE, v_new_attempts, 0;
        RETURN;
    END IF;
END;
$$;

-- 3. FUNÇÃO DE RESET DE RATE LIMITING (private.reset_login_rate_limit)
CREATE OR REPLACE FUNCTION private.reset_login_rate_limit(p_identifier TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    DELETE FROM private.auth_rate_limits WHERE identifier = p_identifier;
END;
$$;

-- 4. FUNÇÃO DE CAPACIDADE OPERACIONAL (private.current_user_can_operate)
-- Avalia se o usuário pode realizar operações de negócio
CREATE OR REPLACE FUNCTION private.current_user_can_operate()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        LEFT JOIN public.companies c ON c.id = p.company_id
        WHERE p.id = (SELECT auth.uid())
          AND p.active = TRUE
          AND p.must_change_password = FALSE
          AND (p.company_id IS NULL OR c.active = TRUE)
    );
$$;

-- 5. REVISÃO DE SEGURANÇA E GRANTS DAS FUNÇÕES
REVOKE ALL ON FUNCTION private.check_and_record_login_attempt(TEXT, INT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reset_login_rate_limit(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.current_user_can_operate() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.current_user_can_operate() TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION DE HARDENING
-- ==============================================================================
