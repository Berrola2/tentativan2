import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Zap,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import { fetchCompanyPlanAndUsage } from '../../services/billing';
import type { CompanyPlanAndUsage, SubscriptionStatus } from '../../types/billing';
import { PlanUsageCard } from './PlanUsageCard';
import { BillingHistoryTable } from './BillingHistoryTable';
import { UpgradePlanModal } from './UpgradePlanModal';

interface CompanyPlanSectionProps {
  companyId: string;
}

export const CompanyPlanSection: React.FC<CompanyPlanSectionProps> = ({ companyId }) => {
  const [data, setData] = useState<CompanyPlanAndUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchCompanyPlanAndUsage(companyId);
      setData(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao carregar informações de faturamento.');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, loadData]);

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ativa
          </span>
        );
      case 'TRIALING':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> Período de Teste
          </span>
        );
      case 'PAST_DUE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Pagamento Pendente
          </span>
        );
      case 'SUSPENDED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Suspensa (Read-Only)
          </span>
        );
      case 'CANCELED':
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" /> Expirada
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3 font-sans">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Carregando dados comerciais e faturamento...
        </p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm space-y-3 font-sans">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
        <h3 className="font-bold text-slate-900">Erro ao Carregar Plano</h3>
        <p className="text-xs text-slate-500">{errorMsg || 'Dados comerciais indisponíveis.'}</p>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const { plan, subscription } = data;

  return (
    <div className="space-y-6 font-sans">
      {/* Banner Principal do Plano */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold tracking-wider text-blue-400 uppercase">Plano Atual</span>
              {getStatusBadge(subscription.status)}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{plan.name}</h2>
            <p className="text-xs text-slate-300 max-w-xl">{plan.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-400" />
                <span>R$ {(plan.price_cents / 100).toFixed(2).replace('.', ',')} / {plan.billing_interval === 'MONTHLY' ? 'mês' : 'ano'}</span>
              </div>
              {subscription.status === 'TRIALING' && subscription.trial_ends_at && (
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <Clock className="w-4 h-4" />
                  <span>Trial expira em: {new Date(subscription.trial_ends_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {subscription.status === 'ACTIVE' && subscription.current_period_end && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <span>Próxima renovação: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 active:scale-95"
            >
              <Zap className="w-4 h-4" />
              <span>Fazer Upgrade / Alterar Plano</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Consumo e Limites */}
      <PlanUsageCard
        planAndUsage={data}
        onUpgradeClick={() => setIsUpgradeModalOpen(true)}
      />

      {/* Tabela de Faturas */}
      <BillingHistoryTable companyId={companyId} />

      {/* Modal de Upgrade */}
      <UpgradePlanModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        companyId={companyId}
        currentPlanCode={plan.code}
      />
    </div>
  );
};
