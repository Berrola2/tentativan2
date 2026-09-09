// ==============================================================================
// VISTORIA YZZY — TIPOS OFICIAIS: ETAPA 03 (IMÓVEIS, VISTORIAS, AMBIENTES E ITENS)
// ==============================================================================

export type PropertyType = 
  | 'HOUSE'
  | 'APARTMENT'
  | 'COMMERCIAL'
  | 'OFFICE'
  | 'LAND'
  | 'OTHER';

export type InspectionType = 
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'Entrada'
  | 'Saída'
  | 'Periódica'
  | 'Constatação'
  | string;

export type InspectionStatus = 
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ARCHIVED';

export type ItemCondition = 
  | 'NEW'
  | 'GOOD'
  | 'REGULAR'
  | 'BAD'
  | 'DAMAGED'
  | 'NOT_APPLICABLE'
  | 'Novo'
  | 'Bom'
  | 'Regular'
  | 'Ruim'
  | 'Danificado'
  | 'Não se aplica'
  | string;

export type RepairUrgency = 'BAIXA' | 'MEDIA' | 'ALTA' | 'Imediata' | 'Curto Prazo' | 'Médio Prazo' | string;

export interface Property {
  id: string;
  company_id: string;
  internal_code: string | null;
  property_type: PropertyType;
  street: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  notes: string | null;
  active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inspection {
  id: string;
  company_id: string;
  property_id: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  title: string;
  inspection_date: string;
  scheduled_date: string | null;
  inspector_id: string | null;
  created_by: string | null;
  last_edited_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  reopened_at: string | null;
  reopened_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joins opcionais
  property?: Property;
  rooms_count?: number;
  items_count?: number;
}

export interface InspectionRoom {
  id: string;
  company_id?: string;
  inspection_id?: string;
  name: string;
  room_type?: string | null;
  position?: number;
  notes?: string | null;
  generalNotes?: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  items: InspectionItem[];
  photos: PhotoItem[];
}

export interface InspectionItem {
  id: string;
  company_id?: string;
  inspection_id?: string;
  room_id?: string;
  name: string;
  item_type?: string | null;
  condition_status?: ItemCondition;
  status?: string;
  description?: string | null;
  requires_repair?: boolean;
  needRepair?: boolean;
  repair_notes?: string | null;
  repairDetails?: string;
  repairUrgency?: RepairUrgency;
  position?: number;
  photos: PhotoItem[];
  observations?: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Labels em PT-BR com index signatures seguras
export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  HOUSE: 'Casa',
  APARTMENT: 'Apartamento',
  COMMERCIAL: 'Comercial',
  OFFICE: 'Escritório',
  LAND: 'Terreno',
  OTHER: 'Outro',
};

export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  CHECK_IN: 'Vistoria de Entrada / Entrega de Chaves',
  CHECK_OUT: 'Vistoria de Saída / Devolução de Chaves',
  Entrada: 'Vistoria de Entrada',
  Saída: 'Vistoria de Saída',
  Periódica: 'Vistoria Periódica',
  Constatação: 'Vistoria de Constatação',
};

export const INSPECTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluída',
  ARCHIVED: 'Arquivada',
};

export const ITEM_CONDITION_LABELS: Record<string, string> = {
  NEW: 'Novo',
  GOOD: 'Bom',
  REGULAR: 'Regular',
  BAD: 'Ruim',
  DAMAGED: 'Danificado',
  NOT_APPLICABLE: 'Não se aplica',
  Novo: 'Novo',
  Bom: 'Bom',
  Regular: 'Regular',
  Ruim: 'Ruim',
  Danificado: 'Danificado',
  'Não se aplica': 'Não se aplica',
};

export const ITEM_CONDITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  NEW: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  GOOD: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  REGULAR: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  BAD: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  DAMAGED: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  NOT_APPLICABLE: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  Novo: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Bom: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Regular: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Ruim: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  Danificado: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  'Não se aplica': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

// Sugestões de Ambientes e Itens comuns
export const COMMON_ROOM_TEMPLATES = [
  'Sala de Estar',
  'Cozinha',
  'Quarto Principal',
  'Quarto 2',
  'Banheiro Social',
  'Suíte',
  'Lavanderia / Área de Serviço',
  'Garagem',
  'Varanda / Sacada',
  'Área Externa',
  'Lavabo',
  'Depósito',
];

export const COMMON_ITEM_SUGGESTIONS: Record<string, string[]> = {
  default: [
    'Paredes e Pintura',
    'Piso e Rodapés',
    'Teto e Forro',
    'Porta e Fechadura',
    'Janela e Vidros',
    'Tomadas e Interruptores',
    'Luminárias e Lâmpadas',
  ],
  cozinha: [
    'Paredes e Azulejos',
    'Piso',
    'Bancada e Pia',
    'Torneira',
    'Armários',
    'Tomadas e Interruptores',
    'Teto',
  ],
  banheiro: [
    'Paredes e Revestimentos',
    'Piso e Ralo',
    'Vaso Sanitário e Descarga',
    'Lavatório e Torneira',
    'Box e Vidros',
    'Chuveiro',
    'Espelho',
  ],
};

// ==============================================================================
// TIPOS RETROCOMPATÍVEIS PARA COMPONENTES LEGADOS
// ==============================================================================

export type ConservationStatus = ItemCondition | string;

export interface PhotoItem {
  id: string;
  url?: string;
  dataUrl?: string;
  caption?: string;
  timestamp?: string;
}

export type LegacyItem = InspectionItem;
export type Room = InspectionRoom;

export interface QuickTemplate {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  rooms: { name: string; items: string[] }[];
}

export interface InspectionData {
  id: string;
  title: string;
  inspectionType?: string;
  date?: string;
  time?: string;
  inspectorName?: string;
  inspectorCpfCreci?: string;
  tenantName?: string;
  tenantCpf?: string;
  ownerName?: string;
  propertyAddress?: string;
  propertyNumber?: string;
  propertyComplement?: string;
  propertyNeighborhood?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  waterMeter?: string;
  energyMeter?: string;
  gasMeter?: string;
  keysInfo?: string;
  generalObservations?: string;
  companyName?: string;
  companyLogo?: string;
  companyCnpj?: string;
  companyPhone?: string;
  rooms: Room[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  bucketName?: string;
  tableName?: string;
  autoSync?: boolean;
}
