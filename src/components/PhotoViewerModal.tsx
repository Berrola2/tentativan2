import React from 'react';
import { X } from 'lucide-react';

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
  if (!isOpen || !photoUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/95 backdrop-blur-md"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="w-full flex items-center justify-between py-2 px-1 text-white">
          <span className="text-xs font-semibold text-slate-300 truncate max-w-[80%]">
            {caption || 'Foto da Vistoria'}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo Container */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center max-h-[80vh]">
          <img
            src={photoUrl}
            alt="Visualização ampliada"
            className="max-h-[80vh] w-auto object-contain"
          />
        </div>
      </div>
    </div>
  );
};
