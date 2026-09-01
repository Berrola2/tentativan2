import React, { useState, useRef } from 'react';
import { 
  X, 
  DownloadCloud, 
  UploadCloud, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileJson,
  Server,
  ChevronDown,
  ChevronUp,
  Code2
} from 'lucide-react';
import type { InspectionData, SupabaseConfig } from '../types/inspection';
import { testSupabaseConnection, uploadInspectionToSupabase, getInitialSupabaseConfig } from '../services/supabaseClient';
import { useToast } from './Toast';

interface BackupSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InspectionData;
  onRestoreData: (restored: InspectionData) => void;
  supabaseConfig?: SupabaseConfig;
  onSaveSupabaseConfig: (config: SupabaseConfig) => void;
}

export const BackupSyncModal: React.FC<BackupSyncModalProps> = ({
  isOpen,
  onClose,
  data,
  onRestoreData,
  supabaseConfig,
  onSaveSupabaseConfig,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialCfg = getInitialSupabaseConfig();
  const [config, setConfig] = useState<SupabaseConfig>({
    url: supabaseConfig?.url || initialCfg.url,
    anonKey: supabaseConfig?.anonKey || initialCfg.anonKey,
    bucketName: supabaseConfig?.bucketName || initialCfg.bucketName,
    tableName: supabaseConfig?.tableName || initialCfg.tableName,
    autoSync: supabaseConfig?.autoSync ?? initialCfg.autoSync,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportJson = () => {
    try {
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_Vistoria_${(data.title || 'Imovel').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Arquivo de backup exportado com sucesso!', 'success');
    } catch (err) {
      showToast('Erro ao exportar arquivo JSON.', 'error');
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as InspectionData;
        if (!parsed.id || !Array.isArray(parsed.rooms)) {
          throw new Error('Formato de arquivo inválido.');
        }
        onRestoreData(parsed);
        showToast('Vistoria restaurada com sucesso!', 'success');
        onClose();
      } catch (err) {
        showToast('Arquivo inválido ou corrompido.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleTestSupabase = async () => {
    if (!config.url || !config.anonKey) {
      showToast('Preencha a URL e a Anon Key do Supabase.', 'error');
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection(config);
      setTestResult(res);
      if (res.success) {
        onSaveSupabaseConfig(config);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncToSupabase = async () => {
    if (!config.url || !config.anonKey) {
      showToast('Configure o Supabase primeiro.', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await uploadInspectionToSupabase(data, config);
      if (res.success) {
        setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Sincronização & Backup na Nuvem</h2>
              <p className="text-xs text-slate-500">Mantenha seus laudos salvos e protegidos com backup contínuo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          
          {/* 1. Primary Cloud Status Card for Users */}
          <div className="bg-gradient-to-br from-indigo-50/70 to-brand-50/70 p-5 rounded-2xl border border-indigo-100 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="font-bold text-xs sm:text-sm text-slate-900">
                  Nuvem Supabase Conectada & Ativa
                </span>
              </div>

              {lastSyncTime && (
                <span className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
                  Última sincronização: {lastSyncTime}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Suas vistorias e fotos são salvas automaticamente em seu armazenamento local (IndexedDB) e podem ser sincronizadas em tempo real com o banco de dados na nuvem para acesso em qualquer dispositivo.
            </p>

            <div className="pt-1">
              <button
                type="button"
                onClick={handleSyncToSupabase}
                disabled={isSyncing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sincronizando com a Nuvem...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4" />
                    <span>Sincronizar Vistoria Atual com a Nuvem</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2. Local JSON Backup & Restore Card */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileJson className="w-4 h-4 text-brand-600" />
              Backup Manual em Arquivo (.json)
            </h3>
            <p className="text-xs text-slate-500">
              Baixe um arquivo seguro contendo todas as fotos e informações da vistoria para arquivamento ou transferência.
            </p>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleExportJson}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold border border-slate-200 shadow-sm transition-all active:scale-95 text-xs"
              >
                <DownloadCloud className="w-4 h-4 text-brand-600" />
                <span>Exportar Arquivo (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold shadow-sm transition-all text-xs"
              >
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                <span>Importar Arquivo (.json)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportJson}
                className="hidden"
              />
            </div>
          </div>

          {/* 3. Developer / Advanced Technical Area (Collapsible) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowDevPanel(!showDevPanel)}
              className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700">
                  Painel do Desenvolvedor (Credenciais e Configurações de API)
                </span>
              </div>
              {showDevPanel ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showDevPanel && (
              <div className="p-4 sm:p-5 border-t border-slate-200 space-y-3 bg-slate-50/50 animate-fadeIn">
                <p className="text-[11px] text-slate-500">
                  Esta área é restrita para ajustes técnicos de infraestrutura do Supabase. Futuramente este painel será protegido com tela de login de administrador.
                </p>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">Supabase Project URL</label>
                    <input
                      type="text"
                      value={config.url}
                      onChange={(e) => setConfig((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://xyzproject.supabase.co"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1 text-xs">Supabase Anon Key (Public Key)</label>
                    <input
                      type="password"
                      value={config.anonKey}
                      onChange={(e) => setConfig((prev) => ({ ...prev, anonKey: e.target.value }))}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testResult.success 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleTestSupabase}
                      disabled={isTesting}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5 text-slate-500" />}
                      <span>Testar Conexão da API</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end bg-white">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
