// ==============================================================================
// VISTORIA YZZY — MOTOR DE SINCRONIZAÇÃO E OFFLINE-FIRST (ETAPA 09)
// ==============================================================================

import { supabase } from './supabaseClient';
import {
  offlineDb,
  getDeviceInstanceId,
  type OfflineInspection,
  type OfflineRoom,
  type OfflineItem,
  type OfflineMedia,
  type SyncQueueOperation,
  type OfflineConflict,
  type OperationType
} from './offlineDb';
import { networkState, type NetworkStatus } from './networkState';

export interface SyncProgressReport {
  isSyncing: boolean;
  totalPending: number;
  totalConflicts: number;
  lastSyncAt: string | null;
  lastError: string | null;
  operationsProcessed: number;
}

export interface InspectionDownloadOptions {
  includeThumbnailsOnly?: boolean;
  onProgress?: (step: string, percent: number) => void;
}

class SyncEngine {
  private isSyncing = false;
  private progressListeners: Set<(report: SyncProgressReport) => void> = new Set();
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Auto-sync ao recuperar conexão
      networkState.subscribe((status: NetworkStatus) => {
        if (status === 'ONLINE') {
          this.syncPendingOperations();
        }
      });

      // Auto-sync ao recuperar foco da aba/janela
      window.addEventListener('focus', () => {
        if (networkState.getStatus() === 'ONLINE') {
          this.syncPendingOperations();
        }
      });
    }
  }

  // ----------------------------------------------------------------------------
  // SUBSCRIBERS DE PROGRESSO
  // ----------------------------------------------------------------------------
  public subscribeProgress(listener: (report: SyncProgressReport) => void): () => void {
    this.progressListeners.add(listener);
    this.notifyProgress();
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  private async notifyProgress(operationsProcessed = 0) {
    const totalPending = await offlineDb.sync_queue
      .where('status')
      .equals('PENDING')
      .or('status')
      .equals('IN_FLIGHT')
      .count();

    const totalConflicts = await offlineDb.conflicts
      .filter((c) => !c.resolved_at)
      .count();

    const report: SyncProgressReport = {
      isSyncing: this.isSyncing,
      totalPending,
      totalConflicts,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError,
      operationsProcessed
    };

    this.progressListeners.forEach((fn) => fn(report));
  }

  // ----------------------------------------------------------------------------
  // 1. PREPARAR VISTORIA PARA OFFLINE ("Disponibilizar Offline")
  // ----------------------------------------------------------------------------
  public async prepareInspectionOffline(
    inspectionId: string,
    options: InspectionDownloadOptions = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      options.onProgress?.('Verificando dados da vistoria...', 10);

      // 1. Buscar Vistoria Completa
      const { data: inspection, error: inspErr } = await supabase
        .from('inspections')
        .select(`
          id, property_id, company_id, inspector_id, inspection_type, status, scheduled_date, updated_at,
          property:properties(id, title, address_street, address_number, address_neighborhood, address_city, address_state),
          inspector:profiles!inspections_inspector_id_fkey(id, full_name, email)
        `)
        .eq('id', inspectionId)
        .single();

      if (inspErr || !inspection) {
        throw new Error(inspErr?.message || 'Vistoria não encontrada.');
      }

      options.onProgress?.('Baixando ambientes e itens...', 30);

      // 2. Buscar Ambientes
      const { data: rooms, error: roomsErr } = await supabase
        .from('inspection_rooms')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('position', { ascending: true });

      if (roomsErr) throw new Error(roomsErr.message);

      // 3. Buscar Itens
      const { data: items, error: itemsErr } = await supabase
        .from('inspection_items')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('position', { ascending: true });

      if (itemsErr) throw new Error(itemsErr.message);

      options.onProgress?.('Baixando galeria de fotos...', 60);

      // 4. Buscar Mídias Existentes
      const { data: mediaList, error: mediaErr } = await supabase
        .from('inspection_media')
        .select('*')
        .eq('inspection_id', inspectionId);

      if (mediaErr) throw new Error(mediaErr.message);

      options.onProgress?.('Armazenando no dispositivo...', 85);

      const now = new Date().toISOString();

      // Gravar tudo no IndexedDB em transação atômica
      await offlineDb.transaction('rw', [
        offlineDb.offline_inspections,
        offlineDb.offline_rooms,
        offlineDb.offline_items,
        offlineDb.offline_media
      ], async () => {
        // Vistoria
        const offlineInsp: OfflineInspection = {
          id: inspection.id,
          property_id: inspection.property_id,
          company_id: inspection.company_id,
          user_id: inspection.inspector_id,
          status: inspection.status,
          inspection_type: inspection.inspection_type,
          scheduled_date: inspection.scheduled_date,
          property: inspection.property as any,
          inspector: inspection.inspector as any,
          offline_available: true,
          downloaded_at: now,
          server_updated_at: inspection.updated_at || now,
          local_updated_at: now,
          sync_status: 'SYNCED',
          ready_for_completion: false
        };
        await offlineDb.offline_inspections.put(offlineInsp);

        // Ambientes
        for (const r of rooms || []) {
          const offRoom: OfflineRoom = {
            id: r.id,
            inspection_id: r.inspection_id,
            company_id: r.company_id,
            name: r.name,
            room_type: r.room_type,
            position: r.position,
            notes: r.notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
            server_updated_at: r.updated_at,
            sync_status: 'SYNCED'
          };
          await offlineDb.offline_rooms.put(offRoom);
        }

        // Itens
        for (const it of items || []) {
          const offItem: OfflineItem = {
            id: it.id,
            inspection_id: it.inspection_id,
            room_id: it.room_id,
            company_id: it.company_id,
            name: it.name,
            item_type: it.item_type,
            condition_status: it.condition_status,
            description: it.description,
            requires_repair: it.requires_repair,
            repair_notes: it.repair_notes,
            position: it.position,
            created_at: it.created_at,
            updated_at: it.updated_at,
            server_updated_at: it.updated_at,
            sync_status: 'SYNCED'
          };
          await offlineDb.offline_items.put(offItem);
        }

        // Mídias
        for (const m of mediaList || []) {
          const offMedia: OfflineMedia = {
            id: m.id,
            inspection_id: m.inspection_id,
            room_id: m.room_id,
            item_id: m.item_id,
            company_id: m.company_id,
            media_type: m.media_type,
            storage_path: m.storage_path,
            caption: m.caption,
            position: m.position,
            size_bytes: 0,
            created_at: m.created_at,
            sync_status: 'SYNCED'
          };
          await offlineDb.offline_media.put(offMedia);
        }
      });

      options.onProgress?.('Vistoria pronta para uso offline!', 100);
      this.notifyProgress();
      return { success: true };
    } catch (err: any) {
      console.error('Erro ao disponibilizar vistoria offline:', err);
      return { success: false, error: err.message || 'Erro ao baixar dados.' };
    }
  }

  // ----------------------------------------------------------------------------
  // 2. ENFILEIRAMENTO DE OPERAÇÕES LOCAIS (OFFLINE MUTATIONS)
  // ----------------------------------------------------------------------------
  public async enqueueOperation(
    entityType: 'ROOM' | 'ITEM' | 'MEDIA',
    entityId: string,
    operationType: OperationType,
    inspectionId: string,
    payload: Record<string, any>,
    baseUpdatedAt?: string,
    dependsOn?: string[]
  ): Promise<string> {
    const opId = crypto.randomUUID();
    const now = new Date().toISOString();

    const op: SyncQueueOperation = {
      operation_id: opId,
      entity_type: entityType,
      entity_id: entityId,
      operation_type: operationType,
      inspection_id: inspectionId,
      payload,
      base_updated_at: baseUpdatedAt,
      local_updated_at: now,
      created_at: now,
      attempt_count: 0,
      status: 'PENDING',
      depends_on: dependsOn || [],
      operation_schema_version: '1.0'
    };

    await offlineDb.sync_queue.add(op);
    this.notifyProgress();

    // Se estiver online, tentar sincronizar imediatamente em segundo plano
    if (networkState.getStatus() === 'ONLINE') {
      setTimeout(() => this.syncPendingOperations(), 100);
    }

    return opId;
  }

  // Helper: Criar Ambiente Offline
  public async offlineCreateRoom(
    inspectionId: string,
    companyId: string,
    name: string,
    roomType: string,
    position = 0,
    notes?: string
  ): Promise<OfflineRoom> {
    const roomId = crypto.randomUUID();
    const now = new Date().toISOString();

    const room: OfflineRoom = {
      id: roomId,
      inspection_id: inspectionId,
      company_id: companyId,
      name,
      room_type: roomType,
      position,
      notes,
      created_at: now,
      updated_at: now,
      sync_status: 'LOCAL_NEW'
    };

    await offlineDb.offline_rooms.put(room);
    await this.enqueueOperation('ROOM', roomId, 'CREATE_ROOM', inspectionId, {
      inspection_id: inspectionId,
      name,
      room_type: roomType,
      position,
      notes
    });

    return room;
  }

  // Helper: Atualizar Ambiente Offline
  public async offlineUpdateRoom(
    roomId: string,
    inspectionId: string,
    updates: Partial<OfflineRoom>
  ): Promise<void> {
    const existing = await offlineDb.offline_rooms.get(roomId);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updated_at: now, sync_status: 'PENDING' as const };
    await offlineDb.offline_rooms.put(updated);

    await this.enqueueOperation(
      'ROOM',
      roomId,
      'UPDATE_ROOM',
      inspectionId,
      { ...updates, inspection_id: inspectionId },
      existing.server_updated_at
    );
  }

  // Helper: Criar Item Offline
  public async offlineCreateItem(
    inspectionId: string,
    roomId: string,
    companyId: string,
    name: string,
    itemType: string,
    conditionStatus: OfflineItem['condition_status'] = 'GOOD',
    description?: string,
    requiresRepair = false,
    repairNotes?: string,
    position = 0
  ): Promise<OfflineItem> {
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();

    const item: OfflineItem = {
      id: itemId,
      inspection_id: inspectionId,
      room_id: roomId,
      company_id: companyId,
      name,
      item_type: itemType,
      condition_status: conditionStatus,
      description,
      requires_repair: requiresRepair,
      repair_notes: repairNotes,
      position,
      created_at: now,
      updated_at: now,
      sync_status: 'LOCAL_NEW'
    };

    await offlineDb.offline_items.put(item);
    await this.enqueueOperation(
      'ITEM',
      itemId,
      'CREATE_ITEM',
      inspectionId,
      {
        inspection_id: inspectionId,
        room_id: roomId,
        name,
        item_type: itemType,
        condition_status: conditionStatus,
        description,
        requires_repair: requiresRepair,
        repair_notes: repairNotes,
        position
      },
      undefined,
      [roomId] // Depende do Room
    );

    return item;
  }

  // Helper: Atualizar Item Offline
  public async offlineUpdateItem(
    itemId: string,
    inspectionId: string,
    updates: Partial<OfflineItem>
  ): Promise<void> {
    const existing = await offlineDb.offline_items.get(itemId);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated = { ...existing, ...updates, updated_at: now, sync_status: 'PENDING' as const };
    await offlineDb.offline_items.put(updated);

    await this.enqueueOperation(
      'ITEM',
      itemId,
      'UPDATE_ITEM',
      inspectionId,
      { ...updates, inspection_id: inspectionId },
      existing.server_updated_at
    );
  }

  // Helper: Salvar Foto como Blob Nativo (Zero base64)
  public async offlineCapturePhoto(
    inspectionId: string,
    companyId: string,
    photoBlob: Blob,
    roomId?: string,
    itemId?: string,
    caption?: string
  ): Promise<OfflineMedia> {
    const mediaId = crypto.randomUUID();
    const now = new Date().toISOString();

    const media: OfflineMedia = {
      id: mediaId,
      inspection_id: inspectionId,
      room_id: roomId,
      item_id: itemId,
      company_id: companyId,
      media_type: 'PHOTO',
      blob: photoBlob, // Blob binário puro
      caption,
      position: 0,
      size_bytes: photoBlob.size,
      created_at: now,
      sync_status: 'LOCAL_NEW'
    };

    await offlineDb.offline_media.put(media);

    const dependsOn = [];
    if (roomId) dependsOn.push(roomId);
    if (itemId) dependsOn.push(itemId);

    await this.enqueueOperation(
      'MEDIA',
      mediaId,
      'CREATE_MEDIA',
      inspectionId,
      {
        inspection_id: inspectionId,
        room_id: roomId,
        item_id: itemId,
        media_type: 'PHOTO',
        caption,
        position: 0
      },
      undefined,
      dependsOn
    );

    return media;
  }

  // ----------------------------------------------------------------------------
  // 3. PROCESSAMENTO TOPOLÓGICO DA FILA E SINCRONIZAÇÃO EM LOTE
  // ----------------------------------------------------------------------------
  public async syncPendingOperations(): Promise<{
    processed: number;
    success: number;
    failed: number;
    conflicts: number;
  }> {
    if (this.isSyncing) {
      return { processed: 0, success: 0, failed: 0, conflicts: 0 };
    }

    const currentNet = networkState.getStatus();
    if (currentNet === 'OFFLINE') {
      return { processed: 0, success: 0, failed: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifyProgress();

    let processedCount = 0;
    let successCount = 0;
    let failCount = 0;
    let conflictCount = 0;

    try {
      // 1. Obter operações pendentes
      const pendingOps = await offlineDb.sync_queue
        .where('status')
        .equals('PENDING')
        .or('status')
        .equals('IN_FLIGHT')
        .toArray();

      if (pendingOps.length === 0) {
        this.isSyncing = false;
        this.lastSyncAt = new Date().toISOString();
        this.notifyProgress();
        return { processed: 0, success: 0, failed: 0, conflicts: 0 };
      }

      // 2. Ordenação Topológica: CREATE_ROOM -> CREATE_ITEM -> CREATE_MEDIA -> UPDATES -> DELETES
      const typePriority: Record<OperationType, number> = {
        CREATE_ROOM: 1,
        CREATE_ITEM: 2,
        CREATE_MEDIA: 3,
        UPDATE_ROOM: 4,
        UPDATE_ITEM: 5,
        UPDATE_MEDIA_CAPTION: 6,
        REORDER_ROOM: 7,
        REORDER_ITEM: 8,
        DELETE_MEDIA: 9,
        DELETE_ITEM: 10,
        DELETE_ROOM: 11
      };

      const sortedOps = [...pendingOps].sort((a, b) => {
        const pA = typePriority[a.operation_type] || 50;
        const pB = typePriority[b.operation_type] || 50;
        if (pA !== pB) return pA - pB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // 3. Processar em lotes (batch de até 30 operações)
      const BATCH_SIZE = 30;
      const deviceInstanceId = await getDeviceInstanceId();

      for (let i = 0; i < sortedOps.length; i += BATCH_SIZE) {
        const batch = sortedOps.slice(i, i + BATCH_SIZE);
        const preparedBatch: any[] = [];

        // Tratar uploads de fotos binárias antes de enviar o batch de RPC
        for (const op of batch) {
          if (op.operation_type === 'CREATE_MEDIA') {
            const mediaRecord = await offlineDb.offline_media.get(op.entity_id);
            if (mediaRecord && mediaRecord.blob && !op.payload.storage_path) {
              try {
                // Upload para Supabase Storage
                const fileExt = mediaRecord.media_type === 'PHOTO' ? 'jpg' : 'webm';
                const filePath = `${op.inspection_id}/${op.entity_id}.${fileExt}`;

                const { error: uploadErr } = await supabase.storage
                  .from('inspection-photos')
                  .upload(filePath, mediaRecord.blob, {
                    contentType: mediaRecord.media_type === 'PHOTO' ? 'image/jpeg' : 'audio/webm',
                    upsert: true
                  });

                if (!uploadErr) {
                  op.payload.storage_path = filePath;
                  await offlineDb.sync_queue.put(op);
                } else {
                  console.warn('Erro ao subir blob de foto:', uploadErr);
                }
              } catch (uErr) {
                console.warn('Falha transitória no upload do blob:', uErr);
              }
            }
          }

          preparedBatch.push({
            operation_id: op.operation_id,
            entity_type: op.entity_type,
            entity_id: op.entity_id,
            operation_type: op.operation_type,
            payload: op.payload,
            base_updated_at: op.base_updated_at
          });
        }

        // Enviar batch via RPC pública idempotente
        const syncSessionId = crypto.randomUUID();
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sync_inspection_operations', {
          p_sync_session_id: syncSessionId,
          p_device_instance_id: deviceInstanceId,
          p_operations: preparedBatch
        });

        if (rpcErr) {
          console.error('Erro na RPC de sincronização:', rpcErr);
          this.lastError = rpcErr.message;
          // Aplicar retry com backoff para o lote
          for (const op of batch) {
            op.attempt_count = (op.attempt_count || 0) + 1;
            op.status = op.attempt_count > 5 ? 'NEEDS_ATTENTION' : 'PENDING';
            op.error_message = rpcErr.message;
            await offlineDb.sync_queue.put(op);
          }
          failCount += batch.length;
          continue;
        }

        // Processar resultados individuais do batch
        const results = rpcRes?.results || [];
        for (const itemRes of results) {
          processedCount++;
          const targetOp = batch.find((b) => b.operation_id === itemRes.operation_id);
          if (!targetOp) continue;

          if (itemRes.status === 'APPLIED' || itemRes.status === 'ALREADY_APPLIED') {
            successCount++;
            // Remover da fila ou marcar como aplicada
            await offlineDb.sync_queue.delete(targetOp.id!);

            // Atualizar status da entidade local
            if (targetOp.entity_type === 'ROOM') {
              const r = await offlineDb.offline_rooms.get(targetOp.entity_id);
              if (r) await offlineDb.offline_rooms.put({ ...r, sync_status: 'SYNCED', server_updated_at: new Date().toISOString() });
            } else if (targetOp.entity_type === 'ITEM') {
              const it = await offlineDb.offline_items.get(targetOp.entity_id);
              if (it) await offlineDb.offline_items.put({ ...it, sync_status: 'SYNCED', server_updated_at: new Date().toISOString() });
            } else if (targetOp.entity_type === 'MEDIA') {
              const m = await offlineDb.offline_media.get(targetOp.entity_id);
              if (m) await offlineDb.offline_media.put({ ...m, sync_status: 'SYNCED' });
            }
          } else if (itemRes.status === 'CONFLICT') {
            conflictCount++;
            targetOp.status = 'CONFLICT';
            await offlineDb.sync_queue.put(targetOp);

            // Registrar na tabela de conflitos
            const conflictRecord: OfflineConflict = {
              id: crypto.randomUUID(),
              operation_id: targetOp.operation_id,
              entity_type: targetOp.entity_type,
              entity_id: targetOp.entity_id,
              inspection_id: targetOp.inspection_id,
              local_value: targetOp.payload,
              server_value: itemRes.server_value || {},
              fields_changed: Object.keys(itemRes.server_value || {}),
              detected_at: new Date().toISOString()
            };
            await offlineDb.conflicts.put(conflictRecord);
          } else {
            failCount++;
            targetOp.status = 'REJECTED';
            targetOp.error_message = itemRes.error || 'Operação rejeitada pelo servidor.';
            await offlineDb.sync_queue.put(targetOp);
          }
        }
      }

      this.lastSyncAt = new Date().toISOString();
    } catch (err: any) {
      console.error('Falha geral no ciclo de sync:', err);
      this.lastError = err.message || 'Falha de comunicação.';
    } finally {
      this.isSyncing = false;
      this.notifyProgress(processedCount);
    }

    return {
      processed: processedCount,
      success: successCount,
      failed: failCount,
      conflicts: conflictCount
    };
  }

  // ----------------------------------------------------------------------------
  // 4. RESOLUÇÃO DE CONFLITOS THREE-WAY
  // ----------------------------------------------------------------------------
  public async resolveConflict(
    conflictId: string,
    strategy: 'USE_LOCAL' | 'USE_SERVER' | 'MANUAL_MERGE',
    mergedPayload?: Record<string, any>
  ): Promise<boolean> {
    const conflict = await offlineDb.conflicts.get(conflictId);
    if (!conflict) return false;

    if (strategy === 'USE_LOCAL') {
      // Re-enfileirar operação forçando sobrescrita com nova versão base
      const op = await offlineDb.sync_queue
        .where('operation_id')
        .equals(conflict.operation_id)
        .first();

      if (op) {
        op.status = 'PENDING';
        op.base_updated_at = new Date().toISOString(); // Atualiza base version
        await offlineDb.sync_queue.put(op);
      }
    } else if (strategy === 'USE_SERVER') {
      // Descartar operação local e aplicar valores do servidor no IndexedDB
      await offlineDb.sync_queue
        .where('operation_id')
        .equals(conflict.operation_id)
        .delete();

      if (conflict.entity_type === 'ITEM') {
        const it = await offlineDb.offline_items.get(conflict.entity_id);
        if (it) {
          await offlineDb.offline_items.put({
            ...it,
            ...conflict.server_value,
            sync_status: 'SYNCED'
          });
        }
      }
    } else if (strategy === 'MANUAL_MERGE' && mergedPayload) {
      // Aplicar merge manual
      if (conflict.entity_type === 'ITEM') {
        const it = await offlineDb.offline_items.get(conflict.entity_id);
        if (it) {
          await offlineDb.offline_items.put({
            ...it,
            ...mergedPayload,
            sync_status: 'PENDING'
          });
        }
      }

      const op = await offlineDb.sync_queue
        .where('operation_id')
        .equals(conflict.operation_id)
        .first();

      if (op) {
        op.payload = { ...op.payload, ...mergedPayload };
        op.base_updated_at = new Date().toISOString();
        op.status = 'PENDING';
        await offlineDb.sync_queue.put(op);
      }
    }

    conflict.resolved_at = new Date().toISOString();
    conflict.resolution_strategy = strategy;
    await offlineDb.conflicts.put(conflict);

    this.notifyProgress();
    this.syncPendingOperations();
    return true;
  }

  // ----------------------------------------------------------------------------
  // 5. REMOVER VISTORIA DO DISPOSITIVO
  // ----------------------------------------------------------------------------
  public async removeOfflineInspection(
    inspectionId: string,
    force = false
  ): Promise<{ success: boolean; pendingOpsCount: number }> {
    const pendingOps = await offlineDb.sync_queue
      .where('inspection_id')
      .equals(inspectionId)
      .and((op) => op.status === 'PENDING' || op.status === 'IN_FLIGHT')
      .count();

    if (pendingOps > 0 && !force) {
      return { success: false, pendingOpsCount: pendingOps };
    }

    await offlineDb.transaction('rw', [
      offlineDb.offline_inspections,
      offlineDb.offline_rooms,
      offlineDb.offline_items,
      offlineDb.offline_media,
      offlineDb.sync_queue,
      offlineDb.conflicts
    ], async () => {
      await offlineDb.offline_inspections.delete(inspectionId);
      await offlineDb.offline_rooms.where('inspection_id').equals(inspectionId).delete();
      await offlineDb.offline_items.where('inspection_id').equals(inspectionId).delete();
      await offlineDb.offline_media.where('inspection_id').equals(inspectionId).delete();
      if (force) {
        await offlineDb.sync_queue.where('inspection_id').equals(inspectionId).delete();
        await offlineDb.conflicts.where('inspection_id').equals(inspectionId).delete();
      }
    });

    this.notifyProgress();
    return { success: true, pendingOpsCount: 0 };
  }
}

export const syncEngine = new SyncEngine();
