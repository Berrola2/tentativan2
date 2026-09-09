-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000007_stage7_signatures_integrity.sql
-- ==============================================================================
-- ETAPA 07: Assinatura Eletrônica, Integridade, Aceite do Laudo e Verificação
-- ==============================================================================

-- 1. ENUMS PERICIAIS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signer_type') THEN
        CREATE TYPE public.signer_type AS ENUM (
            'INSPECTOR',
            'MANAGER',
            'TENANT',
            'OWNER',
            'WITNESS',
            'OTHER'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signature_method') THEN
        CREATE TYPE public.signature_method AS ENUM (
            'AUTHENTICATED_ACCEPTANCE',
            'DRAWN_SIGNATURE',
            'EXTERNAL_LINK_ACCEPTANCE',
            'CERTIFICATE',
            'ICP_BRASIL'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signature_status') THEN
        CREATE TYPE public.signature_status AS ENUM (
            'PENDING',
            'SIGNED',
            'DECLINED',
            'REVOKED',
            'EXPIRED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_event_type') THEN
        CREATE TYPE public.document_event_type AS ENUM (
            'SIGNATURE_REQUEST_CREATED',
            'SIGNATURE_REQUEST_REVOKED',
            'DOCUMENT_VIEWED',
            'DOCUMENT_SIGNED',
            'DOCUMENT_DECLINED',
            'SIGNED_REPORT_GENERATED'
        );
    END IF;
END $$;

-- 2. ALTERAÇÃO EM public.inspection_documents (Código de Verificação Pública e Relatório Fonte)
ALTER TABLE public.inspection_documents 
    ADD COLUMN IF NOT EXISTS verification_code VARCHAR(64) DEFAULT replace(gen_random_uuid()::text, '-', ''),
    ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.inspection_documents(id) ON DELETE SET NULL;

-- Garante que códigos de verificação existentes estejam preenchidos e sejam únicos
UPDATE public.inspection_documents 
SET verification_code = replace(gen_random_uuid()::text, '-', '') 
WHERE verification_code IS NULL;

ALTER TABLE public.inspection_documents 
    ALTER COLUMN verification_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inspection_documents_verification_code 
    ON public.inspection_documents(verification_code);

-- 3. TABELA: public.document_signatures (Assinaturas Eletrônicas Registradas)
CREATE TABLE IF NOT EXISTS public.document_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.inspection_documents(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    signer_type public.signer_type NOT NULL,
    signer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    signer_name TEXT NOT NULL,
    signer_document TEXT, -- CPF / Documento (opcional)
    signer_email TEXT,
    signer_phone TEXT,
    signature_method public.signature_method NOT NULL,
    signature_status public.signature_status NOT NULL DEFAULT 'SIGNED',
    signature_image_path TEXT, -- Caminho da imagem manuscrita se houver
    document_checksum TEXT NOT NULL, -- SHA-256 do documento no instante do aceite
    accepted_terms_version TEXT NOT NULL DEFAULT 'v1.0',
    ip_address_hash TEXT, -- Hash SHA-256 do IP do signatário para auditoria
    user_agent TEXT,
    signature_evidence_hash TEXT NOT NULL, -- Hash de integridade da assinatura
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revocation_reason TEXT,
    declined_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_document_signatures_insp_comp 
        FOREIGN KEY (inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_document_signatures_user_method 
        UNIQUE (document_id, signer_user_id, signature_method)
);

CREATE INDEX IF NOT EXISTS idx_doc_signatures_document_id ON public.document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_signatures_company_id ON public.document_signatures(company_id);
CREATE INDEX IF NOT EXISTS idx_doc_signatures_inspection_id ON public.document_signatures(inspection_id);

-- 4. TABELA: public.document_signature_requests (Convites para Signatários Externos)
CREATE TABLE IF NOT EXISTS public.document_signature_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.inspection_documents(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    signer_type public.signer_type NOT NULL,
    signer_name TEXT NOT NULL,
    signer_email TEXT NOT NULL,
    signer_document TEXT,
    signer_phone TEXT,
    token_hash VARCHAR(128) NOT NULL UNIQUE, -- SHA-256 do token gerado (nunca em plaintext)
    status public.signature_status NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revocation_reason TEXT,
    declined_reason TEXT,
    CONSTRAINT fk_doc_sig_requests_insp_comp 
        FOREIGN KEY (inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_sig_requests_token_hash ON public.document_signature_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_doc_sig_requests_document_id ON public.document_signature_requests(document_id);

-- 5. TABELA: public.document_events (Trilha de Auditoria Pericial)
CREATE TABLE IF NOT EXISTS public.document_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.inspection_documents(id) ON DELETE CASCADE,
    event_type public.document_event_type NOT NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    signature_id UUID REFERENCES public.document_signatures(id) ON DELETE SET NULL,
    request_id UUID REFERENCES public.document_signature_requests(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_events_document_id ON public.document_events(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_events_company_id ON public.document_events(company_id);

-- 6. BUCKET PRIVADO NO SUPABASE STORAGE: document-signatures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'document-signatures',
    'document-signatures',
    false,
    5242880, -- 5 MB limite
    ARRAY['image/png']
)
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png'];

-- 7. POLICIES DO STORAGE (storage.objects) PARA document-signatures
DROP POLICY IF EXISTS "document_signatures_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "document_signatures_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "document_signatures_storage_delete" ON storage.objects;

CREATE POLICY "document_signatures_storage_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'document-signatures'
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (storage.foldername(name))[1]::text = (SELECT private.current_company_id())::text
            )
        )
    );

CREATE POLICY "document_signatures_storage_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'document-signatures'
        AND (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (storage.foldername(name))[1]::text = (SELECT private.current_company_id())::text
            )
        )
    );

CREATE POLICY "document_signatures_storage_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (false); -- Imutabilidade física de assinaturas capturadas

-- 8. RLS NAS TABELAS DE ASSINATURA, REQUISIÇÕES E EVENTOS
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;

-- 8.1 Políticas para public.document_signatures
DROP POLICY IF EXISTS "doc_signatures_select_policy" ON public.document_signatures;
DROP POLICY IF EXISTS "doc_signatures_insert_policy" ON public.document_signatures;
DROP POLICY IF EXISTS "doc_signatures_update_policy" ON public.document_signatures;
DROP POLICY IF EXISTS "doc_signatures_delete_policy" ON public.document_signatures;

CREATE POLICY "doc_signatures_select_policy"
    ON public.document_signatures
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "doc_signatures_insert_policy"
    ON public.document_signatures
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR company_id = (SELECT private.current_company_id())
        )
    );

CREATE POLICY "doc_signatures_update_policy"
    ON public.document_signatures
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.is_company_manager()) = TRUE
            )
        )
    )
    WITH CHECK (
        company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "doc_signatures_delete_policy"
    ON public.document_signatures
    FOR DELETE
    TO authenticated
    USING (false); -- Exclusão proibida por RLS

-- 8.2 Políticas para public.document_signature_requests
DROP POLICY IF EXISTS "doc_sig_requests_select_policy" ON public.document_signature_requests;
DROP POLICY IF EXISTS "doc_sig_requests_insert_policy" ON public.document_signature_requests;
DROP POLICY IF EXISTS "doc_sig_requests_update_policy" ON public.document_signature_requests;
DROP POLICY IF EXISTS "doc_sig_requests_delete_policy" ON public.document_signature_requests;

CREATE POLICY "doc_sig_requests_select_policy"
    ON public.document_signature_requests
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "doc_sig_requests_insert_policy"
    ON public.document_signature_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.is_company_manager()) = TRUE
            )
        )
    );

CREATE POLICY "doc_sig_requests_update_policy"
    ON public.document_signature_requests
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.is_company_manager()) = TRUE
            )
        )
    )
    WITH CHECK (
        company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "doc_sig_requests_delete_policy"
    ON public.document_signature_requests
    FOR DELETE
    TO authenticated
    USING (false);

-- 8.3 Políticas para public.document_events
DROP POLICY IF EXISTS "doc_events_select_policy" ON public.document_events;
DROP POLICY IF EXISTS "doc_events_insert_policy" ON public.document_events;

CREATE POLICY "doc_events_select_policy"
    ON public.document_events
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR company_id = (SELECT private.current_company_id())
    );

CREATE POLICY "doc_events_insert_policy"
    ON public.document_events
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR company_id = (SELECT private.current_company_id())
        )
    );

-- 9. TRIGGERS DE SEGURANÇA E IMUTABILIDADE

-- 9.1 Validação de Inserção de Assinaturas
CREATE OR REPLACE FUNCTION private.trg_document_signatures_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_doc RECORD;
    v_user_role TEXT;
    v_user_can_operate BOOLEAN;
    v_calc_evidence TEXT;
BEGIN
    -- 1. Buscar o documento correspondente
    SELECT * INTO v_doc FROM public.inspection_documents WHERE id = NEW.document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento de vistoria não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    -- 2. Garantir integridade de tenant e inspeção
    NEW.company_id := v_doc.company_id;
    NEW.inspection_id := v_doc.inspection_id;
    NEW.document_checksum := v_doc.checksum;

    -- 3. Documento precisa estar em estado READY
    IF v_doc.document_status <> 'READY' THEN
        RAISE EXCEPTION 'Apenas documentos prontos (READY) podem ser assinados.' USING ERRCODE = 'P0001';
    END IF;

    -- 4. Impedir nova assinatura em versões marcadas como SUPERSEDED
    IF v_doc.document_status = 'SUPERSEDED' THEN
        RAISE EXCEPTION 'Não é permitido assinar uma versão de laudo substituída (SUPERSEDED).' USING ERRCODE = 'P0001';
    END IF;

    -- 5. Timestamp gerado obrigatoriamente server-side
    NEW.signed_at := NOW();
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    -- 6. Validação de papéis para signatários autenticados internos
    IF NEW.signer_user_id IS NOT NULL THEN
        SELECT active INTO v_user_can_operate FROM public.profiles WHERE id = NEW.signer_user_id;
        IF v_user_can_operate IS NOT TRUE THEN
            RAISE EXCEPTION 'Usuário signatário inativo ou não autorizado.' USING ERRCODE = '42501';
        END IF;

        -- Viewer não pode assinar como vistoriador
        SELECT role::text INTO v_user_role FROM public.profiles WHERE id = NEW.signer_user_id;
        IF v_user_role = 'ROLE_VIEWER' AND NEW.signer_type = 'INSPECTOR' THEN
            RAISE EXCEPTION 'Usuário com papel Visualizador (ROLE_VIEWER) não pode assinar como vistoriador.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 7. Cálculo do Hash de Evidência da Assinatura (Integridade Criptográfica com sha256 nativo)
    v_calc_evidence := encode(
        sha256(
            convert_to(
                COALESCE(NEW.document_id::text, '') ||
                COALESCE(NEW.document_checksum, '') ||
                COALESCE(NEW.signer_name, '') ||
                COALESCE(NEW.signer_document, '') ||
                COALESCE(NEW.signature_method::text, '') ||
                COALESCE(NEW.signed_at::text, '') ||
                COALESCE(NEW.accepted_terms_version, 'v1.0'),
                'UTF8'
            )
        ),
        'hex'
    );
    NEW.signature_evidence_hash := v_calc_evidence;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_signatures_before_insert ON public.document_signatures;
CREATE TRIGGER trg_document_signatures_before_insert
    BEFORE INSERT ON public.document_signatures
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_document_signatures_before_insert();

-- 9.2 Imutabilidade de Assinaturas Registradas
CREATE OR REPLACE FUNCTION private.trg_document_signatures_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se a assinatura estava com status SIGNED, bloqueia qualquer alteração em campos de mérito
    IF OLD.signature_status = 'SIGNED' THEN
        IF NEW.document_id <> OLD.document_id OR
           NEW.inspection_id <> OLD.inspection_id OR
           NEW.company_id <> OLD.company_id OR
           NEW.signer_name <> OLD.signer_name OR
           COALESCE(NEW.signer_document, '') <> COALESCE(OLD.signer_document, '') OR
           NEW.signature_method <> OLD.signature_method OR
           NEW.document_checksum <> OLD.document_checksum OR
           NEW.signature_evidence_hash <> OLD.signature_evidence_hash OR
           NEW.signed_at <> OLD.signed_at OR
           NEW.accepted_terms_version <> OLD.accepted_terms_version THEN
            RAISE EXCEPTION 'Tentativa de violação de integridade: uma assinatura eletrônica SIGNED é estritamente imutável.' USING ERRCODE = '42501';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_signatures_before_update ON public.document_signatures;
CREATE TRIGGER trg_document_signatures_before_update
    BEFORE UPDATE ON public.document_signatures
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_document_signatures_before_update();

-- 9.3 Proibição de Exclusão de Assinaturas
CREATE OR REPLACE FUNCTION private.trg_document_signatures_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'Exclusão física de registros de assinatura eletrônica é terminantemente proibida.' USING ERRCODE = '42501';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_signatures_before_delete ON public.document_signatures;
CREATE TRIGGER trg_document_signatures_before_delete
    BEFORE DELETE ON public.document_signatures
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_document_signatures_before_delete();

-- 10. RPCs DE ASSINATURA E INTEGRIDADE

-- 10.1 Assinatura Eletrônica Autenticada (Vistoriador / Gerente)
CREATE OR REPLACE FUNCTION public.sign_inspection_document(
    p_document_id UUID,
    p_signature_method TEXT DEFAULT 'AUTHENTICATED_ACCEPTANCE',
    p_signature_image_path TEXT DEFAULT NULL,
    p_signer_document TEXT DEFAULT NULL,
    p_signer_phone TEXT DEFAULT NULL,
    p_terms_version TEXT DEFAULT 'v1.0'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_company_id UUID;
    v_doc RECORD;
    v_profile RECORD;
    v_signer_type public.signer_type;
    v_sig_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem assinar documentos.' USING ERRCODE = '42501';
    END IF;

    -- Verificar usuário
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    IF NOT FOUND OR v_profile.active IS NOT TRUE THEN
        RAISE EXCEPTION 'Usuário inativo ou não cadastrado.' USING ERRCODE = '42501';
    END IF;

    IF v_profile.must_change_password IS TRUE THEN
        RAISE EXCEPTION 'Usuário deve trocar a senha antes de assinar documentos.' USING ERRCODE = '42501';
    END IF;

    v_company_id := v_profile.company_id;
    v_user_role := v_profile.role::text;

    -- Buscar documento
    SELECT * INTO v_doc FROM public.inspection_documents WHERE id = p_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento de laudo não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    IF v_doc.company_id <> v_company_id AND (SELECT private.is_super_admin()) IS NOT TRUE THEN
        RAISE EXCEPTION 'Acesso negado ao documento.' USING ERRCODE = '42501';
    END IF;

    IF v_doc.document_status <> 'READY' THEN
        RAISE EXCEPTION 'Documento não está em status READY para assinatura.' USING ERRCODE = 'P0001';
    END IF;

    -- Determinar tipo de signatário
    IF v_user_role = 'ROLE_MANAGER' THEN
        v_signer_type := 'MANAGER'::public.signer_type;
    ELSIF v_user_role = 'ROLE_INSPECTOR' THEN
        v_signer_type := 'INSPECTOR'::public.signer_type;
    ELSE
        RAISE EXCEPTION 'Papel % não possui autorização para assinar laudos internamente.', v_user_role USING ERRCODE = '42501';
    END IF;

    -- Inserir registro de assinatura
    INSERT INTO public.document_signatures (
        company_id,
        document_id,
        inspection_id,
        signer_type,
        signer_user_id,
        signer_name,
        signer_document,
        signer_email,
        signer_phone,
        signature_method,
        signature_status,
        signature_image_path,
        document_checksum,
        accepted_terms_version,
        signed_at
    ) VALUES (
        v_company_id,
        v_doc.id,
        v_doc.inspection_id,
        v_signer_type,
        v_user_id,
        v_profile.full_name,
        p_signer_document,
        (SELECT email FROM auth.users WHERE id = v_user_id),
        p_signer_phone,
        p_signature_method::public.signature_method,
        'SIGNED'::public.signature_status,
        p_signature_image_path,
        v_doc.checksum,
        COALESCE(p_terms_version, 'v1.0'),
        NOW()
    )
    ON CONFLICT (document_id, signer_user_id, signature_method) 
    DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_sig_id;

    -- Registrar evento pericial de auditoria
    INSERT INTO public.document_events (
        company_id,
        document_id,
        event_type,
        actor_user_id,
        signature_id,
        metadata
    ) VALUES (
        v_company_id,
        v_doc.id,
        'DOCUMENT_SIGNED'::public.document_event_type,
        v_user_id,
        v_sig_id,
        jsonb_build_object(
            'signer_name', v_profile.full_name,
            'signer_type', v_signer_type::text,
            'method', p_signature_method,
            'checksum', v_doc.checksum
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'signature_id', v_sig_id,
        'signed_at', NOW(),
        'document_id', v_doc.id,
        'checksum', v_doc.checksum
    );
END;
$$;

-- 10.2 Criação de Solicitação Externa de Assinatura (Gerente ou Vistoriador)
CREATE OR REPLACE FUNCTION public.create_signature_request(
    p_document_id UUID,
    p_signer_type TEXT,
    p_signer_name TEXT,
    p_signer_email TEXT,
    p_signer_document TEXT DEFAULT NULL,
    p_signer_phone TEXT DEFAULT NULL,
    p_raw_token TEXT DEFAULT NULL -- Se não fornecido, gera token seguro
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_doc RECORD;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_request_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem solicitar assinaturas.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_doc FROM public.inspection_documents WHERE id = p_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    IF v_doc.document_status <> 'READY' THEN
        RAISE EXCEPTION 'Apenas documentos prontos (READY) podem receber solicitações de assinatura.' USING ERRCODE = 'P0001';
    END IF;

    -- Gerar token de alta entropia se não fornecido
    IF p_raw_token IS NULL OR trim(p_raw_token) = '' THEN
        v_raw_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    ELSE
        v_raw_token := trim(p_raw_token);
    END IF;

    v_token_hash := encode(sha256(convert_to(v_raw_token, 'UTF8')), 'hex');
    v_expires_at := NOW() + INTERVAL '7 days';

    INSERT INTO public.document_signature_requests (
        company_id,
        document_id,
        inspection_id,
        signer_type,
        signer_name,
        signer_email,
        signer_document,
        signer_phone,
        token_hash,
        status,
        expires_at,
        created_by
    ) VALUES (
        v_doc.company_id,
        v_doc.id,
        v_doc.inspection_id,
        p_signer_type::public.signer_type,
        p_signer_name,
        p_signer_email,
        p_signer_document,
        p_signer_phone,
        v_token_hash,
        'PENDING'::public.signature_status,
        v_expires_at,
        v_user_id
    ) RETURNING id INTO v_request_id;

    -- Registrar evento pericial
    INSERT INTO public.document_events (
        company_id,
        document_id,
        event_type,
        actor_user_id,
        request_id,
        metadata
    ) VALUES (
        v_doc.company_id,
        v_doc.id,
        'SIGNATURE_REQUEST_CREATED'::public.document_event_type,
        v_user_id,
        v_request_id,
        jsonb_build_object(
            'signer_name', p_signer_name,
            'signer_email', p_signer_email,
            'signer_type', p_signer_type
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'raw_token', v_raw_token, -- Retornado apenas uma vez na criação
        'expires_at', v_expires_at,
        'document_number', v_doc.document_number,
        'version', v_doc.version
    );
END;
$$;

-- 10.3 Obter Dados da Solicitação Externa via Token Hash (Página Externa de Assinatura)
CREATE OR REPLACE FUNCTION public.get_external_signature_request(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_doc RECORD;
    v_comp RECORD;
    v_prop RECORD;
    v_insp RECORD;
BEGIN
    SELECT * INTO v_req 
    FROM public.document_signature_requests 
    WHERE token_hash = p_token_hash;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Link inválido ou expirado.');
    END IF;

    IF v_req.status = 'SIGNED' OR v_req.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Esta solicitação de assinatura já foi concluída anteriormente.');
    END IF;

    IF v_req.status = 'REVOKED' THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Esta solicitação de assinatura foi revogada pelo emissor.');
    END IF;

    IF v_req.status = 'DECLINED' THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Esta solicitação de assinatura foi recusada.');
    END IF;

    IF v_req.expires_at < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Link de assinatura expirado.');
    END IF;

    -- Buscar dados essenciais do laudo
    SELECT * INTO v_doc FROM public.inspection_documents WHERE id = v_req.document_id;
    SELECT * INTO v_comp FROM public.companies WHERE id = v_doc.company_id;
    SELECT * INTO v_insp FROM public.inspections WHERE id = v_doc.inspection_id;
    SELECT * INTO v_prop FROM public.properties WHERE id = v_insp.property_id;

    RETURN jsonb_build_object(
        'valid', true,
        'request_id', v_req.id,
        'document_id', v_doc.id,
        'document_number', v_doc.document_number,
        'version', v_doc.version,
        'document_checksum', v_doc.checksum,
        'storage_path', v_doc.storage_path,
        'signer_name', v_req.signer_name,
        'signer_email', v_req.signer_email,
        'signer_type', v_req.signer_type::text,
        'company_name', v_comp.name,
        'property_street', v_prop.street,
        'property_city', v_prop.city,
        'property_state', v_prop.state,
        'inspection_type', v_insp.inspection_type::text,
        'inspection_date', v_insp.inspection_date
    );
END;
$$;

-- 10.4 Assinatura Externa (Submissão via Token)
CREATE OR REPLACE FUNCTION public.sign_document_external(
    p_token_hash TEXT,
    p_signer_document TEXT DEFAULT NULL,
    p_signature_image_path TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address_hash TEXT DEFAULT NULL,
    p_terms_version TEXT DEFAULT 'v1.0'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
    v_doc RECORD;
    v_sig_id UUID;
BEGIN
    SELECT * INTO v_req 
    FROM public.document_signature_requests 
    WHERE token_hash = p_token_hash;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Link inválido ou expirado.' USING ERRCODE = 'P0002';
    END IF;

    IF v_req.status <> 'PENDING' OR v_req.used_at IS NOT NULL OR v_req.expires_at < NOW() THEN
        RAISE EXCEPTION 'Solicitação de assinatura expirada, revogada ou já utilizada.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_doc FROM public.inspection_documents WHERE id = v_req.document_id;
    IF NOT FOUND OR v_doc.document_status <> 'READY' THEN
        RAISE EXCEPTION 'Documento de laudo não está pronto para assinatura.' USING ERRCODE = 'P0001';
    END IF;

    -- Inserir assinatura pericial externa
    INSERT INTO public.document_signatures (
        company_id,
        document_id,
        inspection_id,
        signer_type,
        signer_user_id,
        signer_name,
        signer_document,
        signer_email,
        signer_phone,
        signature_method,
        signature_status,
        signature_image_path,
        document_checksum,
        accepted_terms_version,
        ip_address_hash,
        user_agent,
        signed_at
    ) VALUES (
        v_doc.company_id,
        v_doc.id,
        v_doc.inspection_id,
        v_req.signer_type,
        NULL,
        v_req.signer_name,
        COALESCE(p_signer_document, v_req.signer_document),
        v_req.signer_email,
        v_req.signer_phone,
        CASE 
            WHEN p_signature_image_path IS NOT NULL THEN 'DRAWN_SIGNATURE'::public.signature_method
            ELSE 'EXTERNAL_LINK_ACCEPTANCE'::public.signature_method
        END,
        'SIGNED'::public.signature_status,
        p_signature_image_path,
        v_doc.checksum,
        COALESCE(p_terms_version, 'v1.0'),
        p_ip_address_hash,
        p_user_agent,
        NOW()
    ) RETURNING id INTO v_sig_id;

    -- Marcar solicitação como utilizada
    UPDATE public.document_signature_requests
    SET status = 'SIGNED'::public.signature_status,
        used_at = NOW()
    WHERE id = v_req.id;

    -- Registrar evento pericial
    INSERT INTO public.document_events (
        company_id,
        document_id,
        event_type,
        signature_id,
        request_id,
        metadata
    ) VALUES (
        v_doc.company_id,
        v_doc.id,
        'DOCUMENT_SIGNED'::public.document_event_type,
        v_sig_id,
        v_req.id,
        jsonb_build_object(
            'signer_name', v_req.signer_name,
            'signer_type', v_req.signer_type::text,
            'method', 'EXTERNAL_LINK_ACCEPTANCE'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'signature_id', v_sig_id,
        'signed_at', NOW(),
        'document_number', v_doc.document_number,
        'version', v_doc.version
    );
END;
$$;

-- 10.5 Recusa de Assinatura Externa
CREATE OR REPLACE FUNCTION public.decline_document_external(
    p_token_hash TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_req RECORD;
BEGIN
    SELECT * INTO v_req FROM public.document_signature_requests WHERE token_hash = p_token_hash;
    IF NOT FOUND OR v_req.status <> 'PENDING' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Link inválido ou já processado.');
    END IF;

    UPDATE public.document_signature_requests
    SET status = 'DECLINED'::public.signature_status,
        declined_reason = p_reason,
        used_at = NOW()
    WHERE id = v_req.id;

    INSERT INTO public.document_events (
        company_id,
        document_id,
        event_type,
        request_id,
        metadata
    ) VALUES (
        v_req.company_id,
        v_req.document_id,
        'DOCUMENT_DECLINED'::public.document_event_type,
        v_req.id,
        jsonb_build_object('reason', p_reason, 'signer_name', v_req.signer_name)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Assinatura recusada com sucesso.');
END;
$$;

-- 10.6 Verificação Pública Pericial do Laudo (/verify/:code)
CREATE OR REPLACE FUNCTION public.get_document_public_verification(p_verification_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_doc RECORD;
    v_comp RECORD;
    v_insp RECORD;
    v_signatures JSONB;
BEGIN
    -- Busca por verification_code
    SELECT * INTO v_doc 
    FROM public.inspection_documents 
    WHERE verification_code = p_verification_code;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'message', 'Documento não localizado no registro pericial.');
    END IF;

    SELECT name INTO v_comp FROM public.companies WHERE id = v_doc.company_id;
    SELECT inspection_type, inspection_date INTO v_insp FROM public.inspections WHERE id = v_doc.inspection_id;

    -- Coletar resumo auditável das assinaturas sem dados privados sensíveis
    SELECT jsonb_agg(
        jsonb_build_object(
            'signer_name', s.signer_name,
            'signer_type', s.signer_type::text,
            'signature_method', s.signature_method::text,
            'signed_at', s.signed_at,
            'terms_version', s.accepted_terms_version
        )
    ) INTO v_signatures
    FROM public.document_signatures s
    WHERE s.document_id = v_doc.id AND s.signature_status = 'SIGNED';

    RETURN jsonb_build_object(
        'valid', true,
        'document_number', v_doc.document_number,
        'version', v_doc.version,
        'document_type', v_doc.document_type::text,
        'document_status', v_doc.document_status::text,
        'company_name', v_comp.name,
        'inspection_type', v_insp.inspection_type::text,
        'inspection_date', v_insp.inspection_date,
        'generated_at', v_doc.generated_at,
        'document_checksum', v_doc.checksum,
        'signatures_count', COALESCE(jsonb_array_length(v_signatures), 0),
        'signatures', COALESCE(v_signatures, '[]'::jsonb)
    );
END;
$$;

-- 10.7 Registro de Documento Assinado (SIGNED_REPORT)
CREATE OR REPLACE FUNCTION public.register_signed_document(
    p_source_document_id UUID,
    p_storage_path TEXT,
    p_file_size INT,
    p_checksum TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_src RECORD;
    v_user_id UUID;
    v_signed_doc_id UUID;
    v_verification_code VARCHAR(64);
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Apenas usuários autenticados podem registrar laudos assinados.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_src FROM public.inspection_documents WHERE id = p_source_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Documento fonte não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    v_verification_code := replace(gen_random_uuid()::text, '-', '');

    -- Inserir novo documento do tipo SIGNED_REPORT
    INSERT INTO public.inspection_documents (
        company_id,
        inspection_id,
        document_type,
        document_status,
        document_number,
        version,
        snapshot_json,
        storage_bucket,
        storage_path,
        file_size,
        checksum,
        generated_by,
        source_document_id,
        verification_code
    ) VALUES (
        v_src.company_id,
        v_src.inspection_id,
        'SIGNED_REPORT'::public.document_type,
        'READY'::public.document_status,
        v_src.document_number,
        v_src.version,
        v_src.snapshot_json,
        'inspection-documents',
        p_storage_path,
        p_file_size,
        p_checksum,
        v_user_id,
        v_src.id,
        v_verification_code
    ) RETURNING id INTO v_signed_doc_id;

    -- Registrar evento pericial
    INSERT INTO public.document_events (
        company_id,
        document_id,
        event_type,
        actor_user_id,
        metadata
    ) VALUES (
        v_src.company_id,
        v_src.id,
        'SIGNED_REPORT_GENERATED'::public.document_event_type,
        v_user_id,
        jsonb_build_object(
            'signed_document_id', v_signed_doc_id,
            'source_checksum', v_src.checksum,
            'signed_checksum', p_checksum
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'signed_document_id', v_signed_doc_id,
        'verification_code', v_verification_code,
        'checksum', p_checksum
    );
END;
$$;
