import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  FolderOpen, 
  Copy, 
  Trash2, 
  Calendar, 
  MapPin, 
  Plus, 
  ArrowRight
} from 'lucide-react';
import type { InspectionData, InspectionType } from '../types/inspection';
import { getAllInspectionsFromDb, deleteInspectionFromDb } from '../services/db';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './Toast';

interface InspectionsHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentInspectionId: string;
  onSelectInspection: (inspection: InspectionData) => void;
  onNewInspection: () => void;
  onDuplicateAsType: (source: InspectionData, newType: InspectionType) => void;
}

export const InspectionsHistoryModal: React.FC<InspectionsHistoryModalProps> = ({
  isOpen,
  onClose,
  currentInspectionId,
  onSelectInspection,
  onNewInspection,
  onDuplicateAsType,
}) => {
  const { showToast } = useToast();
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string } | null>(null);

  const loadList = async () => {
    try {
      const list = await getAllInspectionsFromDb();
      setInspections(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen]);

  const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (inspections.length <= 1) {
      showToast('Você precisa manter pelo menos uma vistoria.', 'error');
      return;
    }
    setItemToDelete({ id, title });
  };

  const confirmDelete = async () => {
    if (itemToDelete) {
      await deleteInspectionFromDb(itemToDelete.id);
      await loadList();
      showToast('Vistoria excluída com sucesso.', 'info');
      setItemToDelete(null);
    }
  };

  const handleDuplicate = (e: React.MouseEvent, item: InspectionData, newType: InspectionType) => {
    e.stopPropagation();
    onDuplicateAsType(item, newType);
    onClose();
  };

  const filtered = inspections.filter((item) => {
    const matchesSearch = 
      (item.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.propertyAddress || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.tenantName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.inspectorName || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || item.inspectionType === typeFilter;
    return matchesSearch && matchesType;
  });

  const typeBadgeColors = {
    Entrada: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Saída: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Periódica: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    Constatação: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Minhas Vistorias Realizadas</h2>
              <p className="text-xs text-slate-400">Gerencie, alterne ou crie laudos de saída comparativos</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onNewInspection();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por endereço, inquilino ou vistoriador..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['all', 'Entrada', 'Saída', 'Periódica', 'Constatação'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                  typeFilter === t
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'Todas' : t}
              </button>
            ))}
          </div>
        </div>

        {/* List Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const isCurrent = item.id === currentInspectionId;
              const totalItems = item.rooms.reduce((acc, r) => acc + r.items.length, 0);
              const totalPhotos = item.rooms.reduce(
                (acc, r) => acc + r.items.reduce((iAcc, it) => iAcc + it.photos.length, 0),
                0
              );
              const repairsCount = item.rooms.reduce(
                (acc, r) => acc + r.items.filter((it) => it.needRepair).length,
                0
              );

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectInspection(item);
                    onClose();
                  }}
                  className={`group p-4 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-brand-950/40 border-brand-500 shadow-md ring-1 ring-brand-400/40'
                      : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm group-hover:text-brand-300 transition-colors">
                          {item.title || 'Laudo sem título'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadgeColors[item.inspectionType]}`}>
                          {item.inspectionType}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-brand-600 text-white font-bold px-2 py-0.5 rounded-full">
                            Em edição
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-400 shrink-0" />
                        <span>{item.propertyAddress ? `${item.propertyAddress}, ${item.propertyNumber}` : 'Endereço não informado'}</span>
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap pt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {item.date ? new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                        </span>
                        <span>Inquilino: <strong className="text-slate-300">{item.tenantName || 'N/I'}</strong></span>
                        <span>{item.rooms.length} cômodos • {totalItems} itens • {totalPhotos} fotos</span>
                        {repairsCount > 0 && (
                          <span className="text-rose-400 font-bold">⚠️ {repairsCount} reparo(s)</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      
                      {/* Duplicate as Vistoria de Saída */}
                      {item.inspectionType === 'Entrada' && (
                        <button
                          type="button"
                          onClick={(e) => handleDuplicate(e, item, 'Saída')}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors"
                          title="Criar Vistoria de Saída baseada nesta de Entrada"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Gerar Saída</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.id, item.title)}
                        className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
                        title="Excluir Vistoria"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1 text-xs font-bold text-brand-400 group-hover:translate-x-1 transition-transform ml-1">
                        <span>Abrir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>

                    </div>

                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs">
              Nenhuma vistoria encontrada com os filtros selecionados.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Confirm Delete In-App Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Vistoria"
        message={`Deseja excluir a vistoria "${itemToDelete?.title || 'esta vistoria'}"?`}
        confirmText="Sim, Excluir"
        confirmVariant="danger"
      />

    </div>
  );
};
