import React from 'react';
import { Users, FileText, Sparkles, HardDrive, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { CompanyPlanAndUsage } from '../../types/billing';

interface PlanUsageCardProps {
  planAndUsage: CompanyPlanAndUsage;
  onUpgradeClick?: () => void;
}

export const PlanUsageCard: React.FC<PlanUsageCardProps> = ({
  planAndUsage,
  onUpgradeClick
}) => {
  const { entitlements, usage } = planAndUsage;

  // Extrair limites e consumo
  const maxUsers = Number(entitlements.max_users?.value || 2);
  const currentUsers = Number(usage.ACTIVE_USERS || 0);
  const usersPercent = Math.min(100, Math.round((currentUsers / maxUsers) * 100));

  const maxInspections = Number(entitlements.max_inspections_month?.value || 30);
  const currentInspections = Number(usage.INSPECTIONS_CREATED || 0);
  const inspectionsPercent = Math.min(100, Math.round((currentInspections / maxInspections) * 100));

  const maxAi = Number(entitlements.monthly_ai_operations?.value || 50);
  const currentAi = Number(usage.AI_OPERATIONS || 0);
  const aiPercent = Math.min(100, Math.round((currentAi / maxAi) * 100));

  const maxStorageGb = Number(entitlements.storage_gb?.value || 5);
  const currentStorageBytes = Number(usage.STORAGE_BYTES || 0);
  const currentStorageGb = Math.round((currentStorageBytes / (1024 * 1024 * 1024)) * 100) / 100;
  const storagePercent = Math.min(100, Math.round((currentStorageGb / maxStorageGb) * 100));

  const getGaugeColor = (pct: number) => {
    if (pct >= 100) return 'bg-rose-500';
    if (pct >= 90) return 'bg-rose-400';
    if (pct >= 80) return 'bg-amber-500';
    return 'bg-blue-600';
  };

  const getBadge = (pct: number) => {
    if (pct >= 100) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-rose-600" /> Limite Atingido
        </span>
      );
    }
    if (pct >= 80) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-600" /> Alerta ({pct}%)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Normal
      </span>
    );
  };

  const hasAnyNearLimit = usersPercent >= 80 || inspectionsPercent >= 80 || aiPercent >= 80 || storagePercent >= 80;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Consumo de Recursos do Plano</h3>
          <p className="text-xs text-slate-500">Métricas em tempo real de limites e franquia contratada</p>
        </div>

        {onUpgradeClick && (
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            Fazer Upgrade de Plano
          </button>
        )}
      </div>

      {hasAnyNearLimit && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-3 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Atenção de Limites:</strong> Um ou mais recursos da sua empresa estão próximos de atingir 100% da cota contratada. Faça upgrade do plano para evitar interrupções operacionais.
          </div>
        </div>
      )}

      {/* Grid de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Usuários */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            {getBadge(usersPercent)}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Usuários Ativos</div>
            <div className="text-lg font-black text-slate-900">
              {currentUsers} <span className="text-xs font-normal text-slate-400">/ {maxUsers}</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full ${getGaugeColor(usersPercent)} transition-all duration-300`} style={{ width: `${usersPercent}%` }} />
          </div>
        </div>

        {/* 2. Vistorias / Mês */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            {getBadge(inspectionsPercent)}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Vistorias no Mês</div>
            <div className="text-lg font-black text-slate-900">
              {currentInspections} <span className="text-xs font-normal text-slate-400">/ {maxInspections}</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full ${getGaugeColor(inspectionsPercent)} transition-all duration-300`} style={{ width: `${inspectionsPercent}%` }} />
          </div>
        </div>

        {/* 3. IA Assistiva */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            {getBadge(aiPercent)}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Operações IA / Mês</div>
            <div className="text-lg font-black text-slate-900">
              {currentAi} <span className="text-xs font-normal text-slate-400">/ {maxAi}</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full ${getGaugeColor(aiPercent)} transition-all duration-300`} style={{ width: `${aiPercent}%` }} />
          </div>
        </div>

        {/* 4. Armazenamento */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            {getBadge(storagePercent)}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500">Storage em Nuvem</div>
            <div className="text-lg font-black text-slate-900">
              {currentStorageGb} GB <span className="text-xs font-normal text-slate-400">/ {maxStorageGb} GB</span>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div className={`h-full ${getGaugeColor(storagePercent)} transition-all duration-300`} style={{ width: `${storagePercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};
