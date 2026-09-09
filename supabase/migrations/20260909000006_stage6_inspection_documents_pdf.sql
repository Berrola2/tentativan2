-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000006_stage6_inspection_documents_pdf.sql
-- ==============================================================================
-- ETAPA 06: Motor de Laudos Oficiais, Snapshots Imutáveis, Versionamento e PDF
-- ==============================================================================

-- 1. ENUMS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE public.document_type AS ENUM (
            'INSPECTION_REPORT',
            'COMPARISON_REPORT',
            'ADDENDUM',
            'SIGNED_REPORT'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
        CREATE TYPE public.document_status AS ENUM (
            'GENERATING',
            'READY',
            'FAILED',
            'SUPERSEDED'
        );
    END IF;
END $$;

-- 2. TABELA: public.inspection_documents (Laudos e Snapshots Oficiais)
CREATE TABLE IF NOT EXISTS public.inspection_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    document_type public.document_type NOT NULL DEFAULT 'INSPECTION_REPORT',
    document_status public.document_status NOT NULL DEFAULT 'GENERATING',
    document_number TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    snapshot_json JSONB NOT NULL,
    storage_bucket TEXT NOT NULL DEFAULT 'inspection-documents',
    storage_path TEXT NOT NULL,
    file_size INT DEFAULT 0,
    checksum TEXT,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Foreign key composta para garantia de integridade do tenant
    CONSTRAINT fk_inspection_documents_insp_comp 
        FOREIGN KEY (inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_inspection_documents_insp_version UNIQUE (inspection_id, version)
);

CREATE INDEX IF NOT EXISTS idx_inspection_documents_inspection_id ON public.inspection_documents(inspection_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_documents_company_id ON public.inspection_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_inspection_documents_doc_number ON public.inspection_documents(document_number);

-- 3. BUCKET PRIVADO NO SUPABASE STORAGE: inspection-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inspection-documents',
    'inspection-documents',
    false,
    52428800, -- 50 MB limite por PDF
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf'];

-- 4. POLICIES DO STORAGE (storage.objects) PARA inspection-documents
DROP POLICY IF EXISTS "inspection_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "inspection_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "inspection_documents_storage_delete" ON storage.objects;

-- 4.1 Leitura: Apenas usuários autorizados a visualizar a vistoria correspondente
CREATE POLICY "inspection_documents_storage_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'inspection-documents'
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (storage.foldername(name))[1]::text = (SELECT private.current_company_id())::text
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id::text = (storage.foldername(name))[2]::text
                      AND (
                          (SELECT private.is_company_manager()) = TRUE
                          OR (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                          OR (
                              (SELECT private.current_user_role())::text = 'ROLE_VIEWER'
                              AND i.status = 'COMPLETED'::public.inspection_status
                          )
                      )
                )
            )
        )
    );

-- 4.2 Inserção: Vistoria COMPLETED da própria empresa com usuário apto
CREATE POLICY "inspection_documents_storage_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'inspection-documents'
        AND (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (storage.foldername(name))[1]::text = (SELECT private.current_company_id())::text
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id::text = (storage.foldername(name))[2]::text
                      AND i.company_id = (SELECT private.current_company_id())
                      AND i.status = 'COMPLETED'::public.inspection_status
                      AND (
                          (SELECT private.is_company_manager()) = TRUE
                          OR (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      )
                )
            )
        )
    );

-- 4.3 Exclusão de laudos oficiais: BLOQUEADA (preservação documental)
CREATE POLICY "inspection_documents_storage_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
    );

-- 5. TRIGGERS DE SEGURANÇA E IMUTABILIDADE

-- 5.1 Trigger BEFORE INSERT em public.inspection_documents
CREATE OR REPLACE FUNCTION private.trg_inspection_documents_before_insert()
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
    v_role TEXT;
    v_created_by UUID;
    v_inspector_id UUID;
BEGIN
    v_is_super := (SELECT private.is_super_admin());
    v_user_company_id := (SELECT private.current_company_id());
    v_role := (SELECT private.current_user_role())::text;

    -- 1. Validar capacidade operacional
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida: perfil inativo, empresa inativa ou troca de senha pendente.';
    END IF;

    IF v_role = 'ROLE_VIEWER' THEN
        RAISE EXCEPTION 'Usuários com perfil Visualizador não podem gerar novos laudos.';
    END IF;

    -- 2. Buscar e validar vistoria pai
    SELECT company_id, status, created_by, inspector_id 
    INTO v_insp_company_id, v_insp_status, v_created_by, v_inspector_id
    FROM public.inspections
    WHERE id = NEW.inspection_id;

    IF v_insp_company_id IS NULL THEN
        RAISE EXCEPTION 'Vistoria não encontrada.';
    END IF;

    IF NOT v_is_super AND v_insp_company_id <> v_user_company_id THEN
        RAISE EXCEPTION 'Tentativa de geração cross-tenant bloqueada.';
    END IF;

    -- 3. Apenas vistorias COMPLETED podem gerar documento oficial
    IF v_insp_status <> 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'O laudo oficial somente pode ser gerado para vistorias com status CONCLUÍDA (COMPLETED).';
    END IF;

    -- 4. Validar permissão de Inspector
    IF v_role = 'ROLE_INSPECTOR' AND NOT (v_created_by = (SELECT auth.uid()) OR v_inspector_id = (SELECT auth.uid())) THEN
        RAISE EXCEPTION 'Você não tem permissão para gerar o laudo desta vistoria.';
    END IF;

    -- 5. Derivar campos seguros
    NEW.company_id := v_insp_company_id;
    NEW.generated_by := (SELECT auth.uid());
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_documents_bi ON public.inspection_documents;
CREATE TRIGGER trg_inspection_documents_bi
    BEFORE INSERT ON public.inspection_documents
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_documents_before_insert();

-- 5.2 Trigger BEFORE UPDATE em public.inspection_documents (Imutabilidade após READY)
CREATE OR REPLACE FUNCTION private.trg_inspection_documents_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_is_super BOOLEAN;
BEGIN
    v_is_super := (SELECT private.is_super_admin());

    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida.';
    END IF;

    -- Se o documento já estava READY, os dados estruturais e o snapshot são estritamente IMUTÁVEIS
    IF OLD.document_status = 'READY'::public.document_status THEN
        IF NEW.snapshot_json <> OLD.snapshot_json OR
           NEW.checksum <> OLD.checksum OR
           NEW.version <> OLD.version OR
           NEW.storage_path <> OLD.storage_path OR
           NEW.document_number <> OLD.document_number OR
           NEW.company_id <> OLD.company_id OR
           NEW.inspection_id <> OLD.inspection_id OR
           NEW.generated_by <> OLD.generated_by THEN
            RAISE EXCEPTION 'Laudos finalizados (READY) são estritamente imutáveis. Para alterar informações, reabra a vistoria e gere uma nova versão.';
        END IF;
    END IF;

    NEW.id := OLD.id;
    NEW.company_id := OLD.company_id;
    NEW.inspection_id := OLD.inspection_id;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_documents_bu ON public.inspection_documents;
CREATE TRIGGER trg_inspection_documents_bu
    BEFORE UPDATE ON public.inspection_documents
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_documents_before_update();

-- 6. ROW LEVEL SECURITY (RLS) NA TABELA public.inspection_documents
ALTER TABLE public.inspection_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_documents_select_policy" ON public.inspection_documents;
DROP POLICY IF EXISTS "inspection_documents_insert_policy" ON public.inspection_documents;
DROP POLICY IF EXISTS "inspection_documents_update_policy" ON public.inspection_documents;
DROP POLICY IF EXISTS "inspection_documents_delete_policy" ON public.inspection_documents;

-- Leitura de documentos
CREATE POLICY "inspection_documents_select_policy"
    ON public.inspection_documents
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR (
            company_id = (SELECT private.current_company_id())
            AND EXISTS (
                SELECT 1 FROM public.inspections i
                WHERE i.id = inspection_documents.inspection_id
                  AND i.company_id = (SELECT private.current_company_id())
                  AND (
                      (SELECT private.is_company_manager()) = TRUE
                      OR (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      OR (
                          (SELECT private.current_user_role())::text = 'ROLE_VIEWER'
                          AND i.status = 'COMPLETED'::public.inspection_status
                      )
                  )
            )
        )
    );

-- Inserção de documentos
CREATE POLICY "inspection_documents_insert_policy"
    ON public.inspection_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.current_user_role())::text <> 'ROLE_VIEWER'
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_documents.inspection_id
                      AND i.company_id = (SELECT private.current_company_id())
                      AND i.status = 'COMPLETED'::public.inspection_status
                      AND (
                          (SELECT private.is_company_manager()) = TRUE
                          OR (i.created_by = (SELECT auth.uid()) OR i.inspector_id = (SELECT auth.uid()))
                      )
                )
            )
        )
    );

-- Atualização de documentos (apenas para completar geração)
CREATE POLICY "inspection_documents_update_policy"
    ON public.inspection_documents
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                company_id = (SELECT private.current_company_id())
                AND (SELECT private.current_user_role())::text <> 'ROLE_VIEWER'
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id = inspection_documents.inspection_id
                      AND i.company_id = (SELECT private.current_company_id())
                )
            )
        )
    );

-- Exclusão de laudos: Bloqueada para integridade documental
CREATE POLICY "inspection_documents_delete_policy"
    ON public.inspection_documents
    FOR DELETE
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
    );

-- 7. RPCS ATÔMICOS DE GERAÇÃO E FINALIZAÇÃO DE LAUDOS

-- 7.1 Criar Snapshot Imutável da Vistoria
CREATE OR REPLACE FUNCTION public.create_inspection_document_snapshot(p_inspection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_comp UUID := (SELECT private.current_company_id());
    v_is_super BOOLEAN := (SELECT private.is_super_admin());
    v_role TEXT := (SELECT private.current_user_role())::text;
    v_insp RECORD;
    v_comp RECORD;
    v_prop RECORD;
    v_inspector_profile RECORD;
    v_rooms JSONB;
    v_media JSONB;
    v_snapshot JSONB;
    v_doc_id UUID := gen_random_uuid();
    v_next_version INT;
    v_doc_number TEXT;
    v_storage_path TEXT;
    v_total_docs_year INT;
    v_year TEXT := to_char(NOW(), 'YYYY');
BEGIN
    -- 1. Validar capacidade operacional
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida: perfil inativo, empresa inativa ou troca de senha pendente.';
    END IF;

    IF v_role = 'ROLE_VIEWER' THEN
        RAISE EXCEPTION 'Visualizadores não podem gerar laudos oficiais.';
    END IF;

    -- 2. Buscar e validar vistoria
    SELECT * INTO v_insp FROM public.inspections WHERE id = p_inspection_id;
    IF v_insp IS NULL THEN
        RAISE EXCEPTION 'Vistoria não encontrada.';
    END IF;

    IF NOT v_is_super AND v_insp.company_id <> v_user_comp THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    IF v_insp.status <> 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'O laudo oficial somente pode ser gerado para vistorias com status CONCLUÍDA (COMPLETED).';
    END IF;

    IF v_role = 'ROLE_INSPECTOR' AND NOT (v_insp.created_by = (SELECT auth.uid()) OR v_insp.inspector_id = (SELECT auth.uid())) THEN
        RAISE EXCEPTION 'Você não tem permissão para gerar o laudo desta vistoria.';
    END IF;

    -- 3. Buscar dados da Empresa e Imóvel
    SELECT * INTO v_comp FROM public.companies WHERE id = v_insp.company_id;
    SELECT * INTO v_prop FROM public.properties WHERE id = v_insp.property_id;
    
    -- Vistoriador
    SELECT id, full_name, username, role 
    INTO v_inspector_profile 
    FROM public.profiles 
    WHERE id = COALESCE(v_insp.inspector_id, v_insp.created_by);

    -- 4. Montar Ambientes e Itens em ordem posicional
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'position', r.position,
            'notes', r.notes,
            'items', (
                SELECT COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', it.id,
                            'name', it.name,
                            'position', it.position,
                            'condition_status', it.condition_status,
                            'requires_repair', it.requires_repair,
                            'repair_notes', it.repair_notes,
                            'description', it.description
                        ) ORDER BY it.position ASC, it.created_at ASC
                    ), '[]'::jsonb
                )
                FROM public.inspection_items it
                WHERE it.room_id = r.id
            )
        ) ORDER BY r.position ASC, r.created_at ASC
    ) INTO v_rooms
    FROM public.inspection_rooms r
    WHERE r.inspection_id = p_inspection_id;

    -- 5. Montar Mídias Fotográficas
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', m.id,
                'room_id', m.room_id,
                'item_id', m.item_id,
                'storage_path', m.storage_path,
                'caption', m.caption,
                'position', m.position,
                'width', m.width,
                'height', m.height,
                'file_size', m.file_size
            ) ORDER BY m.position ASC, m.created_at ASC
        ), '[]'::jsonb
    ) INTO v_media
    FROM public.inspection_media m
    WHERE m.inspection_id = p_inspection_id AND m.media_type = 'IMAGE';

    -- 6. Calcular próxima versão para esta vistoria
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_next_version
    FROM public.inspection_documents
    WHERE inspection_id = p_inspection_id;

    -- 7. Gerar número sequencial do documento
    SELECT COUNT(*) + 1 INTO v_total_docs_year
    FROM public.inspection_documents
    WHERE company_id = v_insp.company_id 
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());

    v_doc_number := 'YZZY-' || v_year || '-' || lpad(v_total_docs_year::text, 6, '0');
    v_storage_path := v_insp.company_id::text || '/' || v_insp.id::text || '/' || v_doc_id::text || '/report-v' || v_next_version::text || '.pdf';

    -- 8. Montar Snapshot JSON completo
    v_snapshot := jsonb_build_object(
        'document_id', v_doc_id,
        'document_number', v_doc_number,
        'version', v_next_version,
        'generated_at', NOW(),
        'company', jsonb_build_object(
            'id', v_comp.id,
            'name', v_comp.name,
            'slug', v_comp.slug
        ),
        'property', jsonb_build_object(
            'id', v_prop.id,
            'internal_code', v_prop.internal_code,
            'property_type', v_prop.property_type,
            'street', v_prop.street,
            'number', v_prop.number,
            'complement', v_prop.complement,
            'neighborhood', v_prop.neighborhood,
            'city', v_prop.city,
            'state', v_prop.state,
            'postal_code', v_prop.postal_code,
            'notes', v_prop.notes
        ),
        'inspection', jsonb_build_object(
            'id', v_insp.id,
            'title', v_insp.title,
            'inspection_type', v_insp.inspection_type,
            'status', v_insp.status,
            'inspection_date', v_insp.inspection_date,
            'completed_at', v_insp.completed_at,
            'notes', v_insp.notes
        ),
        'inspector', jsonb_build_object(
            'id', v_inspector_profile.id,
            'name', COALESCE(v_inspector_profile.full_name, v_inspector_profile.username, 'Vistoriador'),
            'role', v_inspector_profile.role
        ),
        'rooms', COALESCE(v_rooms, '[]'::jsonb),
        'media', COALESCE(v_media, '[]'::jsonb)
    );

    -- 9. Inserir registro com status GENERATING
    INSERT INTO public.inspection_documents (
        id,
        company_id,
        inspection_id,
        document_type,
        document_status,
        document_number,
        version,
        snapshot_json,
        storage_bucket,
        storage_path,
        generated_by,
        generated_at
    ) VALUES (
        v_doc_id,
        v_insp.company_id,
        p_inspection_id,
        'INSPECTION_REPORT',
        'GENERATING',
        v_doc_number,
        v_next_version,
        v_snapshot,
        'inspection-documents',
        v_storage_path,
        (SELECT auth.uid()),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'document_id', v_doc_id,
        'document_number', v_doc_number,
        'version', v_next_version,
        'storage_path', v_storage_path,
        'storage_bucket', 'inspection-documents',
        'snapshot', v_snapshot
    );
END;
$$;

-- 7.2 Finalizar Laudo após Upload do PDF
CREATE OR REPLACE FUNCTION public.complete_inspection_document(
    p_document_id UUID,
    p_file_size INT,
    p_checksum TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_doc RECORD;
    v_user_comp UUID := (SELECT private.current_company_id());
    v_is_super BOOLEAN := (SELECT private.is_super_admin());
BEGIN
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida.';
    END IF;

    SELECT * INTO v_doc FROM public.inspection_documents WHERE id = p_document_id;
    IF v_doc IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Documento não encontrado.');
    END IF;

    IF NOT v_is_super AND v_doc.company_id <> v_user_comp THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    -- 1. Marcar versões anteriores como SUPERSEDED
    UPDATE public.inspection_documents
    SET document_status = 'SUPERSEDED'::public.document_status,
        updated_at = NOW()
    WHERE inspection_id = v_doc.inspection_id 
      AND id <> p_document_id 
      AND document_status = 'READY'::public.document_status;

    -- 2. Atualizar documento atual para READY
    UPDATE public.inspection_documents
    SET document_status = 'READY'::public.document_status,
        file_size = p_file_size,
        checksum = p_checksum,
        generated_at = NOW(),
        updated_at = NOW()
    WHERE id = p_document_id;

    RETURN jsonb_build_object(
        'success', true,
        'document_id', p_document_id,
        'document_number', v_doc.document_number,
        'version', v_doc.version,
        'document_status', 'READY',
        'file_size', p_file_size,
        'checksum', p_checksum
    );
END;
$$;

-- 8. GRANTS
REVOKE ALL ON TABLE public.inspection_documents FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inspection_documents TO authenticated;

REVOKE ALL ON FUNCTION public.create_inspection_document_snapshot(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_inspection_document_snapshot(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_inspection_document(UUID, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_inspection_document(UUID, INT, TEXT) TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION DA ETAPA 06
-- ==============================================================================
