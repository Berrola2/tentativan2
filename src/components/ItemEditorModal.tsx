import React, { useState, useRef } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Save, 
  Maximize2,
  Wrench
} from 'lucide-react';
import type { InspectionItem, ConservationStatus, RepairUrgency, PhotoItem } from '../types/inspection';
import { compressImage } from '../services/imageCompressor';
import { VoiceInputButton } from './VoiceInputButton';
import { SmartSuggestions } from './SmartSuggestions';
import { REPAIR_SUGGESTIONS } from '../data/suggestions';
import { useToast } from './Toast';

interface ItemEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InspectionItem | null;
  roomName: string;
  onSave: (savedItem: InspectionItem) => void;
  onViewPhoto: (url: string, caption?: string) => void;
}

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({
  isOpen,
  onClose,
  item,
  roomName,
  onSave,
  onViewPhoto,
}) => {
  const { showToast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(item?.name || '');
  const [status, setStatus] = useState<ConservationStatus>(item?.status || 'Bom');
  const [description, setDescription] = useState(item?.description || '');
  const [needRepair, setNeedRepair] = useState(item?.needRepair || false);
  const [repairDetails, setRepairDetails] = useState(item?.repairDetails || '');
  const [repairUrgency, setRepairUrgency] = useState<RepairUrgency>(item?.repairUrgency || 'Média');
  const [photos, setPhotos] = useState<PhotoItem[]>(item?.photos || []);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  // Sync state when item changes
  React.useEffect(() => {
    if (item) {
      setName(item.name);
      setStatus(item.status);
      setDescription(item.description);
      setNeedRepair(item.needRepair);
      setRepairDetails(item.repairDetails || '');
      setRepairUrgency(item.repairUrgency || 'Média');
      setPhotos(item.photos || []);
    } else {
      setName('');
      setStatus('Bom');
      setDescription('');
      setNeedRepair(false);
      setRepairDetails('');
      setRepairUrgency('Média');
      setPhotos([]);
    }
  }, [item]);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingPhoto(true);
    try {
      const newPhotosList: PhotoItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        newPhotosList.push({
          id: Math.random().toString(36).substring(2, 9),
          dataUrl: compressed,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      setPhotos((prev) => [...prev, ...newPhotosList]);
      showToast(`${newPhotosList.length} foto(s) adicionada(s)!`, 'success');
    } catch (err) {
      showToast('Erro ao processar imagem.', 'error');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleVoiceTranscript = (text: string) => {
    setDescription((prev) => (prev ? `${prev} ${text}` : text));
    showToast('Texto inserido via voz!', 'success');
  };

  const handleSelectSuggestion = (text: string) => {
    setDescription((prev) => (prev ? `${prev} ${text}` : text));
    showToast('Termo técnico inserido!', 'info');
  };

  const handleSelectRepairSuggestion = (text: string) => {
    setRepairDetails((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Por favor, informe o nome do item.', 'error');
      return;
    }

    const savedItem: InspectionItem = {
      id: item?.id || Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      status,
      description: description.trim(),
      needRepair,
      repairDetails: needRepair ? repairDetails.trim() : undefined,
      repairUrgency: needRepair ? repairUrgency : undefined,
      photos,
    };

    onSave(savedItem);
    showToast(`"${name}" salvo com sucesso!`, 'success');
    onClose();
  };

  const statusOptions: { value: ConservationStatus; label: string; desc: string; color: string; border: string }[] = [
    { value: 'Novo', label: 'Novo', desc: 'Sem uso / Impecável', color: 'bg-emerald-500/20 text-emerald-300', border: 'border-emerald-500' },
    { value: 'Bom', label: 'Bom', desc: 'Em perfeito estado', color: 'bg-sky-500/20 text-sky-300', border: 'border-sky-500' },
    { value: 'Regular', label: 'Regular', desc: 'Marcas leves de uso', color: 'bg-amber-500/20 text-amber-300', border: 'border-amber-500' },
    { value: 'Ruim', label: 'Ruim', desc: 'Avariado / Danificado', color: 'bg-rose-500/20 text-rose-300', border: 'border-rose-500' },
  ];

  const urgencyOptions: { value: RepairUrgency; label: string; color: string }[] = [
    { value: 'Baixa', label: 'Baixa', color: 'bg-slate-700 text-slate-300' },
    { value: 'Média', label: 'Média', color: 'bg-amber-500/30 text-amber-300 border-amber-500/40' },
    { value: 'Alta', label: 'Alta', color: 'bg-orange-500/30 text-orange-300 border-orange-500/40' },
    { value: 'Crítica', label: 'Crítica', color: 'bg-rose-500/40 text-rose-200 border-rose-500/50' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 sticky top-0 z-10">
          <div>
            <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">{roomName}</span>
            <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
              {item ? 'Editar Item Vistoriado' : 'Novo Item no Ambiente'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          
          {/* 1. Item Name Input */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">Nome do Item / Estrutura</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Paredes e Pintura, Porta Principal, Piso Laminado..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-medium focus:outline-none focus:border-brand-500 transition-colors"
              required
            />
          </div>

          {/* 2. Conservation Status (Large Touch Badges) */}
          <div>
            <label className="block text-slate-300 font-bold mb-2">Estado de Conservação</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {statusOptions.map((opt) => {
                const isSelected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    className={`p-3 rounded-xl border text-left transition-all duration-150 ${
                      isSelected
                        ? `${opt.color} ${opt.border} ring-2 ring-brand-400/40 shadow-lg font-bold`
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm">{opt.label}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-400" />}
                    </div>
                    <span className="block text-[10px] opacity-75 mt-0.5">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Photo Upload & Camera Capture */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white">Fotos do Item ({photos.length})</h3>
                <p className="text-[11px] text-slate-400">Tire fotos na hora com a câmera ou escolha da galeria</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-600/30 transition-all active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Câmera</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Galeria</span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>

            {/* Photos Preview Grid (3 per row layout) */}
            {photos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                {photos.map((photo, pIdx) => (
                  <div
                    key={photo.id}
                    className="relative group aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shadow-md"
                  >
                    <img
                      src={photo.dataUrl}
                      alt={`Foto ${pIdx + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* View overlay */}
                    <button
                      type="button"
                      onClick={() => onViewPhoto(photo.dataUrl, `${name} - Foto ${pIdx + 1}`)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                    >
                      <Maximize2 className="w-5 h-5" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white shadow-md transition-colors"
                      title="Excluir Foto"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    {/* Timestamp */}
                    <div className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/70 text-slate-200 px-1 rounded">
                      {photo.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-slate-800 hover:border-brand-500/60 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-900/40 text-slate-400 hover:text-brand-300 flex flex-col items-center justify-center gap-1.5"
              >
                <Camera className="w-6 h-6 text-brand-400" />
                <span className="font-bold text-xs text-slate-300">Toque aqui para abrir a câmera</span>
                <span className="text-[11px] text-slate-500">Múltiplas fotos permitidas com data e hora automática</span>
              </div>
            )}
          </div>

          {/* 4. Description with Voice Dictation & Smart Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-slate-300 font-bold">Descrição Detalhada do Item</label>
              
              {/* Voice button */}
              <VoiceInputButton onTranscript={handleVoiceTranscript} />
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descreva o estado do material, acabamento, funcionamento, cor e detalhes..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-brand-500 transition-colors text-xs sm:text-sm resize-y"
            />

            {/* Smart Suggestions Accordion */}
            <SmartSuggestions onSelectSuggestion={handleSelectSuggestion} />
          </div>

          {/* 5. Need Repair Toggle & Details */}
          <div className={`p-4 rounded-xl border transition-all ${
            needRepair ? 'bg-rose-950/30 border-rose-500/40' : 'bg-slate-950/40 border-slate-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className={`w-4 h-4 ${needRepair ? 'text-rose-400' : 'text-slate-400'}`} />
                <div>
                  <h4 className="text-xs font-bold text-white">Necessidade de Reparo / Manutenção?</h4>
                  <p className="text-[11px] text-slate-400">Ative se houver avaria que precisa de conserto</p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={needRepair}
                  onChange={(e) => setNeedRepair(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {/* If Need Repair is true, show Urgency and Repair Details */}
            {needRepair && (
              <div className="mt-4 pt-3 border-t border-rose-900/40 space-y-3 animate-fadeIn">
                <div>
                  <label className="block text-rose-300 font-bold mb-1 text-xs">Nível de Urgência do Reparo</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {urgencyOptions.map((urg) => (
                      <button
                        key={urg.value}
                        type="button"
                        onClick={() => setRepairUrgency(urg.value)}
                        className={`py-1.5 rounded-lg border text-center text-xs font-bold transition-all ${
                          repairUrgency === urg.value
                            ? `${urg.color} ring-2 ring-rose-400`
                            : 'bg-slate-800/80 border-slate-700 text-slate-400'
                        }`}
                      >
                        {urg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-rose-300 font-bold mb-1 text-xs">Detalhes do Reparo Solicitado</label>
                  <textarea
                    value={repairDetails}
                    onChange={(e) => setRepairDetails(e.target.value)}
                    rows={2}
                    placeholder="Ex: Necessário repintura geral das paredes e troca do reparo da torneira."
                    className="w-full bg-slate-900 border border-rose-800/60 rounded-xl p-2.5 text-white focus:outline-none focus:border-rose-500 text-xs resize-y"
                  />
                  
                  {/* Quick Repair chips */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {REPAIR_SUGGESTIONS.slice(0, 4).map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => handleSelectRepairSuggestion(sug)}
                        className="text-[10px] bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/40 text-rose-200 px-2 py-1 rounded-md transition-colors"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-lg shadow-brand-600/30 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Item</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
