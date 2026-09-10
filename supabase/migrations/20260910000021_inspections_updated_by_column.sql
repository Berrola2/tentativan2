-- ==============================================================================
-- VISTORIA YZZY — MIGRATION: 20260910000021_inspections_updated_by_column.sql
-- ==============================================================================
-- Adiciona coluna updated_by em public.inspections para compatibilidade plena com
-- a trigger genérica private.trg_entity_before_update()
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'inspections' 
          AND column_name = 'updated_by'
    ) THEN
        ALTER TABLE public.inspections 
        ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;
