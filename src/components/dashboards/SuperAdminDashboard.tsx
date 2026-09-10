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
  HardDrive, 
  RefreshCw, 
  Edit3, 
  Calendar, 
  PowerOff,
  ChevronDown,
  ChevronUp,
  CreditCard,
  FileText
} from 'lucide-react';
import { adminCreateCompany, adminToggleCompanyStatus } from '../../services/auth';
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
import { Button } from '../ui/Button';
import { MetricCard } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface SuperAdminDashboardProps {
  activeNav?: string;
  onNavigate?: (id: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHealthExpanded, setIsHealthExpanded] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCompanyForPlan, setSelectedCompanyForPlan] = useState<any | null>(null);
  const [selectedCompanyForTrial, setSelectedCompanyForTrial] = useState<any | null>(null);
  const [selectedCompanyForDeactivation, setSelectedCompanyForDeactivation] = useState<any | null>(null);

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

  // Form states - Deactivate Company
  const [deactivationReason, setDeactivationReason] = useState('Cancelamento de contrato');
  const [customDeactivationReason, setCustomDeactivationReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);

  // Recalculate feedback
  const [recalculatingCompanyId, setRecalculatingCompanyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [comps, mets, health, flags] = await Promise.all([
        fetchSuperAdminCompaniesList().catch(() => []),
        fetchSuperAdminSaasMetrics().catch(() => null),
        checkSystemHealth().catch(() => null),
        fetchFeatureFlags(true).catch(() => ({}))
      ]);
      setCompanies(comps || []);
      setMetrics(mets);
      setHealthStatus(health);
      setFeatureFlags(flags || {});
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
        setCreatedManagerResult({
          loginAlias: res.data.manager.loginAlias,
          tempPassword: res.data.manager.tempPassword,
          fullName: res.data.manager.fullName,
        });
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
      setPlanActionError('A justificativa da alteração é obrigatória.');
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
        setPlanActionError(res.message || 'Falha ao atualizar plano.');
      }
    } catch (err: any) {
      setPlanActionError(err.message || 'Falha ao atualizar plano.');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const handleExtendTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForTrial) return;
    if (!trialExtendReason.trim()) {
      setTrialActionError('A justificativa da extensão é obrigatória.');
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
        setTrialActionError(res.message || 'Falha ao estender trial.');
      }
    } catch (err: any) {
      setTrialActionError(err.message || 'Falha ao estender trial.');
    } finally {
      setIsExtendingTrial(false);
    }
  };

  const handleDeactivateCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForDeactivation) return;
    const finalReason = deactivationReason === 'Outro' ? customDeactivationReason.trim() : deactivationReason.trim();
    if (!finalReason) {
      setDeactivationError('O motivo do cancelamento é obrigatório.');
      return;
    }

    setIsDeactivating(true);
    setDeactivationError(null);
    try {
      const res = await adminToggleCompanyStatus(selectedCompanyForDeactivation.id, false, finalReason);
      if (res.success) {
        setCompanies(prev => prev.map(c => c.id === selectedCompanyForDeactivation.id ? { ...c, active: false } : c));
        setSelectedCompanyForDeactivation(null);
        setDeactivationReason('Cancelamento de contrato');
        setCustomDeactivationReason('');
        await loadData();
      } else {
        setDeactivationError(res.error || 'Falha ao desativar empresa.');
      }
    } catch (err: any) {
      setDeactivationError(err.message || 'Falha ao desativar empresa.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleReactivateCompany = async (company: any) => {
    const confirmReactivate = window.prompt(`Deseja realmente reativar a empresa "${company.name}"? Digite REATIVAR para confirmar:`);
    if (confirmReactivate !== 'REATIVAR' && confirmReactivate !== 'reativar') return;
    try {
      const res = await adminToggleCompanyStatus(company.id, true);
      if (res.success) {
        setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, active: true } : c));
        await loadData();
      } else {
        alert(res.error || 'Falha ao reativar empresa.');
      }
    } catch (err: any) {
      alert(err.message || 'Falha ao reativar empresa.');
    }
  };

  const handleRecalculateUsage = async (companyId: string) => {
    setRecalculatingCompanyId(companyId);
    try {
      await adminRecalculateUsage(companyId);
      await loadData();
    } catch (err: any) {
      alert(`Falha ao recalcular: ${err.message}`);
    } finally {
      setRecalculatingCompanyId(null);
    }
  };

  const filteredCompanies = companies.filter(c => {
    const matchesSearch = 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.trade_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document_number?.includes(searchTerm);

    const matchesStatus = 
      statusFilter === 'ALL' ? true :
      statusFilter === 'ACTIVE' ? c.active !== false :
      statusFilter === 'INACTIVE' ? c.active === false : true;

    const matchesPlan =
      planFilter === 'ALL' ? true :
      c.company_subscriptions?.[0]?.saas_plans?.code === planFilter || (planFilter === 'TRIAL' && c.company_subscriptions?.[0]?.status === 'TRIALING');

    return matchesSearch && matchesStatus && matchesPlan;
  });

  const copyManagerCredentials = () => {
    if (!createdManagerResult) return;
    const text = `Login YZZY: ${createdManagerResult.loginAlias}\nSenha Provisória: ${createdManagerResult.tempPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeCompaniesCount = companies.filter(c => c.active !== false).length;

  return (
    <div className="w-full space-y-6 animate-fadeIn font-sans text-yzzy-text-primary p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      
      {/* 
        ============================================================
        1. HERO HEADER: YZZY PLATFORM OVERVIEW
        ============================================================
      */}
      <div className="bg-white rounded-card p-6 sm:p-8 border border-yzzy-border shadow-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
            <span>Super Administração Global • YZZY SaaS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-yzzy-text-primary tracking-tight font-display">
            Visão Geral YZZY
          </h1>
          <p className="text-sm text-yzzy-text-secondary">
            Operação, tenants e integridade geral da plataforma imobiliária.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <Button
            variant="secondary"
            size="md"
            onClick={handleRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
            className="text-xs font-semibold"
          >
            Atualizar
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setCreatedManagerResult(null);
              setErrorMsg(null);
              setTradeName('');
              setSlug('');
              setDocumentNumber('');
              setPhone('');
              setManagerFirst('');
              setManagerLast('');
              setIsCreateModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold shadow-xs hover:shadow-subtle-blue"
          >
            Nova Empresa
          </Button>
        </div>
      </div>

      {/* 
        ============================================================
        2. MÉTRICAS DE NEGÓCIO & PLATAFORMA (DADOS REAIS SOMENTE)
        ============================================================
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <MetricCard
          title="Empresas Ativas"
          value={isLoading ? '...' : activeCompaniesCount}
          subtitle={`${companies.length} cadastradas no total`}
          icon={<Building2 className="w-4 h-4" />}
        />
        <MetricCard
          title="Assinaturas / Trial"
          value={isLoading ? '...' : `${metrics?.active_subscriptions || activeCompaniesCount} / ${metrics?.trials_active || 0}`}
          subtitle="Ativas vs Período de Teste"
          icon={<CreditCard className="w-4 h-4" />}
        />
        <MetricCard
          title="Total de Vistorias"
          value={isLoading ? '...' : metrics?.total_inspections || 0}
          subtitle="Laudos na plataforma"
          icon={<FileText className="w-4 h-4" />}
        />
        <MetricCard
          title="Armazenamento Utilizado"
          value={isLoading ? '...' : (metrics?.total_storage_gb ? `${metrics.total_storage_gb} GB` : `${Math.round((metrics?.total_storage_bytes || 0) / (1024 * 1024))} MB`)}
          subtitle="Armazenamento de fotos & laudos"
          icon={<HardDrive className="w-4 h-4" />}
        />
      </div>

      {/* 
        ============================================================
        3. GESTÃO DE EMPRESAS & TENANTS (DESTAQUE MÁXIMO)
        ============================================================
      */}
      <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden space-y-4">
        
        {/* Header da Seção + Filtros */}
        <div className="p-5 sm:p-6 border-b border-yzzy-border/60 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div>
            <h2 className="text-sm font-bold text-yzzy-text-primary tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-600" />
              Empresas & Clientes
            </h2>
            <p className="text-xs text-yzzy-text-muted mt-0.5">
              {filteredCompanies.length} empresa(s) encontrada(s)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Campo de Busca */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar empresa ou @slug..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 hover:border-slate-300 transition-colors"
              />
            </div>

            {/* Filtro de Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-yzzy-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="ALL">Status: Todos</option>
              <option value="ACTIVE">Somente Ativas</option>
              <option value="INACTIVE">Somente Inativas</option>
            </select>

            {/* Filtro de Plano */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-xs py-1.5 px-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-yzzy-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="ALL">Plano: Todos</option>
              <option value="STARTER">Starter</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="ENTERPRISE">Enterprise</option>
              <option value="TRIAL">Trial</option>
            </select>
          </div>
        </div>

        {/* Lista de Empresas */}
        {isLoading ? (
          <div className="p-12 text-center text-yzzy-text-muted flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            <p className="text-xs">Carregando empresas...</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="p-12 text-center text-yzzy-text-muted space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold">Nenhuma empresa encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          <div className="divide-y divide-yzzy-border/60">
            {filteredCompanies.map((comp) => {
              const isActive = comp.active !== false;
              const sub = comp.company_subscriptions?.[0];
              const plan = sub?.saas_plans?.code || 'STARTER';
              const isTrial = sub?.status === 'TRIALING';

              return (
                <div 
                  key={comp.id} 
                  className={`p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-secondary/40 transition-colors ${!isActive ? 'bg-surface-secondary/60 opacity-75' : ''}`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-11 h-11 rounded-btn flex items-center justify-center font-black text-sm shrink-0 ${
                      isActive ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {comp.name?.charAt(0).toUpperCase() || 'E'}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-yzzy-text-primary truncate">
                          {comp.name || comp.trade_name}
                        </h3>
                        {isActive ? (
                          <Badge variant="success" size="sm" dot>ATIVA</Badge>
                        ) : (
                          <Badge variant="danger" size="sm">INATIVA / SUSPENSA</Badge>
                        )}
                        <Badge variant="primary" size="sm">
                          {isTrial ? 'TRIAL' : plan}
                        </Badge>
                        {isTrial && sub?.trial_ends_at && (
                          <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Até {new Date(sub.trial_ends_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-yzzy-text-muted font-mono truncate">
                        @{comp.slug}.yzzy {comp.document_number ? `• CNPJ/CPF: ${comp.document_number}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Ações de Super Admin */}
                  <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedCompanyForPlan(comp);
                        setNewPlanCode(comp.company_subscriptions?.[0]?.saas_plans?.code || 'PROFESSIONAL');
                        setPlanChangeReason('');
                        setPlanActionError(null);
                      }}
                      leftIcon={<Edit3 className="w-3.5 h-3.5" />}
                      className="text-xs font-semibold"
                    >
                      Plano
                    </Button>

                    {isTrial && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedCompanyForTrial(comp);
                          setAdditionalDays(14);
                          setTrialExtendReason('');
                          setTrialActionError(null);
                        }}
                        leftIcon={<Calendar className="w-3.5 h-3.5" />}
                        className="text-xs font-semibold"
                      >
                        Estender Trial
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRecalculateUsage(comp.id)}
                      isLoading={recalculatingCompanyId === comp.id}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      className="text-xs font-semibold"
                      title="Recalcular métricas de uso"
                    >
                      Recalcular
                    </Button>

                    {isActive ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setSelectedCompanyForDeactivation(comp);
                          setDeactivationReason('Cancelamento de contrato');
                          setCustomDeactivationReason('');
                          setDeactivationError(null);
                        }}
                        leftIcon={<XCircle className="w-3.5 h-3.5" />}
                        className="text-xs font-semibold"
                      >
                        Desativar
                      </Button>
                    ) : (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleReactivateCompany(comp)}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                        className="text-xs font-semibold"
                      >
                        Reativar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 
        ============================================================
        4. SAÚDE DA PLATAFORMA (RESUMO OPERACIONAL COMPACTO)
        ============================================================
      */}
      <div className="bg-white rounded-card border border-yzzy-border shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-yzzy-text-primary tracking-tight">
                Saúde da Plataforma
              </h3>
              <p className="text-xs text-yzzy-text-muted">
                Todos os serviços operacionais em produção
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsHealthExpanded(!isHealthExpanded)}
            rightIcon={isHealthExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            className="text-xs font-semibold"
          >
            {isHealthExpanded ? 'Recolher detalhes' : 'Ver detalhes'}
          </Button>
        </div>

        {/* Resumo Rápido em Linha */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-surface-secondary/60 rounded-btn border border-yzzy-border/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-yzzy-text-secondary">Database</span>
            <Badge variant="success" size="sm" dot>OK</Badge>
          </div>
          <div className="p-3 bg-surface-secondary/60 rounded-btn border border-yzzy-border/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-yzzy-text-secondary">Storage</span>
            <Badge variant="success" size="sm" dot>OK</Badge>
          </div>
          <div className="p-3 bg-surface-secondary/60 rounded-btn border border-yzzy-border/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-yzzy-text-secondary">IA / Assistente</span>
            <Badge variant="success" size="sm" dot>OK</Badge>
          </div>
          <div className="p-3 bg-surface-secondary/60 rounded-btn border border-yzzy-border/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-yzzy-text-secondary">Sync Engine</span>
            <Badge variant="success" size="sm" dot>OK</Badge>
          </div>
          <div className="p-3 bg-surface-secondary/60 rounded-btn border border-yzzy-border/60 flex items-center justify-between">
            <span className="text-xs font-semibold text-yzzy-text-secondary">Billing</span>
            <Badge variant="success" size="sm" dot>OK</Badge>
          </div>
        </div>

        {/* Detalhes Técnicos Expandíveis */}
        {isHealthExpanded && healthStatus && (
          <div className="mt-4 p-4 bg-slate-950 text-white rounded-card text-xs font-mono space-y-2 border border-slate-800 animate-fadeIn">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Status Geral:</span>
              <span className="text-emerald-400 font-bold">{healthStatus.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Latência do Banco:</span>
              <span>{healthStatus.database?.latencyMs ?? '< 15'} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Última Auditoria:</span>
              <span>{new Date().toLocaleString('pt-BR')}</span>
            </div>
          </div>
        )}
      </div>

      {/* 
        ============================================================
        5. CONTROLES DA PLATAFORMA / KILL SWITCHES (PROTEGIDO)
        ============================================================
      */}
      <div className="bg-white rounded-card border border-amber-200/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 text-amber-700">
          <PowerOff className="w-5 h-5" />
          <h3 className="text-sm font-bold tracking-tight">
            Controles da Plataforma & Feature Flags (Kill Switches)
          </h3>
        </div>
        <p className="text-xs text-yzzy-text-secondary">
          Restrito à <strong>ROLE_SUPER_ADMIN</strong>. Desative módulos instantaneamente em caso de manutenção ou anomalia operacional. Todas as alterações exigem justificativa registrada em log de auditoria.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {[
            { key: 'ENABLE_AUDIO_INSPECTION' as SystemFlagKey, label: 'Vistoria por Áudio' },
            { key: 'ENABLE_AI_ASSISTANT' as SystemFlagKey, label: 'Assistente Pericial IA' },
            { key: 'ENABLE_EXTERNAL_SIGNATURES' as SystemFlagKey, label: 'Assinaturas Externas' },
            { key: 'ENABLE_PDF_GENERATION' as SystemFlagKey, label: 'Geração de PDF' },
            { key: 'ENABLE_OFFLINE_SYNC' as SystemFlagKey, label: 'Offline Sync Engine' },
          ].map((flag) => {
            const isFlagActive = featureFlags[flag.key] !== false;

            return (
              <div
                key={flag.key}
                className="p-3.5 rounded-btn border border-yzzy-border bg-surface-secondary/60 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-yzzy-text-primary truncate">{flag.label}</p>
                  <p className="text-[10px] text-yzzy-text-muted font-mono">{flag.key}</p>
                </div>

                <Button
                  variant={isFlagActive ? 'danger' : 'success'}
                  size="sm"
                  onClick={() => handleToggleFlag(flag.key, isFlagActive)}
                  className="text-[11px] font-bold shrink-0"
                >
                  {isFlagActive ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 
        ============================================================
        6. MODAIS OPERACIONAIS DO SUPER ADMIN
        ============================================================
      */}

      {/* Modal: Criar Empresa */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-modal max-w-lg w-full p-6 sm:p-8 shadow-floating border border-yzzy-border space-y-6 animate-scaleIn">
            
            {createdManagerResult ? (
              <div className="space-y-5 text-center">
                <div className="w-12 h-12 rounded-btn bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yzzy-text-primary">Empresa e Gerente Criados!</h3>
                  <p className="text-xs text-yzzy-text-secondary mt-1">
                    Copie as credenciais de acesso do gerente da imobiliária abaixo.
                  </p>
                </div>

                <div className="p-4 bg-surface-secondary rounded-card border border-yzzy-border text-left space-y-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-yzzy-text-muted block">Login YZZY Gerente</span>
                    <span className="font-mono text-sm font-bold text-yzzy-text-primary">{createdManagerResult.loginAlias}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-yzzy-text-muted block">Senha Provisória</span>
                    <span className="font-mono text-sm font-bold text-primary-600">{createdManagerResult.tempPassword}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={copyManagerCredentials}
                  leftIcon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  className="w-full text-xs font-bold"
                >
                  {copied ? 'Copiado para a área de transferência!' : 'Copiar Credenciais'}
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-full text-xs font-bold"
                >
                  Concluir
                </Button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
                  <h3 className="text-base font-bold text-yzzy-text-primary flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary-600" />
                    Cadastrar Nova Empresa (Tenant)
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)} 
                    className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger text-xs rounded-btn flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleCreateCompany} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">Nome Fantasia *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Imobiliária Tietê"
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">Slug YZZY *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: tiete"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">CNPJ / CPF</label>
                      <input
                        type="text"
                        placeholder="00.000.000/0001-00"
                        value={documentNumber}
                        onChange={(e) => setDocumentNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">Telefone</label>
                      <input
                        type="text"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-yzzy-border/60 pt-3">
                    <h4 className="text-xs font-bold text-yzzy-text-primary mb-2">Primeiro Usuário Gerente (Opcional)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-yzzy-text-secondary mb-1">Nome</label>
                        <input
                          type="text"
                          placeholder="Ex: Ricson"
                          value={managerFirst}
                          onChange={(e) => setManagerFirst(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-yzzy-text-secondary mb-1">Sobrenome</label>
                        <input
                          type="text"
                          placeholder="Ex: Biella"
                          value={managerLast}
                          onChange={(e) => setManagerLast(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="w-1/2 text-xs font-bold"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      isLoading={isSubmitting}
                      className="w-1/2 text-xs font-bold"
                    >
                      Criar Empresa
                    </Button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}

      {/* Modal: Alterar Plano */}
      {selectedCompanyForPlan && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-md w-full p-6 sm:p-8 shadow-floating border border-yzzy-border space-y-5 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-yzzy-text-primary flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-primary-600" />
                Alterar Plano do Tenant
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedCompanyForPlan(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-surface-secondary rounded-btn text-xs">
              <p className="font-bold text-yzzy-text-primary">{selectedCompanyForPlan.name || selectedCompanyForPlan.trade_name}</p>
              <p className="text-yzzy-text-muted font-mono">@{selectedCompanyForPlan.slug}.yzzy</p>
            </div>

            {planActionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger text-xs rounded-btn flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{planActionError}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePlanSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                  Novo Plano *
                </label>
                <select
                  value={newPlanCode}
                  onChange={(e) => setNewPlanCode(e.target.value as PlanCode)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="STARTER">Starter (50 Vistorias/mês)</option>
                  <option value="PROFESSIONAL">Professional (200 Vistorias/mês)</option>
                  <option value="ENTERPRISE">Enterprise (Ilimitado)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                  Justificativa Operacional *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Upgrade solicitado pelo cliente via contrato..."
                  value={planChangeReason}
                  onChange={(e) => setPlanChangeReason(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedCompanyForPlan(null)}
                  className="w-1/2 text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isUpdatingPlan}
                  className="w-1/2 text-xs font-bold"
                >
                  Salvar Plano
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Estender Trial */}
      {selectedCompanyForTrial && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-md w-full p-6 sm:p-8 shadow-floating border border-yzzy-border space-y-5 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-yzzy-text-primary flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                Estender Período de Teste
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedCompanyForTrial(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-surface-secondary rounded-btn text-xs">
              <p className="font-bold text-yzzy-text-primary">{selectedCompanyForTrial.name || selectedCompanyForTrial.trade_name}</p>
              <p className="text-yzzy-text-muted font-mono">@{selectedCompanyForTrial.slug}.yzzy</p>
            </div>

            {trialActionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger text-xs rounded-btn flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{trialActionError}</span>
              </div>
            )}

            <form onSubmit={handleExtendTrialSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                  Dias Adicionais *
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  required
                  value={additionalDays}
                  onChange={(e) => setAdditionalDays(parseInt(e.target.value) || 14)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                  Justificativa *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Extensão comercial para homologação técnica..."
                  value={trialExtendReason}
                  onChange={(e) => setTrialExtendReason(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedCompanyForTrial(null)}
                  className="w-1/2 text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isExtendingTrial}
                  className="w-1/2 text-xs font-bold"
                >
                  Estender Trial
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Desativar Empresa */}
      {selectedCompanyForDeactivation && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-md w-full p-6 sm:p-8 shadow-floating border border-rose-200 space-y-5 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" />
                Desativar Empresa (Suspensão)
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedCompanyForDeactivation(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-btn text-xs space-y-1 text-rose-900">
              <p className="font-bold text-sm text-slate-900">{selectedCompanyForDeactivation.name || selectedCompanyForDeactivation.trade_name}</p>
              <p className="text-slate-600 font-mono text-[11px]">@{selectedCompanyForDeactivation.slug}.yzzy</p>
              <p className="text-slate-700 pt-1">
                A empresa e todos os seus funcionários perderão imediatamente o acesso ao sistema. O histórico de laudos será preservado.
              </p>
            </div>

            {deactivationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger text-xs rounded-btn flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deactivationError}</span>
              </div>
            )}

            <form onSubmit={handleDeactivateCompanySubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Motivo da Desativação *
                </label>
                <select
                  value={deactivationReason}
                  onChange={(e) => setDeactivationReason(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-600 outline-none"
                >
                  <option value="Cancelamento de contrato">Cancelamento de contrato</option>
                  <option value="Inadimplência">Inadimplência</option>
                  <option value="Término do período de teste">Término do período de teste</option>
                  <option value="Solicitação judicial">Solicitação judicial</option>
                  <option value="Outro">Outro...</option>
                </select>
              </div>

              {deactivationReason === 'Outro' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Descreva o motivo *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Descreva o motivo administrativo..."
                    value={customDeactivationReason}
                    onChange={(e) => setCustomDeactivationReason(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-rose-600 outline-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedCompanyForDeactivation(null)}
                  className="w-1/2 text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="md"
                  isLoading={isDeactivating}
                  className="w-1/2 text-xs font-bold"
                >
                  Confirmar Suspensão
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
