import React, { useState } from 'react';
import { Eye, LogOut, FileText, GitCompare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { InspectionsListView } from '../inspections/InspectionsListView';
import { InspectionEditorView } from '../inspections/InspectionEditorView';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';

export const ViewerDashboard: React.FC = () => {
  const { user, companyName, companySlug, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'inspections' | 'comparisons'>('inspections');
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [selectedComparisonId, setSelectedComparisonId] = useState<string | null>(null);

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
      
      {/* Header Visualizador */}
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white font-bold shadow-md">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900">
                Painel de Consulta
              </h1>
              <p className="text-xs text-slate-500">
                {companyName || 'Vistoria YZZY'} • <span className="font-mono">@{companySlug}.yzzy</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800">{user?.displayName || user?.fullName}</p>
              <span className="text-[10px] font-bold text-slate-500">Visualizador (Somente Leitura)</span>
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
            <span>Vistorias Concluídas</span>
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
            <span>Laudos Comparativos</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        
        {activeTab === 'inspections' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-black text-slate-900">Vistorias Concluídas e Liberadas</h2>
              <p className="text-xs text-slate-500">Acesso protegido e restrito à leitura de laudos finalizados da empresa</p>
            </div>

            <InspectionsListView
              onOpenInspection={(id) => setSelectedInspectionId(id)}
              onNewInspectionClick={() => {}}
              canCreateInspection={false}
            />
          </div>
        )}

        {activeTab === 'comparisons' && (
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-black text-slate-900">Laudos Comparativos Finalizados</h2>
              <p className="text-xs text-slate-500">Consulta de comparações periciais homologadas entre Entrada e Saída</p>
            </div>

            <PropertyComparisonsPanel
              onOpenComparison={(id) => setSelectedComparisonId(id)}
              canCreateComparison={false}
            />
          </div>
        )}

      </main>
    </div>
  );
};

