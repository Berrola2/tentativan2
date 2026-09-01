import React, { useState } from 'react';
import { X, Plus, FolderPlus, Sparkles } from 'lucide-react';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRoom: (roomName: string) => void;
}

const POPULAR_ROOMS = [
  'Sala de Estar',
  'Sala de Jantar',
  'Cozinha',
  'Área de Serviço',
  'Quarto 1',
  'Quarto 2',
  'Suíte Principal',
  'Banheiro Social',
  'Lavabo',
  'Sacada / Varanda',
  'Garagem',
  'Quintal / Jardim',
  'Escritório / Home Office',
  'Varanda Gourmet',
  'Hall de Entrada',
  'Depósito / Despensa',
];

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  isOpen,
  onClose,
  onAddRoom,
}) => {
  const [roomName, setRoomName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      onAddRoom(roomName.trim());
      setRoomName('');
      onClose();
    }
  };

  const handleSelectQuickRoom = (name: string) => {
    onAddRoom(name);
    setRoomName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden my-auto animate-fadeIn flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Novo Ambiente</h2>
              <p className="text-xs text-slate-500">Adicione um cômodo à vistoria</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nome do Ambiente
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Ex: Varanda Gourmet, Lavabo, Quarto 3..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
              autoFocus
              required
            />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Sugestões Rápidas (Toque para Adicionar)
            </span>

            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
              {POPULAR_ROOMS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectQuickRoom(name)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 text-slate-700 hover:text-brand-700 transition-all shadow-sm active:scale-95 text-left"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!roomName.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Ambiente</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
