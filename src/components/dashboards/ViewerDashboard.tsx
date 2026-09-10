import React, { useState, useEffect } from 'react';
import { Eye, FileText, GitCompare, Building } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { InspectionsListView } from '../inspections/InspectionsListView';
import { InspectionEditorView } from '../inspections/InspectionEditorView';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';
import { PropertiesView } from '../properties/PropertiesView';
import { Badge } from '../ui/Badge';

export interface ViewerDashboardProps {
  activeNav?: string;
  onNavigate?: (id: string) => void;
}

export const ViewerDashboard: React.FC<ViewerDashboardProps> = ({
  activeNav,
  onNavigate,
}) => {
  const { companyName } = useAuth();
  const [internalTab, setInternalTab] = useState<'inspections' | 'comparisons' | 'properties'>('inspections');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);

  // Sincronizar com navegação externa (Sidebar / BottomNav)
  useEffect(() => {
    if (!activeNav) return;
    if (activeNav === 'inspections' || activeNav === 'dashboard') setInternalTab('inspections');
    else if (activeNav === 'comparisons') setInternalTab('comparisons');
    else if (activeNav === 'properties') setInternalTab('properties');
  }, [activeNav]);

  const handleTabChange = (tab: 'inspections' | 'comparisons' | 'properties') => {
    setInternalTab(tab);
    if (onNavigate) {
      onNavigate(tab);
    }
  };

  if (selectedComparisonId) {
    return (
      <InspectionComparisonView
        comparisonId={selectedComparisonId}
        onBack={() => setSelectedComparisonId(null)}
      />
    );
  }

  if (selectedInspectionId) {
    return (
      <InspectionEditorView
        inspectionId={selectedInspectionId}
        onBack={() => setSelectedInspectionId(null)}
      />
    );
  }

  return (
    <div className="w-full space-y-6 animate-fadeIn font-sans text-yzzy-text-primary p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      
      {/* Hero Header */}
      <div className="bg-white rounded-card p-6 sm:p-8 border border-yzzy-border shadow-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
            <Eye className="w-3.5 h-3.5 text-slate-500" />
            <span>Perfil de Consulta • Leitura & Auditoria</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-yzzy-text-primary tracking-tight font-display">
            Painel de Consulta
          </h1>
          <p className="text-sm text-yzzy-text-secondary">
            Acesso protegido a laudos, vistorias e relatórios comparativos da <strong className="text-yzzy-text-primary">{companyName || 'empresa'}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="md">
            Somente Leitura
          </Badge>
        </div>
      </div>

      {/* Navegação entre Visualizações */}
      <div className="flex items-center gap-2 border-b border-yzzy-border pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('inspections')}
          className={`px-4 py-2 rounded-btn text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${
            internalTab === 'inspections'
              ? 'bg-primary-50 text-primary-700 border border-primary-100'
              : 'text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Vistorias da Empresa</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('comparisons')}
          className={`px-4 py-2 rounded-btn text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${
            internalTab === 'comparisons'
              ? 'bg-primary-50 text-primary-700 border border-primary-100'
              : 'text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary'
          }`}
        >
          <GitCompare className="w-4 h-4" />
          <span>Laudos Comparativos</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('properties')}
          className={`px-4 py-2 rounded-btn text-xs font-bold transition-colors flex items-center gap-2 whitespace-nowrap ${
            internalTab === 'properties'
              ? 'bg-primary-50 text-primary-700 border border-primary-100'
              : 'text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Imóveis Cadastrados</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico */}
      {internalTab === 'inspections' && (
        <div className="space-y-4">
          <InspectionsListView
            onOpenInspection={(id) => setSelectedInspectionId(id)}
            onNewInspectionClick={() => {}}
            canCreateInspection={false}
          />
        </div>
      )}

      {internalTab === 'comparisons' && (
        <div className="space-y-4">
          <PropertyComparisonsPanel
            onOpenComparison={(id) => setSelectedComparisonId(id)}
            canCreateComparison={false}
          />
        </div>
      )}

      {internalTab === 'properties' && (
        <div className="space-y-4">
          <PropertiesView />
        </div>
      )}

    </div>
  );
};
