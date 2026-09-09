import React, { useState, useEffect } from 'react';
import { networkState, type NetworkStatus } from '../../services/networkState';
import { syncEngine, type SyncProgressReport } from '../../services/syncEngine';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2, HardDrive } from 'lucide-react';

interface OfflineStatusBarProps {
  onOpenSyncCenter?: () => void;
  onOpenConflicts?: () => void;
}

export const OfflineStatusBar: React.FC<OfflineStatusBarProps> = ({
  onOpenSyncCenter,
  onOpenConflicts
}) => {
  const [netStatus, setNetStatus] = useState<NetworkStatus>(networkState.getStatus());
  const [latency, setLatency] = useState<number>(0);
  const [syncReport, setSyncReport] = useState<SyncProgressReport>({
    isSyncing: false,
    totalPending: 0,
    totalConflicts: 0,
    lastSyncAt: null,
    lastError: null,
    operationsProcessed: 0
  });

  useEffect(() => {
    const unsubNet = networkState.subscribe((status, lat) => {
      setNetStatus(status);
      if (lat) setLatency(lat);
    });

    const unsubSync = syncEngine.subscribeProgress((report) => {
      setSyncReport(report);
    });

    return () => {
      unsubNet();
      unsubSync();
    };
  }, []);

  const handleSyncNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (netStatus !== 'OFFLINE') {
      syncEngine.syncPendingOperations();
    }
  };

  return (
    <div
      className={`w-full text-xs font-medium py-1.5 px-3 sm:px-4 flex items-center justify-between transition-colors shadow-sm cursor-pointer ${
        netStatus === 'OFFLINE'
          ? 'bg-amber-600 text-white'
          : netStatus === 'DEGRADED'
          ? 'bg-amber-500 text-slate-900'
          : netStatus === 'RECONNECTING'
          ? 'bg-blue-600 text-white'
          : syncReport.totalConflicts > 0
          ? 'bg-rose-600 text-white'
          : syncReport.totalPending > 0
          ? 'bg-indigo-600 text-white'
          : 'bg-slate-900 text-slate-200'
      }`}
      onClick={onOpenSyncCenter}
    >
      {/* Lado Esquerdo: Status de Conectividade */}
      <div className="flex items-center space-x-2">
        {netStatus === 'OFFLINE' ? (
          <>
            <CloudOff className="w-3.5 h-3.5 animate-pulse" />
            <span className="font-semibold">Modo Offline (Campo)</span>
          </>
        ) : netStatus === 'DEGRADED' ? (
          <>
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-semibold">Conexão Instável ({latency}ms)</span>
          </>
        ) : netStatus === 'RECONNECTING' ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="font-semibold">Reconectando...</span>
          </>
        ) : (
          <>
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-300">Online ({latency}ms)</span>
          </>
        )}

        <span className="opacity-40">|</span>

        {/* Status de Sincronização */}
        {syncReport.isSyncing ? (
          <div className="flex items-center space-x-1.5 text-emerald-300">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Sincronizando fila ({syncReport.totalPending} restantes)...</span>
          </div>
        ) : syncReport.totalConflicts > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenConflicts?.();
            }}
            className="flex items-center space-x-1 underline hover:text-amber-200 font-bold"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{syncReport.totalConflicts} conflito(s) a resolver</span>
          </button>
        ) : syncReport.totalPending > 0 ? (
          <div className="flex items-center space-x-1.5">
            <HardDrive className="w-3 h-3" />
            <span>{syncReport.totalPending} alteraç{syncReport.totalPending > 1 ? 'ões' : 'ão'} no dispositivo</span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            <span>Tudo sincronizado</span>
          </div>
        )}
      </div>

      {/* Lado Direito: Botão de Sincronização / Detalhes */}
      <div className="flex items-center space-x-2">
        {syncReport.totalPending > 0 && netStatus !== 'OFFLINE' && !syncReport.isSyncing && (
          <button
            onClick={handleSyncNow}
            className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded text-[11px] font-semibold transition-all flex items-center space-x-1 shadow-sm"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Sincronizar Agora</span>
          </button>
        )}

        <span className="text-[10px] opacity-75 hidden sm:inline">
          Toque para gerenciar
        </span>
      </div>
    </div>
  );
};
