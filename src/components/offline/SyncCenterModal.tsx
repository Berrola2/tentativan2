import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  Cloud,
  CloudOff,
  HardDrive,
  AlertTriangle,
  Trash2,
  FileImage,
  Layers,
  FileText,
  ShieldCheck,
  Check
} from 'lucide-react';
import { networkState, type NetworkStatus } from '../../services/networkState';
import { syncEngine, type SyncProgressReport } from '../../services/syncEngine';
import {
  offlineDb,
  getStorageEstimate,
  requestStoragePersistence,
  clearOfflineStorageForUser,
  type SyncQueueOperation
} from '../../services/offlineDb';


interface SyncCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConflicts?: () => void;
}

export const SyncCenterModal: React.FC<SyncCenterModalProps> = ({
  isOpen,
  onClose,
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

  const [pendingOps, setPendingOps] = useState<SyncQueueOperation[]>([]);
  const [storageInfo, setStorageInfo] = useState<{
    usageMb: number;
    quotaMb: number;
    percentUsed: number;
    isLowSpace: boolean;
    persisted: boolean;
  }>({
    usageMb: 0,
    quotaMb: 0,
    percentUsed: 0,
    isLowSpace: false,
    persisted: false
  });

  const [isClearing, setIsClearing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadData = async () => {
    const ops = await offlineDb.sync_queue
      .where('status')
      .equals('PENDING')
      .or('status')
      .equals('IN_FLIGHT')
      .or('status')
      .equals('CONFLICT')
      .or('status')
      .equals('NEEDS_ATTENTION')
      .toArray();
    setPendingOps(ops);

    const est = await getStorageEstimate();
    setStorageInfo(est);
  };

  useEffect(() => {
    if (!isOpen) return;

    loadData();

    const unsubNet = networkState.subscribe((status, lat) => {
      setNetStatus(status);
      if (lat) setLatency(lat);
    });

    const unsubSync = syncEngine.subscribeProgress((report) => {
      setSyncReport(report);
      loadData();
    });

    return () => {
      unsubNet();
      unsubSync();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setFeedbackMsg('Sincronizando alterações...');
    const result = await syncEngine.syncPendingOperations();
    setFeedbackMsg(`Concluído: ${result.success} aplicadas com sucesso, ${result.conflicts} conflito(s).`);
    loadData();
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleRequestPersistence = async () => {
    const granted = await requestStoragePersistence();
    setFeedbackMsg(granted ? 'Armazenamento persistente ativado com sucesso.' : 'Persistência não suportada pelo navegador.');
    loadData();
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleClearCache = async () => {
    if (pendingOps.length > 0) {
      const confirmForce = window.confirm(
        `ATENÇÃO: Existem ${pendingOps.length} alteraçõe(s) pendentes no dispositivo que ainda NÃO foram enviadas ao servidor. Se continuar, esse trabalho local será PERDIDO. Deseja realmente limpar?`
      );
      if (!confirmForce) return;
    } else {
      const confirmSimple = window.confirm('Deseja limpar os dados locais em cache das vistorias finalizadas?');
      if (!confirmSimple) return;
    }

    setIsClearing(true);
    await clearOfflineStorageForUser(false);
    setIsClearing(false);
    setFeedbackMsg('Armazenamento local limpo com sucesso.');
    loadData();
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Contadores por tipo de entidade
  const photosPending = pendingOps.filter((o) => o.entity_type === 'MEDIA').length;
  const roomsPending = pendingOps.filter((o) => o.entity_type === 'ROOM').length;
  const itemsPending = pendingOps.filter((o) => o.entity_type === 'ITEM').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Central de Sincronização & Offline</h3>
              <p className="text-xs text-slate-400">Gerenciamento de trabalho em campo e dados locais</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-700">
          {/* Feedback Message */}
          {feedbackMsg && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800 animate-in fade-in">
              {feedbackMsg}
            </div>
          )}

          {/* Status de Conexão */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {netStatus === 'ONLINE' ? (
                <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Cloud className="w-5 h-5" />
                </div>
              ) : netStatus === 'DEGRADED' ? (
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <CloudOff className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <span>Conexão:</span>
                  <span className={
                    netStatus === 'ONLINE' ? 'text-emerald-600' :
                    netStatus === 'DEGRADED' ? 'text-amber-600' : 'text-rose-600'
                  }>
                    {netStatus === 'ONLINE' ? 'Online' :
                     netStatus === 'DEGRADED' ? 'Instável / Degradada' :
                     netStatus === 'RECONNECTING' ? 'Reconectando...' : 'Sem Conexão (Offline)'}
                  </span>
                </div>
                <div className="text-xs text-slate-500">
                  {netStatus === 'ONLINE' ? `Latência do servidor: ${latency}ms` : 'Trabalho sendo gravado no IndexedDB local'}
                </div>
              </div>
            </div>

            <button
              onClick={() => networkState.checkRealConnectivity()}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Testar Rede
            </button>
          </div>

          {/* Resumo da Fila */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>Fila de Alterações Locais</span>
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-700">
                {pendingOps.length} pendente(s)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="font-bold text-base text-slate-800">{roomsPending}</div>
                <div className="text-slate-500 flex items-center justify-center space-x-1 mt-0.5">
                  <Layers className="w-3 h-3" />
                  <span>Ambientes</span>
                </div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="font-bold text-base text-slate-800">{itemsPending}</div>
                <div className="text-slate-500 flex items-center justify-center space-x-1 mt-0.5">
                  <FileText className="w-3 h-3" />
                  <span>Itens</span>
                </div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div className="font-bold text-base text-slate-800">{photosPending}</div>
                <div className="text-slate-500 flex items-center justify-center space-x-1 mt-0.5">
                  <FileImage className="w-3 h-3" />
                  <span>Fotos (Blobs)</span>
                </div>
              </div>
            </div>

            {syncReport.totalConflicts > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-800">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{syncReport.totalConflicts} conflito(s) de sincronização detectado(s).</span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenConflicts?.();
                  }}
                  className="bg-rose-600 text-white px-2.5 py-1 rounded-lg font-bold hover:bg-rose-700 transition-colors"
                >
                  Resolver
                </button>
              </div>
            )}
          </div>

          {/* Armazenamento Local (IndexedDB) */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                <HardDrive className="w-4 h-4 text-slate-600" />
                <span>Armazenamento no Aparelho</span>
              </span>
              <span className="text-slate-500">
                {storageInfo.usageMb} MB usados {storageInfo.quotaMb > 0 ? `de ~${storageInfo.quotaMb} MB` : ''}
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  storageInfo.isLowSpace ? 'bg-rose-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, storageInfo.percentUsed)}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Persistência no navegador: {storageInfo.persisted ? (
                  <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ativa
                  </span>
                ) : (
                  <span className="text-slate-400">Padrão</span>
                )}
              </span>
              {!storageInfo.persisted && (
                <button
                  onClick={handleRequestPersistence}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline"
                >
                  Garantir Persistência
                </button>
              )}
            </div>
          </div>


          {/* Princípio de Segurança */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">Segurança de Campo:</strong> As fotos são armazenadas em formato binário seguro (Blob nativo) no IndexedDB e sincronizadas de forma ordenada com chave criptográfica de idempotência.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className="flex items-center space-x-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold px-3 py-2 rounded-lg hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Dados Locais</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Fechar
            </button>

            <button
              onClick={handleManualSync}
              disabled={syncReport.isSyncing || netStatus === 'OFFLINE'}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-xl shadow-sm transition-all flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncReport.isSyncing ? 'animate-spin' : ''}`} />
              <span>{syncReport.isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
