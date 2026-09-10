import React, { useState, useEffect, useCallback } from 'react';
import { 
  GitCompare, 
  Plus, 
  ArrowRight,
  Lock,
  Layers,
  Building,
  AlertTriangle,
  Search,
  XCircle
} from 'lucide-react';
import { listPropertyComparisons, listAllCompanyComparisons } from '../../services/comparisons';
import type { InspectionComparison } from '../../types/comparison';
import { ComparisonWizardModal } from './ComparisonWizardModal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { Alert } from '../ui/Alert';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY_FOR_REVIEW' | 'FINALIZED'>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadComparisons = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (propertyId) {
        const data = await listPropertyComparisons(propertyId);
        setComparisons(data);
      } else {
        const data = await listAllCompanyComparisons();
        setComparisons(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar comparações.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadComparisons();
  }, [loadComparisons]);

  const filteredComparisons = comparisons.filter((comp) => {
    // Status filter
    if (statusFilter === 'FINALIZED' && comp.status !== 'FINALIZED') return false;
    if (statusFilter === 'READY_FOR_REVIEW' && comp.status === 'FINALIZED') return false;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const propStreet = comp.property?.street?.toLowerCase() || '';
      const propCity = comp.property?.city?.toLowerCase() || '';
      const propNumber = comp.property?.number?.toLowerCase() || '';
      return propStreet.includes(term) || propCity.includes(term) || propNumber.includes(term);
    }

    return true;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'FINALIZED':
        return (
          <Badge variant="success" size="sm" dot>
            Comparação Finalizada
          </Badge>
        );
      case 'READY_FOR_REVIEW':
        return (
          <Badge variant="warning" size="sm" dot>
            Pronta para Revisão
          </Badge>
        );
      case 'REVIEWED':
        return (
          <Badge variant="primary" size="sm" dot>
            Revisada
          </Badge>
        );
      default:
        return <Badge variant="neutral" size="sm">{st}</Badge>;
    }
  };

  return (
    <div className="space-y-6 font-sans text-yzzy-text-primary animate-fadeIn">
      
      {/* 1. Header do Módulo */}
      <div className="bg-white p-6 sm:p-7 rounded-card border border-yzzy-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
            <GitCompare className="w-3.5 h-3.5 text-primary-600" />
            <span>Confronto Pericial</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-yzzy-text-primary tracking-tight font-display">
            Comparações Entrada × Saída
          </h1>
          <p className="text-xs sm:text-sm text-yzzy-text-secondary">
            Confronte laudos de Entrada e Saída do mesmo imóvel e identifique alterações periciais automaticamente.
          </p>
        </div>

        {canCreateComparison && (
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsWizardOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold shadow-xs hover:shadow-subtle-blue"
          >
            Nova Comparação
          </Button>
        )}
      </div>

      {/* 2. Barra de Busca e Filtros */}
      <div className="bg-white p-4 sm:p-5 rounded-card border border-yzzy-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por endereço do imóvel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-xs sm:text-sm text-yzzy-text-primary placeholder:text-yzzy-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 hover:border-slate-300 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-yzzy-text-muted hover:text-yzzy-text-primary p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
              }`}
            >
              Todas
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('READY_FOR_REVIEW')}
              className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'READY_FOR_REVIEW'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Pendentes de Revisão</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('FINALIZED')}
              className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'FINALIZED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Finalizadas</span>
            </button>
          </div>

        </div>
      </div>

      {errorMessage && (
        <Alert type="error">
          <span>{errorMessage}</span>
        </Alert>
      )}

      {/* 3. Listagem de Comparações */}
      <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden">
        
        <div className="px-6 py-4 border-b border-yzzy-border/60 flex justify-between items-center bg-surface-secondary/30">
          <h2 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
            Laudos Comparativos
          </h2>
          <span className="text-xs text-yzzy-text-muted font-semibold">
            {filteredComparisons.length} confronto(s)
          </span>
        </div>

        {/* Loading Skeletons */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="p-5 border border-yzzy-border/60 rounded-card space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="w-48 h-5" />
                  <Skeleton className="w-28 h-5 rounded-full" />
                </div>
                <Skeleton className="w-3/4 h-4" />
                <Skeleton className="w-1/2 h-4" />
              </div>
            ))}
          </div>
        ) : filteredComparisons.length === 0 ? (
          /* Empty State (Rule 32) */
          <div className="py-14 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <GitCompare className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-yzzy-text-primary">
              Nenhuma comparação disponível.
            </h3>
            <p className="text-xs text-yzzy-text-muted max-w-md mx-auto">
              Quando houver pelo menos uma Vistoria de Entrada e uma de Saída concluídas para o mesmo imóvel, você poderá confrontá-las pericialmente.
            </p>
            {canCreateComparison && (
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsWizardOpen(true)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Nova Comparação
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-yzzy-border/60">
            {filteredComparisons.map((comp) => {
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
              const pendingReviews = summary.manual_review_required || 0;
              const isFinalized = comp.status === 'FINALIZED';

              return (
                <div
                  key={comp.id}
                  onClick={() => onOpenComparison(comp.id)}
                  className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-surface-secondary/40 transition-colors cursor-pointer group"
                >
                  <div className="space-y-3 min-w-0">
                    
                    {/* Imóvel e Versão */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {comp.property && (
                        <div className="flex items-center gap-1.5 font-bold text-sm text-yzzy-text-primary group-hover:text-primary-600 transition-colors">
                          <Building className="w-4 h-4 text-primary-600 shrink-0" />
                          <span>
                            {comp.property.street}{comp.property.number ? `, ${comp.property.number}` : ''}
                            {comp.property.complement ? ` • ${comp.property.complement}` : ''}
                          </span>
                        </div>
                      )}
                      {getStatusBadge(comp.status)}
                      <span className="text-[11px] font-mono font-bold text-yzzy-text-muted bg-surface-secondary px-2 py-0.5 rounded-md border border-yzzy-border">
                        v{comp.version || 1}
                      </span>
                    </div>

                    {/* Visual Comparison Flow: ENTRADA ➔ CONFRONTO ➔ SAÍDA (Rule 29) */}
                    <div className="inline-flex items-center gap-2 p-2 rounded-btn bg-surface-secondary/80 border border-yzzy-border text-xs">
                      <div className="flex items-center gap-1 font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded-md border border-primary-100">
                        <span>Entrada: {inDate}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-yzzy-text-muted shrink-0" />
                      <div className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                        <span>Saída: {outDate}</span>
                      </div>
                    </div>

                    {/* Resumo de Itens e Pendências de Revisão (Rule 30) */}
                    <div className="flex items-center gap-3 text-xs text-yzzy-text-secondary flex-wrap pt-0.5">
                      <span className="flex items-center gap-1 font-medium">
                        <Layers className="w-3.5 h-3.5 text-yzzy-text-muted" />
                        {summary.total_items} itens analisados
                      </span>
                      <span>•</span>
                      <span className="text-emerald-700 font-semibold">
                        {summary.unchanged} sem alteração
                      </span>
                      <span>•</span>
                      <span className={totalChanges > 0 ? 'text-amber-700 font-bold' : 'text-yzzy-text-muted'}>
                        {totalChanges} alterações detectadas
                      </span>
                      
                      {/* Destaque para itens pendentes de revisão */}
                      {pendingReviews > 0 && !isFinalized && (
                        <>
                          <span>•</span>
                          <Badge variant="warning" size="sm">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {pendingReviews} {pendingReviews === 1 ? 'item precisa' : 'itens precisam'} de revisão
                          </Badge>
                        </>
                      )}
                    </div>

                  </div>

                  {/* Ação Contextual */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                    <Button
                      variant={isFinalized ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenComparison(comp.id);
                      }}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                    >
                      {isFinalized ? 'Visualizar Laudo' : 'Revisar Confronto'}
                    </Button>
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
