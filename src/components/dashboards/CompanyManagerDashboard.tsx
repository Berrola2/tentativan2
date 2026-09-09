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
  LogOut, 
  FileText,
  GitCompare,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchEmployees, adminCreateEmployee, adminToggleUserStatus, adminChangeUserRole } from '../../services/auth';
import type { UserProfile, UserRole } from '../../types/auth';
import { PropertiesView } from '../properties/PropertiesView';
import { InspectionsListView } from '../inspections/InspectionsListView';
import { NewInspectionWizard } from '../inspections/NewInspectionWizard';
import { InspectionEditorView } from '../inspections/InspectionEditorView';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';
import { ComparisonWizardModal } from '../comparisons/ComparisonWizardModal';
import { CompanyPlanSection } from '../billing/CompanyPlanSection';

export const CompanyManagerDashboard: React.FC = () => {
  const { user, companyId, companyName, companySlug, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'employees' | 'inspections' | 'properties' | 'comparisons' | 'plan'>('employees');
  const [employees, setEmployees] = useState<UserProfile[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchEmployees();
      setEmployees(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

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

      await loadEmployees();
    } catch {
      setErrorMsg('Erro de conexão ao servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (emp: UserProfile) => {
    if (emp.id === user?.id) {
      alert('Você não pode desativar o seu próprio perfil de gerente.');
      return;
    }
    const newStatus = !emp.active;
    const res = await adminToggleUserStatus(emp.id, newStatus);
    if (res.success) {
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, active: newStatus } : e));
    } else {
      alert(res.error || 'Falha ao alterar status.');
    }
  };

  const handleChangeRole = async (emp: UserProfile, newRole: UserRole) => {
    if (emp.id === user?.id) {
      alert('Você não pode alterar o seu próprio cargo de gerente.');
      return;
    }
    const res = await adminChangeUserRole(emp.id, newRole);
    if (res.success) {
      setEmployees((prev) => prev.map((e) => e.id === emp.id ? { ...e, role: newRole } : e));
    } else {
      alert(res.error || 'Falha ao alterar cargo.');
    }
  };

  const filteredEmployees = employees.filter((e) => 
    e.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Gerente</span>;
      case 'ROLE_INSPECTOR':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">Vistoriador</span>;
      case 'ROLE_VIEWER':
      case 'ROLE_ADMIN_VIEWER':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Visualizador</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{role}</span>;
    }
  };

  // Se a comparação estiver aberta, renderizar a visualização da comparação
  if (selectedComparisonId) {
    return (
      <InspectionComparisonView
        comparisonId={selectedComparisonId}
        onBack={() => setSelectedComparisonId(null)}
      />
    );
  }

  // Se o editor estiver aberto, renderizar o editor
  if (selectedInspectionId) {
    return (
      <InspectionEditorView
        inspectionId={selectedInspectionId}
        onBack={() => setSelectedInspectionId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header Painel da Empresa */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/20">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900">
                {companyName || 'Painel da Empresa'}
              </h1>
              <p className="text-xs text-slate-500 font-mono">
                @{companySlug}.yzzy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800">{user?.displayName || user?.fullName}</p>
              <span className="text-[10px] font-bold text-blue-600">Gerente da Empresa</span>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
              title="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-slate-100 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-2 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'employees'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Funcionários ({employees.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inspections')}
            className={`py-2 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'inspections'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Vistorias</span>
          </button>

          <button
            onClick={() => setActiveTab('properties')}
            className={`py-2 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'properties'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Imóveis</span>
          </button>

          <button
            onClick={() => setActiveTab('comparisons')}
            className={`py-2 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'comparisons'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Comparações (Entrada × Saída)</span>
          </button>

          <button
            onClick={() => setActiveTab('plan')}
            className={`py-2 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'plan'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Plano & Uso</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        
        {/* TAB 5: PLANO & USO */}
        {activeTab === 'plan' && (
          <CompanyPlanSection companyId={companyId || ''} />
        )}

        
        {/* TAB 1: FUNCIONÁRIOS */}
        {activeTab === 'employees' && (
          <>
            {/* Action Bar */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar funcionário por nome ou login..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                onClick={() => {
                  setCreatedResult(null);
                  setErrorMsg(null);
                  setFirstName('');
                  setLastName('');
                  setSelectedRole('ROLE_INSPECTOR');
                  setIsAddModalOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Funcionário</span>
              </button>
            </div>

            {/* Employees List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Equipe de Funcionários
                </h2>
                <span className="text-xs text-slate-400 font-medium">
                  {filteredEmployees.length} membro(s)
                </span>
              </div>

              {isLoading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <p className="text-xs">Carregando funcionários...</p>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  Nenhum funcionário cadastrado.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => (
                    <div key={emp.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs mt-0.5">
                          {emp.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">{emp.fullName}</h3>
                            {getRoleBadge(emp.role)}
                            {emp.mustChangePassword && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Senha Provisória
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">
                            {emp.username}@{companySlug}.yzzy
                          </p>
                        </div>
                      </div>

                      {/* Ações de Gerência */}
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <select
                          disabled={emp.id === user?.id}
                          value={emp.role}
                          onChange={(e) => handleChangeRole(emp, e.target.value as UserRole)}
                          className="text-xs py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50"
                        >
                          <option value="ROLE_INSPECTOR">Vistoriador</option>
                          <option value="ROLE_VIEWER">Visualizador</option>
                          <option value="ROLE_MANAGER">Gerente</option>
                        </select>

                        <button
                          disabled={emp.id === user?.id}
                          onClick={() => handleToggleActive(emp)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                            emp.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {emp.active ? 'Ativo' : 'Inativo'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* TAB 2: VISTORIAS */}
        {activeTab === 'inspections' && (
          <InspectionsListView
            onOpenInspection={(id) => setSelectedInspectionId(id)}
            onNewInspectionClick={() => setIsNewInspectionWizardOpen(true)}
            canCreateInspection={true}
          />
        )}

        {/* TAB 3: IMÓVEIS */}
        {activeTab === 'properties' && (
          <PropertiesView />
        )}

        {/* TAB 4: COMPARAÇÕES */}
        {activeTab === 'comparisons' && (
          <div className="space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-blue-600" />
                  Comparações Entrada × Saída
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confronte laudos de Entrada e Saída do mesmo imóvel e identifique alterações automaticamente
                </p>
              </div>
              <button
                onClick={() => setIsNewComparisonWizardOpen(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Comparação</span>
              </button>
            </div>

            <PropertyComparisonsPanel
              onOpenComparison={(id) => setSelectedComparisonId(id)}
              canCreateComparison={true}
            />
          </div>
        )}

      </main>

      {/* Modal: Adicionar Funcionário */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {createdResult ? (
              <div className="space-y-5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Funcionário Cadastrado!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Copie as credenciais abaixo e entregue ao funcionário. A senha temporária não poderá ser visualizada novamente.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Login YZZY</span>
                    <span className="font-mono text-sm font-bold text-slate-900">{createdResult.loginAlias}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Senha Provisória</span>
                    <span className="font-mono text-sm font-bold text-blue-600">{createdResult.tempPassword}</span>
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
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Adicionar Funcionário
                  </h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleCreateEmployee} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Primeiro Nome *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Carlos"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Sobrenome *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Oliveira"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Cargo / Função *</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 font-medium"
                    >
                      <option value="ROLE_INSPECTOR">Vistoriador (Cria e executa vistorias)</option>
                      <option value="ROLE_VIEWER">Visualizador (Somente leitura e laudos)</option>
                      <option value="ROLE_MANAGER">Gerente da Empresa (Acesso administrativo)</option>
                    </select>
                  </div>

                  <p className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    O sistema gerará automaticamente o <strong>Login YZZY</strong> baseado no nome e uma <strong>senha provisória forte</strong> com troca obrigatória no primeiro acesso.
                  </p>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Funcionário'}
                    </button>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>
      )}

      {/* Wizard Modal */}
      {isNewInspectionWizardOpen && (
        <NewInspectionWizard
          onClose={() => setIsNewInspectionWizardOpen(false)}
          onInspectionCreated={(newInsp) => {
            setIsNewInspectionWizardOpen(false);
            setSelectedInspectionId(newInsp.id);
          }}
        />
      )}

      {/* Comparison Wizard Modal */}
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
