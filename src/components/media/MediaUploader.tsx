// ==============================================================================
// VISTORIA YZZY — COMPONENT: MediaUploader (Câmera + Galeria + Fila de Upload)
// ==============================================================================

import React, { useRef, useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, UploadCloud, AlertCircle, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { mediaQueueService, MEDIA_CONFIG } from '../../services/media';
import type { UploadQueueItem } from '../../types/media';

interface MediaUploaderProps {
  companyId: string;
  inspectionId: string;
  roomId?: string | null;
  itemId?: string | null;
  disabled?: boolean;
  onUploadSuccess?: () => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  companyId,
  inspectionId,
  roomId = null,
  itemId = null,
  disabled = false,
  onUploadSuccess,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = mediaQueueService.subscribe((updatedQueue) => {
      // Filtrar itens da fila pertencentes a este escopo (inspection / room / item)
      const relevant = updatedQueue.filter(
        (q) =>
          q.inspectionId === inspectionId &&
          (roomId ? q.roomId === roomId : q.roomId === null) &&
          (itemId ? q.itemId === itemId : q.itemId === null)
      );
      setQueue(relevant);

      // Se houver algum item concluído recentemente, acionar callback de refresh
      if (relevant.some((q) => q.status === 'UPLOADED')) {
        onUploadSuccess?.();
      }
    });

    return unsubscribe;
  }, [inspectionId, roomId, itemId, onUploadSuccess]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled) return;
    setLocalError(null);

    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file) => {
      if (file.size > MEDIA_CONFIG.MAX_FILE_SIZE_BYTES) {
        errors.push(`"${file.name}" ultrapassa o limite de 20MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0) {
      setLocalError(errors.join(' '));
    }

    if (validFiles.length > 0) {
      mediaQueueService.enqueue({
        files: validFiles,
        companyId,
        inspectionId,
        roomId,
        itemId,
      });
    }

    // Resetar inputs
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleRetry = (queueId: string) => {
    mediaQueueService.retry(queueId);
  };

  const handleCancel = (queueId: string) => {
    mediaQueueService.cancel(queueId);
  };

  return (
    <div className="w-full space-y-3">
      {/* Botões de Ação Mobile-First com Touch Target >= 48px */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Input Câmera Nativa Mobile (prioriza traseira) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => cameraInputRef.current?.click()}
          className="min-h-[48px] px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-primary-600/20 active:scale-[0.98] flex items-center justify-center gap-2 select-none"
        >
          <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Tirar Foto</span>
        </button>

        {/* Input Selecionar da Galeria (Multi-upload) */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => galleryInputRef.current?.click()}
          className="min-h-[48px] px-4 py-3 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 text-slate-700 rounded-2xl font-bold text-xs sm:text-sm transition-all border border-slate-200 active:scale-[0.98] flex items-center justify-center gap-2 select-none"
        >
          <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
          <span>Galeria</span>
        </button>
      </div>

      {/* Alerta de Erro Local */}
      {localError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{localError}</div>
          <button onClick={() => setLocalError(null)} className="min-w-[32px] min-h-[32px] flex items-center justify-center text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Fila de Upload Ativa */}
      {queue.length > 0 && (
        <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
            <span className="flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-primary-600" />
              Fila de Upload ({queue.filter((q) => q.status === 'UPLOADED').length}/{queue.length})
            </span>
            {queue.some((q) => q.status === 'UPLOADED') && (
              <button
                type="button"
                onClick={() => mediaQueueService.clearCompleted()}
                className="text-primary-600 hover:text-primary-700 font-bold min-h-[36px] px-2"
              >
                Limpar concluídos
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs text-xs relative overflow-hidden"
              >
                {/* Preview Thumbnail */}
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                  <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>

                {/* Status e Detalhes */}
                <div className="flex-1 min-w-0 pr-6">
                  <p className="font-semibold text-slate-800 truncate">{item.file.name}</p>
                  
                  <div className="flex items-center gap-1.5 mt-1">
                    {item.status === 'QUEUED' && (
                      <span className="text-slate-500">Na fila...</span>
                    )}
                    {item.status === 'COMPRESSING' && (
                      <span className="text-amber-600 font-medium animate-pulse">Comprimindo...</span>
                    )}
                    {item.status === 'UPLOADING' && (
                      <span className="text-primary-600 font-medium">Enviando {item.progress}%</span>
                    )}
                    {item.status === 'UPLOADED' && (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enviada
                      </span>
                    )}
                    {item.status === 'ERROR' && (
                      <div className="flex flex-col">
                        <span className="text-rose-600 font-medium flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Falha no envio
                        </span>
                        {item.error && <span className="text-[10px] text-rose-500 truncate max-w-[160px]">{item.error}</span>}
                      </div>
                    )}
                  </div>

                  {/* Barra de Progresso */}
                  {(item.status === 'COMPRESSING' || item.status === 'UPLOADING') && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div
                        className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Botões de Ação na Fila */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  {item.status === 'ERROR' && (
                    <button
                      type="button"
                      title="Tentar novamente"
                      onClick={() => handleRetry(item.id)}
                      className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {item.status !== 'UPLOADING' && (
                    <button
                      type="button"
                      title="Cancelar"
                      onClick={() => handleCancel(item.id)}
                      className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
