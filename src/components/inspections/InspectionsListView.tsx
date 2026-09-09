import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Plus, 
  Calendar, 
  CheckCircle, 
  Clock, 
  Archive, 
  Loader2, 
  ArrowRight,
  Building,
  AlertCircle
} from 'lucide-react';
import { fetchInspections } from '../../services/inspections';
import type { Inspection, InspectionStatus } from '../../types/inspection';

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
  const [activeTab, setActiveTab] = useState<InspectionStatus | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadInspections = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchInspections({
        status: activeTab === 'ALL' ? undefined : activeTab,
        search: searchTerm,
      });
      setInspections(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar vistorias.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInspections();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadInspections]);

  const getStatusBadge = (status: InspectionStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Rascunho</span>;
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Em Andamento</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">Concluída</span>;
      case 'ARCHIVED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">Arquivada</span>;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar vistoria por título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {canCreateInspection && (
          <button
            onClick={onNewInspectionClick}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Vistoria</span>
          </button>
        )}
      </div>

      {/* Tabs Filter */}
      <div className="flex space-x-2 border-b border-slate-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`py-2 px-3 text-xs font-bold rounded-xl whitespace-nowrap transition-colors ${
            activeTab === 'ALL'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setActiveTab('IN_PROGRESS')}
          className={`py-2 px-3 text-xs font-bold rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'IN_PROGRESS'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Em Andamento</span>
        </button>
        <button
          onClick={() => setActiveTab('DRAFT')}
          className={`py-2 px-3 text-xs font-bold rounded-xl whitespace-nowrap transition-colors ${
            activeTab === 'DRAFT'
              ? 'bg-slate-800 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Rascunhos
        </button>
        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`py-2 px-3 text-xs font-bold rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Concluídas</span>
        </button>
        <button
          onClick={() => setActiveTab('ARCHIVED')}
          className={`py-2 px-3 text-xs font-bold rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'ARCHIVED'
              ? 'bg-slate-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Arquivadas</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Inspections Cards List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Listagem de Vistorias
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {inspections.length} vistoria(s)
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs">Carregando vistorias...</p>
          </div>
        ) : inspections.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Nenhuma vistoria encontrada.</p>
            <p className="text-xs text-slate-400">
              {canCreateInspection 
                ? 'Clique em "Nova Vistoria" para iniciar o registro.' 
                : 'Nenhum laudo finalizado disponível no momento.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inspections.map((insp) => (
              <div 
                key={insp.id}
                onClick={() => onOpenInspection(insp.id)}
                className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-blue-50/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold mt-0.5 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        {insp.inspection_type === 'CHECK_IN' ? 'Entrada' : 'Saída'}
                      </span>
                      {getStatusBadge(insp.status)}
                    </div>
                    
                    <h3 className="text-sm font-bold text-slate-900 mt-1 group-hover:text-blue-600 transition-colors">
                      {insp.title}
                    </h3>
                    
                    {insp.property && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {insp.property.street}{insp.property.number ? `, ${insp.property.number}` : ''} • {insp.property.city}
                        </span>
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {insp.scheduled_date ? new Date(insp.scheduled_date).toLocaleDateString('pt-BR') : new Date(insp.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInspection(insp.id);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-900 group-hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-black/5"
                  >
                    <span>Abrir Vistoria</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
