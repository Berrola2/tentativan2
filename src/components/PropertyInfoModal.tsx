import React, { useState, useRef } from 'react';
import { 
  X, 
  Building, 
  MapPin, 
  User, 
  Gauge, 
  Key, 
  Upload, 
  Trash2, 
  Save, 
  Briefcase 
} from 'lucide-react';
import type { InspectionData } from '../types/inspection';
import { compressImage } from '../services/imageCompressor';
import { useToast } from './Toast';

interface PropertyInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InspectionData;
  onSave: (updatedData: Partial<InspectionData>) => void;
}

export const PropertyInfoModal: React.FC<PropertyInfoModalProps> = ({
  isOpen,
  onClose,
  data,
  onSave,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: data.title || '',
    inspectionType: data.inspectionType || 'Entrada',
    date: data.date || new Date().toISOString().split('T')[0],
    time: data.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    inspectorName: data.inspectorName || '',
    inspectorCpfCreci: data.inspectorCpfCreci || '',
    tenantName: data.tenantName || '',
    tenantCpf: data.tenantCpf || '',
    ownerName: data.ownerName || '',
    propertyAddress: data.propertyAddress || '',
    propertyNumber: data.propertyNumber || '',
    propertyComplement: data.propertyComplement || '',
    propertyNeighborhood: data.propertyNeighborhood || '',
    propertyCity: data.propertyCity || '',
    propertyState: data.propertyState || '',
    propertyZip: data.propertyZip || '',
    companyName: data.companyName || '',
    companyCnpj: data.companyCnpj || '',
    companyPhone: data.companyPhone || '',
    companyLogo: data.companyLogo,
    waterMeter: data.waterMeter || '',
    energyMeter: data.energyMeter || '',
    gasMeter: data.gasMeter || '',
    keysInfo: data.keysInfo || '',
    generalObservations: data.generalObservations || '',
  });

  // Keep form data synchronized with incoming inspection data whenever opened or updated
  React.useEffect(() => {
    if (isOpen && data) {
      setFormData({
        title: data.title || '',
        inspectionType: data.inspectionType || 'Entrada',
        date: data.date || new Date().toISOString().split('T')[0],
        time: data.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        inspectorName: data.inspectorName || '',
        inspectorCpfCreci: data.inspectorCpfCreci || '',
        tenantName: data.tenantName || '',
        tenantCpf: data.tenantCpf || '',
        ownerName: data.ownerName || '',
        propertyAddress: data.propertyAddress || '',
        propertyNumber: data.propertyNumber || '',
        propertyComplement: data.propertyComplement || '',
        propertyNeighborhood: data.propertyNeighborhood || '',
        propertyCity: data.propertyCity || '',
        propertyState: data.propertyState || '',
        propertyZip: data.propertyZip || '',
        companyName: data.companyName || '',
        companyCnpj: data.companyCnpj || '',
        companyPhone: data.companyPhone || '',
        companyLogo: data.companyLogo,
        waterMeter: data.waterMeter || '',
        energyMeter: data.energyMeter || '',
        gasMeter: data.gasMeter || '',
        keysInfo: data.keysInfo || '',
        generalObservations: data.generalObservations || '',
      });
    }
  }, [isOpen, data]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedLogo = await compressImage(file, 400, 400, 0.9, false);
      setFormData((prev) => ({ ...prev, companyLogo: compressedLogo }));
      showToast('Logo carregada com sucesso!', 'success');
    } catch (err) {
      showToast('Erro ao processar imagem da logo.', 'error');
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, companyLogo: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    showToast('Dados do imóvel salvos com sucesso!', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Dados do Imóvel e Vistoria</h2>
              <p className="text-xs text-slate-500">Informações que aparecerão no cabeçalho do laudo em PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          
          {/* Section 1: Tipo e Título da Vistoria */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" />
              Identificação do Laudo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Título do Laudo / Identificação</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Ex: Vistoria de Entrada - Apto 102"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tipo de Vistoria</label>
                <select
                  name="inspectionType"
                  value={formData.inspectionType}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-brand-500 transition-colors"
                >
                  <option value="Entrada">Entrada (Check-in)</option>
                  <option value="Saída">Saída (Check-out)</option>
                  <option value="Periódica">Periódica / Rotina</option>
                  <option value="Constatação">Constatação</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Data da Realização</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Horário</label>
                <input
                  type="time"
                  name="time"
                  value={formData.time}
                  onChange={handleChange}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Endereço do Imóvel */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Endereço do Imóvel Vistoriado
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
              <div className="sm:col-span-4">
                <label className="block text-slate-700 font-bold mb-1">Logradouro (Rua, Av, Alameda)</label>
                <input
                  type="text"
                  name="propertyAddress"
                  value={formData.propertyAddress}
                  onChange={handleChange}
                  placeholder="Ex: Rua das Flores"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Número</label>
                <input
                  type="text"
                  name="propertyNumber"
                  value={formData.propertyNumber}
                  onChange={handleChange}
                  placeholder="Ex: 123"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Complemento / Apto</label>
                <input
                  type="text"
                  name="propertyComplement"
                  value={formData.propertyComplement}
                  onChange={handleChange}
                  placeholder="Ex: Apto 32 Bloco A"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Bairro</label>
                <input
                  type="text"
                  name="propertyNeighborhood"
                  value={formData.propertyNeighborhood}
                  onChange={handleChange}
                  placeholder="Ex: Centro"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-slate-700 font-bold mb-1">Cidade</label>
                <input
                  type="text"
                  name="propertyCity"
                  value={formData.propertyCity}
                  onChange={handleChange}
                  placeholder="Cidade"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-slate-700 font-bold mb-1">UF</label>
                <input
                  type="text"
                  name="propertyState"
                  value={formData.propertyState}
                  onChange={handleChange}
                  placeholder="SP"
                  maxLength={2}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 uppercase transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Partes Envolvidas */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Pessoas e Responsáveis
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nome do Vistoriador</label>
                <input
                  type="text"
                  name="inspectorName"
                  value={formData.inspectorName}
                  onChange={handleChange}
                  placeholder="Nome completo do vistoriador"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CPF ou CRECI do Vistoriador</label>
                <input
                  type="text"
                  name="inspectorCpfCreci"
                  value={formData.inspectorCpfCreci}
                  onChange={handleChange}
                  placeholder="Ex: CRECI 12345-F"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nome do Locatário / Inquilino</label>
                <input
                  type="text"
                  name="tenantName"
                  value={formData.tenantName}
                  onChange={handleChange}
                  placeholder="Nome do inquilino"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CPF do Locatário</label>
                <input
                  type="text"
                  name="tenantCpf"
                  value={formData.tenantCpf}
                  onChange={handleChange}
                  placeholder="000.000.000-00"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-bold mb-1">Nome do Proprietário / Locador (Opcional)</label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleChange}
                  placeholder="Nome do proprietário"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Dados da Imobiliária & Logo */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" />
              Imobiliária / Empresa & Logo do Laudo
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Nome da sua imobiliária"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">CNPJ</label>
                <input
                  type="text"
                  name="companyCnpj"
                  value={formData.companyCnpj}
                  onChange={handleChange}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  name="companyPhone"
                  value={formData.companyPhone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Logo Upload */}
            <div className="pt-2">
              <label className="block text-slate-700 font-bold mb-1.5">Logo da Empresa</label>
              <div className="flex items-center gap-4">
                {formData.companyLogo ? (
                  <div className="relative group w-20 h-20 rounded-2xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-sm">
                    <img
                      src={formData.companyLogo}
                      alt="Logo da empresa"
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg"
                      title="Remover Logo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-500 bg-white flex flex-col items-center justify-center cursor-pointer transition-colors text-slate-400 hover:text-brand-600 shadow-sm"
                  >
                    <Upload className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-bold">Enviar Logo</span>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />

                <p className="text-[11px] text-slate-500">
                  Formato PNG ou JPG. A imagem é comprimida automaticamente para o laudo.
                </p>
              </div>
            </div>
          </div>

          {/* Section 5: Medidores e Chaves */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-brand-700 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" />
              Medidores e Relação de Chaves
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Leitura Água (m³ / Hidrômetro)</label>
                <input
                  type="text"
                  name="waterMeter"
                  value={formData.waterMeter}
                  onChange={handleChange}
                  placeholder="Ex: 00452 m³"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Leitura Luz / Energia (kWh)</label>
                <input
                  type="text"
                  name="energyMeter"
                  value={formData.energyMeter}
                  onChange={handleChange}
                  placeholder="Ex: 12480 kWh"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Leitura Gás (m³ / Botijão)</label>
                <input
                  type="text"
                  name="gasMeter"
                  value={formData.gasMeter}
                  onChange={handleChange}
                  placeholder="Ex: 0134 m³"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-amber-500" />
                  Relação de Chaves e Controles Entregues
                </label>
                <input
                  type="text"
                  name="keysInfo"
                  value={formData.keysInfo}
                  onChange={handleChange}
                  placeholder="Ex: 02 chaves da porta principal e 01 controle da garagem"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Observações Gerais */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-slate-700 font-bold">Observações Gerais e Cláusulas do Laudo</label>
            <textarea
              name="generalObservations"
              value={formData.generalObservations}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: O locatário declara ter recebido o imóvel nas condições descritas neste laudo fotográfico."
              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-brand-500 transition-colors text-xs resize-y"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md shadow-brand-600/20 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Dados</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
