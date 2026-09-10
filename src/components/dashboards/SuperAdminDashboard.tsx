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
  CreditCard,
  FileText,
  Trash2,
  Server,
  Activity,
  Database,
  AlertTriangle,
  Eye,
  Lock,
  Clock
} from 'lucide-react';
import { 
  adminCreateCompany, 
  adminToggleCompanyStatus, 
  adminDeleteCompanyPermanently,
  fetchSecurityAuditLogs,
  fetchSystemAuditLogs
} from '../../services/auth';
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
import { useToast } from '../Toast';

export interface SuperAdminDashboardProps {
  activeNav?: string;
  onNavigate?: (id: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ 
  activeNav = 'companies', 
  onNavigate 
}) => {
  const { showToast } = useToast();

  // Navigation tab state synced with activeNav
  const [currentTab, setCurrentTab] = useState<'companies' | 'audit' | 'system'>(
    (activeNav === 'audit' || activeNav === 'system' || activeNav === 'companies') ? (activeNav as any) : 'companies'
  );

  useEffect(() => {
    if (activeNav === 'companies' || activeNav === 'audit' || activeNav === 'system') {
      setCurrentTab(activeNav as any);
    }
  }, [activeNav]);

  const handleTabSwitch = (tab: 'companies' | 'audit' | 'system') => {
    setCurrentTab(tab);
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  // General State
  const [companies, setCompanies] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null);
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  
  // Filters for Companies
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  
  // Filters for Security Audit
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditEventFilter, setAuditEventFilter] = useState<string>('ALL');
  const [selectedAuditLogForDetail, setSelectedAuditLogForDetail] = useState<any | null>(null);

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals state - Companies
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedCompanyForPlan, setSelectedCompanyForPlan] = useState<any | null>(null);
  const [selectedCompanyForTrial, setSelectedCompanyForTrial] = useState<any | null>(null);
  const [selectedCompanyForDeactivation, setSelectedCompanyForDeactivation] = useState<any | null>(null);
  const [selectedCompanyForPermanentDelete, setSelectedCompanyForPermanentDelete] = useState<any | null>(null);

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

  // Form states - Deactivate Company (Soft)
  const [deactivationReason, setDeactivationReason] = useState('Cancelamento de contrato');
  const [customDeactivationReason, setCustomDeactivationReason] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivationError, setDeactivationError] = useState<string | null>(null);

  // Form states - Hard Permanent Delete (High Risk)
  const [typedConfirmationName, setTypedConfirmationName] = useState('');
  const [permanentDeleteReason, setPermanentDeleteReason] = useState('');
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);
  const [permanentDeleteError, setPermanentDeleteError] = useState<string | null>(null);

  // Form states - Feature Flag toggle with reason
  const [selectedFlagToToggle, setSelectedFlagToToggle] = useState<{ key: SystemFlagKey; currentState: boolean; label: string } | null>(null);
  const [flagToggleReason, setFlagToggleReason] = useState('');
  const [isTogglingFlag, setIsTogglingFlag] = useState(false);

  // Recalculate feedback
  const [recalculatingCompanyId, setRecalculatingCompanyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [comps, mets, health, flags, secLogs, sysLogs] = await Promise.all([
        fetchSuperAdminCompaniesList().catch(() => []),
        fetchSuperAdminSaasMetrics().catch(() => null),
        checkSystemHealth().catch(() => null),
        fetchFeatureFlags(true).catch(() => ({})),
        fetchSecurityAuditLogs(100).catch(() => []),
        fetchSystemAuditLogs(50).catch(() => [])
      ]);
      setCompanies(comps || []);
      setMetrics(mets);
      setHealthStatus(health);
      setFeatureFlags(flags || {});
      setSecurityLogs(secLogs || []);
      setSystemLogs(sysLogs || []);
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

  // Flag toggle handler
  const handleConfirmToggleFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFlagToToggle || !flagToggleReason.trim()) return;

    setIsTogglingFlag(true);
    try {
      const res = await adminToggleFeatureFlag(
        selectedFlagToToggle.key, 
        !selectedFlagToToggle.currentState, 
        flagToggleReason.trim()
      );
      if (res.success) {
        setFeatureFlags(prev => ({ ...prev, [selectedFlagToToggle.key]: !selectedFlagToToggle.currentState }));
        setSelectedFlagToToggle(null);
        setFlagToggleReason('');
        showToast(`Flag ${selectedFlagToToggle.label} alterada com sucesso.`, 'success');
        await loadData();
      } else {
        alert(`Erro ao alterar flag: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Falha ao alterar flag: ${err.message}`);
    } finally {
      setIsTogglingFlag(false);
    }
  };

  // Create Company Handler
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

      showToast('Empresa cadastrada com sucesso!', 'success');

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

  // Update Plan Handler
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
        showToast('Plano atualizado com sucesso!', 'success');
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

  // Extend Trial Handler
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
        showToast('Período de teste estendido com sucesso!', 'success');
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

  // Soft Deactivate Handler
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
        showToast('Empresa desativada com sucesso. Os dados foram preservados.', 'info');
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

  // Reactivate Handler
  const handleReactivateCompany = async (company: any) => {
    const confirmReactivate = window.prompt(`Deseja realmente reativar a empresa "${company.name}"? Digite REATIVAR para confirmar:`);
    if (confirmReactivate !== 'REATIVAR' && confirmReactivate !== 'reativar') return;
    try {
      const res = await adminToggleCompanyStatus(company.id, true);
      if (res.success) {
        setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, active: true } : c));
        showToast('Empresa reativada com sucesso!', 'success');
        await loadData();
      } else {
        alert(res.error || 'Falha ao reativar empresa.');
      }
    } catch (err: any) {
      alert(err.message || 'Falha ao reativar empresa.');
    }
  };

  // Permanent Hard Delete Handler
  const handlePermanentDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForPermanentDelete) return;

    const companyTargetName = (selectedCompanyForPermanentDelete.name || selectedCompanyForPermanentDelete.trade_name || '').trim();
    if (typedConfirmationName.trim() !== companyTargetName) {
      setPermanentDeleteError(`O nome digitado não corresponde exatamente a "${companyTargetName}".`);
      return;
    }

    if (!permanentDeleteReason.trim() || permanentDeleteReason.trim().length < 5) {
      setPermanentDeleteError('O motivo da exclusão é obrigatório (mínimo de 5 caracteres).');
      return;
    }

    setIsPermanentlyDeleting(true);
    setPermanentDeleteError(null);

    try {
      const res = await adminDeleteCompanyPermanently(
        selectedCompanyForPermanentDelete.id,
        typedConfirmationName.trim(),
        permanentDeleteReason.trim()
      );

      if (res.success) {
        // Remover imediatamente da lista
        setCompanies(prev => prev.filter(c => c.id !== selectedCompanyForPermanentDelete.id));
        setSelectedCompanyForPermanentDelete(null);
        setTypedConfirmationName('');
        setPermanentDeleteReason('');
        showToast('Empresa excluída permanentemente.', 'success');
        await loadData();
      } else {
        setPermanentDeleteError(
          res.error || 
          'Não foi possível concluir a exclusão da empresa. Nenhum novo processo de exclusão será iniciado até que o estado seja verificado.'
        );
      }
    } catch (err: any) {
      console.error('Erro na exclusão permanente:', err);
      setPermanentDeleteError('Não foi possível concluir a exclusão da empresa. Nenhum novo processo de exclusão será iniciado até que o estado seja verificado.');
    } finally {
      setIsPermanentlyDeleting(false);
    }
  };

  // Recalculate Usage Handler
  const handleRecalculateUsage = async (companyId: string) => {
    setRecalculatingCompanyId(companyId);
    try {
      await adminRecalculateUsage(companyId);
      showToast('Uso recalculado com sucesso!', 'success');
      await loadData();
    } catch (err: any) {
      alert(`Falha ao recalcular: ${err.message}`);
    } finally {
      setRecalculatingCompanyId(null);
    }
  };

  // Filtered lists
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

  const filteredSecurityLogs = securityLogs.filter(log => {
    const matchesSearch = 
      (log.user_full_name || '').toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (log.user_username || '').toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (log.company_name || '').toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (log.event_type || '').toLowerCase().includes(auditSearchTerm.toLowerCase()) ||
      (log.ip_address || '').includes(auditSearchTerm);

    const matchesEvent = 
      auditEventFilter === 'ALL' ? true :
      log.event_type === auditEventFilter;

    return matchesSearch && matchesEvent;
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
        HERO HEADER COM TABS DE NAVEGAÇÃO SUPER ADMIN
        ============================================================
      */}
      <div className="bg-white rounded-card p-6 sm:p-8 border border-yzzy-border shadow-card flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
              <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
              <span>Super Administração Global • YZZY SaaS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-yzzy-text-primary tracking-tight font-display">
              {currentTab === 'companies' && 'Empresas & Tenants'}
              {currentTab === 'audit' && 'Auditoria de Segurança'}
              {currentTab === 'system' && 'Saúde do Sistema & Kill Switches'}
            </h1>
            <p className="text-sm text-yzzy-text-secondary">
              {currentTab === 'companies' && 'Gestão centralizada de imobiliárias, assinaturas, status e exclusão permanente.'}
              {currentTab === 'audit' && 'Registro imutável de eventos de autenticação, operações de segurança e ações de Super Admin.'}
              {currentTab === 'system' && 'Monitoramento de integridade, serviços de infraestrutura e controles operacionais.'}
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

            {currentTab === 'companies' && (
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
                className="font-bold shadow-xs hover:shadow-subtle-blue"
              >
                Nova Empresa
              </Button>
            )}
          </div>
        </div>

        {/* Abas Super Admin (Conectadas ao Sidebar e BottomNav) */}
        <div className="flex items-center gap-2 border-b border-yzzy-border/60 pb-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabSwitch('companies')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
              currentTab === 'companies'
                ? 'bg-primary-50 text-primary-700 border border-primary-100 shadow-xs'
                : 'text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Empresas & Tenants</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${currentTab === 'companies' ? 'bg-primary-200/60 text-primary-800' : 'bg-slate-200 text-slate-700'}`}>
              {companies.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('audit')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
              currentTab === 'audit'
                ? 'bg-primary-50 text-primary-700 border border-primary-100 shadow-xs'
                : 'text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Auditoria de Segurança</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${currentTab === 'audit' ? 'bg-primary-200/60 text-primary-800' : 'bg-slate-200 text-slate-700'}`}>
              {securityLogs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('system')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
              currentTab === 'system'
                ? 'bg-primary-50 text-primary-700 border border-primary-100 shadow-xs'
                : 'text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Saúde do Sistema</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>
      </div>

      {/* 
        ============================================================
        TAB 1: EMPRESAS & TENANTS
        ============================================================
      */}
      {currentTab === 'companies' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Métricas Reais do SaaS */}
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

          {/* Card Principal da Lista de Empresas */}
          <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden space-y-4">
            {/* Header + Filtros */}
            <div className="p-5 sm:p-6 border-b border-yzzy-border/60 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div>
                <h2 className="text-sm font-bold text-yzzy-text-primary tracking-tight flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary-600" />
                  Empresas Cadastradas
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
                      className={`p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-secondary/40 transition-colors ${!isActive ? 'bg-surface-secondary/60 opacity-85' : ''}`}
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

                        {/* Desativar (se Ativa) ou Reativar (se Inativa) */}
                        {isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setSelectedCompanyForDeactivation(comp);
                              setDeactivationReason('Cancelamento de contrato');
                              setCustomDeactivationReason('');
                              setDeactivationError(null);
                            }}
                            leftIcon={<XCircle className="w-3.5 h-3.5 text-amber-600" />}
                            className="text-xs font-semibold text-amber-700 hover:bg-amber-50"
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

                        {/* Excluir Definitivamente (Apenas se Desativada) */}
                        {!isActive ? (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              setSelectedCompanyForPermanentDelete(comp);
                              setTypedConfirmationName('');
                              setPermanentDeleteReason('');
                              setPermanentDeleteError(null);
                            }}
                            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs"
                          >
                            Excluir
                          </Button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="Empresas ativas não podem ser excluídas. Desative-a primeiro."
                            className="text-xs px-2.5 py-1.5 rounded-btn font-semibold text-slate-400 bg-slate-100 cursor-not-allowed border border-slate-200 inline-flex items-center gap-1 opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Excluir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 
        ============================================================
        TAB 2: AUDITORIA DE SEGURANÇA (DADOS REAIS SOMENTE)
        ============================================================
      */}
      {currentTab === 'audit' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden space-y-4">
            
            {/* Header de Auditoria + Filtros */}
            <div className="p-5 sm:p-6 border-b border-yzzy-border/60 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
              <div>
                <h2 className="text-sm font-bold text-yzzy-text-primary tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary-600" />
                  Trilha de Auditoria & Eventos de Segurança
                </h2>
                <p className="text-xs text-yzzy-text-muted mt-0.5">
                  {filteredSecurityLogs.length} registro(s) auditado(s) em tempo real
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por usuário, empresa, IP ou ação..."
                    value={auditSearchTerm}
                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
                  />
                </div>

                <select
                  value={auditEventFilter}
                  onChange={(e) => setAuditEventFilter(e.target.value)}
                  className="text-xs py-1.5 px-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-yzzy-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="ALL">Eventos: Todos</option>
                  <option value="USER_LOGIN">Login / Autenticação</option>
                  <option value="COMPANY_CREATED">Criação de Tenant</option>
                  <option value="COMPANY_DEACTIVATED">Desativação de Tenant</option>
                  <option value="COMPANY_REACTIVATED">Reativação de Tenant</option>
                  <option value="DELETE_COMPANY_PERMANENTLY">Exclusão Permanente</option>
                  <option value="FEATURE_FLAG_TOGGLED">Kill Switch / Flag</option>
                  <option value="USER_PROVISIONED">Provisionamento de Usuário</option>
                  <option value="SECURITY_EVENT">Segurança / Alerta</option>
                </select>
              </div>
            </div>

            {/* Lista de Registros de Auditoria */}
            {isLoading ? (
              <div className="p-12 text-center text-yzzy-text-muted flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                <p className="text-xs">Carregando eventos de auditoria...</p>
              </div>
            ) : filteredSecurityLogs.length === 0 ? (
              <div className="p-12 text-center text-yzzy-text-muted space-y-2">
                <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">Nenhum evento de auditoria encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-yzzy-text-primary">
                  <thead className="bg-surface-secondary/80 text-[11px] font-bold text-yzzy-text-secondary uppercase border-b border-yzzy-border/60">
                    <tr>
                      <th className="p-3.5 pl-6">Data & Hora</th>
                      <th className="p-3.5">Ação / Evento</th>
                      <th className="p-3.5">Ator / Usuário</th>
                      <th className="p-3.5">Empresa / Tenant</th>
                      <th className="p-3.5">IP</th>
                      <th className="p-3.5 pr-6 text-right">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yzzy-border/40">
                    {filteredSecurityLogs.map((log) => {
                      const isHighRisk = log.event_type === 'DELETE_COMPANY_PERMANENTLY' || log.event_type === 'SECURITY_EVENT';
                      const isWarning = log.event_type === 'COMPANY_DEACTIVATED' || log.event_type === 'FEATURE_FLAG_TOGGLED';

                      return (
                        <tr key={log.id} className="hover:bg-surface-secondary/50 transition-colors">
                          <td className="p-3.5 pl-6 font-mono text-yzzy-text-muted whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                              isHighRisk 
                                ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                : isWarning 
                                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {log.event_type}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-yzzy-text-primary">
                              {log.user_full_name || 'Sistema / Super Admin'}
                            </div>
                            {log.user_username && (
                              <div className="text-[10px] text-yzzy-text-muted font-mono">
                                @{log.user_username}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 font-medium text-yzzy-text-secondary">
                            {log.company_name ? (
                              <span className="text-yzzy-text-primary font-semibold">{log.company_name}</span>
                            ) : log.metadata?.company_name ? (
                              <span className="text-slate-500 italic">{log.metadata.company_name} (excluída)</span>
                            ) : (
                              <span className="text-slate-400">Global</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-yzzy-text-muted text-[11px]">
                            {log.ip_address || '—'}
                          </td>
                          <td className="p-3.5 pr-6 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAuditLogForDetail(log)}
                              leftIcon={<Eye className="w-3.5 h-3.5" />}
                              className="text-[11px] py-1 px-2 font-semibold"
                            >
                              Ver Dados
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 
        ============================================================
        TAB 3: SAÚDE DO SISTEMA & CONTROLES (KILL SWITCHES)
        ============================================================
      */}
      {currentTab === 'system' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Card: Monitoramento de Infraestrutura */}
          <div className="bg-white rounded-card border border-yzzy-border shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-yzzy-text-primary tracking-tight flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Status Operacional dos Serviços
                  </h3>
                  <p className="text-xs text-yzzy-text-muted">
                    Diagnósticos em tempo real do ecossistema YZZY
                  </p>
                </div>
              </div>

              <Badge variant="success" size="md" dot>
                {healthStatus?.status === 'HEALTHY' ? 'TOTALMENTE OPERACIONAL' : 'OPERACIONAL'}
              </Badge>
            </div>

            {/* Grid dos Módulos Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-surface-secondary/60 rounded-btn border border-yzzy-border flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-yzzy-text-primary">
                    <Database className="w-4 h-4 text-primary-600" />
                    <span>PostgreSQL Database</span>
                  </div>
                  <p className="text-[11px] text-yzzy-text-muted font-mono">
                    Latência: {healthStatus?.database?.latencyMs ?? '< 15'} ms
                  </p>
                </div>
                <Badge variant="success" size="sm" dot>ONLINE</Badge>
              </div>

              <div className="p-4 bg-surface-secondary/60 rounded-btn border border-yzzy-border flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-yzzy-text-primary">
                    <HardDrive className="w-4 h-4 text-primary-600" />
                    <span>Supabase Storage</span>
                  </div>
                  <p className="text-[11px] text-yzzy-text-muted font-mono">
                    Buckets de mídia & laudos OK
                  </p>
                </div>
                <Badge variant="success" size="sm" dot>ONLINE</Badge>
              </div>

              <div className="p-4 bg-surface-secondary/60 rounded-btn border border-yzzy-border flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 font-bold text-xs text-yzzy-text-primary">
                    <Server className="w-4 h-4 text-primary-600" />
                    <span>Sync Engine & Offline</span>
                  </div>
                  <p className="text-[11px] text-yzzy-text-muted font-mono">
                    IndexedDB + Web Workers
                  </p>
                </div>
                <Badge variant="success" size="sm" dot>ONLINE</Badge>
              </div>
            </div>

            {/* Diagnóstico Detalhado */}
            <div className="p-4 bg-slate-950 text-white rounded-card text-xs font-mono space-y-2 border border-slate-800">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Ambiente de Execução:</span>
                <span className="text-emerald-400 font-bold">Produção SaaS Multi-tenant</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Total de Empresas Registradas:</span>
                <span className="text-white font-bold">{companies.length} ({activeCompaniesCount} ativas)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Última Checagem de Saúde:</span>
                <span className="text-slate-300">{new Date().toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Integridade de RLS & Segurança:</span>
                <span className="text-emerald-400 font-bold">RLS ATIVO & POLÍTICAS ENFORCED</span>
              </div>
            </div>
          </div>

          {/* Card: Feature Flags & Kill Switches */}
          <div className="bg-white rounded-card border border-amber-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-700">
              <PowerOff className="w-5 h-5" />
              <h3 className="text-sm font-bold tracking-tight">
                Controles Operacionais da Plataforma (Kill Switches)
              </h3>
            </div>
            <p className="text-xs text-yzzy-text-secondary">
              Mecanismos de desligamento de emergência com restrição estrita a <strong>ROLE_SUPER_ADMIN</strong>. O acionamento interrompe funcionalidades instantaneamente em caso de manutenção ou anomalia e gera log de auditoria obrigatório.
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
                      onClick={() => {
                        setSelectedFlagToToggle({
                          key: flag.key,
                          currentState: isFlagActive,
                          label: flag.label,
                        });
                        setFlagToggleReason('');
                      }}
                      className="text-[11px] font-bold shrink-0"
                    >
                      {isFlagActive ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Log de Eventos do Sistema */}
          {systemLogs.length > 0 && (
            <div className="bg-white rounded-card border border-yzzy-border shadow-xs p-5 sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-yzzy-text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-600" />
                Registros Operacionais do Sistema
              </h3>
              <div className="divide-y divide-yzzy-border/60">
                {systemLogs.slice(0, 10).map((sysLog) => (
                  <div key={sysLog.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-yzzy-text-muted text-[11px]">
                        {new Date(sysLog.created_at).toLocaleTimeString('pt-BR')}
                      </span>
                      <span className="font-bold text-yzzy-text-primary">{sysLog.event_type}</span>
                      <span className="text-yzzy-text-secondary">{sysLog.details?.message || sysLog.details?.reason || JSON.stringify(sysLog.details)}</span>
                    </div>
                    <Badge variant={sysLog.severity === 'CRITICAL' || sysLog.severity === 'HIGH' ? 'danger' : 'neutral'} size="sm">
                      {sysLog.severity || 'INFO'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 
        ============================================================
        MODAIS DO SUPER ADMIN
        ============================================================
      */}

      {/* Modal: EXCLUSÃO PERMANENTE DE EMPRESA (HIGH RISK) */}
      {selectedCompanyForPermanentDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-modal max-w-lg w-full p-6 sm:p-8 shadow-floating border-2 border-rose-500 space-y-5 animate-scaleIn">
            
            {/* Header de Alerta Máximo */}
            <div className="flex items-start gap-3 pb-3 border-b border-rose-200">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-rose-900 tracking-tight">
                  Exclusão Definitiva de Empresa
                </h3>
                <p className="text-xs text-rose-700 font-semibold mt-0.5">
                  Operação irreversível e permanente (Super Admin)
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  if (!isPermanentlyDeleting) {
                    setSelectedCompanyForPermanentDelete(null);
                    setPermanentDeleteError(null);
                  }
                }}
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn ml-auto"
                disabled={isPermanentlyDeleting}
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso Explicativo dos Impactos */}
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-btn text-xs text-rose-950 space-y-2">
              <p className="font-bold text-sm">
                Excluir permanentemente <span className="underline decoration-rose-500 font-black">{selectedCompanyForPermanentDelete.name || selectedCompanyForPermanentDelete.trade_name}</span>?
              </p>
              <p className="text-rose-800 leading-relaxed">
                Esta ação é <strong>definitiva e irreversível</strong>. Todos os dados vinculados a este tenant serão permanentemente apagados:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-rose-900 font-medium">
                <li>Todas as vistorias, ambientes e itens periciais</li>
                <li>Todas as fotos, áudios e PDFs armazenados no Storage</li>
                <li>Todos os cadastros de imóveis, documentos e confrontos</li>
                <li>Todas as contas de acesso (Auth) dos funcionários da empresa</li>
              </ul>
              <div className="pt-1 text-[11px] font-semibold text-rose-700 border-t border-rose-200">
                Nota: Um registro de auditoria global da exclusão será retido para fins de integridade.
              </div>
            </div>

            {/* Mensagem de Erro Humana */}
            {permanentDeleteError && (
              <div className="p-3.5 bg-rose-100 border border-rose-300 text-rose-900 text-xs rounded-btn font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-700" />
                <span>{permanentDeleteError}</span>
              </div>
            )}

            {/* Formulário com Dupla Barreira */}
            <form onSubmit={handlePermanentDeleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  1. Para confirmar, digite exatamente o nome da empresa:
                </label>
                <div className="p-2 bg-slate-100 border border-slate-300 rounded-input font-mono text-xs font-bold text-slate-900 select-all mb-2">
                  {selectedCompanyForPermanentDelete.name || selectedCompanyForPermanentDelete.trade_name}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Digite o nome exato aqui..."
                  value={typedConfirmationName}
                  onChange={(e) => setTypedConfirmationName(e.target.value)}
                  disabled={isPermanentlyDeleting}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-input text-xs font-bold text-slate-900 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  2. Motivo da exclusão permanente *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Contrato encerrado e solicitação formal de remoção de dados..."
                  value={permanentDeleteReason}
                  onChange={(e) => setPermanentDeleteReason(e.target.value)}
                  disabled={isPermanentlyDeleting}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={isPermanentlyDeleting}
                  onClick={() => {
                    setSelectedCompanyForPermanentDelete(null);
                    setPermanentDeleteError(null);
                  }}
                  className="w-1/2 text-xs font-bold"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  variant="danger"
                  size="md"
                  disabled={
                    typedConfirmationName.trim() !== (selectedCompanyForPermanentDelete.name || selectedCompanyForPermanentDelete.trade_name || '').trim() ||
                    permanentDeleteReason.trim().length < 5 ||
                    isPermanentlyDeleting
                  }
                  isLoading={isPermanentlyDeleting}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  className="w-1/2 text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  {isPermanentlyDeleting ? 'Excluindo...' : 'Excluir Definitivamente'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detalhes do Log de Auditoria */}
      {selectedAuditLogForDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-xl w-full p-6 sm:p-8 shadow-floating border border-yzzy-border space-y-4 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-sm font-bold text-yzzy-text-primary flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary-600" />
                Dados do Registro de Auditoria
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedAuditLogForDetail(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-surface-secondary rounded-card border border-yzzy-border">
                <div>
                  <span className="text-[11px] text-yzzy-text-muted uppercase font-bold block">Evento</span>
                  <span className="font-mono font-bold text-primary-700">{selectedAuditLogForDetail.event_type}</span>
                </div>
                <div>
                  <span className="text-[11px] text-yzzy-text-muted uppercase font-bold block">Data & Hora</span>
                  <span className="font-mono">{new Date(selectedAuditLogForDetail.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <div>
                  <span className="text-[11px] text-yzzy-text-muted uppercase font-bold block">Ator</span>
                  <span className="font-semibold">{selectedAuditLogForDetail.user_full_name || 'Super Admin / Sistema'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-yzzy-text-muted uppercase font-bold block">IP de Origem</span>
                  <span className="font-mono">{selectedAuditLogForDetail.ip_address || '—'}</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-yzzy-text-secondary block mb-1">Payload / Metadados JSON</span>
                <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[11px] rounded-btn overflow-x-auto max-h-60 border border-slate-800">
                  {JSON.stringify(selectedAuditLogForDetail.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setSelectedAuditLogForDetail(null)}
                className="w-full text-xs font-bold"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Alternar Flag / Kill Switch */}
      {selectedFlagToToggle && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-md w-full p-6 sm:p-8 shadow-floating border border-amber-300 space-y-5 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-amber-800 flex items-center gap-2">
                <PowerOff className="w-5 h-5 text-amber-600" />
                {selectedFlagToToggle.currentState ? 'Desativar Módulo' : 'Ativar Módulo'}
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedFlagToToggle(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-btn text-xs text-amber-900 space-y-1">
              <p className="font-bold text-sm text-slate-900">{selectedFlagToToggle.label}</p>
              <p className="font-mono text-[11px] text-slate-600">{selectedFlagToToggle.key}</p>
              <p className="text-slate-700 pt-1">
                Esta ação afetará todos os usuários da plataforma instantaneamente.
              </p>
            </div>

            <form onSubmit={handleConfirmToggleFlag} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Justificativa Operacional Obrigatória *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Ex: Manutenção preventiva na infraestrutura..."
                  value={flagToggleReason}
                  onChange={(e) => setFlagToggleReason(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedFlagToToggle(null)}
                  className="w-1/2 text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant={selectedFlagToToggle.currentState ? 'danger' : 'success'}
                  size="md"
                  isLoading={isTogglingFlag}
                  className="w-1/2 text-xs font-bold"
                >
                  Confirmar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* Modal: Desativar Empresa (Soft) */}
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
                A empresa e seus funcionários perderão temporariamente o acesso. <strong>Todos os dados, laudos e imóveis permanecerão salvos e poderão ser reativados a qualquer momento.</strong>
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
