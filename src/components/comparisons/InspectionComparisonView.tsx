import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  GitCompare, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Search, 
  Check, 
  X, 
  Eye, 
  Edit3, 
  Sparkles, 
  ImageIcon, 
  Lock, 
  Unlock, 
  Filter,
  Layers,
  Printer
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  fetchComparisonDetails, 
  reviewComparisonItem, 
  finalizeComparison, 
  reopenComparison 
} from '../../services/comparisons';
import { generateOfficialComparisonPdf } from '../../services/pdfGenerator';
import type { 
  InspectionComparison, 
  ComparisonReviewStatus
} from '../../types/comparison';
import { COMPARISON_CHANGE_LABELS } from '../../types/comparison';
import { ITEM_CONDITION_LABELS } from '../../types/inspection';
import { PhotoViewerModal } from '../PhotoViewerModal';

interface InspectionComparisonViewProps {
  comparisonId: string;
  onBack: () => void;
}

export const InspectionComparisonView: React.FC<InspectionComparisonViewProps> = ({
  comparisonId,
  onBack,
}) => {
  const { isCompanyManager, isInspector } = useAuth();
  
  const [comparison, setComparison] = useState<InspectionComparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [onlyChanges, setOnlyChanges] = useState(false);

  // Review states
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [editingNotesItemId, setEditingNotesItemId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');

  // Photo viewer modal
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; caption?: string } | null>(null);

  // PDF Generation State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfOnlyChanges, setPdfOnlyChanges] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchComparisonDetails(comparisonId);
      if (!data) {
        setErrorMessage('Comparação não encontrada ou acesso negado.');
      } else {
        setComparison(data);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao carregar comparação.');
    } finally {
      setIsLoading(false);
    }
  }, [comparisonId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  // Review de Item
  const handleReviewItem = async (itemId: string, status: ComparisonReviewStatus, notes?: string) => {
    if (comparison?.status === 'FINALIZED') {
      alert('Comparação finalizada não pode ser alterada. Reabra-a se for gerente.');
      return;
    }

    setUpdatingItemId(itemId);
    try {
      const res = await reviewComparisonItem(itemId, status, notes);
      if (!res.success) {
        alert(res.error || 'Erro ao registrar revisão.');
      } else {
        // Atualiza localmente
        setComparison((prev) => {
          if (!prev || !prev.items) return prev;
          return {
            ...prev,
            items: prev.items.map((i) => 
              i.id === itemId 
                ? { ...i, review_status: status, reviewer_notes: notes !== undefined ? notes : i.reviewer_notes }
                : i
            ),
          };
        });
        setEditingNotesItemId(null);
      }
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Finalizar Comparação (Bloqueio estrito se houver itens pendentes)
  const handleFinalize = async () => {
    if (!comparison) return;

    // Verificar se há itens com revisão pendente
    const pendingCount = comparison.items?.filter((i) => i.review_status === 'PENDING').length || 0;

    if (pendingCount > 0) {
      alert(`Não é permitido finalizar a comparação. Existem ${pendingCount} item(ns) com revisão pericial pendente. Todos os itens devem ser homologados antes da finalização.`);
      setFilterType('PENDING');
      return;
    }

    if (!window.confirm('Confirma a finalização desta comparação? Após finalizada, todas as revisões serão congeladas em snapshot pericial imutável.')) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await finalizeComparison(comparison.id);
      if (!res.success) {
        alert(res.error || 'Erro ao finalizar comparação.');
      } else {
        setSuccessMessage('Comparação finalizada com sucesso! Snapshot imutável gerado.');
        await loadDetails();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Reabrir Comparação (Gerente apenas)
  const handleReopen = async () => {
    if (!comparison) return;
    if (!isCompanyManager) {
      alert('Apenas gerentes podem reabrir comparações finalizadas.');
      return;
    }

    if (!window.confirm('Deseja reabrir esta comparação para edição pericial?')) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await reopenComparison(comparison.id);
      if (!res.success) {
        alert(res.error || 'Erro ao reabrir comparação.');
      } else {
        setSuccessMessage('Comparação reaberta para revisão.');
        await loadDetails();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Emitir PDF
  const handleGeneratePdf = async (filterOnlyChanges: boolean) => {
    if (!comparison) return;
    setIsGeneratingPdf(true);
    try {
      const { doc } = await generateOfficialComparisonPdf(comparison, filterOnlyChanges);

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfOnlyChanges(filterOnlyChanges);
      setPdfModalOpen(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao compilar laudo PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Itens filtrados
  const filteredItems = (comparison?.items || []).filter((item) => {
    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchRoom = item.room_name.toLowerCase().includes(term);
      const matchItem = item.item_name.toLowerCase().includes(term);
      const matchSummary = item.ai_summary?.toLowerCase().includes(term);
      if (!matchRoom && !matchItem && !matchSummary) return false;
    }

    // Apenas alterações
    if (onlyChanges && item.change_type === 'UNCHANGED') {
      return false;
    }

    // Filtro por tipo
    if (filterType !== 'ALL') {
      if (filterType === 'CHANGES' && item.change_type === 'UNCHANGED') return false;
      if (filterType === 'PENDING' && item.review_status !== 'PENDING') return false;
      if (filterType === item.change_type) return true;
      if (filterType !== 'CHANGES' && filterType !== 'PENDING' && item.change_type !== filterType) return false;
    }

    return true;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'FINALIZED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            FINALIZADA
          </span>
        );
      case 'READY_FOR_REVIEW':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            PRONTA PARA REVISÃO
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            REVISADA
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700 border border-slate-300">
            {st}
          </span>
        );
    }
  };

  if (isLoading && !comparison) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Carregando dados da comparação...
        </p>
      </div>
    );
  }

  if (errorMessage && !comparison) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-rose-200 shadow-sm text-center space-y-4 font-sans">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-black text-slate-900">Falha ao abrir comparação</h3>
        <p className="text-xs text-rose-600">{errorMessage}</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors"
        >
          Voltar
        </button>
      </div>
    );
  }

  const summary = comparison?.summary_json || {
    total_rooms: 0,
    total_items: 0,
    unchanged: 0,
    worsened: 0,
    improved: 0,
    repairs_added: 0,
    repairs_removed: 0,
    items_added: 0,
    items_removed: 0,
    manual_review_required: 0,
  };

  const isFinalized = comparison?.status === 'FINALIZED';

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-600 selection:text-white pb-16">
      
      {/* Top Sticky Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
              title="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
                  <GitCompare className="w-3.5 h-3.5" />
                  Laudo Comparativo Entrada × Saída
                </span>
                {getStatusBadge(comparison?.status || 'DRAFT')}
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                  v{comparison?.version}
                </span>
              </div>
              <h1 className="text-base font-black text-slate-900 mt-0.5">
                {comparison?.property?.street}{comparison?.property?.number ? `, ${comparison?.property?.number}` : ''}
                {comparison?.property?.complement ? ` - ${comparison?.property?.complement}` : ''}
              </h1>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            
            {/* PDF Report Dropdown / Button */}
            <div className="flex rounded-xl shadow-sm border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => handleGeneratePdf(false)}
                disabled={isGeneratingPdf}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 text-blue-600" />}
                <span>Laudo Completo PDF</span>
              </button>
              <button
                onClick={() => handleGeneratePdf(true)}
                disabled={isGeneratingPdf}
                className="px-3 py-2 text-[11px] font-bold text-blue-700 bg-blue-50/50 hover:bg-blue-100 border-l border-slate-200 transition-colors"
                title="Gerar PDF apenas com as alterações identificadas"
              >
                Apenas Alterações
              </button>
            </div>

            {/* Finalize button */}
            {!isFinalized && (isCompanyManager || isInspector) && (
              <button
                onClick={handleFinalize}
                disabled={comparison?.items?.some((i) => i.review_status === 'PENDING')}
                title={
                  comparison?.items?.some((i) => i.review_status === 'PENDING')
                    ? 'A comparação não pode ser finalizada enquanto houver itens pendentes de revisão.'
                    : 'Finalizar e homologar comparação pericial'
                }
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
                  comparison?.items?.some((i) => i.review_status === 'PENDING')
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {comparison?.items?.filter((i) => i.review_status === 'PENDING').length
                    ? `Revisão Incompleta (${comparison.items.filter((i) => i.review_status === 'PENDING').length} pendente)`
                    : 'Finalizar Comparação'}
                </span>
              </button>
            )}

            {/* Reopen button (Manager only) */}
            {isFinalized && isCompanyManager && (
              <button
                onClick={handleReopen}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Reabrir para Revisão</span>
              </button>
            )}

          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Success Alert */}
        {successMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Pending Items Warning Banner */}
        {!isFinalized && (comparison?.items?.filter((i) => i.review_status === 'PENDING').length || 0) > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-bold">Revisão Pericial Incompleta</p>
                <p className="text-amber-800 text-[11px] mt-0.5">
                  Existem <strong>{comparison?.items?.filter((i) => i.review_status === 'PENDING').length} item(ns) pendente(s) de revisão</strong>. A comparação só poderá ser finalizada após a homologação pericial de todos os itens.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setFilterType('PENDING');
                setSearchTerm('');
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
            >
              Revisar Pendências ({comparison?.items?.filter((i) => i.review_status === 'PENDING').length})
            </button>
          </div>
        )}

        {/* Disclaimer Card */}
        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 text-blue-900 flex items-start gap-3 text-xs">
          <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-black">Sistema Assistivo de Comparação Pericial</p>
            <p className="text-blue-800/90 text-[11px] leading-relaxed">
              O Vistoria YZZY realiza o confronto de dados de forma <strong>estritamente objetiva e factual</strong>. A plataforma não atribui nexo de causalidade ou responsabilidade jurídica (como dano causado por locatário ou mau uso). Toda divergência identificada deve ser validada pelo vistoriador ou gerente responsável.
            </p>
          </div>
        </div>

        {/* Inspections Header Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Check-In Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600" />
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 uppercase tracking-wider">
                Vistoria de Entrada (Referência)
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {comparison?.check_in_inspection?.inspection_date ? new Date(comparison.check_in_inspection.inspection_date).toLocaleDateString('pt-BR') : 'N/A'}
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900">
              Vistoria Inicial de Locação
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Registro base de entrega das chaves e estado inicial do imóvel.
            </p>
          </div>

          {/* Check-Out Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600" />
            <div className="flex items-center justify-between mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 uppercase tracking-wider">
                Vistoria de Saída (Atual)
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {comparison?.check_out_inspection?.inspection_date ? new Date(comparison.check_out_inspection.inspection_date).toLocaleDateString('pt-BR') : 'N/A'}
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900">
              Vistoria Final de Devolução
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              Registro atual de devolução de chaves e encerramento de contrato.
            </p>
          </div>

        </div>

        {/* Dashboard Quantitative Summary KPIs */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Painel Resumo da Comparação
            </h2>
            <span className="text-xs text-slate-500">
              {summary.total_rooms} cômodos • {summary.total_items} itens mapeados
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sem Alteração</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">{summary.unchanged}</span>
              <span className="text-[10px] text-slate-400">Itens idênticos</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Condição Piorou</span>
              <span className="text-xl font-black text-rose-700 mt-1 block">{summary.worsened}</span>
              <span className="text-[10px] text-rose-600">Queda de estado</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Condição Melhorou</span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">{summary.improved}</span>
              <span className="text-[10px] text-emerald-600">Reformas/Melhorias</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Novos Reparos</span>
              <span className="text-xl font-black text-amber-700 mt-1 block">{summary.repairs_added}</span>
              <span className="text-[10px] text-amber-600">Marcados para conserto</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Novos / Removidos</span>
              <span className="text-xl font-black text-indigo-700 mt-1 block">
                +{summary.items_added} / -{summary.items_removed}
              </span>
              <span className="text-[10px] text-indigo-600">Divergência cadastral</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Revisão Manual</span>
              <span className="text-xl font-black text-purple-700 mt-1 block">{summary.manual_review_required}</span>
              <span className="text-[10px] text-purple-600">Itens ambíguos</span>
            </div>

          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar ambiente ou item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap w-full md:w-auto justify-between md:justify-end">
            
            {/* Quick Filter Type */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="ALL">Todos os Itens ({comparison?.items?.length || 0})</option>
                <option value="CHANGES">Somente com Alterações</option>
                <option value="CONDITION_WORSENED">Piora de Condição</option>
                <option value="CONDITION_IMPROVED">Melhora de Condição</option>
                <option value="REPAIR_ADDED">Novos Reparos Necessários</option>
                <option value="ITEM_ADDED">Itens Adicionados</option>
                <option value="ITEM_REMOVED">Itens Removidos</option>
                <option value="PENDING">Pendentes de Revisão</option>
              </select>
            </div>

            {/* Toggle Only Changes */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                checked={onlyChanges}
                onChange={(e) => setOnlyChanges(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Ocultar "Sem Alteração"</span>
            </label>

          </div>
        </div>

        {/* List of Compared Items */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Itens Comparados ({filteredItems.length})
            </h3>
            <span className="text-xs text-slate-400">
              Lado a lado: Entrada (Check-In) × Saída (Check-Out)
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">Nenhum item corresponde aos filtros selecionados.</p>
              <p className="text-xs">Altere a busca ou redefina os filtros acima para visualizar os demais itens.</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const changeInfo = COMPARISON_CHANGE_LABELS[item.change_type] || {
                label: item.change_type,
                color: 'text-slate-700',
                badgeBg: 'bg-slate-100 border-slate-200',
              };

              const isItemFinalized = isFinalized;
              const isPending = item.review_status === 'PENDING';
              const isConfirmed = item.review_status === 'CONFIRMED';
              const isDismissed = item.review_status === 'DISMISSED';
              const isEdited = item.review_status === 'EDITED';

              return (
                <div 
                  key={item.id}
                  className={`bg-white rounded-3xl border shadow-sm transition-all overflow-hidden ${
                    item.change_type === 'CONDITION_WORSENED' || item.change_type === 'REPAIR_ADDED'
                      ? 'border-amber-200/80 hover:border-amber-300'
                      : item.change_type === 'UNCHANGED'
                      ? 'border-slate-200 hover:border-slate-300'
                      : 'border-blue-200/80 hover:border-blue-300'
                  }`}
                >
                  {/* Item Header */}
                  <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                          {item.room_name}
                        </span>
                        <h4 className="text-sm font-black text-slate-900">
                          {item.item_name}
                        </h4>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${changeInfo.badgeBg} ${changeInfo.color}`}>
                          {changeInfo.label}
                        </span>
                        {item.match_method === 'MANUAL' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                            Match Manual
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Review Badge */}
                    <div className="flex items-center gap-2">
                      {isConfirmed && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Alteração Confirmada
                        </span>
                      )}
                      {isDismissed && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Sem Alteração Relevante
                        </span>
                      )}
                      {isEdited && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 flex items-center gap-1">
                          <Edit3 className="w-3 h-3" />
                          Ajustado Manualmente
                        </span>
                      )}
                      {isPending && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Pendente de Revisão
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Item Content: Side by Side on Desktop / Responsive on Mobile */}
                  <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                    
                    {/* ENTRADA (CHECK-IN) */}
                    <div className="space-y-3 md:pr-4">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-600" />
                          Vistoria de Entrada
                        </span>
                        {item.previous_condition ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {ITEM_CONDITION_LABELS[item.previous_condition as keyof typeof ITEM_CONDITION_LABELS] || item.previous_condition}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Não existente na entrada</span>
                        )}
                      </div>

                      {/* Reparo na Entrada */}
                      {item.previous_requires_repair && (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Reparo Solicitado na Entrada
                        </span>
                      )}

                      {/* Descrição na Entrada */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Descrição Registrada</span>
                        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[48px] leading-relaxed">
                          {item.previous_description || <span className="text-slate-400 italic">Sem descrição registrada na entrada.</span>}
                        </p>
                      </div>

                      {/* Fotos da Entrada */}
                      {item.check_in_photos && item.check_in_photos.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                            Fotos de Entrada ({item.check_in_photos.length})
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {item.check_in_photos.map((ph) => (
                              <button
                                key={ph.id}
                                onClick={() => setSelectedPhoto({ url: ph.signed_url || '', caption: ph.caption || `${item.room_name} - ${item.item_name} (Entrada)` })}
                                className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-blue-500 shrink-0 relative group"
                              >
                                {ph.signed_url ? (
                                  <img src={ph.signed_url} alt="Foto Entrada" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SAÍDA (CHECK-OUT) */}
                    <div className="space-y-3 pt-4 md:pt-0 md:pl-4">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-indigo-600" />
                          Vistoria de Saída
                        </span>
                        {item.current_condition ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            {ITEM_CONDITION_LABELS[item.current_condition as keyof typeof ITEM_CONDITION_LABELS] || item.current_condition}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Não existente na saída</span>
                        )}
                      </div>

                      {/* Reparo na Saída */}
                      {item.current_requires_repair && (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          Reparo Necessário na Saída
                        </span>
                      )}

                      {/* Descrição na Saída */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Descrição Registrada</span>
                        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[48px] leading-relaxed">
                          {item.current_description || <span className="text-slate-400 italic">Sem descrição registrada na saída.</span>}
                        </p>
                      </div>

                      {/* Fotos da Saída */}
                      {item.check_out_photos && item.check_out_photos.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5">
                            Fotos de Saída ({item.check_out_photos.length})
                          </span>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {item.check_out_photos.map((ph) => (
                              <button
                                key={ph.id}
                                onClick={() => setSelectedPhoto({ url: ph.signed_url || '', caption: ph.caption || `${item.room_name} - ${item.item_name} (Saída)` })}
                                className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-indigo-500 shrink-0 relative group"
                              >
                                {ph.signed_url ? (
                                  <img src={ph.signed_url} alt="Foto Saída" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <ImageIcon className="w-4 h-4" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Assistive Summary Box */}
                  {item.ai_summary && (
                    <div className="px-5 py-3.5 bg-blue-50/40 border-t border-slate-100 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5 w-full">
                        <span className="text-[10px] font-bold uppercase text-blue-700 block">
                          Resumo Assistivo de Divergências
                        </span>
                        <p className="text-slate-700 leading-relaxed">
                          {item.ai_summary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reviewer Notes (if any) */}
                  {item.reviewer_notes && (
                    <div className="px-5 py-2.5 bg-amber-50/50 border-t border-slate-100 text-xs text-amber-900 flex items-center gap-2">
                      <Edit3 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span><strong>Nota do Revisor:</strong> {item.reviewer_notes}</span>
                    </div>
                  )}

                  {/* Action Bar for Reviewer (if not finalized and user has permission) */}
                  {!isItemFinalized && (isCompanyManager || isInspector) && (
                    <div className="p-3.5 sm:px-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {editingNotesItemId === item.id ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="text"
                            placeholder="Adicione observação pericial para este item..."
                            value={tempNotes}
                            onChange={(e) => setTempNotes(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                          />
                          <button
                            onClick={() => handleReviewItem(item.id, 'EDITED', tempNotes)}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingNotesItemId(null)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Ação do Vistoriador / Gerente:
                          </span>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              disabled={updatingItemId === item.id}
                              onClick={() => handleReviewItem(item.id, 'CONFIRMED')}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirmar Alteração</span>
                            </button>

                            <button
                              disabled={updatingItemId === item.id}
                              onClick={() => handleReviewItem(item.id, 'DISMISSED')}
                              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Sem Alteração Relevante</span>
                            </button>

                            <button
                              disabled={updatingItemId === item.id}
                              onClick={() => {
                                setEditingNotesItemId(item.id);
                                setTempNotes(item.reviewer_notes || '');
                              }}
                              className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-white text-slate-700 font-bold text-xs flex items-center gap-1 transition-all"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Anotação Pericial</span>
                            </button>
                          </div>
                        </>
                      )}

                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

      </main>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <PhotoViewerModal
          isOpen={true}
          onClose={() => setSelectedPhoto(null)}
          photoUrl={selectedPhoto.url}
          caption={selectedPhoto.caption}
        />
      )}

      {/* PDF Modal Preview */}
      {pdfModalOpen && pdfUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900">
                  Laudo Comparativo Oficial ({pdfOnlyChanges ? 'Apenas Alterações' : 'Completo'})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfUrl}
                  download={`laudo-comparativo-${comparison?.id}.pdf`}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors"
                >
                  Baixar PDF
                </a>
                <button
                  onClick={() => setPdfModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-200">
              <iframe
                src={pdfUrl}
                title="Visualização do Laudo Comparativo"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
