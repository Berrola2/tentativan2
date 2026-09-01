import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Lock, 
  ArrowRight, 
  ShieldCheck, 
  Loader2, 
  Eye, 
  EyeOff,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { lookupCompany, loginEmployee } from '../services/authService';
import type { AuthSession, Company } from '../types/auth';

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [corporateCode, setCorporateCode] = useState('YZZY01');
  const [username, setUsername] = useState('ricso.biella');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyBranding, setCompanyBranding] = useState<Company | null>(null);

  // Dynamic branding fetch when user alters the corporate code
  useEffect(() => {
    let active = true;
    const code = corporateCode.trim();

    if (code.length >= 3) {
      const timer = setTimeout(async () => {
        const found = await lookupCompany(code);
        if (active) {
          setCompanyBranding(found);
        }
      }, 350);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    } else {
      setCompanyBranding(null);
    }
  }, [corporateCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await loginEmployee(corporateCode, username, password);
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setErrorMessage(res.error || 'Credenciais inválidas. Verifique os dados.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (code: string, user: string, pass: string) => {
    setCorporateCode(code);
    setUsername(user);
    setPassword(pass);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-brand-500 selection:text-white">
      
      {/* Container Central */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 mb-6">
        
        {/* Dynamic Logo */}
        <div className="flex justify-center">
          <div className="p-2 rounded-3xl bg-white border border-slate-200 shadow-md transition-all duration-300">
            <img
              src={companyBranding?.logoUrl || '/logo.jpg'}
              alt={companyBranding?.tradeName || 'Vistoria YZZY'}
              className="h-16 sm:h-20 w-auto max-w-[220px] object-contain rounded-2xl"
            />
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {companyBranding?.tradeName || 'Vistoria YZZY'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Sistema Multi-Tenant de Inspeção e Vistoria Imobiliária
          </p>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 sm:px-9 rounded-3xl border border-slate-200 shadow-xl space-y-5">
          
          {/* Quick preset badge */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Acesso Corporativo
            </span>
            <button
              type="button"
              onClick={() => handleFillDemo('YZZY01', 'ricso.biella', '123')}
              className="text-[11px] font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200 transition-colors flex items-center gap-1"
              title="Preencher dados de teste"
            >
              <Sparkles className="w-3 h-3" />
              <span>Preencher Padrão</span>
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2 animate-shake">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            
            {/* 1. Código da Empresa */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold">Código da Empresa</label>
                {companyBranding && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{companyBranding.tradeName}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={corporateCode}
                  onChange={(e) => setCorporateCode(e.target.value.toUpperCase())}
                  placeholder="Ex: YZZY01"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 font-mono font-bold tracking-wider focus:outline-none focus:border-brand-500 focus:bg-white transition-colors uppercase"
                  required
                />
              </div>
            </div>

            {/* 2. Usuário */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Nome de Usuário</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: ricso.biella"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                  required
                />
              </div>
            </div>

            {/* 3. Senha */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-slate-900 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botão de Login */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-600/25 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Rodapé de Segurança */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Isolamento Multi-Tenant com Criptografia Segura</span>
          </div>

        </div>
      </div>

    </div>
  );
};
