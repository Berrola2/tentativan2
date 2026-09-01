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
    Novo: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Bom: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
    Regular: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    Ruim: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
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
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all space-y-3">
      
      {/* Top Row: Item Name & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              {item.name}
            </h3>
            
            {/* Status Badge */}
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}>
              {item.status}
            </span>

            {/* Need Repair Badge */}
            {item.needRepair && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                Reparo ({item.repairUrgency || 'Média'})
              </span>
            )}
          </div>

          {/* Description preview */}
          <p className="text-xs text-slate-600 line-clamp-2">
            {item.description || <span className="italic text-slate-400">Sem descrição detalhada. Toque em Editar para preencher.</span>}
          </p>

          {/* Repair details preview */}
          {item.needRepair && item.repairDetails && (
            <p className="text-xs text-rose-700 font-medium bg-rose-50 border border-rose-200 p-2 rounded-xl">
              <strong>Reparo necessário:</strong> {item.repairDetails}
            </p>
          )}
        </div>

        {/* Actions Menu */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title="Editar Item"
          >
            <Edit3 className="w-4 h-4 text-brand-600" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Excluir Item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Photos Thumbnail Grid (3 photos per row layout preview) */}
      <div className="pt-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold text-slate-500">
            Fotos ({item.photos.length})
          </span>
          
          {/* Quick camera trigger input */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-700 transition-colors"
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
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {item.photos.slice(0, 6).map((photo, index) => (
              <div
                key={photo.id}
                onClick={() => onViewPhoto(photo.dataUrl, `${item.name} - Foto ${index + 1}`)}
                className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-sm"
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
                <div className="absolute bottom-1 right-1 text-[9px] font-bold bg-black/70 text-white px-1 py-0.2 rounded">
                  {photo.timestamp}
                </div>

                {/* Overflow count overlay on 6th photo */}
                {index === 5 && item.photos.length > 6 && (
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="absolute inset-0 bg-slate-900/80 flex items-center justify-center text-white font-bold text-xs cursor-pointer"
                  >
                    +{item.photos.length - 6} fotos
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            onClick={() => cameraInputRef.current?.click()}
            className="border border-dashed border-slate-300 hover:border-brand-500 rounded-xl p-3 text-center bg-slate-50 cursor-pointer flex items-center justify-center gap-2 text-slate-500 hover:text-brand-600 transition-colors"
          >
            <Camera className="w-4 h-4 text-brand-600" />
            <span className="text-xs">Nenhuma foto adicionada. Toque para fotografar este item.</span>
          </div>
        )}
      </div>

    </div>
  );
};
