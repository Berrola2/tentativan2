import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  FileText, 
  GitCompare, 
  Clock, 
  ArrowRight, 
  ChevronRight, 
  Loader2, 
  Compass
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchInspections } from '../../services/inspections';
import type { Inspection, InspectionStatus } from '../../types/inspection';
import { NewInspectionWizard } from '../inspections/NewInspectionWizard';
import { InspectionEditorView } from '../inspections/InspectionEditorView';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';
import { ComparisonWizardModal } from '../comparisons/ComparisonWizardModal';
import { PropertiesView } from '../properties/PropertiesView';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface InspectorDashboardProps {
  activeNav?: string;
  onNavigate?: (id: string) => void;
}

export const InspectorDashboard: React.FC<InspectorDashboardProps> = ({
  activeNav,
}) => {
  const { user, companyName } = useAuth();
  const [internalTab, setInternalTab] = useState<'home' | 'inspections' | 'comparisons' | 'properties'>('home');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);
  const [isNewWizardOpen, setIsNewWizardOpen] = useState(false);
  const [isNewComparisonWizardOpen, setIsNewComparisonWizardOpen] = useState(false);

  // Sincronizar com navegação externa (Sidebar / BottomNav)
  useEffect(() => {
    if (!activeNav) return;
    if (activeNav === 'inspections' || activeNav === 'dashboard') setInternalTab('home');
    else if (activeNav === 'comparisons') setInternalTab('comparisons');
    else if (activeNav === 'properties') setInternalTab('properties');
  }, [activeNav]);

  // Vistorias do Vistoriador
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'IN_PROGRESS' | 'DRAFT' | 'COMPLETED'>('ALL');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchInspections();
      setInspections(data);
    } catch (err) {
      console.error('Erro ao carregar vistorias do vistoriador:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Saudação contextual
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Vistoria ativa com prioridade máxima (primeira em andamento ou primeiro rascunho)
  const activeInspection = inspections.find((i) => i.status === 'IN_PROGRESS') || 
                           inspections.find((i) => i.status === 'DRAFT');

  const inProgressList = inspections.filter((i) => i.status === 'IN_PROGRESS');
  const draftList = inspections.filter((i) => i.status === 'DRAFT');
  const completedList = inspections.filter((i) => i.status === 'COMPLETED');

  const filteredInspections = filterCategory === 'ALL' 
    ? inspections 
    : inspections.filter((i) => i.status === filterCategory);

  const getStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="neutral" size="sm" dot>Rascunho</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning" size="sm" dot>Em Andamento</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" size="sm" dot>Concluída</Badge>;
      case 'ARCHIVED':
        return <Badge variant="neutral" size="sm">Arquivada</Badge>;
    }
  };

  const handleInspectionCreated = (newInspection: Inspection) => {
    setIsNewWizardOpen(false);
    setSelectedInspectionId(newInspection.id);
  };

  if (selectedComparisonId) {
    return (
      <InspectionComparisonView
        comparisonId={selectedComparisonId}
        onBack={() => {
          setSelectedComparisonId(null);
          loadData();
        }}
      />
    );
  }

  if (selectedInspectionId) {
    return (
      <InspectionEditorView
        inspectionId={selectedInspectionId}
        onBack={() => {
          setSelectedInspectionId(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="w-full space-y-6 animate-fadeIn font-sans text-yzzy-text-primary p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      
      {/* VIEW 1: HOME OPERACIONAL DE CAMPO (MOBILE-FIRST) */}
      {internalTab === 'home' && (
        <div className="space-y-6">
          
          {/* Header Operacional Simples */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-primary-700 bg-primary-50 px-2.5 py-0.5 rounded-full border border-primary-100">
                Operação de Campo • {companyName || 'YZZY'}
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold text-yzzy-text-primary tracking-tight font-display">
                {getGreeting()}, {user?.displayName || user?.fullName || 'Vistoriador'}.
              </h1>
              <p className="text-xs text-yzzy-text-secondary">
                Pronto para continuar os laudos imobiliários?
              </p>
            </div>

            {/* Em Desktop: botão discreto se já houver vistoria ativa */}
            <div className="hidden sm:block">
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsNewWizardOpen(true)}
                leftIcon={<Plus className="w-4 h-4" />}
                className="font-bold shadow-xs hover:shadow-subtle-blue"
              >
                Nova Vistoria
              </Button>
            </div>
          </div>

          {/* 
            ============================================================
            HERO CARD: VISTORIA EM ANDAMENTO (PRIORIDADE MÁXIMA DE CAMPO)
            ============================================================
          */}
          {isLoading ? (
            <div className="bg-white rounded-card p-8 border border-yzzy-border text-center flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              <p className="text-xs text-yzzy-text-muted">Carregando status de campo...</p>
            </div>
          ) : activeInspection ? (
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-card p-6 sm:p-8 border border-slate-800 shadow-card relative overflow-hidden space-y-5">
              {/* Glow sutil */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-600/15 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Vistoria em Andamento
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded bg-slate-800/80">
                  {activeInspection.inspection_type === 'CHECK_IN' ? 'ENTRADA' : 'SAÍDA'}
                </span>
              </div>

              <div className="relative z-10 space-y-2">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-display text-white">
                  {activeInspection.title || 'Vistoria em Campo'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary-400 shrink-0" />
                  Iniciada em {new Date(activeInspection.created_at).toLocaleDateString('pt-BR')} às {new Date(activeInspection.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="relative z-10 pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setSelectedInspectionId(activeInspection.id)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="font-bold w-full sm:w-auto min-h-[48px] shadow-subtle-blue"
                >
                  Continuar Vistoria
                </Button>

                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => setIsNewWizardOpen(true)}
                  className="bg-slate-800/80 hover:bg-slate-800 text-white border-slate-700 min-h-[48px] sm:hidden"
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Iniciar Outra Vistoria
                </Button>
              </div>
            </div>
          ) : (
            /* Empty State Intencional */
            <div className="bg-white rounded-card p-8 sm:p-10 border border-yzzy-border shadow-card text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto shadow-xs">
                <Compass className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="text-base font-bold text-yzzy-text-primary">
                  Nenhuma vistoria em andamento
                </h3>
                <p className="text-xs text-yzzy-text-secondary leading-relaxed">
                  Você não tem nenhum laudo aberto no momento. Ao chegar no imóvel, inicie uma nova vistoria pericial.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setIsNewWizardOpen(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                  className="font-bold min-h-[48px] px-8 shadow-subtle-blue"
                >
                  Nova Vistoria
                </Button>
              </div>
            </div>
          )}

          {/* 
            ============================================================
            SEÇÃO: MINHAS VISTORIAS (MOBILE-FIRST TOUCH-FRIENDLY CARDS)
            ============================================================
          */}
          <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden space-y-4 p-5 sm:p-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-yzzy-border/60 pb-4">
              <div>
                <h2 className="text-sm font-bold text-yzzy-text-primary tracking-tight">
                  Minhas Vistorias
                </h2>
                <p className="text-xs text-yzzy-text-muted">
                  {inspections.length} laudo(s) registrado(s)
                </p>
              </div>

              {/* Filtros em Pílulas Touch-Friendly */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setFilterCategory('ALL')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${
                    filterCategory === 'ALL'
                      ? 'bg-primary-600 text-white'
                      : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
                  }`}
                >
                  Todas ({inspections.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('IN_PROGRESS')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${
                    filterCategory === 'IN_PROGRESS'
                      ? 'bg-amber-500 text-white'
                      : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
                  }`}
                >
                  Em Andamento ({inProgressList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('DRAFT')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${
                    filterCategory === 'DRAFT'
                      ? 'bg-slate-700 text-white'
                      : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
                  }`}
                >
                  Rascunhos ({draftList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory('COMPLETED')}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px] ${
                    filterCategory === 'COMPLETED'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
                  }`}
                >
                  Concluídas ({completedList.length})
                </button>
              </div>
            </div>

            {/* Lista de Vistorias */}
            {isLoading ? (
              <div className="p-8 text-center text-yzzy-text-muted flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
                <span className="text-xs">Carregando lista...</span>
              </div>
            ) : filteredInspections.length === 0 ? (
              <div className="p-8 text-center text-yzzy-text-muted space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">Nenhuma vistoria encontrada nesta categoria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredInspections.map((insp) => (
                  <div
                    key={insp.id}
                    onClick={() => setSelectedInspectionId(insp.id)}
                    className="p-4 rounded-btn border border-yzzy-border hover:border-slate-300 bg-surface-secondary/40 hover:bg-white transition-all cursor-pointer flex items-center justify-between gap-4 group min-h-[64px]"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-yzzy-text-primary group-hover:text-primary-600 transition-colors truncate">
                          {insp.title || 'Vistoria'}
                        </span>
                        {getStatusBadge(insp.status)}
                        <Badge variant="neutral" size="sm">
                          {insp.inspection_type === 'CHECK_IN' ? 'Entrada' : 'Saída'}
                        </Badge>
                      </div>
                      <p className="text-xs text-yzzy-text-muted truncate">
                        Criada em {new Date(insp.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ChevronRight className="w-5 h-5 text-yzzy-text-muted group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* VIEW 2: CONFRONTOS / COMPARAÇÕES */}
      {internalTab === 'comparisons' && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-card border border-yzzy-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-sm font-bold text-yzzy-text-primary flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-primary-600" />
                Comparações Entrada × Saída
              </h2>
              <p className="text-xs text-yzzy-text-secondary mt-0.5">
                Confronto pericial assistivo entre vistorias homologadas do mesmo imóvel.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsNewComparisonWizardOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold shrink-0"
            >
              Nova Comparação
            </Button>
          </div>

          <PropertyComparisonsPanel
            onOpenComparison={(id) => setSelectedComparisonId(id)}
            canCreateComparison={true}
          />
        </div>
      )}

      {/* VIEW 3: IMÓVEIS */}
      {internalTab === 'properties' && (
        <PropertiesView />
      )}

      {/* 
        ============================================================
        WIZARDS & MODAIS FUNCIONAIS
        ============================================================
      */}
      {isNewWizardOpen && (
        <NewInspectionWizard
          onClose={() => setIsNewWizardOpen(false)}
          onInspectionCreated={handleInspectionCreated}
        />
      )}

      {isNewComparisonWizardOpen && (
        <ComparisonWizardModal
          onClose={() => setIsNewComparisonWizardOpen(false)}
          onComparisonCreated={(newCompId) => {
            setIsNewComparisonWizardOpen(false);
            setSelectedComparisonId(newCompId);
          }}
        />
      )}

    </div>
  );
};
