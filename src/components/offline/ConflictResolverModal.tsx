import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check, ShieldAlert, Edit3 } from 'lucide-react';
import { offlineDb, type OfflineConflict } from '../../services/offlineDb';
import { syncEngine } from '../../services/syncEngine';


interface ConflictResolverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConflictResolverModal: React.FC<ConflictResolverModalProps> = ({
  isOpen,
  onClose
}) => {
  const [conflicts, setConflicts] = useState<OfflineConflict[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualDescription, setManualDescription] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const loadConflicts = async () => {
    const list = await offlineDb.conflicts
      .filter((c) => !c.resolved_at)
      .toArray();
    setConflicts(list);
    if (list.length > 0) {
      setManualDescription(list[0].local_value.description || list[0].server_value.description || '');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConflicts();
      setCurrentIndex(0);
      setIsManualEditing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentConflict = conflicts[currentIndex];

  const handleResolve = async (strategy: 'USE_LOCAL' | 'USE_SERVER' | 'MANUAL_MERGE') => {
    if (!currentConflict) return;

    setIsResolving(true);
    try {
      if (strategy === 'MANUAL_MERGE') {
        await syncEngine.resolveConflict(currentConflict.id, 'MANUAL_MERGE', {
          ...currentConflict.local_value,
          description: manualDescription
        });
      } else {
        await syncEngine.resolveConflict(currentConflict.id, strategy);
      }

      await loadConflicts();
      setIsManualEditing(false);
      if (conflicts.length <= 1) {
        onClose();
      }
    } catch (e) {
      console.error('Erro ao resolver conflito:', e);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Conflito de Sincronização</h3>
              <p className="text-xs text-rose-100">
                {conflicts.length > 0
                  ? `Conflito ${currentIndex + 1} de ${conflicts.length}`
                  : 'Nenhum conflito pendente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-rose-200 hover:text-white hover:bg-rose-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700 flex-1">
          {conflicts.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900">Todos os conflitos foram resolvidos!</h4>
              <p className="text-xs text-slate-500">Todas as alterações sincronizadas com segurança.</p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              {/* Alerta de Contexto */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Atenção Pericial:</strong> Este item foi editado simultaneamente no servidor enquanto este dispositivo estava operando offline. Escolha qual versão deve prevalecer ou faça uma mesclagem manual.
                </div>
              </div>

              {/* Informações da Entidade */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  Entidade Afetada
                </div>
                <div className="font-bold text-slate-900">
                  {currentConflict.local_value.name || 'Item de Vistoria'} ({currentConflict.entity_type})
                </div>
              </div>

              {/* Comparativo Visual Three-Way */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Versão Local */}
                <div className="border-2 border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                      Sua Versão no Dispositivo
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div><strong>Condição:</strong> {currentConflict.local_value.condition_status || 'N/A'}</div>
                    <div><strong>Reparo:</strong> {currentConflict.local_value.requires_repair ? 'Sim' : 'Não'}</div>
                    <div><strong>Descrição:</strong></div>
                    <p className="p-2 bg-white rounded-lg border border-blue-100 text-slate-800 text-xs italic">
                      {currentConflict.local_value.description || '(Sem descrição)'}
                    </p>
                  </div>
                </div>

                {/* Versão Servidor */}
                <div className="border-2 border-slate-200 bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                      Versão Atual no Servidor
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div><strong>Condição:</strong> {currentConflict.server_value.condition_status || 'N/A'}</div>
                    <div><strong>Reparo:</strong> {currentConflict.server_value.requires_repair ? 'Sim' : 'Não'}</div>
                    <div><strong>Descrição:</strong></div>
                    <p className="p-2 bg-white rounded-lg border border-slate-200 text-slate-800 text-xs italic">
                      {currentConflict.server_value.description || '(Sem descrição)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modo Edição Manual */}
              {isManualEditing && (
                <div className="p-4 border-2 border-indigo-200 bg-indigo-50/40 rounded-xl space-y-2 animate-in fade-in">
                  <label className="text-xs font-bold text-indigo-900 flex items-center space-x-1.5">
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Mesclagem Pericial Manual (Texto Final)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 bg-white"
                    placeholder="Escreva a descrição consolidada..."
                  />
                  <button
                    onClick={() => handleResolve('MANUAL_MERGE')}
                    disabled={isResolving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    Salvar e Aplicar Mesclagem
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {conflicts.length > 0 && (
          <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={() => setIsManualEditing(!isManualEditing)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 flex items-center space-x-1"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>{isManualEditing ? 'Cancelar Edição Manual' : 'Editar Manualmente'}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleResolve('USE_SERVER')}
                disabled={isResolving}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors"
              >
                Usar Servidor
              </button>

              <button
                onClick={() => handleResolve('USE_LOCAL')}
                disabled={isResolving}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
              >
                Usar Minha Versão
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
