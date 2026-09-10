import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Calendar, 
  Clock, 
  Archive, 
  CheckCircle2, 
  Building,
  ArrowRight,
  XCircle,
  Eye,
  Edit3
} from 'lucide-react';
import { fetchInspections } from '../../services/inspections';
import type { Inspection, InspectionStatus, InspectionType } from '../../types/inspection';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { Alert } from '../ui/Alert';

interface InspectionsListViewProps {
  onOpenInspection: (inspectionId: string) => void;
  onNewInspectionClick: () => void;
  canCreateInspection?: boolean;
}

export const InspectionsListView: React.FC<InspectionsListViewProps> = ({
  onOpenInspection,
  onNewInspectionClick,
  canCreateInspection = true,
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [statusFilter, setStatusFilter] = useState<InspectionStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<InspectionType | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInspections = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchInspections({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchTerm.trim() || undefined,
      });
      setInspections(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar vistorias.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInspections();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadInspections]);

  // Client-side filtering for Type
  const filteredInspections = inspections.filter((insp) => {
    if (typeFilter !== 'ALL' && insp.inspection_type !== typeFilter) {
      return false;
    }
    return true;
  });

  const getStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral" size="sm" dot>Rascunho</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" size="sm" dot>Em andamento</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" size="sm" dot>Concluída</Badge>;
      case 'ARCHIVED':
        return <Badge variant="neutral" size="sm">Arquivada</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: InspectionType) => {
    if (type === 'CHECK_IN') {
      return <Badge variant="primary" size="sm">Entrada</Badge>;
    }
    return <Badge variant="warning" size="sm">Saída</Badge>;
  };

  const getContextualAction = (status: InspectionStatus) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Continuar preparação', icon: <Edit3 className="w-3.5 h-3.5" /> };
      case 'IN_PROGRESS':
        return { label: 'Continuar vistoria', icon: <ArrowRight className="w-3.5 h-3.5" /> };
      case 'COMPLETED':
        return { label: 'Ver laudo', icon: <Eye className="w-3.5 h-3.5" /> };
      case 'ARCHIVED':
        return { label: 'Visualizar', icon: <Eye className="w-3.5 h-3.5" /> };
      default:
        return { label: 'Abrir vistoria', icon: <ArrowRight className="w-3.5 h-3.5" /> };
    }
  };

  return (
    <div className="space-y-6 font-sans text-yzzy-text-primary animate-fadeIn">
      
      {/* 1. Header do Módulo */}
      <div className="bg-white p-6 sm:p-7 rounded-card border border-yzzy-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
            <FileText className="w-3.5 h-3.5 text-primary-600" />
            <span>Gestão Operacional</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-yzzy-text-primary tracking-tight font-display">
            Vistorias
          </h1>
          <p className="text-xs sm:text-sm text-yzzy-text-secondary">
            Gerencie as vistorias de entrada e saída da sua operação.
          </p>
        </div>

        {canCreateInspection && (
          <Button
            variant="primary"
            size="md"
            onClick={onNewInspectionClick}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold shadow-xs hover:shadow-subtle-blue"
          >
            Nova Vistoria
          </Button>
        )}
      </div>

      {/* 2. Barra de Busca e Filtros Principais */}
      <div className="bg-white p-4 sm:p-5 rounded-card border border-yzzy-border shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          
          {/* Input de Busca Consistente */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar vistoria por título, endereço ou responsável..."
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

          {/* Filtro por Tipo de Vistoria */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-yzzy-text-secondary hidden sm:inline">Tipo:</span>
            <div className="inline-flex bg-surface-secondary p-1 rounded-btn border border-yzzy-border text-xs font-bold">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  typeFilter === 'ALL'
                    ? 'bg-white text-primary-700 shadow-xs font-bold'
                    : 'text-yzzy-text-secondary hover:text-yzzy-text-primary'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('CHECK_IN')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  typeFilter === 'CHECK_IN'
                    ? 'bg-white text-primary-700 shadow-xs font-bold'
                    : 'text-yzzy-text-secondary hover:text-yzzy-text-primary'
                }`}
              >
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('CHECK_OUT')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  typeFilter === 'CHECK_OUT'
                    ? 'bg-white text-primary-700 shadow-xs font-bold'
                    : 'text-yzzy-text-secondary hover:text-yzzy-text-primary'
                }`}
              >
                Saída
              </button>
            </div>
          </div>

        </div>

        {/* Status Tabs Bar */}
        <div className="flex items-center gap-1.5 border-t border-yzzy-border/60 pt-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-primary-600 text-white shadow-xs'
                : 'text-yzzy-text-secondary hover:bg-surface-secondary hover:text-yzzy-text-primary'
            }`}
          >
            Todas
          </button>
          
          <button
            type="button"
            onClick={() => setStatusFilter('IN_PROGRESS')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'IN_PROGRESS'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-yzzy-text-secondary hover:bg-surface-secondary hover:text-yzzy-text-primary'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Em andamento</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
              statusFilter === 'DRAFT'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-yzzy-text-secondary hover:bg-surface-secondary hover:text-yzzy-text-primary'
            }`}
          >
            Rascunhos
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-yzzy-text-secondary hover:bg-surface-secondary hover:text-yzzy-text-primary'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Concluídas</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ARCHIVED')}
            className={`px-3.5 py-1.5 rounded-btn text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              statusFilter === 'ARCHIVED'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'text-yzzy-text-secondary hover:bg-surface-secondary hover:text-yzzy-text-primary'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Arquivadas</span>
          </button>

          {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setSearchTerm('');
              }}
              className="ml-auto text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline px-2 py-1 whitespace-nowrap"
            >
              Limpar filtros
            </button>
          )}
        </div>

      </div>

      {/* Error Alert */}
      {errorMessage && (
        <Alert type="error">
          <span>{errorMessage}</span>
        </Alert>
      )}

      {/* 3. Lista Estruturada de Vistorias (Desktop Hybrid / Mobile Touch Cards) */}
      <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden">
        
        {/* Header da Lista */}
        <div className="px-6 py-4 border-b border-yzzy-border/60 flex justify-between items-center bg-surface-secondary/30">
          <h2 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
            Vistorias Cadastradas
          </h2>
          <span className="text-xs text-yzzy-text-muted font-semibold">
            {filteredInspections.length} vistoria(s) encontrada(s)
          </span>
        </div>

        {/* Loading State com Skeletons Coerentes */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="p-4 border border-yzzy-border/60 rounded-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-16 h-5 rounded-full" />
                    <Skeleton className="w-24 h-5 rounded-full" />
                  </div>
                  <Skeleton className="w-20 h-4" />
                </div>
                <Skeleton className="w-3/4 h-5" />
                <Skeleton className="w-1/2 h-4" />
              </div>
            ))}
          </div>
        ) : filteredInspections.length === 0 ? (
          /* Empty State */
          <div className="py-14 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-yzzy-text-primary">
              Nenhuma vistoria encontrada.
            </h3>
            <p className="text-xs text-yzzy-text-muted max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos de busca.'
                : 'Nenhuma vistoria cadastrada na sua operação ainda.'}
            </p>
            {canCreateInspection && (
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onNewInspectionClick}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Nova Vistoria
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Listagem Operacional */
          <div className="divide-y divide-yzzy-border/60">
            {filteredInspections.map((insp) => {
              const action = getContextualAction(insp.status);
              const formattedDate = insp.scheduled_date 
                ? new Date(insp.scheduled_date).toLocaleDateString('pt-BR') 
                : new Date(insp.created_at).toLocaleDateString('pt-BR');

              return (
                <div
                  key={insp.id}
                  onClick={() => onOpenInspection(insp.id)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-secondary/50 transition-colors cursor-pointer group"
                >
                  {/* Informações da Vistoria */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-btn bg-primary-50 text-primary-700 border border-primary-100/70 flex items-center justify-center shrink-0 font-bold mt-0.5 group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5 text-primary-600" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      {/* Badges de Tipo e Status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {getTypeBadge(insp.inspection_type)}
                        {getStatusBadge(insp.status)}
                      </div>

                      {/* Título da Vistoria */}
                      <h3 className="text-sm font-bold text-yzzy-text-primary group-hover:text-primary-600 transition-colors truncate">
                        {insp.title}
                      </h3>

                      {/* Endereço do Imóvel Dominante */}
                      {insp.property ? (
                        <p className="text-xs text-yzzy-text-secondary flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-yzzy-text-muted shrink-0" />
                          <span className="font-semibold text-slate-800">
                            {insp.property.street}{insp.property.number ? `, ${insp.property.number}` : ''}
                          </span>
                          {insp.property.complement && (
                            <span className="text-yzzy-text-muted">• {insp.property.complement}</span>
                          )}
                          <span className="text-yzzy-text-muted">• {insp.property.city}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-yzzy-text-muted">
                          Imóvel vinculado
                        </p>
                      )}

                      {/* Data e Metadados */}
                      <div className="flex items-center gap-3 text-[11px] text-yzzy-text-muted pt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </span>
                        {insp.property?.neighborhood && (
                          <>
                            <span>•</span>
                            <span>Bairro: {insp.property.neighborhood}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ação Contextual (Touch friendly >= 44px) */}
                  <div className="flex items-center gap-2 self-end md:self-auto shrink-0 pt-2 md:pt-0 w-full md:w-auto justify-end">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInspection(insp.id);
                      }}
                      rightIcon={action.icon}
                      className="w-full md:w-auto text-xs font-bold min-h-[40px] md:min-h-[36px]"
                    >
                      {action.label}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
