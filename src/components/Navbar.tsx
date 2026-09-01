import React from 'react';
import { 
  FileText, 
  Sparkles, 
  Building, 
  PenTool, 
  DownloadCloud, 
  FileCheck2, 
  PlusCircle
} from 'lucide-react';
import type { InspectionType } from '../types/inspection';

interface NavbarProps {
  inspectionType: InspectionType;
  onNewInspection: () => void;
  onOpenTemplates: () => void;
  onOpenPropertyInfo: () => void;
  onOpenSignatures: () => void;
  onOpenBackupSync: () => void;
  onGeneratePdf: () => void;
  isGeneratingPdf: boolean;
  totalPhotos: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  inspectionType,
  onNewInspection,
  onOpenTemplates,
  onOpenPropertyInfo,
  onOpenSignatures,
  onOpenBackupSync,
  onGeneratePdf,
  isGeneratingPdf,
  totalPhotos,
}) => {
  const typeBadgeColors = {
    Entrada: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    Saída: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Periódica: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    Constatação: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 safe-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-sky-400 p-0.5 shadow-lg shadow-brand-900/40 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileCheck2 className="w-5 h-5 text-brand-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-white font-display">
                  Vistoria<span className="text-brand-400">Pro</span>
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${typeBadgeColors[inspectionType]}`}>
                  {inspectionType}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Salvo offline • {totalPhotos} fotos</span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Template Selector Button */}
            <button
              onClick={onOpenTemplates}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              title="Carregar modelo de cômodos"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Modelos</span>
            </button>

            {/* Property Info Button */}
            <button
              onClick={onOpenPropertyInfo}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              title="Editar dados do imóvel e vistoriador"
            >
              <Building className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Imóvel</span>
            </button>

            {/* Signatures Button */}
            <button
              onClick={onOpenSignatures}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              title="Assinatura Touch / Gov.br"
            >
              <PenTool className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Assinar</span>
            </button>

            {/* Backup & Cloud Sync */}
            <button
              onClick={onOpenBackupSync}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
              title="Backup JSON e Nuvem Supabase"
            >
              <DownloadCloud className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden lg:inline">Nuvem</span>
            </button>

            {/* New Inspection */}
            <button
              onClick={onNewInspection}
              className="p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5"
              title="Iniciar nova vistoria"
            >
              <PlusCircle className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline">Novo</span>
            </button>

            {/* Primary Generate PDF Button */}
            <button
              onClick={onGeneratePdf}
              disabled={isGeneratingPdf}
              id="btn-gerar-laudo-pdf"
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white shadow-lg shadow-brand-600/30 transition-all transform active:scale-95 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>{isGeneratingPdf ? 'Gerando...' : 'Gerar PDF'}</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
