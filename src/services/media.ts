// ==============================================================================
// VISTORIA YZZY — SERVICE: MOTOR DE MÍDIA, FOTOS E SUPABASE STORAGE
// ==============================================================================

import { supabase } from './supabaseClient';
import { syncEngine } from './syncEngine';
import { networkState } from './networkState';
import type { 

  InspectionMedia, 
  UploadQueueItem, 
  CompressionResult, 
  CompressionOptions 
} from '../types/media';


// Configurações e limites de infraestrutura
export const MEDIA_CONFIG = {
  MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024, // 20 MB limite original
  MAX_DIMENSION: 1920, // 1920px lado maior
  JPEG_QUALITY: 0.82, // Qualidade visual nítida para laudos
  CONCURRENT_UPLOADS: 2, // Limite de concorrência mobile-friendly
  SIGNED_URL_TTL_SECONDS: 900, // 15 minutos de expiração da signed URL
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
};

// ==============================================================================
// 1. COMPRESSÃO DE IMAGENS NO CLIENTE (CANVAS HTML5)
// ==============================================================================

/**
 * Comprime uma imagem no navegador utilizando Canvas HTML5.
 * - Reduz resolução para max 1920px mantendo proporções;
 * - Remove metadados EXIF/GPS por renderização em novo canvas;
 * - Comprime em JPEG com qualidade 0.82;
 * - Preserva nitidez para evidências técnicas de vistoria.
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const startTime = performance.now();
  const maxDim = options.maxDimension || MEDIA_CONFIG.MAX_DIMENSION;
  const quality = options.quality ?? MEDIA_CONFIG.JPEG_QUALITY;
  const targetMime = options.mimeType || 'image/jpeg';

  return new Promise((resolve, reject) => {
    // Validação de tipo MIME
    if (file.type && !MEDIA_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
      return reject(
        new Error(`Formato de imagem não suportado: ${file.type}. Formatos permitidos: JPG, PNG, WEBP, HEIC.`)
      );
    }

    // Validação de tamanho máximo pré-compressão
    if (file.size > MEDIA_CONFIG.MAX_FILE_SIZE_BYTES) {
      return reject(
        new Error(`A imagem original de ${(file.size / (1024 * 1024)).toFixed(1)}MB excede o limite máximo permitido de 20MB.`)
      );
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;

      // Calcular novas dimensões mantendo aspect ratio
      let width = originalWidth;
      let height = originalHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      // Renderizar em Canvas novo (remove EXIF/GPS e padroniza buffer)
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        return reject(new Error('Não foi possível inicializar o contexto 2D do Canvas.'));
      }

      // Fundo branco para imagens com transparência convertidas para JPEG
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Suavização de alta qualidade
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Falha ao exportar blob comprimido do Canvas.'));
          }

          const durationMs = Math.round(performance.now() - startTime);
          const compressedSize = blob.size;
          const compressionRatio = Number((1 - compressedSize / file.size).toFixed(3));

          resolve({
            blob,
            width,
            height,
            originalWidth,
            originalHeight,
            originalSize: file.size,
            compressedSize,
            mimeType: targetMime,
            compressionRatio,
            durationMs,
          });
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Falha ao decodificar arquivo de imagem no dispositivo.'));
    };

    img.src = objectUrl;
  });
}

// ==============================================================================
// 2. CACHE DE SIGNED URLS EM MEMÓRIA
// ==============================================================================

interface CachedUrl {
  url: string;
  expiresAt: number; // timestamp ms
}

const signedUrlCache = new Map<string, CachedUrl>();

/**
 * Obtém URL assinada com expiração de 15 minutos e cache em memória.
 */
export async function getSignedMediaUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;

  const now = Date.now();
  const cached = signedUrlCache.get(storagePath);
  
  // Se existir no cache e faltar mais de 60 segundos para expirar, reutiliza
  if (cached && cached.expiresAt > now + 60000) {
    return cached.url;
  }

  try {
    const { data, error } = await supabase.storage
      .from('inspection-media')
      .createSignedUrl(storagePath, MEDIA_CONFIG.SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.warn(`[MediaService] Erro ao criar signed URL para ${storagePath}:`, error?.message);
      return null;
    }

    const expiresAt = now + (MEDIA_CONFIG.SIGNED_URL_TTL_SECONDS * 1000);
    signedUrlCache.set(storagePath, { url: data.signedUrl, expiresAt });
    return data.signedUrl;
  } catch (err) {
    console.error('[MediaService] Falha inesperada ao obter signed URL:', err);
    return null;
  }
}

/**
 * Obtém signed URLs em lote para uma lista de registros de mídia.
 */
export async function enrichMediaWithSignedUrls(mediaList: InspectionMedia[]): Promise<InspectionMedia[]> {
  const promises = mediaList.map(async (item) => {
    if (item.signed_url) return item;
    const url = await getSignedMediaUrl(item.storage_path);
    return {
      ...item,
      signed_url: url || undefined,
      thumbnail_url: url || undefined,
    };
  });

  return Promise.all(promises);
}

// ==============================================================================
// 3. ESTRUTURA DE PATH SEGURA (ZERO TRUST)
// ==============================================================================

export function buildStoragePath(params: {
  companyId: string;
  inspectionId: string;
  roomId?: string | null;
  itemId?: string | null;
  mediaId: string;
  extension?: string;
}): string {
  const { companyId, inspectionId, roomId, itemId, mediaId, extension = 'jpg' } = params;
  
  // Sanitização estrita contra path traversal
  const cleanComp = companyId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanInsp = inspectionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanRoom = roomId ? roomId.replace(/[^a-zA-Z0-9_-]/g, '') : 'general';
  const cleanItem = itemId ? itemId.replace(/[^a-zA-Z0-9_-]/g, '') : 'general';
  const cleanId = mediaId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanExt = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';

  return `${cleanComp}/${cleanInsp}/${cleanRoom}/${cleanItem}/${cleanId}.${cleanExt}`;
}

// ==============================================================================
// 4. GERENCIADOR DE FILA DE UPLOAD (QUEUE MANAGER)
// ==============================================================================

type QueueListener = (queue: UploadQueueItem[]) => void;

class MediaUploadQueueService {
  private queue: UploadQueueItem[] = [];
  private listeners: Set<QueueListener> = new Set();
  private activeUploads = 0;

  public subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener);
    listener([...this.queue]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.queue];
    this.listeners.forEach((listener) => listener(copy));
  }

  public getQueue(): UploadQueueItem[] {
    return [...this.queue];
  }

  /**
   * Adiciona um ou múltiplos arquivos à fila de upload.
   */
  public enqueue(params: {
    files: File[];
    companyId: string;
    inspectionId: string;
    roomId?: string | null;
    itemId?: string | null;
    caption?: string;
  }): string[] {
    const { files, companyId, inspectionId, roomId = null, itemId = null, caption } = params;
    const addedIds: string[] = [];

    for (const file of files) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);

      const item: UploadQueueItem = {
        id,
        file,
        previewUrl,
        companyId,
        inspectionId,
        roomId,
        itemId,
        caption,
        status: 'QUEUED',
        progress: 0,
        originalSize: file.size,
        retryCount: 0,
        createdAt: Date.now(),
      };

      this.queue.push(item);
      addedIds.push(id);
    }

    this.notify();
    this.processNext();
    return addedIds;
  }

  /**
   * Tenta reenviar um item que falhou.
   */
  public retry(itemId: string) {
    const item = this.queue.find((q) => q.id === itemId);
    if (item && item.status === 'ERROR') {
      item.status = 'QUEUED';
      item.error = undefined;
      item.progress = 0;
      item.retryCount += 1;
      this.notify();
      this.processNext();
    }
  }

  /**
   * Cancela e remove um item da fila.
   */
  public cancel(itemId: string) {
    const index = this.queue.findIndex((q) => q.id === itemId);
    if (index >= 0) {
      const item = this.queue[index];
      URL.revokeObjectURL(item.previewUrl);
      this.queue.splice(index, 1);
      this.notify();
    }
  }

  /**
   * Limpa itens concluídos da fila.
   */
  public clearCompleted() {
    this.queue = this.queue.filter((q) => {
      if (q.status === 'UPLOADED') {
        URL.revokeObjectURL(q.previewUrl);
        return false;
      }
      return true;
    });
    this.notify();
  }

  /**
   * Processador de concorrência da fila.
   */
  private async processNext() {
    if (this.activeUploads >= MEDIA_CONFIG.CONCURRENT_UPLOADS) {
      return;
    }

    const nextItem = this.queue.find((q) => q.status === 'QUEUED');
    if (!nextItem) {
      return;
    }

    this.activeUploads += 1;
    await this.executeUpload(nextItem);
    this.activeUploads -= 1;

    // Continuar processando itens remanescentes
    this.processNext();
  }

  /**
   * Execução completa do upload: Compressão -> Storage -> Registro DB
   */
  private async executeUpload(item: UploadQueueItem) {
    try {
      // Passo 1: Compressão
      item.status = 'COMPRESSING';
      item.progress = 20;
      this.notify();

      const compression = await compressImage(item.file, {
        maxDimension: MEDIA_CONFIG.MAX_DIMENSION,
        quality: MEDIA_CONFIG.JPEG_QUALITY,
      });

      item.compressedSize = compression.compressedSize;
      item.originalWidth = compression.originalWidth;
      item.originalHeight = compression.originalHeight;
      item.compressedWidth = compression.width;
      item.compressedHeight = compression.height;

      // Se estiver OFFLINE, salvar Blob no IndexedDB e enfileirar para sync
      if (networkState.getStatus() === 'OFFLINE') {
        item.status = 'UPLOADING';
        item.progress = 60;
        this.notify();

        const offMedia = await syncEngine.offlineCapturePhoto(
          item.inspectionId,
          item.companyId,
          compression.blob,
          item.roomId || undefined,
          item.itemId || undefined,
          item.caption
        );

        item.status = 'UPLOADED';
        item.progress = 100;
        item.result = {
          id: offMedia.id,
          company_id: offMedia.company_id,
          inspection_id: offMedia.inspection_id,
          room_id: offMedia.room_id || null,
          item_id: offMedia.item_id || null,
          media_type: 'IMAGE',
          storage_bucket: 'inspection-media',
          storage_path: '',
          original_filename: item.file.name,
          mime_type: 'image/jpeg',
          file_size: compression.compressedSize,
          width: compression.width,
          height: compression.height,
          caption: item.caption || null,
          position: 0,
          upload_status: 'READY',
          uploaded_by: '',
          created_at: offMedia.created_at,
          updated_at: offMedia.created_at
        };

        this.notify();
        return;
      }

      // Passo 2: Montagem do Path Seguro
      item.status = 'UPLOADING';
      item.progress = 40;
      this.notify();

      const mediaId = item.id;
      const storagePath = buildStoragePath({
        companyId: item.companyId,
        inspectionId: item.inspectionId,
        roomId: item.roomId,
        itemId: item.itemId,
        mediaId,
        extension: 'jpg',
      });

      // Passo 3: Upload no Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('inspection-media')
        .upload(storagePath, compression.blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false, // ZERO OVERWRITE para segurança de evidências
        });

      if (storageError) {
        throw new Error(`Erro no Storage: ${storageError.message}`);
      }

      item.progress = 75;
      this.notify();

      // Passo 4: Calcular próxima posição ordinal
      const { data: existingCount } = await supabase
        .from('inspection_media')
        .select('position', { count: 'exact', head: true })
        .eq('inspection_id', item.inspectionId);

      const nextPosition = (existingCount !== null ? Number(existingCount) : 0) + 1;

      // Passo 5: Registro no PostgreSQL (public.inspection_media)
      const { data: dbData, error: dbError } = await supabase
        .from('inspection_media')
        .insert({
          id: mediaId,
          company_id: item.companyId,
          inspection_id: item.inspectionId,
          room_id: item.roomId || null,
          item_id: item.itemId || null,
          media_type: 'IMAGE',
          storage_bucket: 'inspection-media',
          storage_path: storagePath,
          original_filename: item.file.name,
          mime_type: 'image/jpeg',
          file_size: compression.compressedSize,
          width: compression.width,
          height: compression.height,
          caption: item.caption || null,
          position: nextPosition,
          upload_status: 'READY',
        })
        .select()
        .single();

      if (dbError) {
        // Compensação: se falhar o banco, remove o arquivo do storage para não deixar órfão
        await supabase.storage.from('inspection-media').remove([storagePath]);
        throw new Error(`Erro ao registrar metadados no banco: ${dbError.message}`);
      }


      item.status = 'UPLOADED';
      item.progress = 100;
      item.result = dbData as InspectionMedia;

      // Armazenar no cache de signed url local usando o preview existente
      signedUrlCache.set(storagePath, {
        url: item.previewUrl,
        expiresAt: Date.now() + 600000,
      });

      this.notify();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha desconhecida no upload';
      item.status = 'ERROR';
      item.error = message;
      console.error(`[MediaService] Erro no upload da foto ${item.file.name}:`, message);
      this.notify();
    }
  }
}

// Instância singleton da fila de upload
export const mediaQueueService = new MediaUploadQueueService();

// ==============================================================================
// 5. CRUD DE MÍDIAS E FOTOS
// ==============================================================================

/**
 * Lista mídias de uma vistoria com enriquecimento de signed URLs.
 */
export async function listInspectionMedia(params: {
  inspectionId: string;
  roomId?: string | null;
  itemId?: string | null;
}): Promise<InspectionMedia[]> {
  const { inspectionId, roomId, itemId } = params;

  let query = supabase
    .from('inspection_media')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  if (itemId) {
    query = query.eq('item_id', itemId);
  } else if (roomId) {
    query = query.eq('room_id', roomId).is('item_id', null);
  } else if (roomId === null && itemId === null) {
    // Mídias gerais da vistoria (sem ambiente e sem item)
    query = query.is('room_id', null).is('item_id', null);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[MediaService] Erro ao listar mídias:', error.message);
    throw error;
  }

  return enrichMediaWithSignedUrls((data || []) as InspectionMedia[]);
}

/**
 * Atualiza legenda de uma foto com autosave.
 */
export async function updateMediaCaption(mediaId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('inspection_media')
    .update({ 
      caption: caption.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', mediaId);

  if (error) {
    console.error(`[MediaService] Erro ao atualizar legenda da mídia ${mediaId}:`, error.message);
    throw error;
  }
}

/**
 * Reordena fotos utilizando RPC atômico.
 */
export async function reorderMedia(mediaIds: string[], newPositions: number[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_media', {
    p_media_ids: mediaIds,
    p_new_positions: newPositions,
  });

  if (error) {
    console.error('[MediaService] Erro ao reordenar fotos:', error.message);
    throw error;
  }
}

/**
 * Exclusão segura de mídia: Banco PostgreSQL + Supabase Storage.
 */
export async function deleteInspectionMedia(mediaId: string): Promise<{ success: boolean; message?: string }> {
  // 1. Chamar RPC que valida permissões, vistoria não concluída e remove do PostgreSQL
  const { data, error } = await supabase.rpc('delete_inspection_media', {
    p_media_id: mediaId,
  });

  if (error) {
    console.error(`[MediaService] Erro ao deletar mídia ${mediaId}:`, error.message);
    throw error;
  }

  const res = data as { success: boolean; storage_path?: string; error?: string };

  if (!res.success) {
    throw new Error(res.error || 'Falha ao excluir registro da mídia');
  }

  // 2. Remover objeto do Storage se path estiver presente
  if (res.storage_path) {
    const { error: storageErr } = await supabase.storage
      .from('inspection-media')
      .remove([res.storage_path]);

    if (storageErr) {
      console.warn(`[MediaService] Aviso: registro excluído mas falha ao remover arquivo ${res.storage_path}:`, storageErr.message);
    }
    
    // Limpar cache local
    signedUrlCache.delete(res.storage_path);
  }

  return { success: true };
}
