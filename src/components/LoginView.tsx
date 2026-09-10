import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, ArrowRight, Sparkles, CheckCircle2, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/Button';

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
    <div className="min-h-screen bg-yzzy-canvas flex font-sans antialiased text-yzzy-text-primary selection:bg-primary-600 selection:text-white">
      {/* 
        ============================================================
        PAINEL ESQUERDO: BRAND EXPERIENCE (DESKTOP >= 1024px - 45%)
        ============================================================
      */}
      <div className="hidden lg:flex lg:w-[45%] bg-slate-950 text-white relative overflow-hidden flex-col justify-between p-12 select-none border-r border-slate-800/80">
        {/* Glow de Fundo e Gradiente Radial Sutil */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        
        {/* Grid de Blueprint Abstrato em SVG */}
        <svg 
          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>

        {/* Topo: Logo & Identidade Institucional */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-btn bg-primary-600 flex items-center justify-center text-white font-extrabold shadow-subtle-blue">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight font-display text-white">
              Vistoria <span className="text-primary-400">YZZY</span>
            </span>
            <span className="block text-[11px] text-slate-400 font-medium tracking-wide">
              Plataforma Imobiliária Multi-Tenant
            </span>
          </div>
        </div>

        {/* Centro: Gráfico Abstrato e Título Institucional */}
        <div className="relative z-10 space-y-8 my-auto max-w-lg">
          {/* Ilustração Abstrata em SVG: Blueprint / Planta Baixa / Eixos Espaciais */}
          <div className="relative w-full h-48 rounded-2xl bg-slate-900/60 border border-slate-800/80 p-6 flex flex-col justify-between overflow-hidden shadow-card">
            {/* Linhas de Cota e Eixos Técnicos */}
            <div className="flex items-center justify-between text-[10px] font-mono text-primary-400/80 border-b border-slate-800 pb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                SISTEMA PERICIAL ATIVO
              </span>
              <span>COORD: 23°33'S 46°38'W</span>
            </div>

            {/* Geometria Abstrata da Planta */}
            <div className="relative h-24 flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 320 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Contorno de Cômodos */}
                <rect x="20" y="10" width="120" height="70" rx="4" stroke="#3B82F6" strokeWidth="1.5" strokeDasharray="4 2" strokeOpacity="0.6" />
                <rect x="150" y="10" width="150" height="70" rx="4" stroke="#60A5FA" strokeWidth="1.5" strokeOpacity="0.8" fill="#1E293B" fillOpacity="0.4" />
                <line x1="80" y1="10" x2="80" y2="80" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.4" />
                <line x1="220" y1="10" x2="220" y2="80" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.4" />
                {/* Pontos de Inspeção */}
                <circle cx="50" cy="45" r="4" fill="#3B82F6" />
                <circle cx="185" cy="30" r="4" fill="#10B981" />
                <circle cx="260" cy="55" r="4" fill="#3B82F6" />
                {/* Linha de Conexão Assistiva */}
                <path d="M 50 45 Q 117 15 185 30 T 260 55" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.7" />
              </svg>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Laudos Criptografados
              </span>
              <span>PWA Offline-Ready</span>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-extrabold tracking-tight font-display text-white leading-tight">
              Vistorias inteligentes.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-300">
                Do início ao fim.
              </span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-md">
              Precisão, agilidade e segurança para sua operação imobiliária com confronto pericial assistivo e integridade digital.
            </p>
          </div>
        </div>

        {/* Rodapé Institucional */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 pt-6 border-t border-slate-900">
          <span>Vistoria YZZY &copy; {new Date().getFullYear()}</span>
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            Ambiente Seguro
          </span>
        </div>
      </div>

      {/* 
        ============================================================
        PAINEL DIREITO: LOGIN FORM (55% DESKTOP / 100% MOBILE)
        ============================================================
      */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-16 py-12">
        <div className="w-full max-w-md mx-auto space-y-8 animate-fadeIn">
          
          {/* Header Mobile / Brand Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 lg:hidden mb-2">
              <div className="w-9 h-9 rounded-btn bg-primary-600 flex items-center justify-center text-white font-bold shadow-xs">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-extrabold text-base tracking-tight font-display text-yzzy-text-primary">
                Vistoria <span className="text-primary-600">YZZY</span>
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
              <Shield className="w-3.5 h-3.5 text-primary-600" />
              <span>Acesso Corporativo Seguro</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-yzzy-text-primary tracking-tight font-display">
              Bem-vindo à YZZY
            </h2>
            <p className="text-sm text-yzzy-text-secondary">
              Acesse sua conta para continuar.
            </p>
          </div>

          {/* Card do Formulário */}
          <div className="bg-white rounded-card p-6 sm:p-8 border border-yzzy-border shadow-card space-y-6">
            
            {/* Mensagem de Erro Humana */}
            {errorMsg && (
              <div 
                role="alert"
                className="p-3.5 rounded-btn bg-rose-50 border border-rose-200 flex items-start gap-3 text-status-danger text-xs font-medium animate-fadeIn"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              
              {/* Campo: Login YZZY */}
              <div className="space-y-1.5 text-left">
                <label 
                  htmlFor="loginInput" 
                  className="text-xs font-semibold text-yzzy-text-primary block"
                >
                  Login YZZY
                </label>
                <div className="relative">
                  <input
                    id="loginInput"
                    name="login"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    required
                    placeholder="nome.sobrenome@empresa.yzzy"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    className="w-full bg-white text-sm text-yzzy-text-primary placeholder:text-yzzy-text-muted border border-yzzy-border rounded-input py-2.5 px-3.5 min-h-[44px] transition-all duration-default outline-none hover:border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  />
                </div>
                <p className="text-[11px] text-yzzy-text-muted">
                  Utilize seu identificador oficial (ex: <code className="font-mono text-slate-600">joao.silva@tiete.yzzy</code>)
                </p>
              </div>

              {/* Campo: Senha de Acesso */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="passwordInput" 
                    className="text-xs font-semibold text-yzzy-text-primary"
                  >
                    Senha de Acesso
                  </label>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="passwordInput"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white text-sm text-yzzy-text-primary placeholder:text-yzzy-text-muted border border-yzzy-border rounded-input py-2.5 pl-3.5 pr-11 min-h-[44px] transition-all duration-default outline-none hover:border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-yzzy-text-muted hover:text-yzzy-text-primary rounded-btn transition-colors"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* CTA Entrar */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSubmitting || isLoading}
                  className="w-full font-bold shadow-xs hover:shadow-subtle-blue min-h-[48px]"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Entrar no Vistoria YZZY
                </Button>
              </div>
            </form>
          </div>

          {/* Informações de Suporte e Direitos */}
          <div className="text-center space-y-2">
            <p className="text-xs text-yzzy-text-muted">
              Primeiro acesso? A senha provisória foi informada pelo seu gestor.
            </p>
            <p className="text-[11px] text-yzzy-text-muted">
              Vistoria YZZY &copy; {new Date().getFullYear()} — Todos os direitos reservados.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
