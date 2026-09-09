import React, { useState, useEffect, useCallback } from 'react';
import { 
  GitCompare, 
  XCircle, 
  Building, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  Sparkles,
  Info
} from 'lucide-react';
import { fetchProperties } from '../../services/properties';
import { fetchInspections } from '../../services/inspections';
import { createAndProcessComparison } from '../../services/comparisons';
import type { Property, Inspection } from '../../types/inspection';

interface ComparisonWizardModalProps {
  onClose: () => void;
  onComparisonCreated: (comparisonId: string) => void;
  initialPropertyId?: string;
}

export const ComparisonWizardModal: React.FC<ComparisonWizardModalProps> = ({
  onClose,
  onComparisonCreated,
  initialPropertyId,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialPropertyId ? 2 : 1);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedCheckIn, setSelectedCheckIn] = useState<Inspection | null>(null);
  const [selectedCheckOut, setSelectedCheckOut] = useState<Inspection | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Carregar propriedades se não houver selecionada
  useEffect(() => {
    async function loadProps() {
      setIsLoading(true);
      try {
        const props = await fetchProperties();
        setProperties(props.filter(p => p.active));
        if (initialPropertyId) {
          const found = props.find(p => p.id === initialPropertyId);
          if (found) {
            setSelectedProperty(found);
          }
        }
      } catch (err: unknown) {
        setErrorMessage('Erro ao carregar lista de imóveis.');
      } finally {
        setIsLoading(false);
      }
    }
    loadProps();
  }, [initialPropertyId]);

  // Carregar vistorias concluídas quando selecionar propriedade
  const loadPropertyInspections = useCallback(async (propId: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchInspections({ propertyId: propId });
      // Apenas vistorias COMPLETED
      const completed = data.filter(i => i.status === 'COMPLETED');
      setInspections(completed);
    } catch (err: unknown) {
      setErrorMessage('Erro ao carregar vistorias do imóvel selecionado.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      loadPropertyInspections(selectedProperty.id);
    }
  }, [selectedProperty, loadPropertyInspections]);

  // Vistorias filtradas por tipo
  const checkInInspections = inspections.filter(i => i.inspection_type === 'CHECK_IN');
  const checkOutInspections = inspections.filter(i => i.inspection_type === 'CHECK_OUT');

  const handleSelectProperty = (prop: Property) => {
    setSelectedProperty(prop);
    setSelectedCheckIn(null);
    setSelectedCheckOut(null);
    setStep(2);
  };

  const handleSelectCheckIn = (insp: Inspection) => {
    setSelectedCheckIn(insp);
    setStep(3);
  };

  const handleSelectCheckOut = (insp: Inspection) => {
    setSelectedCheckOut(insp);
    setStep(4);
  };

  const handleStartComparison = async () => {
    if (!selectedCheckIn || !selectedCheckOut) {
      setErrorMessage('Selecione ambas as vistorias de Entrada e Saída.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      setProcessingStage('Normalizando nomes de ambientes e cômodos...');
      await new Promise(r => setTimeout(r, 600));

      setProcessingStage('Comparando estados de conservação e itens...');
      await new Promise(r => setTimeout(r, 600));

      setProcessingStage('Sintetizando histórico descritivo...');
      
      const res = await createAndProcessComparison(selectedCheckIn.id, selectedCheckOut.id);
      
      if (!res.success || !res.comparisonId) {
        setErrorMessage(res.error || 'Falha ao processar comparação automática.');
        setIsProcessing(false);
        return;
      }

      setProcessingStage('Comparação concluída com sucesso!');
      await new Promise(r => setTimeout(r, 400));
      onComparisonCreated(res.comparisonId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro no processamento.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Nova Comparação Entrada × Saída
              </h3>
              <p className="text-xs text-slate-500">
                Identificação automática e assistiva de alterações no imóvel
              </p>
            </div>
          </div>
          
          {!isProcessing && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Steps Progress Indicator */}
        {!isProcessing && (
          <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
            <div className={`p-2 rounded-xl border ${step === 1 ? 'bg-blue-50 border-blue-200 text-blue-700' : selectedProperty ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              1. Imóvel
            </div>
            <div className={`p-2 rounded-xl border ${step === 2 ? 'bg-blue-50 border-blue-200 text-blue-700' : selectedCheckIn ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              2. Entrada
            </div>
            <div className={`p-2 rounded-xl border ${step === 3 ? 'bg-blue-50 border-blue-200 text-blue-700' : selectedCheckOut ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              3. Saída
            </div>
            <div className={`p-2 rounded-xl border ${step === 4 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
              4. Confirmar
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Processing State with Animated Feedback */}
        {isProcessing ? (
          <div className="py-12 px-4 text-center space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 animate-spin text-blue-600" />
              <Sparkles className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900">Processando Comparação</h4>
              <p className="text-xs text-blue-600 font-medium mt-1 animate-pulse">{processingStage}</p>
            </div>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Realizando match de ambientes, mapeando conservação de itens e preparando painel de revisão pericial.
            </p>
          </div>
        ) : (
          <>
            {/* STEP 1: Selecionar Imóvel */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Selecione o Imóvel
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {properties.length} imóvel(is) disponível(is)
                  </span>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs">Carregando imóveis...</span>
                  </div>
                ) : properties.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                    Nenhum imóvel ativo cadastrado.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {properties.map((prop) => (
                      <div
                        key={prop.id}
                        onClick={() => handleSelectProperty(prop)}
                        className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Building className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {prop.street}{prop.number ? `, ${prop.number}` : ''}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {prop.neighborhood ? `${prop.neighborhood}, ` : ''}{prop.city} - {prop.state}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Selecionar Vistoria de Entrada */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Vistoria de Entrada (Check-In)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedProperty?.street}, {selectedProperty?.number}
                    </p>
                  </div>
                  {!initialPropertyId && (
                    <button
                      onClick={() => setStep(1)}
                      className="text-xs text-blue-600 hover:underline font-bold"
                    >
                      Trocar Imóvel
                    </button>
                  )}
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs">Buscando vistorias de entrada...</span>
                  </div>
                ) : checkInInspections.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                    <p className="text-xs font-bold text-slate-800">
                      Nenhuma Vistoria de Entrada concluída encontrada.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      É necessário que a vistoria de entrada esteja com status CONCLUÍDA (COMPLETED) para permitir a comparação.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {checkInInspections.map((insp) => (
                      <div
                        key={insp.id}
                        onClick={() => handleSelectCheckIn(insp)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          selectedCheckIn?.id === insp.id
                            ? 'border-blue-600 bg-blue-50/70'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
                            IN
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{insp.title}</p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{new Date(insp.inspection_date).toLocaleDateString('pt-BR')}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                CONCLUÍDA
                              </span>
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Selecionar Vistoria de Saída */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Vistoria de Saída (Check-Out)
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Entrada selecionada: {selectedCheckIn?.title}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    Voltar
                  </button>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-xs">Buscando vistorias de saída...</span>
                  </div>
                ) : checkOutInspections.length === 0 ? (
                  <div className="p-6 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl space-y-2">
                    <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                    <p className="text-xs font-bold text-slate-800">
                      Nenhuma Vistoria de Saída concluída encontrada.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Para realizar o comparativo, é obrigatório haver uma Vistoria de Saída concluída no mesmo imóvel.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {checkOutInspections.map((insp) => (
                      <div
                        key={insp.id}
                        onClick={() => handleSelectCheckOut(insp)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                          selectedCheckOut?.id === insp.id
                            ? 'border-indigo-600 bg-indigo-50/70'
                            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                            OUT
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{insp.title}</p>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{new Date(insp.inspection_date).toLocaleDateString('pt-BR')}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                CONCLUÍDA
                              </span>
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Confirmação e Disparo */}
            {step === 4 && selectedCheckIn && selectedCheckOut && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Resumo da Comparação
                </h4>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-500">Imóvel:</span>
                    <span className="font-bold text-slate-900">
                      {selectedProperty?.street}, {selectedProperty?.number}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-blue-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                        Vistoria de Entrada
                      </span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{selectedCheckIn.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(selectedCheckIn.inspection_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-indigo-200">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                        Vistoria de Saída
                      </span>
                      <p className="text-xs font-bold text-slate-900 mt-0.5">{selectedCheckOut.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(selectedCheckOut.inspection_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2 text-[11px] text-blue-900">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      A comparação é <strong>estritamente assistiva</strong> e factual. O sistema não atribui culpa ou responsabilidade jurídica causal. A conclusão pericial final é exclusiva do vistoriador ou gerente.
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                  >
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={handleStartComparison}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Iniciar Comparação Automática</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};
