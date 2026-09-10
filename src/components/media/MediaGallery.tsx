// ==============================================================================
// VISTORIA YZZY — COMPONENT: MediaGallery (Galeria de Fotos, Ordenação e Ações)
// ==============================================================================

import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  Eye, 
  FileText, 
  Image as ImageIcon 
} from 'lucide-react';
import type { InspectionMedia } from '../../types/media';
import { MediaViewerModal } from './MediaViewerModal';
import { reorderMedia } from '../../services/media';

interface MediaGalleryProps {
  mediaList: InspectionMedia[];
  onDeleteMedia?: (mediaId: string) => Promise<void>;
  onRefresh?: () => void;
  readOnly?: boolean;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  mediaList,
  onDeleteMedia,
  onRefresh,
  readOnly = false,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  if (!mediaList || mediaList.length === 0) {
    return (
      <div className="py-6 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <ImageIcon className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="text-xs font-semibold text-slate-600">Nenhuma foto adicionada ainda.</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Tire uma foto ou selecione da galeria acima.</p>
      </div>
    );
  }

  // Ordenação manual de foto: mover para esquerda ou direita
  const handleMove = async (index: number, direction: 'left' | 'right') => {
    if (readOnly || isReordering) return;
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mediaList.length) return;

    try {
      setIsReordering(true);
      const items = [...mediaList];
      const temp = items[index];
      items[index] = items[targetIndex];
      items[targetIndex] = temp;

      const mediaIds = items.map((m) => m.id);
      const newPositions = items.map((_, i) => i + 1);

      await reorderMedia(mediaIds, newPositions);
      onRefresh?.();
    } catch (err) {
      console.error('[MediaGallery] Falha ao reordenar:', err);
    } finally {
      setIsReordering(false);
    }
  };

  const handleDelete = async (mediaId: string) => {
    if (readOnly || !onDeleteMedia) return;
    const confirmDelete = window.confirm('Deseja realmente excluir esta foto? Esta ação não pode ser desfeita.');
    if (!confirmDelete) return;

    try {
      await onDeleteMedia(mediaId);
      if (selectedPhotoIndex !== null) {
        setSelectedPhotoIndex(null);
      }
      onRefresh?.();
    } catch (err) {
      console.error('[MediaGallery] Erro ao excluir foto:', err);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Grid de Fotos: 2 cols on mobile, 3 on sm, 4 on md */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {mediaList.map((media, index) => (
          <div
            key={media.id}
            className="group relative bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col hover:border-primary-400 transition-all"
          >
            {/* Imagem Thumbnail */}
            <div
              onClick={() => setSelectedPhotoIndex(index)}
              className="relative aspect-4/3 bg-slate-100 cursor-pointer overflow-hidden flex items-center justify-center"
            >
              <img
                src={media.signed_url || media.thumbnail_url || ''}
                alt={media.caption || `Foto ${index + 1}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Tag de Numeração: Foto 1, Foto 2 */}
              <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold text-white tracking-wide">
                Foto {index + 1}
              </div>

              {/* Hover/Tap Overlay */}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-md">
                  <Eye className="w-5 h-5" />
                </span>
              </div>
            </div>

            {/* Legenda e Ações Rápidas */}
            <div className="p-2.5 flex flex-col justify-between flex-1 bg-white border-t border-slate-100">
              <div className="mb-2">
                {media.caption ? (
                  <p className="text-[11px] text-slate-700 font-medium line-clamp-2 leading-tight">
                    {media.caption}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 italic flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Sem legenda
                  </p>
                )}
              </div>

              {/* Controles de Reordenação e Exclusão com Touch Targets >= 44px */}
              {!readOnly && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0 || isReordering}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(index, 'left');
                      }}
                      title="Mover para esquerda"
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === mediaList.length - 1 || isReordering}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(index, 'right');
                      }}
                      title="Mover para direita"
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(media.id);
                    }}
                    title="Excluir foto"
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Fullscreen */}
      {selectedPhotoIndex !== null && (
        <MediaViewerModal
          mediaList={mediaList}
          initialIndex={selectedPhotoIndex}
          isOpen={selectedPhotoIndex !== null}
          onClose={() => setSelectedPhotoIndex(null)}
          onDelete={handleDelete}
          onCaptionChange={() => onRefresh?.()}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};
