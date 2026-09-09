// ==============================================================================
// VISTORIA YZZY — TIPOS OFICIAIS: ETAPA 04 (MOTOR DE MÍDIA, FOTOS E STORAGE)
// ==============================================================================

export type MediaType = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';

export type UploadStatus = 'PENDING' | 'READY' | 'FAILED' | 'DELETED';

export type QueueState = 'QUEUED' | 'COMPRESSING' | 'UPLOADING' | 'UPLOADED' | 'ERROR' | 'CANCELLED';

export interface InspectionMedia {
  id: string;
  company_id: string;
  inspection_id: string;
  room_id: string | null;
  item_id: string | null;
  media_type: MediaType;
  storage_bucket: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  position: number;
  upload_status: UploadStatus;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  // Propriedades temporárias de visualização (URLs assinadas cacheadas)
  signed_url?: string;
  thumbnail_url?: string;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  companyId: string;
  inspectionId: string;
  roomId: string | null;
  itemId: string | null;
  caption?: string;
  status: QueueState;
  progress: number;
  error?: string;
  result?: InspectionMedia;
  originalSize: number;
  compressedSize?: number;
  originalWidth?: number;
  originalHeight?: number;
  compressedWidth?: number;
  compressedHeight?: number;
  retryCount: number;
  createdAt: number;
}

export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
  compressionRatio: number;
  durationMs: number;
}

export interface CompressionOptions {
  maxDimension?: number; // padrão: 1920
  quality?: number; // padrão: 0.82
  mimeType?: 'image/jpeg' | 'image/webp';
}

export interface ReorderMediaPayload {
  mediaIds: string[];
  newPositions: number[];
}
