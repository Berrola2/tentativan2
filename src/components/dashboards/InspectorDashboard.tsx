import React, { useState } from 'react';
import { Shield, Plus, LogOut, FileText, GitCompare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { InspectionsListView } from '../inspections/InspectionsListView';
import { NewInspectionWizard } from '../inspections/NewInspectionWizard';
import { InspectionEditorView } from '../inspections/InspectionEditorView';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';
import { ComparisonWizardModal } from '../comparisons/ComparisonWizardModal';
import type { Inspection } from '../../types/inspection';

export const InspectorDashboard: React.FC = () => {
  const { user, companyName, companySlug, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'inspections' | 'comparisons'>('inspections');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);
  const [isNewWizardOpen, setIsNewWizardOpen] = useState(false);
  const [isNewComparisonWizardOpen, setIsNewComparisonWizardOpen] = useState(false);

  const handleInspectionCreated = (newInspection: Inspection) => {
    setIsNewWizardOpen(false);
    setSelectedInspectionId(newInspection.id);
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header Vistoriador */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900">
                Painel do Vistoriador
              </h1>
              <p className="text-xs text-slate-500">
                {companyName || 'Vistoria YZZY'} • <span className="font-mono">@{companySlug}.yzzy</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800">{user?.displayName || user?.fullName}</p>
              <span className="text-[10px] font-bold text-blue-600">Vistoriador Oficial</span>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 border-t border-slate-100 pt-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('inspections')}
            className={`py-2 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'inspections'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Minhas Vistorias</span>
          </button>

          <button
            onClick={() => setActiveTab('comparisons')}
            className={`py-2 px-4 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'comparisons'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Comparações (Entrada × Saída)</span>
          </button>
        </div>
      </header>

      {/* Main Content Mobile First */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        
        {activeTab === 'inspections' && (
          <>
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-600/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-md mb-2">
                  Ambiente de Campo • ETAPA 08
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  Olá, {user?.displayName || user?.fullName}!
                </h2>
                <p className="text-xs sm:text-sm text-blue-100 mt-1 max-w-lg">
                  Gerencie seus laudos de entrada e saída, cadastre ambientes e compare laudos para identificar alterações de forma assistiva.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsNewWizardOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-white text-blue-700 font-bold text-xs shadow-lg shadow-black/10 hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Vistoria</span>
                </button>
              </div>
            </div>

            {/* Inspections List */}
            <InspectionsListView
              onOpenInspection={(id) => setSelectedInspectionId(id)}
              onNewInspectionClick={() => setIsNewWizardOpen(true)}
              canCreateInspection={true}
            />
          </>
        )}

        {activeTab === 'comparisons' && (
          <div className="space-y-6">
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-blue-600" />
                  Comparações Entrada × Saída
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confronto pericial assistivo entre vistorias concluídas
                </p>
              </div>
              <button
                onClick={() => setIsNewComparisonWizardOpen(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Comparação</span>
              </button>
            </div>

            <PropertyComparisonsPanel
              onOpenComparison={(id) => setSelectedComparisonId(id)}
              canCreateComparison={true}
            />
          </div>
        )}

      </main>

      {/* Wizard Modal */}
      {isNewWizardOpen && (
        <NewInspectionWizard
          onClose={() => setIsNewWizardOpen(false)}
          onInspectionCreated={handleInspectionCreated}
        />
      )}

      {/* Comparison Wizard Modal */}
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

