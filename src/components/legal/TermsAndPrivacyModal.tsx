import React, { useState } from 'react';
import { ShieldCheck, XCircle, Download, Check } from 'lucide-react';
import { exportCompanyLgpdData, downloadLgpdExportAsJson } from '../../services/lgpd';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'terms' | 'privacy' | 'lgpd';
}

export const TermsAndPrivacyModal: React.FC<Props> = ({ isOpen, onClose, defaultTab = 'privacy' }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'lgpd'>(defaultTab);
  const { companyId, companyName } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [exportedSuccess, setExportedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleExportLgpd = async () => {
    if (!companyId) return;
    setIsExporting(true);
    try {
      const data = await exportCompanyLgpdData(companyId);
      downloadLgpdExportAsJson(data, companyName || 'empresa');
      setExportedSuccess(true);
      setTimeout(() => setExportedSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao exportar dados LGPD:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              Privacidade, Termos & LGPD
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-100 pt-3 pb-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'privacy' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Política de Privacidade
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'terms' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Termos de Uso
          </button>
          <button
            onClick={() => setActiveTab('lgpd')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'lgpd' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Direitos LGPD & Exportação
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-4 text-xs text-slate-600 space-y-4 pr-1 leading-relaxed">
          {activeTab === 'privacy' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900">1. Tratamento de Dados Pessoais</h4>
              <p>
                A plataforma <strong>Vistoria YZZY</strong> trata dados estritamente necessários para a realização, documentação e garantia da integridade jurídica de vistorias imobiliárias (Lei Geral de Proteção de Dados - Lei nº 13.709/2018).
              </p>
              <h4 className="text-sm font-bold text-slate-900">2. Finalidade e Minimização</h4>
              <p>
                Os dados coletados (nomes de vistoriadores, signatários, fotos de imóveis e metadados de assinatura) destinam-se exclusivamente ao cumprimento de obrigação contratual e exercício regular de direitos em laudos periciais.
              </p>
              <h4 className="text-sm font-bold text-slate-900">3. Segurança e Criptografia</h4>
              <p>
                Todos os dados em trânsito são protegidos via HTTPS/TLS. Assinaturas e snapshots possuem integridade inviolável assegurada por hashes SHA-256 e trilha de auditoria auditável.
              </p>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900">1. Objeto e Responsabilidade</h4>
              <p>
                O Vistoria YZZY é uma ferramenta de gestão pericial e laudos eletrônicos. A responsabilidade técnica pelas declarações constantes nas vistorias é do profissional ou imobiliária emissora.
              </p>
              <h4 className="text-sm font-bold text-slate-900">2. Imutabilidade dos Laudos</h4>
              <p>
                Após a assinatura eletrônica ou aceite das partes, os laudos tornam-se juridicamente imutáveis, sendo expressamente vedada sua alteração retroativa sem a geração de uma nova versão com trilha de versionamento.
              </p>
            </div>
          )}

          {activeTab === 'lgpd' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                <h4 className="text-xs font-bold text-blue-900 uppercase">Exportação Completa de Dados (Art. 18 LGPD)</h4>
                <p className="text-xs text-blue-700 mt-1">
                  Como titular e gestor da sua conta empresarial, você pode exportar a qualquer momento todos os cadastros de imóveis, perfis e vistorias em formato estruturado (JSON).
                </p>
                <div className="mt-3">
                  <button
                    onClick={handleExportLgpd}
                    disabled={isExporting || !companyId}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-600/20"
                  >
                    {exportedSuccess ? <Check className="w-4 h-4 text-emerald-300" /> : <Download className="w-4 h-4" />}
                    <span>{exportedSuccess ? 'Exportação Concluída!' : isExporting ? 'Exportando...' : 'Exportar Dados da Minha Empresa (JSON)'}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900">Canal do Encarregado de Dados (DPO)</h4>
                <p>
                  Para dúvidas ou solicitações de retificação e anonimização de titulares de dados, contate: <span className="font-mono text-blue-600">privacidade@yzzy.com.br</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
