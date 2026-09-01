import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Check, 
  X, 
  FolderOpen,
  MessageSquare
} from 'lucide-react';
import type { Room, InspectionItem } from '../types/inspection';
import { ItemCard } from './ItemCard';
import { useToast } from './Toast';

interface RoomDetailProps {
  room: Room;
  onUpdateRoom: (updated: Room) => void;
  onDeleteRoom: () => void;
  onOpenItemEditor: (item: InspectionItem | null) => void;
  onViewPhoto: (url: string, caption?: string) => void;
}

const COMMON_ROOM_ITEMS = [
  'Paredes e Pintura',
  'Piso e Rodapés',
  'Teto e Iluminação',
  'Porta, Fechadura e Batente',
  'Janelas, Vidros e Esquadrias',
  'Tomadas e Interruptores',
  'Bancada de Pia e Torneira',
  'Vaso Sanitário e Louças',
  'Box de Vidro / Chuveiro',
  'Armários Embutidos',
  'Ponto de Gás / Encanamento',
];

export const RoomDetail: React.FC<RoomDetailProps> = ({
  room,
  onUpdateRoom,
  onDeleteRoom,
  onOpenItemEditor,
  onViewPhoto,
}) => {
  const { showToast } = useToast();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(room.name);
  const [showNotes, setShowNotes] = useState(!!room.generalNotes);

  const handleSaveName = () => {
    if (nameInput.trim()) {
      onUpdateRoom({ ...room, name: nameInput.trim() });
      setIsEditingName(false);
      showToast('Nome do cômodo atualizado!', 'success');
    }
  };

  const handleQuickAddItem = (itemName: string) => {
    const exists = room.items.some((i) => i.name.toLowerCase() === itemName.toLowerCase());
    if (exists) {
      showToast(`O item "${itemName}" já existe neste cômodo.`, 'info');
      return;
    }

    const newItem: InspectionItem = {
      id: Math.random().toString(36).substring(2, 9),
      name: itemName,
      status: 'Bom',
      description: '',
      needRepair: false,
      photos: [],
    };

    onUpdateRoom({
      ...room,
      items: [...room.items, newItem],
    });
    showToast(`"${itemName}" adicionado ao cômodo!`, 'success');
  };

  const handleDeleteItem = (itemId: string, itemName: string) => {
    if (window.confirm(`Deseja realmente excluir o item "${itemName}"?`)) {
      onUpdateRoom({
        ...room,
        items: room.items.filter((i) => i.id !== itemId),
      });
      showToast(`Item "${itemName}" excluído.`, 'info');
    }
  };

  const handleUpdateItemPhotos = (
    itemId: string,
    newPhotos: { id: string; dataUrl: string; timestamp: string }[]
  ) => {
    onUpdateRoom({
      ...room,
      items: room.items.map((i) => {
        if (i.id === itemId) {
          return {
            ...i,
            photos: [...i.photos, ...newPhotos],
          };
        }
        return i;
      }),
    });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateRoom({
      ...room,
      generalNotes: e.target.value,
    });
  };

  return (
    <div className="space-y-5">
      
      {/* Room Header Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Room Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 shrink-0">
            <FolderOpen className="w-5 h-5" />
          </div>

          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="bg-slate-50 border border-brand-500 rounded-lg px-3 py-1.5 text-slate-900 font-bold text-base focus:outline-none"
                autoFocus
              />
              <button
                onClick={handleSaveName}
                className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setNameInput(room.name);
                  setIsEditingName(false);
                }}
                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  {room.name}
                </h2>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Renomear cômodo"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {room.items.length} {room.items.length === 1 ? 'item vistoriado' : 'itens vistoriados'} •{' '}
                {room.items.reduce((acc, curr) => acc + curr.photos.length, 0)} fotos
              </p>
            </div>
          )}
        </div>

        {/* Room Header Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
              showNotes || room.generalNotes
                ? 'bg-brand-50 text-brand-700 border-brand-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Obs. do Cômodo</span>
          </button>

          <button
            onClick={onDeleteRoom}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
            title="Excluir este cômodo"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Room General Notes Card (Expandable) */}
      {showNotes && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm animate-fadeIn space-y-2">
          <label className="block text-xs font-bold text-slate-700">
            Observações Gerais do Ambiente ({room.name})
          </label>
          <textarea
            value={room.generalNotes || ''}
            onChange={handleNotesChange}
            rows={2}
            placeholder="Ex: Ambiente com ventilação natural, sem odores ou sinais de umidade estrutural."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:bg-white resize-y transition-colors"
          />
        </div>
      )}

      {/* Quick Add Preset Items Chips */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            Adicionar Itens Rápidos ao Ambiente
          </span>
          <button
            onClick={() => onOpenItemEditor(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Item Personalizado</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {COMMON_ROOM_ITEMS.map((item) => {
            const isAlreadyAdded = room.items.some((i) => i.name.toLowerCase() === item.toLowerCase());
            return (
              <button
                key={item}
                onClick={() => handleQuickAddItem(item)}
                disabled={isAlreadyAdded}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                  isAlreadyAdded
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-50 hover:bg-brand-50 hover:border-brand-300 text-slate-700 hover:text-brand-700 border-slate-200 active:scale-95'
                }`}
              >
                {isAlreadyAdded ? `✓ ${item}` : `+ ${item}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inspected Items List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Itens no Ambiente ({room.items.length})
          </h3>
        </div>

        {room.items.length > 0 ? (
          <div className="space-y-3">
            {room.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={() => onOpenItemEditor(item)}
                onDelete={() => handleDeleteItem(item.id, item.name)}
                onViewPhoto={onViewPhoto}
                onAddPhotos={(newPhotos) => handleUpdateItemPhotos(item.id, newPhotos)}
              />
            ))}
          </div>
        ) : (
          <div
            onClick={() => onOpenItemEditor(null)}
            className="border-2 border-dashed border-slate-200 hover:border-brand-500 rounded-2xl p-8 text-center bg-white cursor-pointer transition-colors text-slate-500 hover:text-brand-700 flex flex-col items-center justify-center gap-2"
          >
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600">
              <Plus className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-800">Nenhum item cadastrado neste ambiente</h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Use os botões de itens rápidos acima ou toque aqui para criar o primeiro item (paredes, piso, janelas, etc.).
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
