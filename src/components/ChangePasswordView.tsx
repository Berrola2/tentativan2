import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, XCircle, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const ChangePasswordView: React.FC = () => {
  const { user, changePassword, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validações
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isFormValid) {
      setErrorMsg('Por favor, atenda a todos os requisitos de segurança antes de prosseguir.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePassword(newPassword);
      if (!res.success) {
        setErrorMsg(res.error || 'Falha ao redefinir a senha. Tente novamente.');
      }
    } catch {
      setErrorMsg('Erro de conexão ao servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 font-sans selection:bg-blue-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        <div className="flex justify-center items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <KeyRound className="w-6 h-6" />
          </div>
        </div>

        <h2 className="text-center text-2xl font-black tracking-tight text-slate-900">
          Primeiro Acesso — Criar Nova Senha
        </h2>
        <p className="mt-1.5 text-center text-sm text-slate-600">
          Olá, <span className="font-bold text-slate-900">{user?.displayName || user?.fullName}</span>. Por segurança, você deve cadastrar sua senha definitiva para continuar.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-200">
          
          {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-sm animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            
            {/* Campo Nova Senha */}
            <div>
              <label htmlFor="newPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Nova Senha Definitiva
              </label>
              <div className="mt-1 relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Cadastre sua nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 pr-11 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm bg-slate-50/50 hover:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Campo Confirmar Nova Senha */}
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita sua nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm bg-slate-50/50 hover:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Checklist de Requisitos de Senha */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <p className="font-bold text-slate-700 mb-1">Critérios obrigatórios da senha:</p>
              
              <div className="flex items-center gap-2">
                {hasMinLength ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                <span className={hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}>Mínimo de 8 caracteres</span>
              </div>

              <div className="flex items-center gap-2">
                {hasUpperCase ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                <span className={hasUpperCase ? 'text-emerald-700 font-medium' : 'text-slate-500'}>Pelo menos 1 letra maiúscula (A-Z)</span>
              </div>

              <div className="flex items-center gap-2">
                {hasLowerCase ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                <span className={hasLowerCase ? 'text-emerald-700 font-medium' : 'text-slate-500'}>Pelo menos 1 letra minúscula (a-z)</span>
              </div>

              <div className="flex items-center gap-2">
                {hasNumber ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                <span className={hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}>Pelo menos 1 número (0-9)</span>
              </div>

              <div className="flex items-center gap-2">
                {passwordsMatch ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-slate-400" />}
                <span className={passwordsMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'}>As senhas digitadas coincidem</span>
              </div>
            </div>

            {/* Botão de Salvar Senha */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Salvando Senha...</span>
                  </>
                ) : (
                  <span>Definir Senha e Entrar</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => logout()}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da conta</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
