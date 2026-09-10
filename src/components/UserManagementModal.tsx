import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  Loader2,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import type { UserProfile, AuthSession, UserRole } from '../types/auth';
import { 
  fetchEmployees, 
  adminCreateEmployee, 
  adminToggleUserStatus,
  adminChangeUserRole
} from '../services/auth';
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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('ROLE_INSPECTOR');
  const [createdResult, setCreatedResult] = useState<{
    loginAlias: string;
    tempPassword: string;
    fullName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await fetchEmployees();
      setUsers(list);
    } catch (e) {
      console.warn('Erro ao listar usuários:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setCreatedResult(null);
    }
  }, [isOpen, loadUsers]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      showToast('Preencha Nome e Sobrenome.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminCreateEmployee({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      });

      if (res.success && res.data) {
        showToast(`Colaborador ${res.data.user.fullName} cadastrado com sucesso!`, 'success');
        setCreatedResult({
          loginAlias: res.data.loginAlias,
          tempPassword: res.data.tempPassword,
          fullName: res.data.user.fullName,
        });
        setFirstName('');
        setLastName('');
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

  const handleToggleActive = async (userToToggle: UserProfile) => {
    if (userToToggle.id === currentSession.user.id) {
      showToast('Você não pode desativar seu próprio usuário logado.', 'error');
      return;
    }

    const nextActive = !userToToggle.active;
    try {
      const res = await adminToggleUserStatus(userToToggle.id, nextActive);
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

  const handleChangeRole = async (userItem: UserProfile, newRole: UserRole) => {
    if (userItem.id === currentSession.user.id) {
      showToast('Você não pode alterar seu próprio cargo.', 'error');
      return;
    }

    try {
      const res = await adminChangeUserRole(userItem.id, newRole);
      if (res.success) {
        showToast(`Cargo de ${userItem.fullName} atualizado para ${newRole}.`, 'info');
        await loadUsers();
      } else {
        showToast(res.error || 'Erro ao alterar cargo.', 'error');
      }
    } catch {
      showToast('Erro de comunicação ao alterar cargo.', 'error');
    }
  };

  const getRoleBadge = (userRole: UserRole) => {
    switch (userRole) {
      case 'ROLE_SUPER_ADMIN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Super Admin</span>;
      case 'ROLE_MANAGER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Gerente</span>;
      case 'ROLE_INSPECTOR':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Vistoriador</span>;
      case 'ROLE_VIEWER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Visualizador</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Usuário</span>;
    }
  };

  const copyCredentials = () => {
    if (!createdResult) return;
    const text = `Acesso Vistoria YZZY:\nLogin: ${createdResult.loginAlias}\nSenha Temporária: ${createdResult.tempPassword}\nLink: https://vistoriayzzy.vercel.app`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Credenciais copiadas!', 'info');
    setTimeout(() => setCopied(false), 3000);
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
                Empresa: <strong>{currentSession.company?.name || 'Vistoria YZZY'}</strong> ({currentSession.company?.slug || 'yzzy'})
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

          {/* Credenciais Geradas */}
          {createdResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800">✅ Novo Colaborador Provisionado</span>
                <button
                  type="button"
                  onClick={copyCredentials}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 hover:bg-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar Acesso'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Login YZZY</span>
                  <span className="font-mono font-bold text-slate-800">{createdResult.loginAlias}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Senha Temporária</span>
                  <span className="font-mono font-bold text-emerald-600">{createdResult.tempPassword}</span>
                </div>
              </div>
            </div>
          )}

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
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/25'
              }`}
            >
              {isCreating ? (
                <>
                  <X className="w-4 h-4" /> Cancelar
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" /> Adicionar Colaborador
                </>
              )}
            </button>
          </div>

          {/* Form de Criação */}
          {isCreating && (
            <form onSubmit={handleCreateUser} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Novo Colaborador (Provisionamento Canônico)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Nome *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Maria"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Sobrenome *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex: Silva"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Função (Role)</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="ROLE_INSPECTOR">Vistoriador (ROLE_INSPECTOR)</option>
                  <option value="ROLE_VIEWER">Visualizador (ROLE_VIEWER)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-all disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Provisionar Usuário
                </button>
              </div>
            </form>
          )}

          {/* Listagem de Usuários */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando colaboradores...
              </div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum colaborador cadastrado ainda.
              </div>
            ) : (
              users.map((u) => (
                <div 
                  key={u.id}
                  className="p-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs">
                      {u.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {u.fullName}
                        </span>
                        {getRoleBadge(u.role)}
                        {!u.active && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            Inativo
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono truncate block">
                        @{u.username}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Alterar Role */}
                    {u.id !== currentSession.user.id && (
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
                      >
                        <option value="ROLE_INSPECTOR">Vistoriador</option>
                        <option value="ROLE_VIEWER">Visualizador</option>
                      </select>
                    )}

                    {/* Toggle Ativo / Inativo */}
                    {u.id !== currentSession.user.id && (
                      <button
                        onClick={() => handleToggleActive(u)}
                        title={u.active ? 'Desativar usuário' : 'Ativar usuário'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {u.active ? (
                          <ToggleRight className="w-5 h-5" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
