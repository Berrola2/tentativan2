import React, { useState } from 'react';
import { 
  Building, 
  FileText, 
  Calendar, 
  UserCheck, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  X
} from 'lucide-react';
import { PropertiesView } from '../properties/PropertiesView';
import { createInspection } from '../../services/inspections';
import type { Property, Inspection, InspectionType } from '../../types/inspection';
import { INSPECTION_TYPE_LABELS } from '../../types/inspection';
import { useAuth } from '../../contexts/AuthContext';

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

  const handleSelectProperty = (property: Property) => {
    setSelectedProperty(property);
    const defaultTitle = `${INSPECTION_TYPE_LABELS[inspectionType].split(' / ')[0]} - ${property.street}${property.number ? `, ${property.number}` : ''}`;
    setTitle(defaultTitle);
    setStep(2);
  };

  const handleSelectType = (type: InspectionType) => {
    setInspectionType(type);
    if (selectedProperty) {
      const defaultTitle = `${INSPECTION_TYPE_LABELS[type].split(' / ')[0]} - ${selectedProperty.street}${selectedProperty.number ? `, ${selectedProperty.number}` : ''}`;
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
      const msg = err instanceof Error ? err.message : 'Erro ao criar vistoria.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header com Stepper */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Nova Vistoria</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Passo {step} de 3 — {step === 1 ? 'Selecionar Imóvel' : step === 2 ? 'Tipo de Vistoria' : 'Informações e Responsável'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Dots */}
        <div className="flex items-center justify-center gap-2 shrink-0">
          <div className={`h-2 rounded-full transition-all ${step === 1 ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`} />
          <div className={`h-2 rounded-full transition-all ${step === 2 ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`} />
          <div className={`h-2 rounded-full transition-all ${step === 3 ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`} />
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Wizard Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          
          {/* PASSO 1: SELECIONAR IMÓVEL */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Selecione o imóvel onde a vistoria será realizada ou cadastre um novo:
              </p>
              <PropertiesView 
                isSelectionMode={true} 
                onSelectPropertyForInspection={handleSelectProperty} 
              />
            </div>
          )}

          {/* PASSO 2: SELECIONAR TIPO DE VISTORIA */}
          {step === 2 && selectedProperty && (
            <div className="space-y-6 py-2">
              <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 flex items-center gap-3">
                <Building className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Imóvel Selecionado</span>
                  <p className="text-sm font-bold text-slate-900">{selectedProperty.street}{selectedProperty.number ? `, ${selectedProperty.number}` : ''}</p>
                  <p className="text-xs text-slate-500">{selectedProperty.neighborhood ? `${selectedProperty.neighborhood}, ` : ''}{selectedProperty.city} - {selectedProperty.state}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-3">Selecione o Tipo de Vistoria *</label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => handleSelectType('CHECK_IN')}
                    className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${
                      inspectionType === 'CHECK_IN'
                        ? 'border-blue-600 bg-blue-50/30 shadow-md shadow-blue-600/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-3">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900">Vistoria de Entrada</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Entrega de chaves e registro do estado inicial de conservação do imóvel.
                    </p>
                  </div>

                  <div
                    onClick={() => handleSelectType('CHECK_OUT')}
                    className={`p-6 rounded-3xl border-2 cursor-pointer transition-all ${
                      inspectionType === 'CHECK_OUT'
                        ? 'border-blue-600 bg-blue-50/30 shadow-md shadow-blue-600/10'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-3">
                      <ArrowLeft className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-black text-slate-900">Vistoria de Saída</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Devolução de chaves e verificação de divergências ou danos ao imóvel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 3: DETALHES DA VISTORIA */}
          {step === 3 && selectedProperty && (
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {INSPECTION_TYPE_LABELS[inspectionType]}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      {selectedProperty.street}{selectedProperty.number ? `, ${selectedProperty.number}` : ''}
                    </h4>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {inspectionType === 'CHECK_IN' ? 'Entrada' : 'Saída'}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Título da Vistoria *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Data Agendada</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Vistoriador Responsável</label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      disabled
                      value={`${user?.displayName || user?.fullName} (Você)`}
                      className="w-full pl-10 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Observações Iniciais</label>
                <textarea
                  rows={3}
                  placeholder="Informações prévias sobre as chaves, presença do inquilino ou instruções..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Criar Vistoria e Abrir Editor</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer Navigation quando no Passo 2 */}
        {step === 2 && (
          <div className="pt-2 border-t border-slate-100 flex justify-between shrink-0">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Trocar Imóvel</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/10 flex items-center gap-1.5 transition-all"
            >
              <span>Continuar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
