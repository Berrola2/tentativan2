import React from 'react';
import { 
  FileText, 
  Sparkles, 
  Building, 
  DownloadCloud, 
  LayoutDashboard,
  Mic,
  LogOut,
  Users
} from 'lucide-react';
import type { InspectionType } from '../types/inspection';
import type { AuthSession } from '../types/auth';

interface NavbarProps {
  currentView: 'lobby' | 'inspection' | 'audio-inspection';
  onNavigate: (view: 'lobby' | 'inspection' | 'audio-inspection') => void;
  inspectionType?: InspectionType;
  inspectionTitle?: string;
  onOpenTemplates?: () => void;
  onOpenPropertyInfo?: () => void;
  onOpenBackupSync: () => void;
  onOpenUserManagement?: () => void;
  onGeneratePdf?: () => void;
  isGeneratingPdf?: boolean;
  totalPhotos?: number;
  currentSession?: AuthSession | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  inspectionType = 'Entrada',
  inspectionTitle,
  onOpenTemplates,
  onOpenPropertyInfo,
  onOpenBackupSync,
  onOpenUserManagement,
  onGeneratePdf,
  isGeneratingPdf = false,
  totalPhotos = 0,
  currentSession,
  onLogout,
}) => {
  const typeBadges: Record<InspectionType, string> = {
    Entrada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Saída: 'bg-amber-50 text-amber-700 border-amber-200',
    Periódica: 'bg-sky-50 text-sky-700 border-sky-200',
    Constatação: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ROLE_MANAGER': return 'Gerente';
      case 'ROLE_INSPECTOR': return 'Vistoriador';
      case 'ROLE_ADMIN_VIEWER': return 'Administrativo';
      default: return 'Colaborador';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm safe-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          
          {/* Logo & Current View */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => onNavigate('lobby')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <img 
                src={currentSession?.company.logoUrl || '/logo.jpg'} 
                alt={currentSession?.company.tradeName || 'Vistoria YZZY'} 
                className="h-10 w-auto max-w-[130px] sm:max-w-[160px] object-contain rounded-xl shadow-sm border border-slate-200/60 bg-white p-0.5 group-hover:scale-105 transition-transform" 
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 font-display">
                    {currentSession?.company.tradeName || 'Vistoria YZZY'}
                  </span>
                  {currentView !== 'lobby' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${typeBadges[inspectionType]}`}>
                      {inspectionType}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium line-clamp-1">
                  {currentView === 'lobby' 
                    ? 'Serviços de Inspeção e Avaliação' 
                    : `${inspectionTitle || 'Editando Laudo'}${totalPhotos > 0 ? ` • ${totalPhotos} fotos` : ''}`}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* If in inspection mode, show button to return to Lobby */}
            {currentView !== 'lobby' && (
              <button
                onClick={() => onNavigate('lobby')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 shadow-sm transition-all"
                title="Voltar ao Painel Geral de Vistorias"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Painel Geral</span>
              </button>
            )}

            {/* Quick Audio / AI Inspection Tab */}
            {currentView !== 'audio-inspection' && (
              <button
                onClick={() => onNavigate('audio-inspection')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm shadow-emerald-500/20 transition-all"
                title="Vistoria Guiada por Áudio"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Gravar Áudio</span>
              </button>
            )}

            {/* Templates Selector */}
            {currentView === 'inspection' && onOpenTemplates && (
              <button
                onClick={onOpenTemplates}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all"
                title="Carregar modelo de cômodos pré-configurados"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Modelos</span>
              </button>
            )}

            {/* Property and Inspection details modal button */}
            {currentView === 'inspection' && onOpenPropertyInfo && (
              <button
                onClick={onOpenPropertyInfo}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all"
                title="Editar dados do imóvel e vistoriador"
              >
                <Building className="w-3.5 h-3.5 text-brand-600" />
                <span className="hidden sm:inline">Imóvel</span>
              </button>
            )}

            {/* Manager Team & User Management */}
            {currentSession?.user.role === 'ROLE_MANAGER' && onOpenUserManagement && (
              <button
                onClick={onOpenUserManagement}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shadow-sm transition-all"
                title="Gerenciar Equipe e Usuários"
              >
                <Users className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">Equipe</span>
              </button>
            )}

            {/* Backup & Cloud Sync */}
            <button
              onClick={onOpenBackupSync}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all"
              title="Backup JSON e Nuvem Supabase"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden lg:inline">Nuvem</span>
            </button>

            {/* Primary Generate PDF Button */}
            {currentView === 'inspection' && onGeneratePdf && (
              <button
                onClick={onGeneratePdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/25 transition-all transform active:scale-95 disabled:opacity-50"
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>{isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}</span>
              </button>
            )}

            {/* Logged in User Badge and Logout Button */}
            {currentSession && (
              <div className="flex items-center gap-1.5 pl-1.5 sm:pl-2.5 border-l border-slate-200 ml-1">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-[11px] font-bold text-slate-800 leading-tight truncate max-w-[110px]">
                    {currentSession.user.fullName}
                  </span>
                  <span className="text-[9px] font-semibold text-brand-600">
                    {getRoleLabel(currentSession.user.role)}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                    title="Sair do sistema (Logout)"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
