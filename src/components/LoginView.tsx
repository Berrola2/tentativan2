import React, { useState } from 'react';
import { Shield, Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanLogin = loginInput.trim();
    if (!cleanLogin || !password) {
      setErrorMsg('Por favor, preencha todos os campos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login({
        login: cleanLogin,
        password,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'Login ou senha inválidos.');
      }
    } catch {
      setErrorMsg('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4 font-sans selection:bg-blue-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        
        {/* Brand Logo Header */}
        <div className="flex justify-center items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Vistoria <span className="text-blue-600">YZZY</span>
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Plataforma Imobiliária Multi-Tenant
            </p>
          </div>
        </div>

        <h2 className="mt-2 text-center text-xl font-bold tracking-tight text-slate-800">
          Entrar no Sistema
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Utilize seu identificador de Login YZZY
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
            {/* Campo Login YZZY */}
            <div>
              <label htmlFor="loginInput" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Login YZZY
              </label>
              <div className="mt-1">
                <input
                  id="loginInput"
                  name="login"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="nome.sobrenome@empresa.yzzy"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm bg-slate-50/50 hover:bg-white transition-colors"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Exemplo: joao.silva@imobiliariaalpha.yzzy
              </p>
            </div>

            {/* Campo Senha */}
            <div>
              <label htmlFor="passwordInput" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Senha de Acesso
              </label>
              <div className="mt-1 relative">
                <input
                  id="passwordInput"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Botão de Entrada */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isSubmitting || isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Autenticando...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Entrar no Vistoria YZZY</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Vistoria YZZY &copy; {new Date().getFullYear()} — Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};
