// ==============================================================================
// VISTORIA YZZY — SERVICE: GERENCIADOR DE COMPARAÇÕES ENTRADA × SAÍDA (ETAPA 08)
// ==============================================================================

import { supabase } from './supabaseClient';
import { getSignedMediaUrl } from './media';
import type { 
  InspectionComparison, 
  InspectionComparisonItem, 
  ComparisonReviewStatus 
} from '../types/comparison';

/**
 * Cria e executa o processamento determinístico da comparação Entrada × Saída.
 */
export async function createAndProcessComparison(
  checkInInspectionId: string,
  checkOutInspectionId: string
): Promise<{ success: boolean; comparisonId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_and_process_comparison', {
      p_check_in_inspection_id: checkInInspectionId,
      p_check_out_inspection_id: checkOutInspectionId,
    });

    if (error) {
      console.error('[ComparisonService] Erro ao criar comparação:', error.message);
      return { success: false, error: error.message };
    }

    const res = data as any;
    return {
      success: true,
      comparisonId: res?.comparison_id,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar comparação.';
    return { success: false, error: msg };
  }
}

/**
 * Busca os detalhes completos de uma comparação, incluindo itens e fotos pareadas.
 */
export async function fetchComparisonDetails(comparisonId: string): Promise<InspectionComparison | null> {
  try {
    // 1. Buscar a comparação
    const { data: compData, error: compErr } = await supabase
      .from('inspection_comparisons')
      .select(`
        *,
        property:properties(id, street, number, complement, neighborhood, city, state),
        check_in_inspection:inspections!fk_insp_comp_checkin(id, inspection_type, inspection_date, status),
        check_out_inspection:inspections!fk_insp_comp_checkout(id, inspection_type, inspection_date, status)
      `)
      .eq('id', comparisonId)
      .single();

    if (compErr || !compData) {
      console.error('[ComparisonService] Erro ao buscar comparação:', compErr?.message);
      return null;
    }

    // 2. Buscar os itens comparados
    const { data: itemsData, error: itemsErr } = await supabase
      .from('inspection_comparison_items')
      .select('*')
      .eq('comparison_id', comparisonId)
      .order('created_at', { ascending: true });

    if (itemsErr) {
      console.error('[ComparisonService] Erro ao buscar itens da comparação:', itemsErr.message);
    }

    // 3. Enriquecer itens com fotos de entrada e saída
    const items = (itemsData || []) as InspectionComparisonItem[];
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let checkInPhotos: any[] = [];
        let checkOutPhotos: any[] = [];

        if (item.check_in_item_id) {
          const { data: inMedias } = await supabase
            .from('inspection_media')
            .select('id, storage_path, caption')
            .eq('item_id', item.check_in_item_id);

          if (inMedias && inMedias.length > 0) {
            checkInPhotos = await Promise.all(
              inMedias.map(async (m) => ({
                ...m,
                signed_url: (await getSignedMediaUrl(m.storage_path)) || undefined,
              }))
            );
          }
        }

        if (item.check_out_item_id) {
          const { data: outMedias } = await supabase
            .from('inspection_media')
            .select('id, storage_path, caption')
            .eq('item_id', item.check_out_item_id);

          if (outMedias && outMedias.length > 0) {
            checkOutPhotos = await Promise.all(
              outMedias.map(async (m) => ({
                ...m,
                signed_url: (await getSignedMediaUrl(m.storage_path)) || undefined,
              }))
            );
          }
        }

        return {
          ...item,
          check_in_photos: checkInPhotos,
          check_out_photos: checkOutPhotos,
        };
      })
    );

    return {
      ...(compData as InspectionComparison),
      items: enrichedItems,
    };
  } catch (err) {
    console.error('[ComparisonService] Falha ao carregar detalhes:', err);
    return null;
  }
}

/**
 * Revisa um item individual da comparação (Confirmar, Descartar ou Ajustar).
 */
export async function reviewComparisonItem(
  itemId: string,
  reviewStatus: ComparisonReviewStatus,
  reviewerNotes?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('review_comparison_item', {
      p_item_id: itemId,
      p_review_status: reviewStatus,
      p_reviewer_notes: reviewerNotes || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao revisar item.';
    return { success: false, error: msg };
  }
}

/**
 * Finaliza a comparação gerando o snapshot pericial imutável.
 */
export async function finalizeComparison(
  comparisonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('finalize_comparison', {
      p_comparison_id: comparisonId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao finalizar comparação.';
    return { success: false, error: msg };
  }
}

/**
 * Reabre uma comparação finalizada (Apenas Gerente).
 */
export async function reopenComparison(
  comparisonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('reopen_comparison', {
      p_comparison_id: comparisonId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao reabrir comparação.';
    return { success: false, error: msg };
  }
}

/**
 * Lista todas as comparações de um imóvel específico.
 */
export async function listPropertyComparisons(
  propertyId: string
): Promise<InspectionComparison[]> {
  try {
    const { data, error } = await supabase
      .from('inspection_comparisons')
      .select(`
        *,
        check_in_inspection:inspections!fk_insp_comp_checkin(id, inspection_type, inspection_date, status),
        check_out_inspection:inspections!fk_insp_comp_checkout(id, inspection_type, inspection_date, status)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ComparisonService] Erro ao listar comparações do imóvel:', error.message);
      return [];
    }

    return (data || []) as InspectionComparison[];
  } catch {
    return [];
  }
}

/**
 * Gera resumo assistivo factual e não-julgatório de divergências textuais.
 */
export function generateDeterministicTextDiff(
  checkInDesc: string | null,
  checkOutDesc: string | null
): string {
  if (!checkInDesc && checkOutDesc) {
    return `Na vistoria de saída foi registrado: "${checkOutDesc}", informação não constante na entrada.`;
  }
  if (checkInDesc && !checkOutDesc) {
    return `Na vistoria de entrada constava: "${checkInDesc}", não mencionado na vistoria de saída.`;
  }
  if (checkInDesc && checkOutDesc && checkInDesc.trim() !== checkOutDesc.trim()) {
    return `Entrada: "${checkInDesc}" → Saída: "${checkOutDesc}".`;
  }
  return 'Descrições sem divergências relevantes identificadas.';
}
