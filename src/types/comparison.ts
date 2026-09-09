// ==============================================================================
// VISTORIA YZZY — TIPOS: ETAPA 08 (COMPARAÇÃO AUTOMÁTICA ENTRADA × SAÍDA)
// ==============================================================================

export type ComparisonStatus = 
  | 'DRAFT'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'REVIEWED'
  | 'FINALIZED'
  | 'FAILED';

export type ComparisonChangeType = 
  | 'UNCHANGED'
  | 'CONDITION_IMPROVED'
  | 'CONDITION_WORSENED'
  | 'DESCRIPTION_CHANGED'
  | 'REPAIR_ADDED'
  | 'REPAIR_REMOVED'
  | 'ITEM_ADDED'
  | 'ITEM_REMOVED'
  | 'ROOM_ADDED'
  | 'ROOM_REMOVED'
  | 'POSSIBLE_CHANGE'
  | 'MANUAL_REVIEW_REQUIRED';

export type ComparisonMatchMethod = 
  | 'EXACT_NAME'
  | 'NORMALIZED_NAME'
  | 'MANUAL'
  | 'UNMATCHED';

export type ComparisonReviewStatus = 
  | 'PENDING'
  | 'CONFIRMED'
  | 'DISMISSED'
  | 'EDITED';

export type ComparisonEventType = 
  | 'COMPARISON_CREATED'
  | 'COMPARISON_PROCESSED'
  | 'ITEM_MATCHED_MANUALLY'
  | 'CHANGE_CONFIRMED'
  | 'CHANGE_DISMISSED'
  | 'COMPARISON_FINALIZED'
  | 'COMPARISON_REOPENED';

export interface InspectionComparisonSummary {
  total_rooms: number;
  total_items: number;
  unchanged: number;
  worsened: number;
  improved: number;
  repairs_added: number;
  repairs_removed: number;
  items_added: number;
  items_removed: number;
  manual_review_required: number;
}

export interface InspectionComparisonItem {
  id: string;
  company_id: string;
  comparison_id: string;
  room_name: string;
  item_name: string;
  check_in_room_id: string | null;
  check_out_room_id: string | null;
  check_in_item_id: string | null;
  check_out_item_id: string | null;
  match_method: ComparisonMatchMethod;
  manual_match: boolean;
  change_type: ComparisonChangeType;
  previous_condition: string | null;
  current_condition: string | null;
  previous_requires_repair: boolean;
  current_requires_repair: boolean;
  previous_description: string | null;
  current_description: string | null;
  ai_summary: string | null;
  ai_uncertainty: boolean;
  review_status: ComparisonReviewStatus;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  check_in_photos?: Array<{ id: string; storage_path: string; signed_url?: string; caption?: string }>;
  check_out_photos?: Array<{ id: string; storage_path: string; signed_url?: string; caption?: string }>;
}

export interface InspectionComparison {
  id: string;
  company_id: string;
  property_id: string;
  check_in_inspection_id: string;
  check_out_inspection_id: string;
  status: ComparisonStatus;
  version: number;
  summary_json: InspectionComparisonSummary;
  snapshot_json?: any;
  created_by: string | null;
  reviewed_by: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  property?: {
    id: string;
    street: string;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
  };
  check_in_inspection?: {
    id: string;
    inspection_type: string;
    inspection_date: string;
    status: string;
  };
  check_out_inspection?: {
    id: string;
    inspection_type: string;
    inspection_date: string;
    status: string;
  };
  items?: InspectionComparisonItem[];
}

export const COMPARISON_CHANGE_LABELS: Record<ComparisonChangeType, { label: string; color: string; badgeBg: string }> = {
  UNCHANGED: { label: 'Sem Alteração', color: 'text-slate-600', badgeBg: 'bg-slate-100 border-slate-200' },
  CONDITION_IMPROVED: { label: 'Condição Melhorou', color: 'text-emerald-700', badgeBg: 'bg-emerald-50 border-emerald-200' },
  CONDITION_WORSENED: { label: 'Condição Piorou', color: 'text-rose-700', badgeBg: 'bg-rose-50 border-rose-200' },
  DESCRIPTION_CHANGED: { label: 'Descrição Alterada', color: 'text-blue-700', badgeBg: 'bg-blue-50 border-blue-200' },
  REPAIR_ADDED: { label: 'Novo Reparo Necessário', color: 'text-amber-700', badgeBg: 'bg-amber-50 border-amber-200' },
  REPAIR_REMOVED: { label: 'Reparo Resolvido', color: 'text-emerald-700', badgeBg: 'bg-emerald-50 border-emerald-200' },
  ITEM_ADDED: { label: 'Item Adicionado', color: 'text-indigo-700', badgeBg: 'bg-indigo-50 border-indigo-200' },
  ITEM_REMOVED: { label: 'Item Removido/Ausente', color: 'text-orange-700', badgeBg: 'bg-orange-50 border-orange-200' },
  ROOM_ADDED: { label: 'Cômodo Adicionado', color: 'text-indigo-700', badgeBg: 'bg-indigo-50 border-indigo-200' },
  ROOM_REMOVED: { label: 'Cômodo Removido', color: 'text-orange-700', badgeBg: 'bg-orange-50 border-orange-200' },
  POSSIBLE_CHANGE: { label: 'Possível Alteração', color: 'text-purple-700', badgeBg: 'bg-purple-50 border-purple-200' },
  MANUAL_REVIEW_REQUIRED: { label: 'Revisão Manual Necessária', color: 'text-amber-700', badgeBg: 'bg-amber-50 border-amber-200' },
};
