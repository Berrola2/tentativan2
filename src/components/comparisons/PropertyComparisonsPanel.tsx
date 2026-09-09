import React, { useState, useEffect, useCallback } from 'react';
import { 
  GitCompare, 
  Plus, 
  Loader2, 
  ArrowRight,
  Lock,
  Layers
} from 'lucide-react';
import { listPropertyComparisons } from '../../services/comparisons';
import type { InspectionComparison } from '../../types/comparison';
import { ComparisonWizardModal } from './ComparisonWizardModal';

interface PropertyComparisonsPanelProps {
  propertyId?: string;
  onOpenComparison: (comparisonId: string) => void;
  canCreateComparison?: boolean;
}

export const PropertyComparisonsPanel: React.FC<PropertyComparisonsPanelProps> = ({
  propertyId,
  onOpenComparison,
  canCreateComparison = true,
}) => {
  const [comparisons, setComparisons] = useState<InspectionComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const loadComparisons = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await listPropertyComparisons(propertyId);
      setComparisons(data);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadComparisons();
  }, [loadComparisons]);

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'FINALIZED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Finalizada
          </span>
        );
      case 'READY_FOR_REVIEW':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            Pronta para Revisão
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
            Revisada
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
            {st}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Action Header */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-blue-600" />
            Comparações de Vistorias (Entrada × Saída)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Histórico de confrontos periciais e alterações registradas no imóvel
          </p>
        </div>

        {canCreateComparison && (
          <button
            onClick={() => setIsWizardOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Comparação</span>
          </button>
        )}
      </div>

      {/* Comparisons List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Laudos Comparativos do Imóvel
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            {comparisons.length} comparação(ões)
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs">Carregando comparações...</p>
          </div>
        ) : comparisons.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <GitCompare className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Nenhuma comparação realizada neste imóvel.</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Quando houver pelo menos uma Vistoria de Entrada e uma de Saída concluídas, você poderá confrontá-las automaticamente.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {comparisons.map((comp) => {
              const summary = comp.summary_json || {
                total_items: 0,
                unchanged: 0,
                worsened: 0,
                improved: 0,
                repairs_added: 0,
                items_added: 0,
                items_removed: 0,
                manual_review_required: 0,
              };

              const inDate = comp.check_in_inspection?.inspection_date 
                ? new Date(comp.check_in_inspection.inspection_date).toLocaleDateString('pt-BR') 
                : 'Entrada';
              const outDate = comp.check_out_inspection?.inspection_date 
                ? new Date(comp.check_out_inspection.inspection_date).toLocaleDateString('pt-BR') 
                : 'Saída';

              const totalChanges = (summary.worsened || 0) + (summary.repairs_added || 0) + (summary.items_added || 0) + (summary.items_removed || 0);

              return (
                <div
                  key={comp.id}
                  onClick={() => onOpenComparison(comp.id)}
                  className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 cursor-pointer transition-colors group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                        Entrada {inDate} × Saída {outDate}
                      </span>
                      {getStatusBadge(comp.status)}
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        v{comp.version}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        {summary.total_items} itens comparados
                      </span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">
                        {summary.unchanged} sem alteração
                      </span>
                      <span>•</span>
                      <span className={totalChanges > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                        {totalChanges} alterações identificadas
                      </span>
                      {summary.manual_review_required > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-purple-700 font-bold">
                            {summary.manual_review_required} revisão manual
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <button className="px-4 py-2 rounded-xl bg-slate-900 group-hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm">
                      <span>Abrir Comparação</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison Wizard Modal */}
      {isWizardOpen && (
        <ComparisonWizardModal
          onClose={() => setIsWizardOpen(false)}
          initialPropertyId={propertyId}
          onComparisonCreated={(newCompId) => {
            setIsWizardOpen(false);
            onOpenComparison(newCompId);
          }}
        />
      )}

    </div>
  );
};
