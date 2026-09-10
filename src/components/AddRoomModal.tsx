import React, { useState } from 'react';
import { X, Plus, FolderPlus, Sparkles, Building } from 'lucide-react';

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRoom: (roomName: string) => void;
}

const POPULAR_ROOMS = [
  'Sala de Estar',
  'Sala de Jantar',
  'Cozinha',
  'Área de Serviço / Lavanderia',
  'Quarto 1',
  'Quarto 2',
  'Quarto 3',
  'Suíte Principal',
  'Banheiro Social',
  'Lavabo',
  'Sacada / Varanda',
  'Varanda Gourmet',
  'Garagem',
  'Quintal / Jardim',
  'Escritório / Home Office',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Adicionar Novo Ambiente
              </h2>
              <p className="text-xs text-slate-500">
                Informe o nome do cômodo ou escolha uma opção rápida
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
          
          {/* Section 1: Nome do Ambiente */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <h3 className="text-xs font-bold text-primary-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              Identificação do Cômodo
            </h3>
            
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">
                Nome do Ambiente / Cômodo
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Ex: Varanda Gourmet, Lavabo, Quarto 3..."
                className="w-full min-h-[44px] bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-semibold focus:outline-none focus:border-primary-500 transition-colors"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Section 2: Sugestões Rápidas */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Sugestões Rápidas (Toque para Criar)
            </h3>

            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1 pt-1">
              {POPULAR_ROOMS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectQuickRoom(name)}
                  className="min-h-[40px] text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-primary-50 hover:border-primary-300 text-slate-700 hover:text-primary-700 transition-all shadow-xs active:scale-95 text-left"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-semibold transition-colors flex items-center justify-center"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!roomName.trim()}
              className="min-h-[48px] flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-md shadow-primary-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar Ambiente</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
