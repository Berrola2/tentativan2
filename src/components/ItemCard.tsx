import React, { useRef } from 'react';
import { 
  Camera, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  Maximize2
} from 'lucide-react';
import type { InspectionItem, ConservationStatus } from '../types/inspection';
import { compressImage } from '../services/imageCompressor';
import { useToast } from './Toast';

interface ItemCardProps {
  item: InspectionItem;
  onEdit: () => void;
  onDelete: () => void;
  onViewPhoto: (photoUrl: string, caption?: string) => void;
  onAddPhotos: (newPhotos: { id: string; dataUrl: string; timestamp: string }[]) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  onEdit,
  onDelete,
  onViewPhoto,
  onAddPhotos,
}) => {
  const { showToast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const statusConfig: Record<ConservationStatus, { bg: string; text: string; border: string }> = {
    Novo: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    Bom: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
    Regular: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    Ruim: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  };

  const currentStatus = statusConfig[item.status] || statusConfig['Bom'];

  const handleQuickCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const processed: { id: string; dataUrl: string; timestamp: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        processed.push({
          id: Math.random().toString(36).substring(2, 9),
          dataUrl: compressed,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      onAddPhotos(processed);
      showToast(`${processed.length} foto(s) adicionada(s)!`, 'success');
    } catch (err) {
      showToast('Erro ao processar foto.', 'error');
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-slate-700/80 transition-all space-y-3">
      
      {/* Top Row: Item Name & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {item.name}
            </h3>
            
            {/* Status Badge */}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}>
              {item.status}
            </span>

            {/* Need Repair Badge */}
            {item.needRepair && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Reparo ({item.repairUrgency || 'Média'})
              </span>
            )}
          </div>

          {/* Description preview */}
          <p className="text-xs text-slate-300 line-clamp-2">
            {item.description || <span className="italic text-slate-500">Sem descrição detalhada. Toque em Editar para descrever ou ditar.</span>}
          </p>

          {/* Repair details preview */}
          {item.needRepair && item.repairDetails && (
            <p className="text-xs text-rose-300/90 font-medium bg-rose-950/40 border border-rose-900/50 p-1.5 rounded-lg">
              <strong>Reparo necessário:</strong> {item.repairDetails}
            </p>
          )}
        </div>

        {/* Actions Menu */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Editar Item"
          >
            <Edit3 className="w-4 h-4 text-brand-400" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-colors"
            title="Excluir Item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Photos Thumbnail Grid (3 photos per row layout preview) */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-slate-400">
            Fotos ({item.photos.length})
          </span>
          
          {/* Quick camera trigger input */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1 text-[11px] font-bold text-brand-400 hover:text-brand-300 transition-colors"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Tirar Foto</span>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleQuickCameraCapture}
            className="hidden"
          />
        </div>

        {item.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {item.photos.slice(0, 3).map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => onViewPhoto(photo.dataUrl, `${item.name} - Foto ${index + 1}`)}
                className="relative group aspect-square rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer"
              >
                <img
                  src={photo.dataUrl}
                  alt={`Foto ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
                
                {/* Timestamp tag */}
                <div className="absolute bottom-1 right-1 text-[9px] font-bold bg-black/70 text-slate-200 px-1 py-0.2 rounded">
                  {photo.timestamp}
                </div>

                {/* Overflow count overlay on 3rd photo */}
                {index === 2 && item.photos.length > 3 && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-white font-bold text-xs cursor-pointer"
                  >
                    +{item.photos.length - 3} fotos
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            onClick={() => cameraInputRef.current?.click()}
            className="border border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-3 text-center bg-slate-950/40 cursor-pointer flex items-center justify-center gap-2 text-slate-500 hover:text-slate-400 transition-colors"
          >
            <Camera className="w-4 h-4" />
            <span className="text-xs">Nenhuma foto adicionada ainda. Toque para fotografar.</span>
          </div>
        )}
      </div>

    </div>
  );
};
