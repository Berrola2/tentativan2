import React, { useState, useEffect, useCallback } from 'react';
import { 
  GitCompare, 
  Building, 
  ArrowRight, 
  ArrowLeft,
  Calendar, 
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { fetchProperties } from '../../services/properties';
import { fetchInspections } from '../../services/inspections';
import { createAndProcessComparison } from '../../services/comparisons';
import type { Property, Inspection } from '../../types/inspection';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { Skeleton } from '../ui/Skeleton';

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
      } catch {
        setErrorMessage('Não foi possível carregar a lista de imóveis.');
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
    } catch {
      setErrorMessage('Não foi possível carregar as vistorias do imóvel selecionado.');
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
      await new Promise(r => setTimeout(r, 500));

      setProcessingStage('Comparando estados de conservação e itens...');
      await new Promise(r => setTimeout(r, 500));

      setProcessingStage('Sintetizando histórico descritivo pericial...');
      
      const res = await createAndProcessComparison(selectedCheckIn.id, selectedCheckOut.id);
      
      if (!res.success || !res.comparisonId) {
        setErrorMessage(res.error || 'Não foi possível concluir a comparação automática.');
        setIsProcessing(false);
        return;
      }

      setProcessingStage('Confronto pericial concluído com sucesso!');
      await new Promise(r => setTimeout(r, 400));
      onComparisonCreated(res.comparisonId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha no processamento do confronto.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-modal max-w-2xl w-full p-5 sm:p-7 shadow-floating border border-yzzy-border space-y-5 animate-scaleIn max-h-[92vh] flex flex-col my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-yzzy-border/60 shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-btn bg-primary-50 text-primary-700 flex items-center justify-center font-bold">
                <GitCompare className="w-4 h-4 text-primary-600" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-yzzy-text-primary">
                Nova Comparação Entrada × Saída
              </h2>
            </div>
            <p className="text-xs text-yzzy-text-secondary pl-10">
              Confronto assistivo e identificação de divergências no imóvel
            </p>
          </div>

          {!isProcessing && (
            <button 
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-btn text-yzzy-text-muted hover:text-yzzy-text-primary hover:bg-surface-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Stepper Progress */}
        {!isProcessing && (
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold shrink-0">
            <div className={`p-2 rounded-btn border transition-all ${
              step === 1 ? 'bg-primary-50 border-primary-200 text-primary-700 font-bold' : selectedProperty ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-surface-secondary border-yzzy-border text-yzzy-text-muted'
            }`}>
              1. Imóvel
            </div>
            <div className={`p-2 rounded-btn border transition-all ${
              step === 2 ? 'bg-primary-50 border-primary-200 text-primary-700 font-bold' : selectedCheckIn ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-surface-secondary border-yzzy-border text-yzzy-text-muted'
            }`}>
              2. Entrada
            </div>
            <div className={`p-2 rounded-btn border transition-all ${
              step === 3 ? 'bg-primary-50 border-primary-200 text-primary-700 font-bold' : selectedCheckOut ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-surface-secondary border-yzzy-border text-yzzy-text-muted'
            }`}>
              3. Saída
            </div>
            <div className={`p-2 rounded-btn border transition-all ${
              step === 4 ? 'bg-primary-50 border-primary-200 text-primary-700 font-bold' : 'bg-surface-secondary border-yzzy-border text-yzzy-text-muted'
            }`}>
              4. Confirmar
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <Alert type="error">
            <span>{errorMessage}</span>
          </Alert>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1">
          
          {/* State: Processing Animation */}
          {isProcessing ? (
            <div className="py-12 px-4 text-center space-y-4">
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-yzzy-text-primary">Processando Confronto Pericial</h4>
                <p className="text-xs text-primary-600 font-semibold animate-pulse">{processingStage}</p>
              </div>
              <p className="text-[11px] text-yzzy-text-muted max-w-sm mx-auto">
                Mapeando ambientes, avaliando variações de conservação dos itens e preparando painel de laudo comparativo.
              </p>
            </div>
          ) : (
            <>
              {/* STEP 1: Selecionar Imóvel */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-yzzy-text-secondary">
                      Selecione o Imóvel
                    </h4>
                    <span className="text-[11px] text-yzzy-text-muted font-semibold">
                      {properties.length} imóvel(is) ativo(s)
                    </span>
                  </div>

                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14 w-full rounded-card" />
                      <Skeleton className="h-14 w-full rounded-card" />
                    </div>
                  ) : properties.length === 0 ? (
                    <div className="p-8 text-center text-yzzy-text-muted border border-dashed border-yzzy-border rounded-card">
                      Nenhum imóvel ativo cadastrado.
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {properties.map((prop) => (
                        <div
                          key={prop.id}
                          onClick={() => handleSelectProperty(prop)}
                          className="p-3.5 rounded-card border border-yzzy-border hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-btn bg-surface-secondary flex items-center justify-center text-yzzy-text-secondary group-hover:bg-primary-600 group-hover:text-white transition-colors shrink-0">
                              <Building className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-yzzy-text-primary truncate">
                                {prop.street}{prop.number ? `, ${prop.number}` : ''}
                              </p>
                              <p className="text-[11px] text-yzzy-text-muted truncate">
                                {prop.neighborhood ? `${prop.neighborhood}, ` : ''}{prop.city} - {prop.state}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-yzzy-text-muted group-hover:text-primary-600 transition-colors shrink-0" />
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
                      <h4 className="text-xs font-bold uppercase tracking-wider text-yzzy-text-secondary">
                        Vistoria de Entrada (Check-In)
                      </h4>
                      <p className="text-[11px] text-yzzy-text-muted mt-0.5 font-semibold">
                        {selectedProperty?.street}, {selectedProperty?.number}
                      </p>
                    </div>
                    {!initialPropertyId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setStep(1)}
                        className="text-xs font-bold"
                      >
                        Trocar Imóvel
                      </Button>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14 w-full rounded-card" />
                    </div>
                  ) : checkInInspections.length === 0 ? (
                    <div className="p-6 text-center text-yzzy-text-muted border border-dashed border-amber-200 bg-amber-50/40 rounded-card space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                      <p className="text-xs font-bold text-slate-800">
                        Nenhuma Vistoria de Entrada concluída encontrada.
                      </p>
                      <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                        Para realizar a comparação pericial, o imóvel precisa de uma Vistoria de Entrada homologada (Concluída).
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {checkInInspections.map((insp) => (
                        <div
                          key={insp.id}
                          onClick={() => handleSelectCheckIn(insp)}
                          className={`p-3.5 rounded-card border cursor-pointer transition-all flex items-center justify-between ${
                            selectedCheckIn?.id === insp.id
                              ? 'border-primary-600 bg-primary-50/60 shadow-xs'
                              : 'border-yzzy-border hover:border-primary-300 hover:bg-surface-secondary/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="primary" size="sm">ENTRADA</Badge>
                            <div>
                              <p className="text-xs font-bold text-yzzy-text-primary">{insp.title}</p>
                              <p className="text-[11px] text-yzzy-text-muted flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                <span>{insp.inspection_date ? new Date(insp.inspection_date).toLocaleDateString('pt-BR') : new Date(insp.created_at).toLocaleDateString('pt-BR')}</span>
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-yzzy-text-muted" />
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
                      <h4 className="text-xs font-bold uppercase tracking-wider text-yzzy-text-secondary">
                        Vistoria de Saída (Check-Out)
                      </h4>
                      <p className="text-[11px] text-primary-700 mt-0.5 font-semibold">
                        Entrada vinculada: {selectedCheckIn?.title}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep(2)}
                      className="text-xs font-bold"
                    >
                      Trocar Entrada
                    </Button>
                  </div>

                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14 w-full rounded-card" />
                    </div>
                  ) : checkOutInspections.length === 0 ? (
                    <div className="p-6 text-center text-yzzy-text-muted border border-dashed border-amber-200 bg-amber-50/40 rounded-card space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                      <p className="text-xs font-bold text-slate-800">
                        Nenhuma Vistoria de Saída concluída encontrada.
                      </p>
                      <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
                        Finalize a Vistoria de Saída deste imóvel antes de iniciar o confronto pericial.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {checkOutInspections.map((insp) => (
                        <div
                          key={insp.id}
                          onClick={() => handleSelectCheckOut(insp)}
                          className={`p-3.5 rounded-card border cursor-pointer transition-all flex items-center justify-between ${
                            selectedCheckOut?.id === insp.id
                              ? 'border-amber-600 bg-amber-50/60 shadow-xs'
                              : 'border-yzzy-border hover:border-amber-300 hover:bg-surface-secondary/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="warning" size="sm">SAÍDA</Badge>
                            <div>
                              <p className="text-xs font-bold text-yzzy-text-primary">{insp.title}</p>
                              <p className="text-[11px] text-yzzy-text-muted flex items-center gap-1.5 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                <span>{insp.inspection_date ? new Date(insp.inspection_date).toLocaleDateString('pt-BR') : new Date(insp.created_at).toLocaleDateString('pt-BR')}</span>
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-yzzy-text-muted" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 4: Confirmação e Início */}
              {step === 4 && selectedCheckIn && selectedCheckOut && (
                <div className="space-y-4 py-1">
                  <div className="p-4 bg-surface-secondary border border-yzzy-border rounded-card space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-yzzy-text-secondary">
                      Resumo do Confronto Pericial
                    </h4>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-btn bg-white border border-yzzy-border">
                        <span className="font-semibold text-yzzy-text-secondary">Imóvel</span>
                        <span className="font-bold text-yzzy-text-primary">{selectedProperty?.street}, {selectedProperty?.number}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-btn bg-primary-50/50 border border-primary-100">
                        <span className="font-semibold text-primary-800">1. Vistoria de Entrada</span>
                        <span className="font-bold text-primary-900">{selectedCheckIn.title}</span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-btn bg-amber-50/50 border border-amber-100">
                        <span className="font-semibold text-amber-800">2. Vistoria de Saída</span>
                        <span className="font-bold text-amber-900">{selectedCheckOut.title}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-yzzy-text-muted leading-relaxed">
                    Ao confirmar, o sistema comparará todos os ambientes e itens de forma determinística, mapeando estados de conservação, novas avarias e alterações descritivas para revisão pericial.
                  </p>

                  <div className="pt-3 flex gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setStep(3)}
                      leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                      className="w-1/3 text-xs font-bold"
                    >
                      Voltar
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={handleStartComparison}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      className="w-2/3 text-xs font-bold shadow-xs hover:shadow-subtle-blue"
                    >
                      Iniciar Comparação
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

      </div>
    </div>
  );
};
