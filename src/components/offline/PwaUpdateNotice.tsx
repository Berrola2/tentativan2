import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Sparkles, X } from 'lucide-react';
import { offlineDb } from '../../services/offlineDb';

export const PwaUpdateNotice: React.FC = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showNotice, setShowNotice] = useState(false);
  const [pendingOpsCount, setPendingOpsCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // Se já houver um worker esperando ativação
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          checkPendingAndShow();
        }

        // Se um novo worker for encontrado
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                checkPendingAndShow();
              }
            });
          }
        });
      }).catch((err) => {
        console.warn('Erro no registro do ServiceWorker:', err);
      });

      // Recarregar quando a nova versão assumir o controle
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const checkPendingAndShow = async () => {
    try {
      const count = await offlineDb.sync_queue
        .where('status')
        .equals('PENDING')
        .or('status')
        .equals('IN_FLIGHT')
        .count();
      setPendingOpsCount(count);
      setShowNotice(true);
    } catch (e) {
      setShowNotice(true);
    }
  };

  const handleUpdateNow = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  if (!showNotice) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full p-4 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm">Nova versão disponível!</h4>
        </div>
        <button
          onClick={() => setShowNotice(false)}
          className="p-1 rounded-md text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-300 mt-2">
        Uma nova versão do Vistoria YZZY está pronta para ser aplicada no seu dispositivo.
      </p>

      {pendingOpsCount > 0 && (
        <div className="mt-2.5 p-2.5 bg-amber-950/60 border border-amber-500/40 rounded-xl flex items-center space-x-2 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Você tem <strong>{pendingOpsCount} alteraç{pendingOpsCount > 1 ? 'ões' : 'ão'} pendente(s)</strong>. Recomendamos sincronizar antes de atualizar.
          </span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-end space-x-2">
        <button
          onClick={() => setShowNotice(false)}
          className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          Depois
        </button>
        <button
          onClick={handleUpdateNow}
          className="px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow transition-all flex items-center space-x-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar Agora</span>
        </button>
      </div>
    </div>
  );
};
