import React from 'react';
import { 
  FileText, 
  Sparkles, 
  Building, 
  DownloadCloud, 
  FileCheck2, 
  LayoutDashboard,
  Mic
} from 'lucide-react';
import type { InspectionType } from '../types/inspection';

interface NavbarProps {
  currentView: 'lobby' | 'inspection' | 'audio-inspection';
  onNavigate: (view: 'lobby' | 'inspection' | 'audio-inspection') => void;
  inspectionType?: InspectionType;
  inspectionTitle?: string;
  onOpenTemplates?: () => void;
  onOpenPropertyInfo?: () => void;
  onOpenBackupSync: () => void;
  onGeneratePdf?: () => void;
  isGeneratingPdf?: boolean;
  totalPhotos?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  inspectionType = 'Entrada',
  inspectionTitle,
  onOpenTemplates,
  onOpenPropertyInfo,
  onOpenBackupSync,
  onGeneratePdf,
  isGeneratingPdf = false,
  totalPhotos = 0,
}) => {
  const typeBadges: Record<InspectionType, string> = {
    Entrada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Saída: 'bg-amber-50 text-amber-700 border-amber-200',
    Periódica: 'bg-sky-50 text-sky-700 border-sky-200',
    Constatação: 'bg-purple-50 text-purple-700 border-purple-200',
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-sky-500 p-0.5 shadow-md shadow-brand-600/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5 text-brand-600" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 font-display">
                    Vistoria<span className="text-brand-600">Pro</span>
                  </span>
                  {currentView !== 'lobby' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${typeBadges[inspectionType]}`}>
                      {inspectionType}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-medium line-clamp-1">
                  {currentView === 'lobby' 
                    ? 'Painel Geral de Vistorias' 
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
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all"
                title="Voltar ao Painel Geral de Vistorias"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">Painel / Lobby</span>
              </button>
            )}

            {/* Audio Inspection Tab button */}
            {currentView === 'inspection' && (
              <button
                onClick={() => onNavigate('audio-inspection')}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all"
                title="Vistoria por Áudio"
              >
                <Mic className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden md:inline">Vistoria Áudio</span>
              </button>
            )}

            {/* Template Selector Button */}
            {currentView === 'inspection' && onOpenTemplates && (
              <button
                onClick={onOpenTemplates}
                className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all"
                title="Carregar modelo de cômodos"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Modelos</span>
              </button>
            )}

            {/* Property Info Button */}
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

          </div>

        </div>
      </div>
    </header>
  );
};
