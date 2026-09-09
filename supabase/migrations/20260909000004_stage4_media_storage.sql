-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260909000004_stage4_media_storage.sql
-- ==============================================================================
-- ETAPA 04: Motor de Mídia, Fotos e Supabase Storage Multi-Tenant
-- ==============================================================================

-- 1. ENUMS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        CREATE TYPE public.media_type AS ENUM (
            'IMAGE',
            'AUDIO',
            'VIDEO',
            'DOCUMENT'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'upload_status') THEN
        CREATE TYPE public.upload_status AS ENUM (
            'PENDING',
            'READY',
            'FAILED',
            'DELETED'
        );
    END IF;
END $$;

-- 2. TABELA: public.inspection_media (Metadados de Mídias e Fotos)
CREATE TABLE IF NOT EXISTS public.inspection_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    inspection_id UUID NOT NULL,
    room_id UUID REFERENCES public.inspection_rooms(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inspection_items(id) ON DELETE CASCADE,
    media_type public.media_type NOT NULL DEFAULT 'IMAGE',
    storage_bucket TEXT NOT NULL DEFAULT 'inspection-media',
    storage_path TEXT NOT NULL UNIQUE,
    original_filename TEXT,
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    file_size INT NOT NULL,
    width INT,
    height INT,
    caption TEXT,
    position INT NOT NULL DEFAULT 1,
    upload_status public.upload_status NOT NULL DEFAULT 'READY',
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Foreign key composta que GARANTE que a mídia pertence à mesma empresa e vistoria
    CONSTRAINT fk_inspection_media_insp_comp 
        FOREIGN KEY (inspection_id, company_id) 
        REFERENCES public.inspections(id, company_id) 
        ON DELETE CASCADE,
    CONSTRAINT uq_inspection_media_id_company UNIQUE (id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_inspection_media_inspection_id ON public.inspection_media(inspection_id, position ASC);
CREATE INDEX IF NOT EXISTS idx_inspection_media_room_id ON public.inspection_media(room_id, position ASC) WHERE room_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspection_media_item_id ON public.inspection_media(item_id, position ASC) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inspection_media_company_id ON public.inspection_media(company_id);
CREATE INDEX IF NOT EXISTS idx_inspection_media_storage_path ON public.inspection_media(storage_path);

-- 3. TRIGGERS DE AUDITORIA E VALIDAÇÃO SERVER-SIDE (ZERO TRUST)

-- 3.1 Trigger BEFORE INSERT
CREATE OR REPLACE FUNCTION private.trg_inspection_media_before_insert()
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
    v_room_insp_id UUID;
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
        RAISE EXCEPTION 'Tentativa de upload cross-tenant bloqueada.';
    END IF;

    IF v_insp_status = 'COMPLETED'::public.inspection_status THEN
        RAISE EXCEPTION 'Não é permitido adicionar mídias em uma vistoria concluída.';
    END IF;

    -- 3. Validar room_id se fornecido
    IF NEW.room_id IS NOT NULL THEN
        SELECT inspection_id INTO v_room_insp_id
        FROM public.inspection_rooms
        WHERE id = NEW.room_id AND company_id = v_insp_company_id;

        IF v_room_insp_id IS NULL OR v_room_insp_id <> NEW.inspection_id THEN
            RAISE EXCEPTION 'Ambiente não pertence a esta vistoria ou empresa.';
        END IF;
    END IF;

    -- 4. Validar item_id se fornecido
    IF NEW.item_id IS NOT NULL THEN
        IF NEW.room_id IS NULL THEN
            SELECT room_id INTO NEW.room_id
            FROM public.inspection_items
            WHERE id = NEW.item_id AND company_id = v_insp_company_id;
        END IF;

        SELECT room_id INTO v_item_room_id
        FROM public.inspection_items
        WHERE id = NEW.item_id AND inspection_id = NEW.inspection_id AND company_id = v_insp_company_id;

        IF v_item_room_id IS NULL THEN
            RAISE EXCEPTION 'Item não pertence a este ambiente ou vistoria.';
        END IF;
    END IF;

    -- 5. Derivar campos seguros
    NEW.company_id := v_insp_company_id;
    NEW.uploaded_by := (SELECT auth.uid());
    NEW.created_at := NOW();
    NEW.updated_at := NOW();

    -- 6. Validação do Path de Storage (Prevenção de Path Traversal)
    IF NEW.storage_path LIKE '%..%' OR NEW.storage_path LIKE '%//%' THEN
        RAISE EXCEPTION 'Caminho de arquivo inválido ou inseguro.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_media_bi ON public.inspection_media;
CREATE TRIGGER trg_inspection_media_bi
    BEFORE INSERT ON public.inspection_media
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_media_before_insert();

-- 3.2 Trigger BEFORE UPDATE
CREATE OR REPLACE FUNCTION private.trg_inspection_media_before_update()
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
        RAISE EXCEPTION 'Não é permitido alterar mídias de uma vistoria concluída.';
    END IF;

    -- Imutabilidade de dados estruturais
    NEW.id := OLD.id;
    NEW.company_id := OLD.company_id;
    NEW.inspection_id := OLD.inspection_id;
    NEW.storage_bucket := OLD.storage_bucket;
    NEW.storage_path := OLD.storage_path;
    NEW.uploaded_by := OLD.uploaded_by;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_media_bu ON public.inspection_media;
CREATE TRIGGER trg_inspection_media_bu
    BEFORE UPDATE ON public.inspection_media
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_media_before_update();

-- 3.3 Trigger BEFORE DELETE
CREATE OR REPLACE FUNCTION private.trg_inspection_media_before_delete()
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
        RAISE EXCEPTION 'Não é permitido excluir mídias de uma vistoria já concluída.';
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_inspection_media_bd ON public.inspection_media;
CREATE TRIGGER trg_inspection_media_bd
    BEFORE DELETE ON public.inspection_media
    FOR EACH ROW
    EXECUTE FUNCTION private.trg_inspection_media_before_delete();

-- 4. BUCKET PRIVADO NO SUPABASE STORAGE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'inspection-media',
    'inspection-media',
    false,
    26214400, -- 25 MB limite por arquivo no bucket
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

-- 5. POLICIES DO SUPABASE STORAGE (storage.objects)
-- O path é estruturado como: {company_id}/{inspection_id}/...

DROP POLICY IF EXISTS "inspection_media_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "inspection_media_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "inspection_media_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "inspection_media_storage_delete" ON storage.objects;

-- 5.1 Leitura: Apenas usuários autorizados a visualizar a vistoria correspondente
CREATE POLICY "inspection_media_storage_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'inspection-media'
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                -- Validar se o primeiro segmento do path é a empresa do usuário
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

-- 5.2 Inserção: Vistoria ativa da própria empresa com usuário apto a operar
CREATE POLICY "inspection_media_storage_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'inspection-media'
        AND (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (storage.foldername(name))[1]::text = (SELECT private.current_company_id())::text
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id::text = (storage.foldername(name))[2]::text
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

-- 5.3 Exclusão de objetos do Storage
CREATE POLICY "inspection_media_storage_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'inspection-media'
        AND (SELECT private.current_user_can_operate()) = TRUE
        AND (
            (SELECT private.is_super_admin()) = TRUE
            OR (
                (storage.foldername(name))[1]::text = (SELECT private.current_company_id())::text
                AND EXISTS (
                    SELECT 1 FROM public.inspections i
                    WHERE i.id::text = (storage.foldername(name))[2]::text
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

-- 6. ROW LEVEL SECURITY (RLS) NA TABELA public.inspection_media
ALTER TABLE public.inspection_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inspection_media_select_policy" ON public.inspection_media;
DROP POLICY IF EXISTS "inspection_media_insert_policy" ON public.inspection_media;
DROP POLICY IF EXISTS "inspection_media_update_policy" ON public.inspection_media;
DROP POLICY IF EXISTS "inspection_media_delete_policy" ON public.inspection_media;

-- Leitura de metadados
CREATE POLICY "inspection_media_select_policy"
    ON public.inspection_media
    FOR SELECT
    TO authenticated
    USING (
        (SELECT private.is_super_admin()) = TRUE
        OR EXISTS (
            SELECT 1 FROM public.inspections i
            WHERE i.id = inspection_media.inspection_id
        )
    );

-- Inserção de metadados
CREATE POLICY "inspection_media_insert_policy"
    ON public.inspection_media
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
                    WHERE i.id = inspection_media.inspection_id
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

-- Atualização de legenda e posição
CREATE POLICY "inspection_media_update_policy"
    ON public.inspection_media
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
                    WHERE i.id = inspection_media.inspection_id
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

-- Exclusão de registro de mídia
CREATE POLICY "inspection_media_delete_policy"
    ON public.inspection_media
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
                    WHERE i.id = inspection_media.inspection_id
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

-- 7. FUNÇÕES AUXILIARES / RPCS

-- 7.1 Reordenação em lote de fotos
CREATE OR REPLACE FUNCTION public.reorder_media(
    p_media_ids UUID[],
    p_new_positions INT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_comp UUID := (SELECT private.current_company_id());
    v_is_super BOOLEAN := (SELECT private.is_super_admin());
    i INT;
BEGIN
    IF NOT v_is_super AND NOT (SELECT private.current_user_can_operate()) THEN
        RAISE EXCEPTION 'Operação não permitida.';
    END IF;

    IF array_length(p_media_ids, 1) <> array_length(p_new_positions, 1) THEN
        RAISE EXCEPTION 'Parâmetros de reordenação inconsistentes.';
    END IF;

    FOR i IN 1..array_length(p_media_ids, 1) LOOP
        UPDATE public.inspection_media
        SET position = p_new_positions[i],
            updated_at = NOW()
        WHERE id = p_media_ids[i]
          AND (v_is_super OR company_id = v_user_comp);
    END LOOP;
END;
$$;

-- 7.2 Exclusão Segura de Mídia
CREATE OR REPLACE FUNCTION public.delete_inspection_media(p_media_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rec RECORD;
    v_user_comp UUID := (SELECT private.current_company_id());
    v_is_super BOOLEAN := (SELECT private.is_super_admin());
BEGIN
    SELECT * INTO v_rec FROM public.inspection_media WHERE id = p_media_id;

    IF v_rec IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mídia não encontrada.');
    END IF;

    IF NOT v_is_super AND v_rec.company_id <> v_user_comp THEN
        RAISE EXCEPTION 'Acesso negado.';
    END IF;

    DELETE FROM public.inspection_media WHERE id = p_media_id;

    RETURN jsonb_build_object(
        'success', true, 
        'deleted_id', p_media_id,
        'storage_path', v_rec.storage_path,
        'storage_bucket', v_rec.storage_bucket
    );
END;
$$;

-- 8. GRANTS
REVOKE ALL ON TABLE public.inspection_media FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.inspection_media TO authenticated;

REVOKE ALL ON FUNCTION public.reorder_media(UUID[], INT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_media(UUID[], INT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_inspection_media(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_inspection_media(UUID) TO authenticated;

-- ==============================================================================
-- FIM DA MIGRATION DA ETAPA 04
-- ==============================================================================
