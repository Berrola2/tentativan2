import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building, 
  Users, 
  Plus, 
  Search, 
  Copy, 
  Check, 
  XCircle, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  GitCompare, 
  UserX, 
  UserCheck, 
  Clock, 
  ArrowRight, 
  ChevronRight 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchEmployees, adminCreateEmployee, adminToggleUserStatus, adminChangeUserRole } from '../../services/auth';
import { fetchInspections } from '../../services/inspections';
import { fetchProperties } from '../../services/properties';
import type { UserProfile, UserRole } from '../../types/auth';
import type { Inspection, Property } from '../../types/inspection';
import { PropertiesView } from '../properties/PropertiesView';
import { InspectionsListView } from '../inspections/InspectionsListView';
import { NewInspectionWizard } from '../inspections/NewInspectionWizard';
import { InspectionEditorView } from '../inspections/InspectionEditorView';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';
import { ComparisonWizardModal } from '../comparisons/ComparisonWizardModal';
import { DocumentsCenterView } from '../documents/DocumentsCenterView';
import { CompanyPlanSection } from '../billing/CompanyPlanSection';
import { Button } from '../ui/Button';
import { MetricCard, ActionCard } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';

export interface CompanyManagerDashboardProps {
  activeNav?: string;
  onNavigate?: (id: string) => void;
}

export type ManagerTab = 'overview' | 'employees' | 'inspections' | 'properties' | 'comparisons' | 'documents' | 'plan';

export const CompanyManagerDashboard: React.FC<CompanyManagerDashboardProps> = ({
  activeNav,
  onNavigate,
}) => {
  const { user, companyId, companyName, companySlug } = useAuth();
  
  // Tab interna: overview (Visão Geral), employees, inspections, properties, comparisons, documents, plan
  const [internalTab, setInternalTab] = useState<ManagerTab>('overview');

  // Sincronizar com navegação externa (Sidebar / BottomNav)
  useEffect(() => {
    if (!activeNav) return;
    if (activeNav === 'dashboard' || activeNav === 'overview') setInternalTab('overview');
    else if (activeNav === 'employees') setInternalTab('employees');
    else if (activeNav === 'inspections') setInternalTab('inspections');
    else if (activeNav === 'properties') setInternalTab('properties');
    else if (activeNav === 'comparisons') setInternalTab('comparisons');
    else if (activeNav === 'signatures' || activeNav === 'documents') setInternalTab('documents');
    else if (activeNav === 'billing' || activeNav === 'plan') setInternalTab('plan');
  }, [activeNav]);

  const handleTabChange = (tab: ManagerTab) => {
    setInternalTab(tab);
    if (onNavigate) {
      const navMap: Record<ManagerTab, string> = {
        overview: 'dashboard',
        employees: 'employees',
        inspections: 'inspections',
        properties: 'properties',
        comparisons: 'comparisons',
        documents: 'signatures',
        plan: 'billing',
      };
      onNavigate(navMap[tab] || tab);
    }
  };

  // Dados reais
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Busca e modais de funcionários
  const [searchTerm, setSearchTerm] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEmpForDeactivation, setSelectedEmpForDeactivation] = useState<UserProfile | null>(null);
  const [selectedEmpForReactivation, setSelectedEmpForReactivation] = useState<UserProfile | null>(null);
  const [empDeactivationReason, setEmpDeactivationReason] = useState('Demissão');
  const [customEmpDeactivationReason, setCustomEmpDeactivationReason] = useState('');
  const [isDeactivatingEmp, setIsDeactivatingEmp] = useState(false);
  const [isReactivatingEmp, setIsReactivatingEmp] = useState(false);
  const [empDeactivationError, setEmpDeactivationError] = useState<string | null>(null);
  const [empReactivationError, setEmpReactivationError] = useState<string | null>(null);
  const [roleActionMessage, setRoleActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Inspections management states
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [isNewInspectionWizardOpen, setIsNewInspectionWizardOpen] = useState(false);

  // Comparisons management states
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);
  const [isNewComparisonWizardOpen, setIsNewComparisonWizardOpen] = useState(false);

  // Form states for employee
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('ROLE_INSPECTOR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ loginAlias: string; tempPassword: string; fullName: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Saudação contextual baseada no horário local do frontend
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [empData, inspData, propData] = await Promise.all([
        fetchEmployees().catch(() => []),
        fetchInspections().catch(() => []),
        fetchProperties().catch(() => [])
      ]);
      setEmployees(empData);
      setInspections(inspData);
      setProperties(propData);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Cálculos de Métricas Reais
  const activeEmployees = employees.filter((e) => e.active !== false);
  const inProgressInspections = inspections.filter((i) => i.status === 'IN_PROGRESS');
  const completedInspections = inspections.filter((i) => i.status === 'COMPLETED');
  const draftInspections = inspections.filter((i) => i.status === 'DRAFT');
  const attentionItems = [...inProgressInspections, ...draftInspections].slice(0, 4);
  const recentInspections = inspections.slice(0, 5);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Nome e sobrenome são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminCreateEmployee({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: selectedRole,
      });

      if (!res.success || !res.data) {
        setErrorMsg(res.error || 'Erro ao cadastrar funcionário.');
        return;
      }

      setCreatedResult({
        loginAlias: res.data.loginAlias,
        tempPassword: res.data.tempPassword,
        fullName: res.data.user.fullName,
      });

      const updatedEmps = await fetchEmployees();
      setEmployees(updatedEmps);
    } catch {
      setErrorMsg('Erro de conexão ao servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpForDeactivation) return;
    const finalReason = empDeactivationReason === 'Outro' ? customEmpDeactivationReason.trim() : empDeactivationReason.trim();
    if (!finalReason) {
      setEmpDeactivationError('O motivo da desativação é obrigatório.');
      return;
    }

    setIsDeactivatingEmp(true);
    setEmpDeactivationError(null);
    try {
      const res = await adminToggleUserStatus(selectedEmpForDeactivation.id, false, finalReason);
      if (res.success) {
        setEmployees((prev) => prev.map((e) => e.id === selectedEmpForDeactivation.id ? { ...e, active: false } : e));
        setSelectedEmpForDeactivation(null);
        setEmpDeactivationReason('Demissão');
        setCustomEmpDeactivationReason('');
      } else {
        setEmpDeactivationError(res.error || 'Falha ao desativar funcionário.');
      }
    } catch (err: any) {
      setEmpDeactivationError(err.message || 'Falha ao desativar funcionário.');
    } finally {
      setIsDeactivatingEmp(false);
    }
  };

  const handleReactivateEmpSubmit = async () => {
    if (!selectedEmpForReactivation) return;
    setIsReactivatingEmp(true);
    setEmpReactivationError(null);
    try {
      const res = await adminToggleUserStatus(selectedEmpForReactivation.id, true);
      if (res.success) {
        setEmployees((prev) => prev.map((e) => e.id === selectedEmpForReactivation.id ? { ...e, active: true } : e));
        setSelectedEmpForReactivation(null);
      } else {
        setEmpReactivationError(res.error || 'Não foi possível reativar o funcionário.');
      }
    } catch (err: any) {
      setEmpReactivationError(err.message || 'Falha de conexão com o servidor.');
    } finally {
      setIsReactivatingEmp(false);
    }
  };

  const handleChangeRole = async (emp: UserProfile, newRole: UserRole) => {
    setRoleActionMessage(null);
    if (emp.id === user?.id) {
      setRoleActionMessage({ text: 'Você não pode alterar o seu próprio cargo de gerente.', type: 'error' });
      return;
    }
    const res = await adminChangeUserRole(emp.id, newRole);
    if (res.success) {
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, role: newRole } : e));
      setRoleActionMessage({ text: `Cargo de "${emp.fullName}" alterado com sucesso!`, type: 'success' });
      setTimeout(() => setRoleActionMessage(null), 3000);
    } else {
      setRoleActionMessage({ text: res.error || 'Falha ao alterar cargo.', type: 'error' });
    }
  };

  const filteredEmployees = employees.filter((e) => {
    if (empStatusFilter === 'ACTIVE' && e.active === false) return false;
    if (empStatusFilter === 'INACTIVE' && e.active !== false) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return e.fullName.toLowerCase().includes(term) || e.username.toLowerCase().includes(term);
    }
    return true;
  });

  const copyCredentials = () => {
    if (!createdResult) return;
    const text = `Login YZZY: ${createdResult.loginAlias}\nSenha Provisória: ${createdResult.tempPassword}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ROLE_MANAGER':
        return <Badge variant="warning" size="sm">Gerente</Badge>;
      case 'ROLE_INSPECTOR':
        return <Badge variant="primary" size="sm">Vistoriador</Badge>;
      case 'ROLE_VIEWER':
      case 'ROLE_ADMIN_VIEWER':
        return <Badge variant="neutral" size="sm">Visualizador</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{role}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral" size="sm" dot>Rascunho</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" size="sm" dot>Em Andamento</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" size="sm" dot>Concluída</Badge>;
      case 'ARCHIVED':
        return <Badge variant="neutral" size="sm">Arquivada</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  // Se a comparação estiver aberta, renderizar em tela cheia
  if (selectedComparisonId) {
    return (
      <InspectionComparisonView
        comparisonId={selectedComparisonId}
        onBack={() => setSelectedComparisonId(null)}
      />
    );
  }

  // Se o editor de vistoria estiver aberto, renderizar o editor
  if (selectedInspectionId) {
    return (
      <InspectionEditorView
        inspectionId={selectedInspectionId}
        onBack={() => setSelectedInspectionId(null)}
      />
    );
  }

  return (
    <div className="w-full space-y-6 animate-fadeIn font-sans text-yzzy-text-primary p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      
      {/* 
        ============================================================
        1. HERO HEADER: SAUDAÇÃO CONTEXTUAL & AÇÃO DOMINANTE
        ============================================================
      */}
      <div className="bg-white rounded-card p-6 sm:p-8 border border-yzzy-border shadow-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
            <Building className="w-3.5 h-3.5 text-primary-600" />
            <span>Gestão Operacional • {companyName || 'Empresa'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-yzzy-text-primary tracking-tight font-display">
            {getGreeting()}, {user?.displayName || user?.fullName || 'Gestor'}.
          </h1>
          <p className="text-sm text-yzzy-text-secondary">
            Veja o que está acontecendo na operação imobiliária da <strong className="text-yzzy-text-primary">{companyName || 'sua empresa'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsNewInspectionWizardOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold shadow-xs hover:shadow-subtle-blue"
          >
            Nova Vistoria
          </Button>
        </div>
      </div>

      {/* 
        ============================================================
        2. SUB-VIEWS RENDER: SELECIONADA POR NAVEGAÇÃO OU TAB
        ============================================================
      */}

      {/* VIEW: VISÃO GERAL (DEFAULT) */}
      {internalTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Grade de 4 Métricas Reais Compactas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <MetricCard
              title="Vistorias em Andamento"
              value={isLoading ? '...' : inProgressInspections.length}
              subtitle="Execução ativa em campo"
              icon={<Clock className="w-4 h-4" />}
              onClick={() => handleTabChange('inspections')}
            />
            <MetricCard
              title="Vistorias Concluídas"
              value={isLoading ? '...' : completedInspections.length}
              subtitle="Laudos homologados"
              icon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => handleTabChange('inspections')}
            />
            <MetricCard
              title="Imóveis Cadastrados"
              value={isLoading ? '...' : properties.length}
              subtitle="Unidades na base"
              icon={<Building className="w-4 h-4" />}
              onClick={() => handleTabChange('properties')}
            />
            <MetricCard
              title="Funcionários Ativos"
              value={isLoading ? '...' : activeEmployees.length}
              subtitle={`${employees.length} no quadro total`}
              icon={<Users className="w-4 h-4" />}
              onClick={() => handleTabChange('employees')}
            />
          </div>

          {/* Grid Principal: 2 Colunas (Conteúdo Operacional + Painel Lateral) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Coluna Esquerda: Atenção & Vistorias Recentes (2/3) */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Seção: Precisam da sua Atenção */}
              <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-yzzy-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-bold text-yzzy-text-primary tracking-tight">
                      Precisam da sua atenção
                    </h2>
                  </div>
                  {attentionItems.length > 0 && (
                    <span className="text-[11px] font-semibold text-yzzy-text-secondary bg-surface-secondary px-2 py-0.5 rounded-full">
                      {attentionItems.length} pendente(s)
                    </span>
                  )}
                </div>

                <div className="p-5">
                  {isLoading ? (
                    <div className="p-8 text-center text-yzzy-text-muted flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                      <span className="text-xs">Carregando pendências...</span>
                    </div>
                  ) : attentionItems.length === 0 ? (
                    <div className="py-6 px-4 text-center space-y-2 bg-emerald-50/40 rounded-btn border border-emerald-100">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                        <Check className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-emerald-900">Tudo em dia!</h4>
                      <p className="text-xs text-emerald-700 max-w-sm mx-auto">
                        Nenhuma vistoria pendente de finalização ou rascunho esquecido no momento.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attentionItems.map((insp) => (
                        <div
                          key={insp.id}
                          onClick={() => setSelectedInspectionId(insp.id)}
                          className="p-3.5 rounded-btn border border-yzzy-border hover:border-slate-300 bg-surface-secondary/40 hover:bg-white transition-all cursor-pointer flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-yzzy-text-primary group-hover:text-primary-600 transition-colors truncate">
                                {insp.title || 'Vistoria Sem Título'}
                              </span>
                              {getStatusBadge(insp.status)}
                              <Badge variant="neutral" size="sm">
                                {insp.inspection_type === 'CHECK_IN' ? 'Entrada' : 'Saída'}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-yzzy-text-muted truncate">
                              Criada em {new Date(insp.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            rightIcon={<ChevronRight className="w-4 h-4" />}
                            className="shrink-0"
                          >
                            Abrir
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Seção: Vistorias Recentes */}
              <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-yzzy-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary-600" />
                    <h2 className="text-sm font-bold text-yzzy-text-primary tracking-tight">
                      Vistorias Recentes
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange('inspections')}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 transition-colors"
                  >
                    <span>Ver todas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="divide-y divide-yzzy-border/60">
                  {isLoading ? (
                    <div className="p-8 text-center text-yzzy-text-muted flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                      <span className="text-xs">Carregando vistorias...</span>
                    </div>
                  ) : recentInspections.length === 0 ? (
                    <div className="p-8 text-center text-yzzy-text-muted space-y-2">
                      <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs">Nenhuma vistoria registrada na empresa ainda.</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsNewInspectionWizardOpen(true)}
                        leftIcon={<Plus className="w-3.5 h-3.5" />}
                      >
                        Criar Primeira Vistoria
                      </Button>
                    </div>
                  ) : (
                    recentInspections.map((insp) => (
                      <div
                        key={insp.id}
                        onClick={() => setSelectedInspectionId(insp.id)}
                        className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-surface-secondary/60 transition-colors cursor-pointer group"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-yzzy-text-primary group-hover:text-primary-600 transition-colors truncate">
                              {insp.title || 'Vistoria'}
                            </span>
                            {getStatusBadge(insp.status)}
                            <Badge variant="neutral" size="sm">
                              {insp.inspection_type === 'CHECK_IN' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-yzzy-text-muted">
                            Data: {new Date(insp.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>

                        <ChevronRight className="w-4 h-4 text-yzzy-text-muted group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Coluna Direita: Ações Rápidas & Equipe Resumida (1/3) */}
            <div className="space-y-6">
              
              {/* Bloco: Ações Rápidas */}
              <div className="bg-white rounded-card border border-yzzy-border shadow-xs p-5 space-y-3">
                <h3 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
                  Ações Rápidas
                </h3>
                <div className="space-y-2">
                  <ActionCard
                    title="Nova Vistoria"
                    description="Criar laudo de entrada ou saída"
                    icon={<FileText className="w-4 h-4" />}
                    onClick={() => setIsNewInspectionWizardOpen(true)}
                  />
                  <ActionCard
                    title="Novo Imóvel"
                    description="Cadastrar unidade para vistoria"
                    icon={<Building className="w-4 h-4" />}
                    onClick={() => handleTabChange('properties')}
                  />
                  <ActionCard
                    title="Nova Comparação"
                    description="Confrontar Entrada × Saída"
                    icon={<GitCompare className="w-4 h-4" />}
                    onClick={() => setIsNewComparisonWizardOpen(true)}
                  />
                  <ActionCard
                    title="Adicionar Funcionário"
                    description="Criar acesso para vistoriador"
                    icon={<Users className="w-4 h-4" />}
                    onClick={() => {
                      setCreatedResult(null);
                      setErrorMsg(null);
                      setFirstName('');
                      setLastName('');
                      setSelectedRole('ROLE_INSPECTOR');
                      setIsAddModalOpen(true);
                    }}
                  />
                </div>
              </div>

              {/* Bloco: Resumo da Equipe */}
              <div className="bg-white rounded-card border border-yzzy-border shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
                    Equipe ({activeEmployees.length} ativos)
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleTabChange('employees')}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    Gerenciar
                  </button>
                </div>

                <div className="space-y-2.5">
                  {employees.slice(0, 4).map((emp) => (
                    <div key={emp.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-btn bg-primary-50 text-primary-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-yzzy-text-primary truncate">{emp.fullName}</p>
                          <p className="text-[10px] text-yzzy-text-muted font-mono truncate">@{emp.username}</p>
                        </div>
                      </div>
                      {getRoleBadge(emp.role)}
                    </div>
                  ))}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTabChange('employees')}
                  className="w-full text-xs font-semibold"
                >
                  Ver Todos os Membros
                </Button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* VIEW: FUNCIONÁRIOS & EQUIPE */}
      {internalTab === 'employees' && (
        <div className="space-y-6">
          
          {/* Header do Módulo Equipe */}
          <div className="bg-white p-6 sm:p-7 rounded-card border border-yzzy-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
                <Users className="w-3.5 h-3.5 text-primary-600" />
                <span>Gestão de Acessos</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-yzzy-text-primary tracking-tight font-display">
                Membros da Equipe
              </h1>
              <p className="text-xs sm:text-sm text-yzzy-text-secondary">
                Gerencie o acesso de vistoriadores, gerentes e auditores da sua empresa.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setCreatedResult(null);
                setErrorMsg(null);
                setFirstName('');
                setLastName('');
                setSelectedRole('ROLE_INSPECTOR');
                setIsAddModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold shadow-xs hover:shadow-subtle-blue"
            >
              Adicionar Funcionário
            </Button>
          </div>

          {/* Barra de Filtro e Busca */}
          <div className="bg-white p-4 sm:p-5 rounded-card border border-yzzy-border shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar funcionário por nome ou login..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-xs sm:text-sm text-yzzy-text-primary placeholder:text-yzzy-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 hover:border-slate-300 transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-yzzy-text-muted hover:text-yzzy-text-primary p-1"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setEmpStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
                    empStatusFilter === 'ALL'
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
                  }`}
                >
                  Todos ({employees.length})
                </button>

                <button
                  type="button"
                  onClick={() => setEmpStatusFilter('ACTIVE')}
                  className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
                    empStatusFilter === 'ACTIVE'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
                  }`}
                >
                  Ativos ({activeEmployees.length})
                </button>

                <button
                  type="button"
                  onClick={() => setEmpStatusFilter('INACTIVE')}
                  className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
                    empStatusFilter === 'INACTIVE'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
                  }`}
                >
                  Inativos ({employees.length - activeEmployees.length})
                </button>
              </div>

            </div>
          </div>

          {/* Feedback de Alteração de Cargo */}
          {roleActionMessage && (
            <Alert type={roleActionMessage.type === 'success' ? 'success' : 'error'}>
              <span>{roleActionMessage.text}</span>
            </Alert>
          )}

          {/* Lista Estruturada de Funcionários */}
          <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-yzzy-border/60 flex justify-between items-center bg-surface-secondary/30">
              <h2 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
                Quadro de Colaboradores
              </h2>
              <span className="text-xs text-yzzy-text-muted font-semibold">
                {filteredEmployees.length} funcionário(s)
              </span>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                <div className="p-4 border border-yzzy-border rounded-card flex items-center gap-3">
                  <div className="w-10 h-10 rounded-btn bg-slate-200 animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                    <div className="h-3 w-28 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-yzzy-text-primary">
                  Nenhum funcionário encontrado.
                </h3>
                <p className="text-xs text-yzzy-text-muted max-w-sm mx-auto">
                  {searchTerm || empStatusFilter !== 'ALL'
                    ? 'Nenhum colaborador corresponde aos filtros ativos.'
                    : 'Clique em "Adicionar Funcionário" para cadastrar vistoriadores ou administradores.'}
                </p>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setCreatedResult(null);
                      setErrorMsg(null);
                      setFirstName('');
                      setLastName('');
                      setSelectedRole('ROLE_INSPECTOR');
                      setIsAddModalOpen(true);
                    }}
                    leftIcon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Adicionar Funcionário
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-yzzy-border/60">
                {filteredEmployees.map((emp) => {
                  const isCurrentUser = emp.id === user?.id;
                  const isEmpActive = emp.active !== false;

                  return (
                    <div 
                      key={emp.id} 
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-secondary/40 transition-colors ${!isEmpActive ? 'bg-surface-secondary/40 opacity-80' : ''}`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className={`w-10 h-10 rounded-btn flex items-center justify-center font-bold text-xs shrink-0 ${
                          isEmpActive ? 'bg-primary-50 text-primary-700 border border-primary-100/80' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-yzzy-text-primary truncate">{emp.fullName}</h3>
                            {getRoleBadge(emp.role)}
                            {isEmpActive ? (
                              <Badge variant="success" size="sm" dot>Ativo</Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">Inativo</Badge>
                            )}
                            {emp.mustChangePassword && (
                              <Badge variant="warning" size="sm">Senha Provisória</Badge>
                            )}
                          </div>
                          <p className="text-xs text-yzzy-text-muted font-mono truncate">
                            {emp.username}@{companySlug}.yzzy
                          </p>
                        </div>
                      </div>

                      {/* Ações de Gerência (Touch-friendly >= 44px) */}
                      <div className="flex items-center gap-3 self-end sm:self-auto shrink-0 flex-wrap">
                        <select
                          disabled={isCurrentUser || !isEmpActive}
                          value={emp.role}
                          onChange={(e) => handleChangeRole(emp, e.target.value as UserRole)}
                          className="text-xs py-2 px-3 bg-surface-secondary border border-yzzy-border rounded-input text-yzzy-text-primary font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50 cursor-pointer min-h-[40px]"
                        >
                          <option value="ROLE_INSPECTOR">Vistoriador</option>
                          <option value="ROLE_VIEWER">Visualizador</option>
                          <option value="ROLE_MANAGER">Gerente</option>
                        </select>

                        {isEmpActive ? (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={isCurrentUser}
                            onClick={() => {
                              setSelectedEmpForDeactivation(emp);
                              setEmpDeactivationReason('Demissão');
                              setCustomEmpDeactivationReason('');
                              setEmpDeactivationError(null);
                            }}
                            leftIcon={<UserX className="w-3.5 h-3.5" />}
                            className="text-xs font-semibold min-h-[40px]"
                            title="Desativar Funcionário"
                          >
                            Desativar
                          </Button>
                        ) : (
                          <Button
                            variant="success"
                            size="sm"
                            disabled={isCurrentUser}
                            onClick={() => {
                              setSelectedEmpForReactivation(emp);
                              setEmpReactivationError(null);
                            }}
                            leftIcon={<UserCheck className="w-3.5 h-3.5" />}
                            className="text-xs font-semibold min-h-[40px]"
                            title="Reativar Funcionário"
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
        </div>
      )}

      {/* VIEW: VISTORIAS */}
      {internalTab === 'inspections' && (
        <InspectionsListView
          onOpenInspection={(id) => setSelectedInspectionId(id)}
          onNewInspectionClick={() => setIsNewInspectionWizardOpen(true)}
          canCreateInspection={true}
        />
      )}

      {/* VIEW: IMÓVEIS */}
      {internalTab === 'properties' && (
        <PropertiesView />
      )}

      {/* VIEW: COMPARAÇÕES */}
      {internalTab === 'comparisons' && (
        <PropertyComparisonsPanel
          onOpenComparison={(id) => setSelectedComparisonId(id)}
          canCreateComparison={true}
        />
      )}

      {/* VIEW: DOCUMENTOS & ASSINATURAS */}
      {internalTab === 'documents' && (
        <DocumentsCenterView
          onOpenInspection={(id) => setSelectedInspectionId(id)}
        />
      )}

      {/* VIEW: PLANO & USO */}
      {internalTab === 'plan' && (
        <CompanyPlanSection companyId={companyId || ''} />
      )}

      {/* 
        ============================================================
        3. MODAIS FUNCIONAIS PRESERVADOS & MODERNIZADOS
        ============================================================
      */}

      {/* Modal: Reativar Funcionário (Design System Dialog) */}
      {selectedEmpForReactivation && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-md w-full p-6 sm:p-7 shadow-floating border border-yzzy-border space-y-5 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-yzzy-text-primary flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-emerald-600" />
                Reativar funcionário
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedEmpForReactivation(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-btn text-xs space-y-1 text-emerald-950">
              <p className="font-bold text-sm text-slate-900">{selectedEmpForReactivation.fullName}</p>
              <p className="text-slate-600 font-mono text-[11px]">@{selectedEmpForReactivation.username}@{companySlug}.yzzy</p>
              <p className="text-emerald-800 pt-1">
                Deseja restabelecer o acesso deste colaborador ao sistema da empresa? O login voltará a ficar ativo imediatamente.
              </p>
            </div>

            {empReactivationError && (
              <Alert type="error">
                <span>{empReactivationError}</span>
              </Alert>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setSelectedEmpForReactivation(null)}
                className="w-1/2 text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="success"
                size="md"
                isLoading={isReactivatingEmp}
                onClick={handleReactivateEmpSubmit}
                className="w-1/2 text-xs font-bold"
              >
                Confirmar Reativação
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Desativar Funcionário (Confirmação com Motivo Obrigatório) */}
      {selectedEmpForDeactivation && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-md w-full p-6 sm:p-8 shadow-floating border border-rose-200 space-y-5 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-600" />
                Desativar funcionário
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedEmpForDeactivation(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-btn text-xs space-y-1 text-rose-900">
              <p className="font-bold text-sm text-slate-900">{selectedEmpForDeactivation.fullName}</p>
              <p className="text-slate-600 font-mono text-[11px]">@{selectedEmpForDeactivation.username}@{companySlug}.yzzy</p>
              <p className="text-slate-700 pt-1">
                O funcionário perderá imediatamente o acesso ao sistema, mas seu histórico de laudos será integralmente preservado.
              </p>
            </div>

            {empDeactivationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-btn flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{empDeactivationError}</span>
              </div>
            )}

            <form onSubmit={handleDeactivateEmpSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                  Motivo da desativação *
                </label>
                <select
                  value={empDeactivationReason}
                  onChange={(e) => setEmpDeactivationReason(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-rose-600 outline-none"
                >
                  <option value="Demissão">Demissão</option>
                  <option value="Afastamento">Afastamento</option>
                  <option value="Mudança de função">Mudança de função</option>
                  <option value="Outro">Outro...</option>
                </select>
              </div>

              {empDeactivationReason === 'Outro' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                    Descreva o motivo *
                  </label>
                  <textarea
                    required
                    rows={2}
                    placeholder="Descreva o motivo administrativo..."
                    value={customEmpDeactivationReason}
                    onChange={(e) => setCustomEmpDeactivationReason(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-rose-600 outline-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setSelectedEmpForDeactivation(null)}
                  className="w-1/2 text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="md"
                  isLoading={isDeactivatingEmp}
                  className="w-1/2 text-xs font-bold"
                >
                  Confirmar Desativação
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Funcionário */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-modal max-w-md w-full p-6 sm:p-8 shadow-floating border border-yzzy-border space-y-6 animate-scaleIn">
            
            {createdResult ? (
              <div className="space-y-5 text-center">
                <div className="w-12 h-12 rounded-btn bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-yzzy-text-primary">Funcionário Cadastrado!</h3>
                  <p className="text-xs text-yzzy-text-secondary mt-1">
                    Copie as credenciais abaixo e entregue ao funcionário. A senha provisória só pode ser visualizada agora.
                  </p>
                </div>

                <div className="p-4 bg-surface-secondary rounded-card border border-yzzy-border text-left space-y-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-yzzy-text-muted block">Login YZZY</span>
                    <span className="font-mono text-sm font-bold text-yzzy-text-primary">{createdResult.loginAlias}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-yzzy-text-muted block">Senha Provisória</span>
                    <span className="font-mono text-sm font-bold text-primary-600">{createdResult.tempPassword}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={copyCredentials}
                  leftIcon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  className="w-full text-xs font-bold"
                >
                  {copied ? 'Copiado para a área de transferência!' : 'Copiar Credenciais'}
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-full text-xs font-bold"
                >
                  Fechar
                </Button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
                  <h3 className="text-base font-bold text-yzzy-text-primary flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary-600" />
                    Adicionar Funcionário
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)} 
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

                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">Primeiro Nome *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Carlos"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">Sobrenome *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Oliveira"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">Cargo / Função *</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 font-medium outline-none"
                    >
                      <option value="ROLE_INSPECTOR">Vistoriador (Cria e executa vistorias)</option>
                      <option value="ROLE_VIEWER">Visualizador (Somente leitura e laudos)</option>
                      <option value="ROLE_MANAGER">Gerente da Empresa (Acesso administrativo)</option>
                    </select>
                  </div>

                  <p className="text-[11px] text-yzzy-text-muted bg-surface-secondary p-2.5 rounded-btn border border-yzzy-border">
                    O sistema gerará automaticamente o <strong>Login YZZY</strong> baseado no nome e uma <strong>senha provisória forte</strong> com troca obrigatória no primeiro acesso.
                  </p>

                  <div className="pt-2 flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setIsAddModalOpen(false)}
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
                      Criar Funcionário
                    </Button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}

      {/* Wizard Modal: Nova Vistoria */}
      {isNewInspectionWizardOpen && (
        <NewInspectionWizard
          onClose={() => setIsNewInspectionWizardOpen(false)}
          onInspectionCreated={(newInsp) => {
            setIsNewInspectionWizardOpen(false);
            setSelectedInspectionId(newInsp.id);
          }}
        />
      )}

      {/* Wizard Modal: Nova Comparação */}
      {isNewComparisonWizardOpen && (
        <ComparisonWizardModal
          onClose={() => setIsNewComparisonWizardOpen(false)}
          onComparisonCreated={(newCompId) => {
            setIsNewComparisonWizardOpen(false);
            setSelectedComparisonId(newCompId);
          }}
        />
      )}

    </div>
  );
};
