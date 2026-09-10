import React, { useState } from 'react';
import { 
  Building, 
  FileText, 
  Calendar, 
  UserCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  X,
  ExternalLink
} from 'lucide-react';
import { PropertiesView } from '../properties/PropertiesView';
import { createInspection, DuplicateActiveCheckinError } from '../../services/inspections';
import type { Property, Inspection, InspectionType } from '../../types/inspection';
import { INSPECTION_TYPE_LABELS } from '../../types/inspection';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';

interface NewInspectionWizardProps {
  onClose: () => void;
  onInspectionCreated: (inspection: Inspection) => void;
}

export const NewInspectionWizard: React.FC<NewInspectionWizardProps> = ({
  onClose,
  onInspectionCreated,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Form State
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [inspectionType, setInspectionType] = useState<InspectionType>('CHECK_IN');
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateDetails, setDuplicateDetails] = useState<{
    activeInspectionId?: string;
    inspectorName?: string;
    inspectionStatus?: string;
  } | null>(null);

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    setDuplicateDetails(null);
    setErrorMessage(null);
    const prefix = inspectionType === 'CHECK_IN' ? 'Vistoria de Entrada' : 'Vistoria de Saída';
    const defaultTitle = `${prefix} - ${property.street}${property.number ? `, ${property.number}` : ''}`;
    setTitle(defaultTitle);
    setStep(2);
  };

  const handleSelectType = (type: InspectionType) => {
    setInspectionType(type);
    setDuplicateDetails(null);
    setErrorMessage(null);
    if (selectedProperty) {
      const prefix = type === 'CHECK_IN' ? 'Vistoria de Entrada' : 'Vistoria de Saída';
      const defaultTitle = `${prefix} - ${selectedProperty.street}${selectedProperty.number ? `, ${selectedProperty.number}` : ''}`;
      setTitle(defaultTitle);
    }
    setStep(3);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty) {
      setErrorMessage('Selecione um imóvel antes de continuar.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('O título da vistoria é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setDuplicateDetails(null);

    try {
      const created = await createInspection({
        property_id: selectedProperty.id,
        inspection_type: inspectionType,
        title: title.trim(),
        scheduled_date: scheduledDate || null,
        inspector_id: user?.id || null,
        notes: notes ? notes.trim() : null,
      });

      onInspectionCreated(created);
    } catch (err: unknown) {
      if (err instanceof DuplicateActiveCheckinError) {
        setDuplicateDetails({
          activeInspectionId: err.activeInspectionId,
          inspectorName: err.inspectorName,
          inspectionStatus: err.inspectionStatus,
        });
        setErrorMessage('Já existe uma vistoria de entrada ativa para este imóvel. Continue ou finalize a vistoria existente antes de iniciar outra.');
      } else {
        const msg = err instanceof Error ? err.message : 'Não foi possível concluir o agendamento da vistoria.';
        setErrorMessage(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-modal max-w-3xl w-full p-5 sm:p-7 shadow-floating border border-yzzy-border space-y-5 animate-scaleIn max-h-[92vh] flex flex-col my-auto">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-yzzy-border/60 shrink-0">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-btn bg-primary-50 text-primary-700 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4 text-primary-600" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-yzzy-text-primary">
                Nova Vistoria
              </h2>
            </div>
            <p className="text-xs text-yzzy-text-secondary pl-10">
              Passo {step} de 3 — {step === 1 ? 'Selecionar Imóvel' : step === 2 ? 'Tipo de Vistoria' : 'Informações e Responsável'}
            </p>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-btn text-yzzy-text-muted hover:text-yzzy-text-primary hover:bg-surface-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex items-center justify-center gap-2 shrink-0 py-1">
          <div className={`h-1.5 rounded-full transition-all ${step === 1 ? 'w-10 bg-primary-600' : 'w-3 bg-surface-secondary border border-yzzy-border'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step === 2 ? 'w-10 bg-primary-600' : 'w-3 bg-surface-secondary border border-yzzy-border'}`} />
          <div className={`h-1.5 rounded-full transition-all ${step === 3 ? 'w-10 bg-primary-600' : 'w-3 bg-surface-secondary border border-yzzy-border'}`} />
        </div>

        {/* Human Duplicate Checkin Alert (Rule 11) */}
        {duplicateDetails ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-btn space-y-3 shrink-0 animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-amber-900 text-sm">
                  Já existe uma vistoria de entrada ativa para este imóvel.
                </h4>
                <p className="text-amber-800 mt-1">
                  Continue ou finalize a vistoria existente antes de iniciar outra.
                </p>
                <div className="mt-2 text-[11px] text-amber-800/90 bg-amber-100/50 p-2 rounded-btn">
                  <p>• <strong>Responsável:</strong> {duplicateDetails.inspectorName || 'Vistoriador'}</p>
                  <p>• <strong>Status atual:</strong> {duplicateDetails.inspectionStatus || 'Em andamento'}</p>
                </div>
              </div>
            </div>

            {duplicateDetails.activeInspectionId && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  onInspectionCreated({ id: duplicateDetails.activeInspectionId } as any);
                }}
                leftIcon={<ExternalLink className="w-4 h-4" />}
                className="w-full font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border-amber-300"
              >
                Abrir vistoria de entrada existente
              </Button>
            )}
          </div>
        ) : errorMessage ? (
          <Alert type="error">
            <span>{errorMessage}</span>
          </Alert>
        ) : null}

        {/* Wizard Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          
          {/* PASSO 1: SELECIONAR IMÓVEL */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-yzzy-text-secondary">
                Selecione o imóvel onde a vistoria será realizada:
              </p>
              <PropertiesView 
                isSelectionMode={true} 
                onSelectPropertyForInspection={handleSelectProperty} 
              />
            </div>
          )}

          {/* PASSO 2: SELECIONAR TIPO DE VISTORIA */}
          {step === 2 && selectedProperty && (
            <div className="space-y-5 py-2">
              <div className="p-4 rounded-btn bg-primary-50/40 border border-primary-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-btn bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wider block">Imóvel Selecionado</span>
                    <p className="text-xs sm:text-sm font-bold text-yzzy-text-primary">
                      {selectedProperty.street}{selectedProperty.number ? `, ${selectedProperty.number}` : ''}
                    </p>
                    <p className="text-[11px] text-yzzy-text-secondary">
                      {selectedProperty.neighborhood ? `${selectedProperty.neighborhood}, ` : ''}{selectedProperty.city} - {selectedProperty.state}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="text-xs"
                >
                  Trocar
                </Button>
              </div>

              <div>
                <label className="block text-xs font-bold text-yzzy-text-secondary uppercase mb-3">
                  Selecione o Tipo de Vistoria *
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tipo: Entrada */}
                  <div
                    onClick={() => handleSelectType('CHECK_IN')}
                    className={`p-5 rounded-card border-2 cursor-pointer transition-all ${
                      inspectionType === 'CHECK_IN'
                        ? 'border-primary-600 bg-primary-50/30 shadow-subtle-blue'
                        : 'border-yzzy-border hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-btn bg-primary-100 text-primary-700 flex items-center justify-center font-bold mb-3">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-yzzy-text-primary">Vistoria de Entrada</h4>
                      <Badge variant="primary" size="sm">CHECK_IN</Badge>
                    </div>
                    <p className="text-xs text-yzzy-text-secondary mt-1.5 leading-relaxed">
                      Entrega de chaves e registro do estado inicial de conservação do imóvel.
                    </p>
                  </div>

                  {/* Tipo: Saída */}
                  <div
                    onClick={() => handleSelectType('CHECK_OUT')}
                    className={`p-5 rounded-card border-2 cursor-pointer transition-all ${
                      inspectionType === 'CHECK_OUT'
                        ? 'border-primary-600 bg-primary-50/30 shadow-subtle-blue'
                        : 'border-yzzy-border hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-btn bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-3">
                      <ArrowLeft className="w-5 h-5" />
                    </div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-yzzy-text-primary">Vistoria de Saída</h4>
                      <Badge variant="warning" size="sm">CHECK_OUT</Badge>
                    </div>
                    <p className="text-xs text-yzzy-text-secondary mt-1.5 leading-relaxed">
                      Devolução de chaves e verificação de divergências ou danos ao imóvel.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-start">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setStep(1)}
                  leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                  className="text-xs font-bold"
                >
                  Voltar para Imóveis
                </Button>
              </div>
            </div>
          )}

          {/* PASSO 3: DETALHES DA VISTORIA */}
          {step === 3 && selectedProperty && (
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="p-3.5 rounded-btn bg-surface-secondary border border-yzzy-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-btn bg-primary-600 text-white flex items-center justify-center font-bold text-xs">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-yzzy-text-muted uppercase tracking-wider block">
                      {INSPECTION_TYPE_LABELS[inspectionType]}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-yzzy-text-primary">
                      {selectedProperty.street}{selectedProperty.number ? `, ${selectedProperty.number}` : ''}
                    </h4>
                  </div>
                </div>
                <Badge variant={inspectionType === 'CHECK_IN' ? 'primary' : 'warning'} size="sm">
                  {inspectionType === 'CHECK_IN' ? 'Entrada' : 'Saída'}
                </Badge>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                  Título da Vistoria *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-xs sm:text-sm font-semibold text-yzzy-text-primary focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                    Data Agendada
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs font-semibold text-yzzy-text-primary focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                    Vistoriador Responsável
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled
                      value={`${user?.displayName || user?.fullName || 'Você'}`}
                      className="w-full pl-10 pr-3 py-2 bg-surface-secondary/70 border border-yzzy-border rounded-input text-xs font-semibold text-yzzy-text-secondary cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                  Observações Iniciais
                </label>
                <textarea
                  rows={2}
                  placeholder="Informações sobre chaves, presença de inquilino ou instruções especiais..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none resize-none text-yzzy-text-primary"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setStep(2)}
                  leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                  className="w-1/3 text-xs font-bold"
                >
                  Voltar
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  className="w-2/3 text-xs font-bold shadow-xs hover:shadow-subtle-blue"
                >
                  Criar Vistoria
                </Button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
