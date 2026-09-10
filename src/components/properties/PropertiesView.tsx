import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building, 
  Search, 
  Plus, 
  Edit, 
  CheckCircle2, 
  MapPin, 
  Loader2, 
  AlertCircle, 
  Home, 
  Briefcase,
  GitCompare, 
  ArrowLeft,
  X
} from 'lucide-react';
import { fetchProperties, createProperty, updateProperty, togglePropertyActive } from '../../services/properties';
import type { Property, PropertyType } from '../../types/inspection';
import { PROPERTY_TYPE_LABELS } from '../../types/inspection';
import { PropertyComparisonsPanel } from '../comparisons/PropertyComparisonsPanel';
import { InspectionComparisonView } from '../comparisons/InspectionComparisonView';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);

  // Status toggle confirmation modal
  const [propertyToToggle, setPropertyToToggle] = useState<Property | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

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
    }, 250);
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
          internal_code: internalCode.trim() || null,
          property_type: propertyType,
          street: street.trim(),
          number: number.trim() || null,
          complement: complement.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim(),
          state: stateCode.trim().toUpperCase(),
          postal_code: postalCode.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        const created = await createProperty({
          internal_code: internalCode.trim() || null,
          property_type: propertyType,
          street: street.trim(),
          number: number.trim() || null,
          complement: complement.trim() || null,
          neighborhood: neighborhood.trim() || null,
          city: city.trim(),
          state: stateCode.trim().toUpperCase(),
          postal_code: postalCode.trim() || null,
          notes: notes.trim() || null,
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

  const handleConfirmToggleActive = async () => {
    if (!propertyToToggle) return;
    setIsTogglingStatus(true);
    try {
      const newStatus = !propertyToToggle.active;
      await togglePropertyActive(propertyToToggle.id, newStatus);
      setProperties((prev) => prev.map((p) => p.id === propertyToToggle.id ? { ...p, active: newStatus } : p));
      setPropertyToToggle(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Falha ao alterar status.');
    } finally {
      setIsTogglingStatus(false);
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
        return <Building className="w-5 h-5 text-primary-600" />;
    }
  };

  const filteredProperties = properties.filter((prop) => {
    const matchesType = typeFilter === 'ALL' || prop.property_type === typeFilter;
    const matchesStatus = 
      statusFilter === 'ALL' ? true :
      statusFilter === 'ACTIVE' ? prop.active !== false :
      statusFilter === 'INACTIVE' ? prop.active === false : true;
    return matchesType && matchesStatus;
  });

  const hasActiveFilters = typeFilter !== 'ALL' || statusFilter !== 'ALL';

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
      <div className="space-y-6 font-sans animate-fadeIn">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setComparisonProperty(null)}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Voltar aos Imóveis
          </Button>
          <div>
            <h2 className="text-sm font-bold text-yzzy-text-primary">
              Comparações: {comparisonProperty.street}{comparisonProperty.number ? `, ${comparisonProperty.number}` : ''}
            </h2>
            <p className="text-xs text-yzzy-text-muted">
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
    <div className="space-y-6 font-sans text-yzzy-text-primary animate-fadeIn">
      
      {/* 
        ============================================================
        1. CABEÇALHO DO MÓDULO & AÇÃO PRINCIPAL
        ============================================================
      */}
      {!isSelectionMode && (
        <div className="bg-white rounded-card p-5 sm:p-6 border border-yzzy-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-yzzy-text-primary tracking-tight font-display flex items-center gap-2">
              <Building className="w-5 h-5 text-primary-600" />
              Imóveis
            </h1>
            <p className="text-xs text-yzzy-text-secondary">
              Gerencie o catálogo e os dados cadastrais das unidades imobiliárias da sua operação.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={openAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold shadow-xs hover:shadow-subtle-blue shrink-0"
          >
            Cadastrar Imóvel
          </Button>
        </div>
      )}

      {/* 
        ============================================================
        2. BARRA DE BUSCA E FILTROS COMPACTOS
        ============================================================
      */}
      <div className="bg-white p-4 sm:p-5 rounded-card border border-yzzy-border shadow-xs flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
        
        {/* Input de Busca */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por endereço, código, bairro ou cidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 hover:border-slate-300 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-yzzy-text-muted hover:text-yzzy-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros de Tipo e Status */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs py-2 px-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-yzzy-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="ALL">Tipo: Todos</option>
            <option value="APARTMENT">Apartamento</option>
            <option value="HOUSE">Casa</option>
            <option value="COMMERCIAL">Comercial</option>
            <option value="OFFICE">Escritório</option>
            <option value="LAND">Terreno</option>
            <option value="OTHER">Outro</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-2 px-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-yzzy-text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="ALL">Status: Todos</option>
            <option value="ACTIVE">Somente Ativos</option>
            <option value="INACTIVE">Somente Inativos</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="text-xs text-primary-600 hover:text-primary-700 font-semibold px-2 py-1 transition-colors"
            >
              Limpar Filtros
            </button>
          )}

          {isSelectionMode && (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddModal}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="ml-auto font-bold"
            >
              Novo Imóvel
            </Button>
          )}
        </div>
      </div>

      {/* 
        ============================================================
        3. LISTAGEM HÍBRIDA / CARDS ESTRUTURADOS
        ============================================================
      */}
      <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-yzzy-border/60 flex justify-between items-center">
          <h2 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
            Catálogo de Imóveis
          </h2>
          <span className="text-xs text-yzzy-text-muted font-medium">
            {filteredProperties.length} de {properties.length} unidade(s)
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-yzzy-text-muted flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            <p className="text-xs font-medium">Carregando catálogo de imóveis...</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="p-12 text-center text-yzzy-text-muted space-y-3">
            <Building className="w-10 h-10 mx-auto text-slate-300" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-yzzy-text-primary">Nenhum imóvel encontrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {hasActiveFilters || searchTerm
                  ? 'Nenhum imóvel corresponde aos filtros de busca aplicados.'
                  : 'Cadastre o primeiro imóvel para iniciar vistorias de entrada e saída.'}
              </p>
            </div>
            {!isSelectionMode && (
              <Button
                variant="secondary"
                size="sm"
                onClick={openAddModal}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Cadastrar Imóvel
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-yzzy-border/60">
            {filteredProperties.map((prop) => (
              <div 
                key={prop.id} 
                className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-secondary/40 transition-colors ${!prop.active ? 'bg-surface-secondary/60 opacity-75' : ''}`}
              >
                {/* Informações do Imóvel */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-btn bg-surface-secondary border border-yzzy-border flex items-center justify-center shrink-0 mt-0.5">
                    {getPropertyIcon(prop.property_type)}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {prop.internal_code && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white">
                          {prop.internal_code}
                        </span>
                      )}
                      <Badge variant="primary" size="sm">
                        {PROPERTY_TYPE_LABELS[prop.property_type] || prop.property_type}
                      </Badge>
                      {prop.active ? (
                        <Badge variant="success" size="sm" dot>Ativo</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Inativo</Badge>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-yzzy-text-primary truncate">
                      {prop.street}{prop.number ? `, ${prop.number}` : ''}
                      {prop.complement ? ` - ${prop.complement}` : ''}
                    </h3>

                    <p className="text-xs text-yzzy-text-muted flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-yzzy-text-muted shrink-0" />
                      <span>{prop.neighborhood ? `${prop.neighborhood}, ` : ''}{prop.city} - {prop.state}</span>
                      {prop.postal_code && <span className="font-mono text-[11px]">({prop.postal_code})</span>}
                    </p>
                  </div>
                </div>

                {/* Ações Operacionais */}
                <div className="flex items-center gap-2 self-end lg:self-auto shrink-0 flex-wrap">
                  {isSelectionMode && onSelectPropertyForInspection && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onSelectPropertyForInspection(prop)}
                      leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      className="font-bold shadow-xs hover:shadow-subtle-blue"
                    >
                      Selecionar
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setComparisonProperty(prop)}
                    leftIcon={<GitCompare className="w-3.5 h-3.5 text-primary-600" />}
                    className="text-xs font-semibold"
                    title="Ver comparações deste imóvel"
                  >
                    Confrontos
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditModal(prop)}
                    leftIcon={<Edit className="w-3.5 h-3.5" />}
                    className="text-xs font-semibold"
                    title="Editar imóvel"
                  >
                    Editar
                  </Button>

                  <Button
                    variant={prop.active ? 'secondary' : 'success'}
                    size="sm"
                    onClick={() => setPropertyToToggle(prop)}
                    className="text-xs font-semibold"
                  >
                    {prop.active ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 
        ============================================================
        4. MODAL: CADASTRAR / EDITAR IMÓVEL
        ============================================================
      */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-modal max-w-xl w-full p-6 sm:p-8 shadow-floating border border-yzzy-border space-y-6 animate-scaleIn max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center pb-3 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-yzzy-text-primary flex items-center gap-2">
                <Building className="w-5 h-5 text-primary-600" />
                {editingProperty ? 'Editar Imóvel' : 'Cadastrar Novo Imóvel'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-status-danger text-xs rounded-btn flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveProperty} className="space-y-5">
              
              {/* Grupo 1: Identificação */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
                  1. Identificação do Imóvel
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Tipo de Imóvel *
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 font-medium outline-none"
                    >
                      <option value="APARTMENT">Apartamento</option>
                      <option value="HOUSE">Casa</option>
                      <option value="COMMERCIAL">Comercial</option>
                      <option value="OFFICE">Escritório</option>
                      <option value="LAND">Terreno</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Código Interno (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: IMO-0012"
                      value={internalCode}
                      onChange={(e) => setInternalCode(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Grupo 2: Endereço */}
              <div className="space-y-3 pt-2 border-t border-yzzy-border/60">
                <h4 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
                  2. Endereço Completo
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Logradouro / Rua *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Av. Paulista"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Número
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 1000"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Complemento
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Apto 42 Bloco B"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Bela Vista"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Cidade *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      Estado (UF) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      placeholder="SP"
                      value={stateCode}
                      onChange={(e) => setStateCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-yzzy-text-secondary mb-1">
                      CEP
                    </label>
                    <input
                      type="text"
                      placeholder="01310-100"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Grupo 3: Observações */}
              <div className="space-y-3 pt-2 border-t border-yzzy-border/60">
                <h4 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
                  3. Observações de Acesso
                </h4>

                <div>
                  <textarea
                    rows={2}
                    placeholder="Informações sobre portaria, chaves ou particularidades..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-secondary border border-yzzy-border rounded-input text-xs focus:ring-2 focus:ring-primary-500 resize-none outline-none"
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-3 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 text-xs font-bold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  className="w-1/2 text-xs font-bold shadow-xs hover:shadow-subtle-blue"
                >
                  {editingProperty ? 'Salvar Alterações' : 'Cadastrar Imóvel'}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* 
        ============================================================
        5. MODAL DE CONFIRMAÇÃO: ATIVAR / DESATIVAR IMÓVEL
        ============================================================
      */}
      {propertyToToggle && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-modal max-w-md w-full p-6 shadow-floating border border-yzzy-border space-y-5 animate-scaleIn">
            <div className="flex justify-between items-center pb-2 border-b border-yzzy-border/60">
              <h3 className="text-base font-bold text-yzzy-text-primary">
                {propertyToToggle.active ? 'Desativar Imóvel' : 'Reativar Imóvel'}
              </h3>
              <button 
                type="button"
                onClick={() => setPropertyToToggle(null)} 
                className="text-yzzy-text-muted hover:text-yzzy-text-primary p-1 rounded-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-surface-secondary rounded-btn text-xs space-y-1">
              <p className="font-bold text-yzzy-text-primary">
                {propertyToToggle.street}{propertyToToggle.number ? `, ${propertyToToggle.number}` : ''}
              </p>
              <p className="text-yzzy-text-muted">
                {propertyToToggle.city} - {propertyToToggle.state}
              </p>
              <p className="text-yzzy-text-secondary pt-1">
                {propertyToToggle.active 
                  ? 'Ao desativar este imóvel, novas vistorias não poderão ser agendadas, mas o histórico anterior permanecerá intacto.' 
                  : 'Ao reativar este imóvel, ele voltará a ficar disponível para novas vistorias de entrada e saída.'}
              </p>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setPropertyToToggle(null)}
                className="w-1/2 text-xs font-bold"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant={propertyToToggle.active ? 'danger' : 'success'}
                size="md"
                isLoading={isTogglingStatus}
                onClick={handleConfirmToggleActive}
                className="w-1/2 text-xs font-bold"
              >
                Confirmar {propertyToToggle.active ? 'Desativação' : 'Reativação'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
