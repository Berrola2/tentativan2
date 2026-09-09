import Dexie, { type Table } from 'dexie';

// ==============================================================================
// VISTORIA YZZY — TIPOS E INTERFACES INDEXEDDB (ETAPA 09)
// ==============================================================================

export type SyncStatus = 'SYNCED' | 'PENDING' | 'LOCAL_NEW' | 'LOCAL_DELETED' | 'CONFLICT' | 'ERROR';
export type OperationStatus = 'PENDING' | 'IN_FLIGHT' | 'APPLIED' | 'CONFLICT' | 'REJECTED' | 'NEEDS_ATTENTION';

export type OperationType =
  | 'CREATE_ROOM'
  | 'UPDATE_ROOM'
  | 'DELETE_ROOM'
  | 'REORDER_ROOM'
  | 'CREATE_ITEM'
  | 'UPDATE_ITEM'
  | 'DELETE_ITEM'
  | 'REORDER_ITEM'
  | 'CREATE_MEDIA'
  | 'UPDATE_MEDIA_CAPTION'
  | 'DELETE_MEDIA';

export interface OfflineInspection {
  id: string; // inspection_id UUID
  property_id: string;
  company_id: string;
  user_id: string;
  status: string; // 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_COMPLETION'
  inspection_type: string;
  scheduled_date?: string;
  property?: {
    id: string;
    title: string;
    address_street?: string;
    address_number?: string;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
  };
  inspector?: {
    id: string;
    full_name: string;
    email: string;
  };
  offline_available: boolean;
  downloaded_at: string;
  server_updated_at: string;
  local_updated_at: string;
  sync_status: SyncStatus;
  ready_for_completion?: boolean;
}

export interface OfflineRoom {
  id: string; // UUID
  inspection_id: string;
  company_id: string;
  name: string;
  room_type: string;
  position: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  server_updated_at?: string;
  sync_status: SyncStatus;
}

export interface OfflineItem {
  id: string; // UUID
  inspection_id: string;
  room_id: string;
  company_id: string;
  name: string;
  item_type: string;
  condition_status: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
  description?: string;
  requires_repair: boolean;
  repair_notes?: string;
  position: number;
  created_at: string;
  updated_at: string;
  server_updated_at?: string;
  sync_status: SyncStatus;
}

export interface OfflineMedia {
  id: string; // UUID
  inspection_id: string;
  room_id?: string;
  item_id?: string;
  company_id: string;
  media_type: 'PHOTO' | 'AUDIO';
  storage_path?: string;
  blob?: Blob; // NUNCA base64 — Blob binário puro
  thumbnail_url?: string;
  caption?: string;
  position: number;
  size_bytes: number;
  created_at: string;
  sync_status: SyncStatus;
}

export interface SyncQueueOperation {
  id?: number; // Auto-increment Dexie key
  operation_id: string; // UUID criptográfico
  entity_type: 'ROOM' | 'ITEM' | 'MEDIA';
  entity_id: string; // UUID
  operation_type: OperationType;
  inspection_id: string;
  payload: Record<string, any>;
  base_updated_at?: string;
  local_updated_at: string;
  created_at: string;
  attempt_count: number;
  last_attempt_at?: string;
  status: OperationStatus;
  error_code?: string;
  error_message?: string;
  depends_on?: string[]; // Array de operation_ids ou parent entity_ids
  operation_schema_version: string;
}

export interface OfflineConflict {
  id: string; // UUID
  operation_id: string;
  entity_type: 'ROOM' | 'ITEM' | 'MEDIA';
  entity_id: string;
  inspection_id: string;
  local_value: Record<string, any>;
  server_value: Record<string, any>;
  base_value?: Record<string, any>;
  fields_changed: string[];
  detected_at: string;
  resolved_at?: string;
  resolution_strategy?: 'USE_LOCAL' | 'USE_SERVER' | 'MANUAL_MERGE';
}

export interface SyncMetadata {
  key: string;
  value: any;
  updated_at: string;
}

export interface CachedReferenceData {
  key: string;
  data: any;
  cached_at: string;
}

// ==============================================================================
// CLASSE PRINCIPAL DEXIE: YzzyOfflineDatabase
// ==============================================================================

export class YzzyOfflineDatabase extends Dexie {
  offline_inspections!: Table<OfflineInspection, string>;
  offline_rooms!: Table<OfflineRoom, string>;
  offline_items!: Table<OfflineItem, string>;
  offline_media!: Table<OfflineMedia, string>;
  sync_queue!: Table<SyncQueueOperation, number>;
  conflicts!: Table<OfflineConflict, string>;
  sync_metadata!: Table<SyncMetadata, string>;
  cached_reference_data!: Table<CachedReferenceData, string>;

  constructor() {
    super('yzzy_offline');

    // DB Schema Version 1 (com versionamento para migrações seguras)
    this.version(1).stores({
      offline_inspections: 'id, property_id, company_id, user_id, status, sync_status',
      offline_rooms: 'id, inspection_id, company_id, position, sync_status',
      offline_items: 'id, inspection_id, room_id, company_id, condition_status, sync_status',
      offline_media: 'id, inspection_id, room_id, item_id, company_id, media_type, sync_status',
      sync_queue: '++id, operation_id, entity_id, entity_type, inspection_id, status, created_at',
      conflicts: 'id, operation_id, entity_id, inspection_id, detected_at',
      sync_metadata: 'key',
      cached_reference_data: 'key'
    });
  }
}

export const offlineDb = new YzzyOfflineDatabase();

// ==============================================================================
// UTILITÁRIOS DE DISPOSITIVO E ISOLAMENTO
// ==============================================================================

/**
 * Obtém ou gera o device_instance_id não-sensível para auditoria
 */
export async function getDeviceInstanceId(): Promise<string> {
  const existing = await offlineDb.sync_metadata.get('device_instance_id');
  if (existing && existing.value) {
    return existing.value as string;
  }
  const newId = crypto.randomUUID();
  await offlineDb.sync_metadata.put({
    key: 'device_instance_id',
    value: newId,
    updated_at: new Date().toISOString()
  });
  return newId;
}

/**
 * Limpa todos os dados locais se houver troca de usuário ou logout seguro
 */
export async function clearOfflineStorageForUser(checkPendingQueue = true): Promise<{ cleared: boolean; pendingCount: number }> {
  const pendingCount = await offlineDb.sync_queue
    .where('status')
    .equals('PENDING')
    .or('status')
    .equals('IN_FLIGHT')
    .count();

  if (checkPendingQueue && pendingCount > 0) {
    return { cleared: false, pendingCount };
  }

  await offlineDb.transaction('rw', [
    offlineDb.offline_inspections,
    offlineDb.offline_rooms,
    offlineDb.offline_items,
    offlineDb.offline_media,
    offlineDb.sync_queue,
    offlineDb.conflicts,
    offlineDb.cached_reference_data
  ], async () => {
    await offlineDb.offline_inspections.clear();
    await offlineDb.offline_rooms.clear();
    await offlineDb.offline_items.clear();
    await offlineDb.offline_media.clear();
    await offlineDb.sync_queue.clear();
    await offlineDb.conflicts.clear();
    await offlineDb.cached_reference_data.clear();
  });

  return { cleared: true, pendingCount: 0 };
}

/**
 * Obtém estatísticas de armazenamento local seguro (storage.estimate)
 */
export async function getStorageEstimate(): Promise<{
  usageMb: number;
  quotaMb: number;
  percentUsed: number;
  isLowSpace: boolean;
  persisted: boolean;
}> {
  let usage = 0;
  let quota = 0;
  let persisted = false;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    if (navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        usage = est.usage || 0;
        quota = est.quota || 0;
      } catch (e) {
        console.warn('Falha ao estimar armazenamento:', e);
      }
    }
    if (navigator.storage.persisted) {
      try {
        persisted = await navigator.storage.persisted();
      } catch (e) {
        // Ignorado
      }
    }
  }

  const usageMb = Math.round((usage / (1024 * 1024)) * 100) / 100;
  const quotaMb = Math.round((quota / (1024 * 1024)) * 100) / 100;
  const percentUsed = quota > 0 ? Math.round((usage / quota) * 1000) / 10 : 0;
  const isLowSpace = percentUsed > 85 || (quotaMb > 0 && quotaMb - usageMb < 50);

  return {
    usageMb,
    quotaMb,
    percentUsed,
    isLowSpace,
    persisted
  };
}

/**
 * Solicita persistência de armazenamento ao navegador
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch (e) {
      console.warn('Persistência de storage não concedida:', e);
      return false;
    }
  }
  return false;
}
