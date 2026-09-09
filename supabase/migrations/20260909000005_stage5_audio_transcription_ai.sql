-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000005_stage5_audio_transcription_ai.sql
-- ==============================================================================
-- ETAPA 05: Áudio, Transcrição, Assistente de Redação com IA (Gemini) e Auditoria
-- ==============================================================================

-- 1. ENUMS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transcription_status') THEN
        CREATE TYPE public.transcription_status AS ENUM (
            'PENDING',
            'PROCESSING',
            'READY',
            'ACCEPTED',
            'REJECTED',
            'FAILED'
        );
    END IF;
END $$;

-- 2. TABELA: public.inspection_transcriptions (Histórico e Auditoria de Transcrições)
CREATE TABLE IF NOT EXISTS public.inspection_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    room_id UUID REFERENCES public.inspection_rooms(id) ON DELETE SET NULL,
    item_id UUID REFERENCES public.inspection_items(id) ON DELETE SET NULL,
    media_id UUID REFERENCES public.inspection_media(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    raw_transcript TEXT NOT NULL,
    processed_text TEXT,
    status public.transcription_status NOT NULL DEFAULT 'READY',
    model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Foreign key composta para garantia de isolamento do tenant
    CONSTRAINT fk_inspection_transcriptions_insp_comp 
        FOREIGN KEY (inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_inspection_transcriptions_id_company UNIQUE (id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_transcriptions_inspection_id ON public.inspection_transcriptions(inspection_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_item_id ON public.inspection_transcriptions(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transcriptions_company_id ON public.inspection_transcriptions(company_id);

-- 3. TABELA: public.ai_processing_logs (Observabilidade, Custos e Métricas)
CREATE TABLE IF NOT EXISTS public.ai_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    item_id UUID,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    operation_type TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_ms INT NOT NULL DEFAULT 0,
    input_char_count INT NOT NULL DEFAULT 0,
    output_char_count INT NOT NULL DEFAULT 0,
    prompt_tokens INT,
    candidates_tokens INT,
    total_tokens INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_company_id ON public.ai_processing_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_inspection_id ON public.ai_processing_logs(inspection_id);

-- 4. ATUALIZAR BUCKET DE STORAGE PARA SUPORTAR ÁUDIOS PRIVADOS
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/wav', 'audio/mpeg'
]
WHERE id = 'inspection-media';

-- 5. TRIGGERS DE SEGURANÇA E ZERO TRUST PARA TRANSCRIÇÕES

-- 5.1 BEFORE INSERT em public.inspection_transcriptions
CREATE OR REPLACE FUNCTION private.trg_transcriptions_before_insert()
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
    v_item_room_id UUID;
BEGIN
    v_is_super := (SELECT private.is_super_admin());
    v_user_company_id := (SELECT private.current_company_id());

    -- 1. Validar capacidade operacional
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida: perfil inativo, empresa inativa ou troca de senha pendente.';
    END IF;

    -- 2. Buscar e validar vistoria pai
    SELECT company_id, status INTO v_insp_company_id, v_insp_status
    FROM public.inspections
    WHERE id = NEW.inspection_id;

    IF v_insp_company_id IS NULL THEN
        RAISE EXCEPTION 'Vistoria não encontrada.';
    END IF;

    IF NOT v_is_super AND v_insp_company_id <> v_user_company_id THEN
        RAISE EXCEPTION 'Tentativa de processamento cross-tenant bloqueada.';
    END IF;

    IF v_insp_status = 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'Não é permitido registrar transcrições em uma vistoria concluída.';
    END IF;

    -- 3. Validar item_id se informado
    IF NEW.item_id IS NOT NULL THEN
        SELECT room_id INTO v_item_room_id
        FROM public.inspection_items
        WHERE id = NEW.item_id AND inspection_id = NEW.inspection_id AND company_id = v_insp_company_id;

        IF v_item_room_id IS NULL THEN
            RAISE EXCEPTION 'Item não pertence a esta vistoria ou empresa.';
        END IF;

        IF NEW.room_id IS NULL THEN
            NEW.room_id := v_item_room_id;
        END IF;
    END IF;

    -- 4. Derivar campos seguros
    NEW.company_id := v_insp_company_id;
    NEW.created_by := (SELECT auth.uid());
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transcriptions_bi ON public.inspection_transcriptions;
CREATE TRIGGER trg_transcriptions_bi
    BEFORE INSERT ON public.inspection_transcriptions
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_transcriptions_before_insert();

-- 5.2 BEFORE UPDATE em public.inspection_transcriptions
CREATE OR REPLACE FUNCTION private.trg_transcriptions_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_super BOOLEAN;
    v_insp_status public.inspection_status;
BEGIN
    v_is_super := (SELECT private.is_super_admin());

    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida.';
    END IF;

    SELECT status INTO v_insp_status
    FROM public.inspections
    WHERE id = OLD.inspection_id;

    IF v_insp_status = 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'Não é permitido alterar transcrições de uma vistoria concluída.';
    END IF;

    -- Imutabilidade de integridade estrutural
    NEW.id := OLD.id;
    NEW.company_id := OLD.company_id;
    NEW.inspection_id := OLD.inspection_id;
    NEW.created_by := OLD.created_by;
    NEW.raw_transcript := OLD.raw_transcript; -- Preservar fala original intacta
    NEW.created_at := OLD.created_at;
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transcriptions_bu ON public.inspection_transcriptions;
CREATE TRIGGER trg_transcriptions_bu
    BEFORE UPDATE ON public.inspection_transcriptions
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_transcriptions_before_update();

-- 6. ROW LEVEL SECURITY (RLS)

-- 6.1 public.inspection_transcriptions
ALTER TABLE public.inspection_transcriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_transcriptions_select_policy" ON public.inspection_transcriptions;
DROP POLICY IF EXISTS "inspection_transcriptions_insert_policy" ON public.inspection_transcriptions;
DROP POLICY IF EXISTS "inspection_transcriptions_update_policy" ON public.inspection_transcriptions;
DROP POLICY IF EXISTS "inspection_transcriptions_delete_policy" ON public.inspection_transcriptions;

-- SELECT
CREATE POLICY "inspection_transcriptions_select_policy"
    ON public.inspection_transcriptions
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR EXISTS (
            SELECT 1 FROM public.inspections i
            WHERE i.id = inspection_transcriptions.inspection_id
        )
    );

-- INSERT
CREATE POLICY "inspection_transcriptions_insert_policy"
    ON public.inspection_transcriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_transcriptions.inspection_id
                      AND i.company_id = (SELECT private.current_company_id())
                      AND i.status <> 'COMPLETED'::public.inspection_status
                      AND (
                          (SELECT private.is_company_manager()) = TRUE
                          OR (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      )
                )
            )
        )
    );

-- UPDATE
CREATE POLICY "inspection_transcriptions_update_policy"
    ON public.inspection_transcriptions
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_transcriptions.inspection_id
                      AND i.company_id = (SELECT private.current_company_id())
                      AND i.status <> 'COMPLETED'::public.inspection_status
                      AND (
                          (SELECT private.is_company_manager()) = TRUE
                          OR (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      )
                )
            )
        )
    );

-- DELETE
CREATE POLICY "inspection_transcriptions_delete_policy"
    ON public.inspection_transcriptions
    FOR DELETE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_transcriptions.inspection_id
                      AND i.company_id = (SELECT private.current_company_id())
                      AND i.status <> 'COMPLETED'::public.inspection_status
                      AND (
                          (SELECT private.is_company_manager()) = TRUE
                          OR (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      )
                )
            )
        )
    );

-- 6.2 public.ai_processing_logs
ALTER TABLE public.ai_processing_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_processing_logs_select_policy" ON public.ai_processing_logs;
DROP POLICY IF EXISTS "ai_processing_logs_insert_policy" ON public.ai_processing_logs;

CREATE POLICY "ai_processing_logs_select_policy"
    ON public.ai_processing_logs
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "ai_processing_logs_insert_policy"
    ON public.ai_processing_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

-- 7. RPC ATÔMICO: Aceitar Transcrição e Atualizar Descrição do Item
CREATE OR REPLACE FUNCTION public.accept_inspection_transcription(
    p_transcription_id UUID,
    p_mode TEXT DEFAULT 'REPLACE', -- 'REPLACE' ou 'APPEND'
    p_custom_text TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tr RECORD;
    v_item RECORD;
    v_insp RECORD;
    v_user_comp UUID := (SELECT private.current_company_id());
    v_is_super BOOLEAN := (SELECT private.is_super_admin());
    v_text_to_apply TEXT;
    v_final_description TEXT;
BEGIN
    -- 1. Validar capacidade operacional
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida.';
    END IF;

    -- 2. Buscar transcrição
    SELECT * INTO v_tr 
    FROM public.inspection_transcriptions 
    WHERE id = p_transcription_id;

    IF v_tr IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Transcrição não encontrada.');
    END IF;

    IF NOT v_is_super AND v_tr.company_id <> v_user_comp THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- 3. Buscar e validar vistoria
    SELECT * INTO v_insp 
    FROM public.inspections 
    WHERE id = v_tr.inspection_id;

    IF v_insp.status = 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'Não é permitido alterar descrições de uma vistoria concluída.';
    END IF;

    -- 4. Definir texto a ser aplicado
    v_text_to_apply := COALESCE(NULLIF(TRIM(p_custom_text), ''), v_tr.processed_text, v_tr.raw_transcript);

    IF v_text_to_apply IS NULL OR TRIM(v_text_to_apply) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Texto de descrição vazio.');
    END IF;

    -- 5. Se houver item_id, atualizar item
    IF v_tr.item_id IS NOT NULL THEN
        SELECT * INTO v_item 
        FROM public.inspection_items 
        WHERE id = v_tr.item_id;

        IF v_item IS NOT NULL THEN
            IF p_mode = 'APPEND' AND v_item.description IS NOT NULL AND TRIM(v_item.description) <> '' THEN
                v_final_description := TRIM(v_item.description) || E'\n' || TRIM(v_text_to_apply);
            ELSE
                v_final_description := TRIM(v_text_to_apply);
            END IF;

            UPDATE public.inspection_items
            SET description = v_final_description,
                updated_at = NOW(),
                updated_by = (SELECT auth.uid())
            WHERE id = v_tr.item_id;
        END IF;
    END IF;

    -- 6. Atualizar status da transcrição
    UPDATE public.inspection_transcriptions
    SET status = 'ACCEPTED'::public.transcription_status,
        accepted_at = NOW(),
        accepted_by = (SELECT auth.uid()),
        updated_at = NOW()
    WHERE id = p_transcription_id;

    RETURN jsonb_build_object(
        'success', true,
        'transcription_id', p_transcription_id,
        'item_id', v_tr.item_id,
        'applied_description', v_final_description
    );
END;
$$;

-- 8. GRANTS
REVOKE ALL ON TABLE public.inspection_transcriptions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inspection_transcriptions TO authenticated;

REVOKE ALL ON TABLE public.ai_processing_logs FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.ai_processing_logs TO authenticated;

REVOKE ALL ON FUNCTION public.accept_inspection_transcription(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_inspection_transcription(UUID, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION DA ETAPA 05
-- ==============================================================================
