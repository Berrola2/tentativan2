import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  Check, 
  Loader2,
  Key,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import type { AuthUser, AuthSession, UserRole } from '../types/auth';
import { 
  fetchCompanyUsers, 
  createCompanyUser, 
  deleteCompanyUser,
  updateCompanyUserPassword,
  toggleCompanyUserActive
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

  // Password reset modal state
  const [passwordResetUserId, setPasswordResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await fetchCompanyUsers(currentSession.company.id);
      setUsers(list);
    } catch (e) {
      console.warn('Erro ao listar usuários:', e);
    } finally {
      setIsLoading(false);
    }
  }, [currentSession.company.id]);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen, loadUsers]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      showToast('Preencha Nome Completo, Usuário e Senha.', 'error');
      return;
    }

    if (password.trim().length < 6) {
      showToast('A senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCompanyUser(currentSession.company.id, {
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        role,
        password: password.trim(),
      });

      if (res.success && res.data) {
        showToast(`Colaborador ${res.data.fullName} cadastrado com sucesso!`, 'success');
        setFullName('');
        setUsername('');
        setPassword('');
        setIsCreating(false);
        await loadUsers();
      } else {
        showToast(res.error || 'Erro ao cadastrar usuário.', 'error');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (userToToggle: AuthUser) => {
    if (userToToggle.id === currentSession.user.id) {
      showToast('Você não pode desativar seu próprio usuário logado.', 'error');
      return;
    }

    const nextActive = !userToToggle.active;
    try {
      const res = await toggleCompanyUserActive(userToToggle.id, nextActive);
      if (res.success) {
        showToast(
          `Usuário ${userToToggle.fullName} ${nextActive ? 'ativado' : 'desativado'}.`,
          'info'
        );
        await loadUsers();
      } else {
        showToast(res.error || 'Erro ao alterar status.', 'error');
      }
    } catch {
      showToast('Erro de comunicação ao alterar status.', 'error');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetUserId || newPassword.trim().length < 6) {
      showToast('A nova senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await updateCompanyUserPassword(passwordResetUserId, newPassword.trim());
      if (res.success) {
        showToast('Senha redefinida com sucesso!', 'success');
        setPasswordResetUserId(null);
        setNewPassword('');
      } else {
        showToast(res.error || 'Erro ao redefinir senha.', 'error');
      }
    } catch {
      showToast('Falha ao redefinir senha.', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userToDelete: AuthUser) => {
    if (userToDelete.id === currentSession.user.id) {
      showToast('Você não pode excluir o seu próprio usuário logado.', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Deseja realmente remover o acesso de "${userToDelete.fullName}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    try {
      const res = await deleteCompanyUser(userToDelete.id);
      if (res.success) {
        showToast(`Usuário ${userToDelete.fullName} removido com sucesso.`, 'info');
        await loadUsers();
      } else {
        showToast(res.error || 'Erro ao excluir usuário.', 'error');
      }
    } catch {
      showToast('Não foi possível excluir o usuário.', 'error');
    }
  };

  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case 'ROLE_MANAGER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Gerente</span>;
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
        
        {/* Modal Header */}
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
                Empresa: <strong>{currentSession.company.name}</strong> ({currentSession.company.slug})
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

        {/* Modal Content */}
        <div className="p-5 sm:px-6 py-5 space-y-6">

          {/* Action Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                Colaboradores Cadastrados ({users.length})
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

          {/* Form: Create User */}
          {isCreating && (
            <form onSubmit={handleCreateUser} className="bg-brand-50/50 border border-brand-200/80 rounded-2xl p-4 sm:p-5 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-brand-800 font-bold text-xs border-b border-brand-200/60 pb-2">
                <UserPlus className="w-4 h-4 text-brand-600" />
                <span>Cadastrar Novo Colaborador na {currentSession.company.name}</span>
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
                    placeholder="Ex: carlos.silva"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-brand-500 lowercase"
                    required
                  />
                </div>

                {/* Perfil / Cargo */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cargo / Permissão (Role) *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-brand-500"
                  >
                    <option value="ROLE_INSPECTOR">Vistoriador (ROLE_INSPECTOR - Cria e edita vistorias)</option>
                    <option value="ROLE_ADMIN_VIEWER">Administrativo (ROLE_ADMIN_VIEWER - Visualiza laudos)</option>
                    <option value="ROLE_MANAGER">Gerente (ROLE_MANAGER - Acesso total e gestão da equipe)</option>
                  </select>
                </div>

                {/* Senha Inicial */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Senha de Acesso Inicial (min. 6 dígitos) *</label>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-brand-500"
                    required
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
                      <span>Salvar e Cadastrar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Form: Password Reset Box */}
          {passwordResetUserId && (
            <form onSubmit={handleResetPasswordSubmit} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>Redefinir Senha do Colaborador</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => { setPasswordResetUserId(null); setNewPassword(''); }}
                  className="text-xs text-amber-700 hover:text-amber-900 font-semibold"
                >
                  Cancelar
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  className="flex-1 bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-amber-500"
                  required
                />
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isResettingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Atualizar Senha</span>
                </button>
              </div>
            </form>
          )}

          {/* Users List Table */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                <span className="text-xs font-semibold">Carregando colaboradores da empresa...</span>
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
                    className={`p-4 flex items-center justify-between gap-3 transition-colors ${
                      u.active ? 'hover:bg-white' : 'bg-slate-100/70 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shadow-sm ${
                        u.active 
                          ? 'bg-white border-slate-200 text-slate-700' 
                          : 'bg-slate-200 border-slate-300 text-slate-400'
                      }`}>
                        {u.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-xs sm:text-sm ${
                            u.active ? 'text-slate-900' : 'text-slate-500 line-through'
                          }`}>
                            {u.fullName}
                          </span>
                          {getRoleBadge(u.role)}
                          {!u.active && (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-200">
                              Desativado
                            </span>
                          )}
                          {u.id === currentSession.user.id && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                              Você
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Login: <code className="font-mono text-slate-700 font-bold">{u.username}</code></span>
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {/* Redefinir Senha */}
                      <button
                        onClick={() => {
                          setPasswordResetUserId(u.id);
                          setNewPassword('');
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        title="Redefinir senha deste usuário"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      {/* Ativar/Desativar (não pode em si próprio) */}
                      {u.id !== currentSession.user.id && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`p-2 rounded-xl transition-colors ${
                            u.active 
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' 
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={u.active ? 'Desativar acesso' : 'Reativar acesso'}
                        >
                          {u.active ? <ToggleRight className="w-5 h-5 text-emerald-600" /> : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                        </button>
                      )}

                      {/* Excluir Colaborador (não pode excluir a si próprio) */}
                      {u.id !== currentSession.user.id && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Excluir permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rodapé de Instrução */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong>Como o novo colaborador entra:</strong> No login, ele informará o código da empresa (<strong>{currentSession.company.slug}</strong>), o <strong>Nome de Usuário</strong> e a <strong>Senha</strong> cadastrados aqui.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};
