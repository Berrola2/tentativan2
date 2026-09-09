import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Copy, 
  Check, 
  AlertCircle, 
  Loader2, 
  LogOut,
  TrendingUp,
  CreditCard,
  Clock,
  HardDrive,
  RefreshCw,
  Edit3,
  Calendar,
  Layers,
  Filter
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { adminCreateCompany } from '../../services/auth';
import { 
  fetchSuperAdminCompaniesList, 
  fetchSuperAdminSaasMetrics,
  adminUpdateCompanyPlan,
  adminExtendTrial,
  adminRecalculateUsage
} from '../../services/billing';
import { checkSystemHealth, type SystemHealthStatus } from '../../services/health';
import { fetchFeatureFlags, adminToggleFeatureFlag, type SystemFlagKey } from '../../services/killSwitch';
import type { SaasMetrics, PlanCode } from '../../types/billing';

export const SuperAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCompanyForPlan, setSelectedCompanyForPlan] = useState<any | null>(null);
  const [selectedCompanyForTrial, setSelectedCompanyForTrial] = useState<any | null>(null);

  // Form states - Create Company
  const [tradeName, setTradeName] = useState('');
  const [slug, setSlug] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [managerFirst, setManagerFirst] = useState('');
  const [managerLast, setManagerLast] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdManagerResult, setCreatedManagerResult] = useState<{ loginAlias: string; tempPassword: string; fullName: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form states - Update Plan
  const [newPlanCode, setNewPlanCode] = useState<PlanCode>('PROFESSIONAL');
  const [planChangeReason, setPlanChangeReason] = useState('');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);
  const [planActionError, setPlanActionError] = useState<string | null>(null);

  // Form states - Extend Trial
  const [additionalDays, setAdditionalDays] = useState<number>(14);
  const [trialExtendReason, setTrialExtendReason] = useState('');
  const [isExtendingTrial, setIsExtendingTrial] = useState(false);
  const [trialActionError, setTrialActionError] = useState<string | null>(null);

  // Recalculate feedback
  const [recalculatingCompanyId, setRecalculatingCompanyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [comps, mets, health, flags] = await Promise.all([
        fetchSuperAdminCompaniesList(),
        fetchSuperAdminSaasMetrics().catch(() => null),
        checkSystemHealth().catch(() => null),
        fetchFeatureFlags(true).catch(() => ({}))
      ]);
      setCompanies(comps);
      setMetrics(mets);
      setHealthStatus(health);
      setFeatureFlags(flags);
    } catch (err) {
      console.error('Erro ao carregar dados do Super Admin:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleToggleFlag = async (key: SystemFlagKey, currentState: boolean) => {
    const reason = window.prompt(`Informe a justificativa operacional para ${currentState ? 'DESATIVAR' : 'ATIVAR'} a flag ${key}:`);
    if (!reason || !reason.trim()) return;

    const res = await adminToggleFeatureFlag(key, !currentState, reason.trim());
    if (res.success) {
      setFeatureFlags(prev => ({ ...prev, [key]: !currentState }));
      await loadData();
    } else {
      alert(`Erro ao alterar flag: ${res.message}`);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!tradeName.trim() || !slug.trim()) {
      setErrorMsg('Nome fantasia e Slug YZZY são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminCreateCompany({
        name: tradeName.trim(),
        legalName: tradeName.trim(),
        tradeName: tradeName.trim(),
        slug: slug.trim(),
        documentNumber: documentNumber.trim(),
        phone: phone.trim(),
        email: '',
        managerFirstName: managerFirst.trim() || undefined,
        managerLastName: managerLast.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Erro ao cadastrar empresa.');
        return;
      }

      if (res.data?.manager) {
        setCreatedManagerResult(res.data.manager);
      } else {
        setIsCreateModalOpen(false);
      }

      await loadData();
    } catch {
      setErrorMsg('Erro de conexão ao servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForPlan) return;
    if (!planChangeReason.trim()) {
      setPlanActionError('Informe a justificativa comercial da alteração.');
      return;
    }

    setIsUpdatingPlan(true);
    setPlanActionError(null);
    try {
      const res = await adminUpdateCompanyPlan(selectedCompanyForPlan.id, newPlanCode, planChangeReason.trim());
      if (res.success) {
        setSelectedCompanyForPlan(null);
        setPlanChangeReason('');
        await loadData();
      } else {
        setPlanActionError(res.message || 'Erro ao atualizar plano.');
      }
    } catch (err: any) {
      setPlanActionError(err.message || 'Erro ao atualizar plano.');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleExtendTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForTrial) return;
    if (!trialExtendReason.trim()) {
      setTrialActionError('Informe o motivo da extensão de trial.');
      return;
    }

    setIsExtendingTrial(true);
    setTrialActionError(null);
    try {
      const res = await adminExtendTrial(selectedCompanyForTrial.id, additionalDays, trialExtendReason.trim());
      if (res.success) {
        setSelectedCompanyForTrial(null);
        setTrialExtendReason('');
        await loadData();
      } else {
        setTrialActionError(res.message || 'Erro ao estender trial.');
      }
    } catch (err: any) {
      setTrialActionError(err.message || 'Erro ao estender trial.');
    } finally {
      setIsExtendingTrial(false);
    }
  };

  const handleRecalculate = async (companyId: string) => {
    setRecalculatingCompanyId(companyId);
    try {
      await adminRecalculateUsage(companyId);
      await loadData();
    } catch (err) {
      console.error('Erro ao recalcular uso:', err);
    } finally {
      setRecalculatingCompanyId(null);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const matchesSearch = 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id?.toLowerCase().includes(searchTerm.toLowerCase());

    const sub = c.company_subscriptions?.[0] || c.company_subscriptions;
    const planCode = sub?.saas_plans?.code || 'STARTER';
    const subStatus = sub?.status || 'ACTIVE';

    const matchesPlan = planFilter === 'ALL' || planCode === planFilter;
    const matchesStatus = statusFilter === 'ALL' || subStatus === statusFilter;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  const copyCredentials = () => {
    if (!createdManagerResult) return;
    const text = `Login YZZY: ${createdManagerResult.loginAlias}\nSenha Provisória: ${createdManagerResult.tempPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header Super Admin */}
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">
                Painel YZZY — <span className="text-blue-400">Super Admin SaaS</span>
              </h1>
              <p className="text-xs text-slate-400">
                Administração Global de Tenants, Planos, Limites e Billing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors flex items-center gap-2 text-xs font-semibold"
              title="Atualizar Métricas e Lista"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <div className="text-right hidden sm:block border-l border-slate-800 pl-4">
              <p className="text-xs font-bold text-slate-200">{user?.displayName || user?.fullName}</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700">
                SUPER_ADMIN
              </span>
            </div>
            <button
              onClick={() => logout()}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        
        {/* Metric Cards - SaaS Aggregation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* MRR & ARR */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">MRR / Faturamento</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {metrics ? metrics.mrr_formatted : 'R$ 0,00'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              ARR Estimado: <span className="font-semibold text-slate-700">{metrics ? metrics.arr_formatted : 'R$ 0,00'}</span>
            </p>
          </div>

          {/* Subscriptions & Trials */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Assinaturas Ativas</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-2xl font-black text-slate-900">
                {metrics ? metrics.active_subscriptions : 0}
              </p>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {metrics ? metrics.trials_active : 0} trials
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Inadimplentes (Past Due): <span className="font-semibold text-amber-600">{metrics?.past_due_subscriptions || 0}</span>
            </p>
          </div>

          {/* Companies Stats */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Empresas Cadastradas</span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {companies.length}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Total Vistorias na Base: <span className="font-semibold text-slate-700">{metrics?.total_inspections || 0}</span>
            </p>
          </div>

          {/* Storage Aggregated */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Armazenamento Total</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-2">
              {metrics ? `${metrics.total_storage_gb} GB` : '0 GB'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Mídias & Evidências Reconciliadas
            </p>
          </div>
        </div>

        {/* System Health & Emergency Kill Switches */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full ${healthStatus?.status === 'HEALTHY' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Saúde Operacional do Sistema: <span className="text-emerald-400">{healthStatus?.status || 'HEALTHY'}</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  PostgreSQL conectado • Latência: {healthStatus?.database.latencyMs || 0}ms • Versão: {healthStatus?.version || '1.0.0-prod'}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
              PROD-READY MONITOR
            </span>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Kill Switches Globais & Feature Flags de Emergência:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {[
                { key: 'AI_ENABLED_GLOBALLY', label: 'IA Assistiva' },
                { key: 'EXTERNAL_SIGNATURES_ENABLED', label: 'Assinaturas Ext.' },
                { key: 'BILLING_ENABLED', label: 'Billing / Checkout' },
                { key: 'UPLOADS_ENABLED', label: 'Upload Storage' },
                { key: 'OFFLINE_SYNC_ENABLED', label: 'Sync Offline' },
              ].map((flag) => {
                const isEnabled = featureFlags[flag.key] !== false;
                return (
                  <button
                    key={flag.key}
                    onClick={() => handleToggleFlag(flag.key as SystemFlagKey, isEnabled)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isEnabled
                        ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/50'
                        : 'bg-rose-950/40 border-rose-800/80 text-rose-300 hover:bg-rose-900/50'
                    }`}
                    title="Clique para alternar (exige justificativa)"
                  >
                    <span className="text-[10px] font-medium text-slate-400 block">{flag.label}</span>
                    <span className="text-xs font-black mt-1 flex items-center justify-between">
                      {isEnabled ? 'ATIVADO' : 'DESATIVADO'}
                      <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action, Search & Filters Bar */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por Empresa, Slug, CNPJ ou UUID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Filter Plan */}
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400 hidden sm:inline" />
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Todos os Planos</option>
                <option value="STARTER">Starter</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="BUSINESS">Business</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>

              {/* Filter Status */}
              <Filter className="w-4 h-4 text-slate-400 hidden sm:inline" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Todos os Status</option>
                <option value="ACTIVE">Ativo</option>
                <option value="TRIALING">Trial</option>
                <option value="PAST_DUE">Inadimplente (Past Due)</option>
                <option value="SUSPENDED">Suspenso</option>
                <option value="CANCELED">Cancelado</option>
              </select>

              <button
                onClick={() => {
                  setCreatedManagerResult(null);
                  setErrorMsg(null);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Empresa</span>
              </button>
            </div>
          </div>
        </div>

        {/* Company SaaS Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Empresas & Assinaturas SaaS
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              {filteredCompanies.length} de {companies.length} empresa(s)
            </span>
          </div>

          {isLoading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm">Carregando empresas e dados de faturamento...</p>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              Nenhuma empresa encontrada com os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Empresa</th>
                    <th className="py-3.5 px-4">Plano Atual</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Próx. Cobrança / Fim Trial</th>
                    <th className="py-3.5 px-4">Cadastro</th>
                    <th className="py-3.5 px-4 text-right">Ações SaaS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompanies.map((comp) => {
                    const sub = comp.company_subscriptions?.[0] || comp.company_subscriptions;
                    const plan = sub?.saas_plans;
                    const status = sub?.status || 'TRIALING';

                    const isTrial = status === 'TRIALING';
                    const isPastDue = status === 'PAST_DUE';
                    const isSuspended = status === 'SUSPENDED';

                    return (
                      <tr key={comp.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Empresa Name & Document */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{comp.name}</p>
                              <p className="text-slate-500 font-mono text-[11px]">
                                @{comp.slug}.yzzy
                                {comp.document_number && ` • ${comp.document_number}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Plano */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {plan?.name || 'Starter'}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {plan?.price_cents ? `R$ ${(plan.price_cents / 100).toFixed(2)}/mês` : 'Gratuito'}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {isTrial && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-500" />
                              Trial
                            </span>
                          )}
                          {status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Ativa
                            </span>
                          )}
                          {isPastDue && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3 text-rose-500" />
                              Past Due
                            </span>
                          )}
                          {isSuspended && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                              <XCircle className="w-3 h-3 text-slate-500" />
                              Suspensa
                            </span>
                          )}
                        </td>

                        {/* Renewal / Trial End */}
                        <td className="py-4 px-4 text-slate-600">
                          {isTrial ? (
                            <div>
                              <p className="font-semibold text-amber-700">
                                {sub?.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString('pt-BR') : 'Sem data'}
                              </p>
                              <p className="text-[10px] text-slate-400">Expiração do Trial</p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-slate-800">
                                {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString('pt-BR') : '—'}
                              </p>
                              <p className="text-[10px] text-slate-400">Renovação de Ciclo</p>
                            </div>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-4 px-4 text-slate-500">
                          {new Date(comp.created_at).toLocaleDateString('pt-BR')}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Alterar Plano */}
                            <button
                              onClick={() => {
                                setSelectedCompanyForPlan(comp);
                                setNewPlanCode(plan?.code || 'PROFESSIONAL');
                                setPlanChangeReason('');
                                setPlanActionError(null);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 transition-colors"
                              title="Alterar Plano (Super Admin)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Estender Trial */}
                            <button
                              onClick={() => {
                                setSelectedCompanyForTrial(comp);
                                setAdditionalDays(14);
                                setTrialExtendReason('');
                                setTrialActionError(null);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 border border-slate-200 transition-colors"
                              title="Estender Período de Trial"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </button>

                            {/* Recalcular Uso */}
                            <button
                              onClick={() => handleRecalculate(comp.id)}
                              disabled={recalculatingCompanyId === comp.id}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 border border-slate-200 transition-colors"
                              title="Reconciliar e Recalcular Contadores"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${recalculatingCompanyId === comp.id ? 'animate-spin text-emerald-600' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {/* Modal: Alterar Plano (Super Admin Override com Auditoria) */}
      {selectedCompanyForPlan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-blue-600" />
                Alterar Plano da Empresa
              </h3>
              <button onClick={() => setSelectedCompanyForPlan(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-800">{selectedCompanyForPlan.name}</p>
              <p className="text-slate-500 font-mono text-[11px]">ID: {selectedCompanyForPlan.id}</p>
            </div>

            {planActionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{planActionError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Novo Plano</label>
                <select
                  value={newPlanCode}
                  onChange={(e) => setNewPlanCode(e.target.value as PlanCode)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="STARTER">Starter (Gratuito / Básico)</option>
                  <option value="PROFESSIONAL">Professional (R$ 149,00/mês)</option>
                  <option value="BUSINESS">Business (R$ 349,00/mês)</option>
                  <option value="ENTERPRISE">Enterprise (Personalizado)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Justificativa Comercial (Auditoria Obrigatória) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Upgrade solicitado via atendimento comercial / Bonificação anual..."
                  value={planChangeReason}
                  onChange={(e) => setPlanChangeReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCompanyForPlan(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPlan}
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                >
                  {isUpdatingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Alteração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Estender Trial (Super Admin com Auditoria) */}
      {selectedCompanyForTrial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Estender Período de Trial
              </h3>
              <button onClick={() => setSelectedCompanyForTrial(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-800">{selectedCompanyForTrial.name}</p>
              <p className="text-slate-500 font-mono text-[11px]">ID: {selectedCompanyForTrial.id}</p>
            </div>

            {trialActionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{trialActionError}</span>
              </div>
            )}

            <form onSubmit={handleExtendTrialSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Dias Adicionais</label>
                <select
                  value={additionalDays}
                  onChange={(e) => setAdditionalDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600"
                >
                  <option value={7}>+ 7 dias de degustação</option>
                  <option value={14}>+ 14 dias de degustação</option>
                  <option value={30}>+ 30 dias de degustação</option>
                  <option value={60}>+ 60 dias de degustação</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Motivo da Extensão (Auditoria Obrigatória) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Cliente em processo de homologação técnica com a diretoria..."
                  value={trialExtendReason}
                  onChange={(e) => setTrialExtendReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCompanyForTrial(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isExtendingTrial}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-600/20"
                >
                  {isExtendingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Estender Trial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar Empresa */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {createdManagerResult ? (
              <div className="space-y-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Empresa e Gerente Criados!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Copie as credenciais iniciais do gerente abaixo. A senha provisória só será exibida agora.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Login YZZY</span>
                    <span className="font-mono text-sm font-bold text-slate-900">{createdManagerResult.loginAlias}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Senha Provisória</span>
                    <span className="font-mono text-sm font-bold text-blue-600">{createdManagerResult.tempPassword}</span>
                  </div>
                </div>

                <button
                  onClick={copyCredentials}
                  className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copiado para a área de transferência!' : 'Copiar Credenciais'}</span>
                </button>

                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Cadastrar Nova Empresa
                  </h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleCreateCompany} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Nome Fantasia *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Imobiliária Alpha"
                        value={tradeName}
                        onChange={(e) => {
                          setTradeName(e.target.value);
                          if (!slug) {
                            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Slug YZZY *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: imobiliariaalpha"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">CNPJ</label>
                      <input
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Telefone</label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  {/* Primeiro Gerente */}
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-800 mb-2">Primeiro Gerente (Opcional):</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Primeiro Nome"
                          value={managerFirst}
                          onChange={(e) => setManagerFirst(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Sobrenome"
                          value={managerLast}
                          onChange={(e) => setManagerLast(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Empresa'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
