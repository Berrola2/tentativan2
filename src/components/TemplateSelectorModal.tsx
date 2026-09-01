import React from 'react';
import { 
  X, 
  Sparkles, 
  Building2, 
  Home, 
  LayoutGrid, 
  Briefcase, 
  PlusSquare, 
  ChevronRight 
} from 'lucide-react';
import { INSPECTION_TEMPLATES } from '../data/templates';
import type { QuickTemplate } from '../types/inspection';

interface TemplateSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: QuickTemplate) => void;
}

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2':
        return <Building2 className="w-5 h-5 text-brand-600" />;
      case 'Home':
        return <Home className="w-5 h-5 text-emerald-600" />;
      case 'LayoutGrid':
        return <LayoutGrid className="w-5 h-5 text-purple-600" />;
      case 'Briefcase':
        return <Briefcase className="w-5 h-5 text-amber-600" />;
      default:
        return <PlusSquare className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Modelos Prontos de Imóvel</h2>
              <p className="text-xs text-slate-500">Inicie rapidamente com cômodos e itens já estruturados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-2xl">
            💡 <strong>Dica:</strong> Escolher um modelo criará os cômodos padrão para economizar tempo. Você poderá adicionar, renomear ou excluir qualquer ambiente.
          </p>

          <div className="space-y-3 pt-1">
            {INSPECTION_TEMPLATES.map((template) => (
              <div
                key={template.id}
                onClick={() => {
                  onSelectTemplate(template);
                  onClose();
                }}
                className="group relative bg-slate-50 hover:bg-white border border-slate-200 hover:border-brand-400 rounded-2xl p-4 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    {getTemplateIcon(template.icon)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {template.rooms.length} Ambientes
                      </span>
                      <span className="text-[11px] text-slate-300">•</span>
                      <span className="text-[11px] text-slate-500">
                        {template.rooms.map((r) => r.name).slice(0, 3).join(', ')}...
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end sm:justify-center">
                  <div className="flex items-center gap-1 text-xs font-bold text-brand-600 group-hover:translate-x-1 transition-transform">
                    <span>Selecionar</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
