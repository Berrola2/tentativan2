import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  Check, 
  Loader2
} from 'lucide-react';
import type { AuthUser, AuthSession, UserRole } from '../types/auth';
import { 
  fetchCompanyUsers, 
  createCompanyUser, 
  deleteCompanyUser 
} from '../services/authService';
import { useToast } from './Toast';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: AuthSession;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  currentSession,
}) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<UserRole>('ROLE_INSPECTOR');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState('');
  const [creci, setCreci] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const list = await fetchCompanyUsers(currentSession.company.id);
      setUsers(list);
    } catch (e) {
      console.warn('Error loading users', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      showToast('Preencha Nome, Usuário e Senha.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCompanyUser(currentSession.company.id, {
        fullName,
        username,
        role,
        password,
        cpf: cpf || undefined,
        creci: creci || undefined,
      });

      if (res.success && res.user) {
        showToast(`Colaborador ${res.user.fullName} cadastrado com sucesso!`, 'success');
        setFullName('');
        setUsername('');
        setPassword('');
        setCpf('');
        setCreci('');
        setIsCreating(false);
        await loadUsers();
      } else {
        showToast(res.error || 'Erro ao criar usuário.', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Erro inesperado.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userToDelete: AuthUser) => {
    if (userToDelete.id === currentSession.user.id) {
      showToast('Você não pode excluir o seu próprio usuário logado.', 'error');
      return;
    }

    const confirmed = window.confirm(`Deseja realmente remover o acesso de "${userToDelete.fullName}"?`);
    if (!confirmed) return;

    try {
      const res = await deleteCompanyUser(userToDelete.id);
      if (res.success) {
        showToast(`Usuário ${userToDelete.fullName} removido.`, 'info');
        await loadUsers();
      } else {
        showToast(res.error || 'Erro ao excluir.', 'error');
      }
    } catch (err) {
      showToast('Não foi possível excluir o usuário.', 'error');
    }
  };

  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case 'ROLE_MANAGER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Gerente / Admin</span>;
      case 'ROLE_INSPECTOR':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">Vistoriador</span>;
      case 'ROLE_ADMIN_VIEWER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Administrativo</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Usuário</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-auto animate-fadeIn">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Gestão da Equipe & Acessos
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Empresa: <strong>{currentSession.company.tradeName}</strong> ({currentSession.company.corporateCode})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-6">

          {/* Action Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Colaboradores Ativos ({users.length})
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 ${
                isCreating 
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' 
                  : 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/25'
              }`}
            >
              {isCreating ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Cancelar</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Criar Novo Login</span>
                </>
              )}
            </button>
          </div>

          {/* Create User Form Box */}
          {isCreating && (
            <form onSubmit={handleCreateUser} className="bg-brand-50/50 border border-brand-200/80 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-brand-800 font-bold text-xs border-b border-brand-200/60 pb-2">
                <UserPlus className="w-4 h-4 text-brand-600" />
                <span>Cadastrar Novo Colaborador na {currentSession.company.tradeName}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Nome Completo */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Carlos Eduardo Silva"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>

                {/* Nome de Usuário / Login */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nome de Usuário (Login) *</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                    placeholder="Ex: carlos.silva ou 123456"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>

                {/* Perfil / Cargo */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cargo / Permissão *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-brand-500"
                  >
                    <option value="ROLE_INSPECTOR">Vistoriador / Corretor (Cria e edita vistorias)</option>
                    <option value="ROLE_ADMIN_VIEWER">Administrativo (Visualiza e emite PDFs)</option>
                    <option value="ROLE_MANAGER">Gerente (Acesso total e gestão da equipe)</option>
                  </select>
                </div>

                {/* Senha Inicial */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Senha de Acesso Inicial *</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ex: 123456"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>

                {/* CPF (opcional) */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">CPF (Opcional)</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* CRECI (opcional) */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">CRECI / Matrícula (Opcional)</label>
                  <input
                    type="text"
                    value={creci}
                    onChange={(e) => setCreci(e.target.value)}
                    placeholder="Ex: CRECI 123456-F"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/25 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Salvar e Liberar Acesso</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Users List Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <span className="text-xs font-semibold">Carregando colaboradores...</span>
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Nenhum colaborador encontrado nesta empresa.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {users.map((u) => (
                  <div 
                    key={u.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">
                            {u.fullName}
                          </span>
                          {getRoleBadge(u.role)}
                          {u.id === currentSession.user.id && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                              Você
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Login: <code className="font-mono text-slate-700 font-bold">{u.username}</code></span>
                          {u.creci && <span>• CRECI: {u.creci}</span>}
                          {u.cpf && <span>• CPF: {u.cpf}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Delete button (cannot delete self) */}
                    {u.id !== currentSession.user.id && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                        title="Remover acesso deste colaborador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Como o novo colaborador entra no sistema:</strong> Ele só precisa abrir o site, informar o código da empresa (<strong>{currentSession.company.corporateCode}</strong>), o <strong>Nome de Usuário</strong> e a <strong>Senha</strong> cadastrados aqui.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
