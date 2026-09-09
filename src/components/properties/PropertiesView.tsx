import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building, 
  Search, 
  Plus, 
  Edit, 
  CheckCircle2, 
  XCircle, 
  MapPin, 
  Loader2, 
  AlertCircle, 
  Home, 
  Briefcase,
  GitCompare,
  ArrowLeft 
} from 'lucide-react';
import { fetchProperties, createProperty, updateProperty, togglePropertyActive } from '../../services/properties';
import type { Property, PropertyType } from '../../types/inspection';
import { PROPERTY_TYPE_LABELS } from '../../types/inspection';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';

interface PropertiesViewProps {
  onSelectPropertyForInspection?: (property: Property) => void;
  isSelectionMode?: boolean;
}

export const PropertiesView: React.FC<PropertiesViewProps> = ({
  onSelectPropertyForInspection,
  isSelectionMode = false,
}) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // Comparison subviews
  const [comparisonProperty, setComparisonProperty] = useState<Property | null>(null);
  const [activeComparisonId, setActiveComparisonId] = useState<string | null>(null);

  // Form states
  const [internalCode, setInternalCode] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('APARTMENT');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('SP');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchProperties(searchTerm);
      setProperties(data);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProperties();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadProperties]);

  const openAddModal = () => {
    setEditingProperty(null);
    setInternalCode('');
    setPropertyType('APARTMENT');
    setStreet('');
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('');
    setStateCode('SP');
    setPostalCode('');
    setNotes('');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (prop: Property) => {
    setEditingProperty(prop);
    setInternalCode(prop.internal_code || '');
    setPropertyType(prop.property_type);
    setStreet(prop.street);
    setNumber(prop.number || '');
    setComplement(prop.complement || '');
    setNeighborhood(prop.neighborhood || '');
    setCity(prop.city);
    setStateCode(prop.state);
    setPostalCode(prop.postal_code || '');
    setNotes(prop.notes || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!street.trim() || !city.trim() || !stateCode.trim()) {
      setErrorMessage('Logradouro, cidade e estado são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProperty) {
        await updateProperty(editingProperty.id, {
          internal_code: internalCode,
          property_type: propertyType,
          street,
          number,
          complement,
          neighborhood,
          city,
          state: stateCode,
          postal_code: postalCode,
          notes,
        });
      } else {
        const created = await createProperty({
          internal_code: internalCode,
          property_type: propertyType,
          street,
          number,
          complement,
          neighborhood,
          city,
          state: stateCode,
          postal_code: postalCode,
          notes,
        });

        if (onSelectPropertyForInspection) {
          onSelectPropertyForInspection(created);
        }
      }

      setIsModalOpen(false);
      await loadProperties();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar imóvel.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (prop: Property) => {
    try {
      const newStatus = !prop.active;
      await togglePropertyActive(prop.id, newStatus);
      setProperties((prev) => prev.map((p) => p.id === prop.id ? { ...p, active: newStatus } : p));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao alterar status.');
    }
  };

  const getPropertyIcon = (type: PropertyType) => {
    switch (type) {
      case 'COMMERCIAL':
      case 'OFFICE':
        return <Briefcase className="w-5 h-5 text-indigo-600" />;
      case 'HOUSE':
        return <Home className="w-5 h-5 text-emerald-600" />;
      default:
        return <Building className="w-5 h-5 text-blue-600" />;
    }
  };

  if (activeComparisonId) {
    return (
      <InspectionComparisonView
        comparisonId={activeComparisonId}
        onBack={() => setActiveComparisonId(null)}
      />
    );
  }

  if (comparisonProperty) {
    return (
      <div className="space-y-6 font-sans">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setComparisonProperty(null)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="Voltar aos imóveis"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-black text-slate-900">
              Comparações: {comparisonProperty.street}, {comparisonProperty.number}
            </h2>
            <p className="text-xs text-slate-500">
              {comparisonProperty.neighborhood ? `${comparisonProperty.neighborhood}, ` : ''}{comparisonProperty.city} - {comparisonProperty.state}
            </p>
          </div>
        </div>

        <PropertyComparisonsPanel
          propertyId={comparisonProperty.id}
          onOpenComparison={(id) => setActiveComparisonId(id)}
          canCreateComparison={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      
      {/* Top Action Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, rua, bairro ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Imóvel</span>
        </button>
      </div>

      {/* Property Cards List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Imóveis da Empresa
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {properties.length} imóvel(is)
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs">Carregando catálogo de imóveis...</p>
          </div>
        ) : properties.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Building className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Nenhum imóvel encontrado.</p>
            <p className="text-xs text-slate-400">Clique em "Cadastrar Imóvel" para registrar o primeiro imóvel da empresa.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {properties.map((prop) => (
              <div 
                key={prop.id} 
                className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    {getPropertyIcon(prop.property_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {prop.internal_code && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-900 text-white">
                          {prop.internal_code}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {PROPERTY_TYPE_LABELS[prop.property_type] || prop.property_type}
                      </span>
                      {!prop.active && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Inativo
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      {prop.street}{prop.number ? `, ${prop.number}` : ''}
                      {prop.complement ? ` - ${prop.complement}` : ''}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{prop.neighborhood ? `${prop.neighborhood}, ` : ''}{prop.city} - {prop.state}</span>
                      {prop.postal_code && <span className="font-mono text-[11px] text-slate-400">({prop.postal_code})</span>}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {isSelectionMode && onSelectPropertyForInspection && (
                    <button
                      onClick={() => onSelectPropertyForInspection(prop)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/10 flex items-center gap-1.5 transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Selecionar Imóvel</span>
                    </button>
                  )}

                  <button
                    onClick={() => setComparisonProperty(prop)}
                    className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors"
                    title="Comparações de Entrada × Saída deste imóvel"
                  >
                    <GitCompare className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openEditModal(prop)}
                    className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors"
                    title="Editar Imóvel"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleToggleActive(prop)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      prop.active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    {prop.active ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Cadastro / Edição de Imóvel */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                {editingProperty ? 'Editar Imóvel' : 'Cadastrar Novo Imóvel'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveProperty} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Código Interno (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: IMO-0012"
                    value={internalCode}
                    onChange={(e) => setInternalCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Tipo de Imóvel *</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 font-medium"
                  >
                    <option value="APARTMENT">Apartamento</option>
                    <option value="HOUSE">Casa</option>
                    <option value="COMMERCIAL">Comercial</option>
                    <option value="OFFICE">Escritório</option>
                    <option value="LAND">Terreno</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Logradouro / Rua *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Av. Paulista"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Número</label>
                  <input
                    type="text"
                    placeholder="Ex: 1000"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Complemento</label>
                  <input
                    type="text"
                    placeholder="Ex: Apto 42 Bloco B"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Bairro</label>
                  <input
                    type="text"
                    placeholder="Ex: Bela Vista"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Cidade *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: São Paulo"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Estado (UF) *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    placeholder="SP"
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">CEP</label>
                  <input
                    type="text"
                    placeholder="01310-100"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Observações do Imóvel</label>
                <textarea
                  rows={2}
                  placeholder="Informações adicionais sobre o imóvel, portaria ou acesso..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingProperty ? 'Salvar Alterações' : 'Criar Imóvel'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
