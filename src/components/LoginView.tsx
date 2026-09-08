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
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { lookupCompany } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import type { Company } from '../types/auth';

interface LoginViewProps {
  onSuccess?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const { login } = useAuth();

  const [companySlug, setCompanySlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingCompany, setIsSearchingCompany] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyFeedback, setCompanyFeedback] = useState<{
    company: Company | null;
    error: string | null;
  }>({
    company: null,
    error: null,
  });

  // Busca dinâmica e debounced da empresa pelo slug informado
  useEffect(() => {
    let isCurrent = true;
    const clean = companySlug.trim().toLowerCase();

    if (clean.length >= 3) {
      setIsSearchingCompany(true);
      const timer = setTimeout(async () => {
        try {
          const found = await lookupCompany(clean);
          if (!isCurrent) return;

          if (found) {
            if (!found.active) {
              setCompanyFeedback({
                company: found,
                error: 'Esta empresa está temporariamente indisponível.',
              });
            } else {
              setCompanyFeedback({
                company: found,
                error: null,
              });
            }
          } else {
            setCompanyFeedback({
              company: null,
              error: 'Empresa não encontrada.',
            });
          }
        } catch {
          if (isCurrent) {
            setCompanyFeedback({ company: null, error: null });
          }
        } finally {
          if (isCurrent) {
            setIsSearchingCompany(false);
          }
        }
      }, 350);

      return () => {
        isCurrent = false;
        clearTimeout(timer);
      };
    } else {
      setCompanyFeedback({ company: null, error: null });
      setIsSearchingCompany(false);
    }
  }, [companySlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanSlug = companySlug.trim().toLowerCase();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanSlug || !cleanUser || !cleanPass) {
      setErrorMessage('Por favor, preencha todos os campos.');
      return;
    }

    if (companyFeedback.company && !companyFeedback.company.active) {
      setErrorMessage('Esta empresa está temporariamente indisponível.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await login({
        companySlug: cleanSlug,
        username: cleanUser,
        password: cleanPass,
      });

      if (res.success) {
        if (onSuccess) onSuccess();
      } else {
        setErrorMessage(res.error || 'Empresa, usuário ou senha inválidos.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro de conexão com o servidor';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeBranding = companyFeedback.company;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-brand-500 selection:text-white">
      
      {/* Dynamic Header Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 mb-6 animate-fadeIn">
        <div className="flex justify-center">
          <div className="p-2.5 rounded-3xl bg-white border border-slate-200 shadow-md transition-all duration-300">
            <img
              src={activeBranding?.logoUrl || '/logo.jpg'}
              alt={activeBranding?.name || 'Vistoria YZZY'}
              className="h-16 sm:h-20 w-auto max-w-[220px] object-contain rounded-2xl"
            />
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {activeBranding?.name || 'Sistema de Vistorias'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Acesso Corporativo Seguro • Multi-Tenant
          </p>
        </div>
      </div>

      {/* Main Login Box */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 sm:px-9 rounded-3xl border border-slate-200 shadow-xl space-y-5">
          
          <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Identificação do Colaborador
            </span>
            {isSearchingCompany && (
              <span className="text-[10px] text-brand-600 flex items-center gap-1 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Verificando...</span>
              </span>
            )}
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2 animate-shake">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            
            {/* 1. Código / Slug da Empresa */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-slate-700 font-bold">Código da Empresa</label>
                {activeBranding && activeBranding.active && (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{activeBranding.name}</span>
                  </span>
                )}
                {companyFeedback.error && (
                  <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{companyFeedback.error}</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={companySlug}
                  onChange={(e) => setCompanySlug(e.target.value.toLowerCase())}
                  placeholder="Ex: vistoria-yzzy ou imobiliaria-alfa"
                  className={`w-full bg-slate-50 border rounded-xl pl-10 pr-4 py-2.5 text-slate-900 font-mono font-medium focus:outline-none focus:bg-white transition-colors lowercase ${
                    companyFeedback.error 
                      ? 'border-amber-300 focus:border-amber-500' 
                      : activeBranding 
                        ? 'border-emerald-300 focus:border-emerald-500' 
                        : 'border-slate-200 focus:border-brand-500'
                  }`}
                  required
                />
              </div>
            </div>

            {/* 2. Nome de Usuário */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">Nome de Usuário</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  placeholder="Ex: joao ou ricso.biella"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 font-medium focus:outline-none focus:border-brand-500 focus:bg-white transition-colors lowercase"
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
                  placeholder="Digite sua senha"
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

            {/* Botão Entrar */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-600/25 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Autenticando...</span>
                  </>
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
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Isolamento Multi-Tenant com RLS e Criptografia Supabase</span>
          </div>

        </div>
      </div>

    </div>
  );
};
