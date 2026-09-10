// ==============================================================================
// VISTORIA YZZY — COMPONENT: MediaViewerModal (Visualizador Fullscreen e Legendas)
// ==============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Check, 
  Loader2 
} from 'lucide-react';
import type { InspectionMedia } from '../../types/media';
import { updateMediaCaption } from '../../services/media';

interface MediaViewerModalProps {
  mediaList: InspectionMedia[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (mediaId: string) => void;
  onCaptionChange?: (mediaId: string, newCaption: string) => void;
  readOnly?: boolean;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  mediaList,
  initialIndex = 0,
  isOpen,
  onClose,
  onDelete,
  onCaptionChange,
  readOnly = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [caption, setCaption] = useState('');
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [captionSaved, setCaptionSaved] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const currentMedia = mediaList[currentIndex];

  useEffect(() => {
    if (currentMedia) {
      setCaption(currentMedia.caption || '');
      setZoomLevel(1);
    }
  }, [currentMedia]);

  const handleCaptionInput = (value: string) => {
    if (readOnly || !currentMedia) return;
    setCaption(value);
    setCaptionSaved(false);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSavingCaption(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await updateMediaCaption(currentMedia.id, value);
        onCaptionChange?.(currentMedia.id, value);
        setCaptionSaved(true);
        setTimeout(() => setCaptionSaved(false), 2000);
      } catch (err) {
        console.error('[MediaViewerModal] Erro ao salvar legenda:', err);
      } finally {
        setIsSavingCaption(false);
      }
    }, 600); // Debounce de 600ms para autosave
  };

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < mediaList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, mediaList.length]);

  // Navegação por teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  // Touch Swipe para Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handlePrev();
      } else {
        handleNext();
      }
    }
    touchStartXRef.current = null;
  };

  if (!isOpen || !currentMedia) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* Barra de Topo */}
      <div className="flex items-center justify-between p-3 sm:p-4 text-white z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm font-semibold tracking-wide bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            Foto {currentIndex + 1} de {mediaList.length}
          </span>
          {currentMedia.width && currentMedia.height && (
            <span className="text-xs text-white/60 hidden sm:inline">
              {currentMedia.width}×{currentMedia.height} ({((currentMedia.file_size || 0) / 1024).toFixed(0)} KB)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Buttons com Touch Target >= 44px */}
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.5, 3))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.5, 1))}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          {zoomLevel > 1 && (
            <button
              type="button"
              onClick={() => setZoomLevel(1)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Resetar Zoom"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          )}

          {!readOnly && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(currentMedia.id)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors ml-1"
              title="Excluir Foto"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors ml-2"
            title="Fechar (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Área Central: Imagem Principal e Navegação */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden px-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Botão Anterior */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 sm:left-6 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 z-20 backdrop-blur-md transition-all active:scale-95 shadow-xl"
            title="Foto Anterior"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Imagem */}
        <div
          className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <img
            src={currentMedia.signed_url || currentMedia.thumbnail_url || ''}
            alt={currentMedia.caption || `Foto ${currentIndex + 1}`}
            className="max-h-[72vh] max-w-full object-contain rounded-xl shadow-2xl"
          />
        </div>

        {/* Botão Próximo */}
        {currentIndex < mediaList.length - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 sm:right-6 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 z-20 backdrop-blur-md transition-all active:scale-95 shadow-xl"
            title="Próxima Foto"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Barra Inferior: Edição de Legenda com Autosave */}
      <div className="p-4 bg-black/70 backdrop-blur-md border-t border-white/10 z-10">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="flex items-center justify-between text-xs text-white/70">
            <label htmlFor="media-caption-input" className="font-semibold">
              Legenda da Evidência
            </label>
            <div className="flex items-center gap-1">
              {isSavingCaption && (
                <span className="flex items-center gap-1 text-primary-400 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
                </span>
              )}
              {captionSaved && (
                <span className="flex items-center gap-1 text-emerald-400 font-medium animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> Salvo
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              id="media-caption-input"
              type="text"
              value={caption}
              disabled={readOnly}
              onChange={(e) => handleCaptionInput(e.target.value)}
              placeholder={readOnly ? 'Sem legenda' : 'Ex: Mancha de umidade próxima ao rodapé...'}
              className="w-full min-h-[44px] px-4 py-2.5 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white/15 disabled:opacity-60 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
