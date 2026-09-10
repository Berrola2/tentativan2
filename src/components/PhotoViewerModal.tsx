import React, { useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface PhotoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string;
  caption?: string;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  isOpen,
  onClose,
  photoUrl,
  caption,
}) => {
  const [zoom, setZoom] = React.useState(1);

  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !photoUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl max-h-[92vh] w-full flex flex-col items-center justify-center space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with 48px touch targets */}
        <div className="w-full flex items-center justify-between py-1 px-2 text-white">
          <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-[70%]">
            {caption || 'Foto da Vistoria'}
          </span>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(z + 0.5, 3))}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(z - 0.5, 1))}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Photo Container */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center max-h-[80vh]">
          <img
            src={photoUrl}
            alt="Visualização ampliada"
            style={{ transform: `scale(${zoom})`, transition: 'transform 200ms ease' }}
            className="max-h-[80vh] w-auto max-w-full object-contain select-none"
          />
        </div>
      </div>
    </div>
  );
};
