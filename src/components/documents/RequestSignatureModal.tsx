// ==============================================================================
// VISTORIA YZZY — COMPONENT: MODAL DE SOLICITAÇÃO DE ASSINATURA EXTERNA
// ==============================================================================

import React, { useState } from 'react';
import { 
  Send, 
  Copy, 
  Check, 
  X, 
  Mail, 
  User, 
  Phone, 
  FileText, 
  ShieldCheck, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import type { InspectionDocument, SignerType } from '../../types/document';
import { createExternalSignatureRequest } from '../../services/documents';
import { useToast } from '../Toast';

interface RequestSignatureModalProps {
  document: InspectionDocument;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestSignatureModal: React.FC<RequestSignatureModalProps> = ({
  document,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [signerType, setSignerType] = useState<SignerType>('TENANT');
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signerDocument, setSignerDocument] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !signerEmail.trim()) {
      setErrorMessage('Nome completo e e-mail do signatário são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await createExternalSignatureRequest({
        documentId: document.id,
        signerType,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim(),
        signerDocument: signerDocument.trim() || null,
        signerPhone: signerPhone.trim() || null,
      });

      if (!res.success || !res.signUrl) {
        setErrorMessage(res.error || 'Não foi possível gerar o link de assinatura.');
        setIsSubmitting(false);
        return;
      }

      setGeneratedLink(res.signUrl);
      showToast('Link de assinatura externa gerado com sucesso com validade de 7 dias.', 'success');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar solicitação.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast('O link de assinatura foi copiado para a área de transferência.', 'info');
    } catch {
      // Fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/30 border border-indigo-400/30 rounded-lg text-indigo-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Solicitar Assinatura Externa</h3>
              <p className="text-xs text-slate-300">
                Laudo Nº {document.document_number} (v{document.version})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-sm">
          {!generatedLink ? (
            <form onSubmit={handleCreateRequest} className="space-y-3.5">
              {/* Seleção do Papel */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Papel do Signatário Externo
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'TENANT', label: 'Inquilino' },
                    { id: 'OWNER', label: 'Proprietário' },
                    { id: 'WITNESS', label: 'Testemunha' },
                    { id: 'OTHER', label: 'Outro' },
                  ].map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSignerType(role.id as SignerType)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                        signerType === role.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome Completo */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Ex: Maria dos Santos"
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  E-mail do Signatário <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="exemplo@email.com"
                    className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* CPF e Telefone (opcionais) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">CPF (opcional)</label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={signerDocument}
                      onChange={(e) => setSignerDocument(e.target.value)}
                      placeholder="000.000.000-00"
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">WhatsApp / Telefone (opcional)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={signerPhone}
                      onChange={(e) => setSignerPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Aviso de Segurança do Token */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-600">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>
                  O sistema gerará um link criptografado único com token de uso único (single-use) e expiração automática em 7 dias.
                </span>
              </div>

              {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Gerar Link de Assinatura
                </button>
              </div>
            </form>
          ) : (
            /* Tela de Sucesso com Link Copiável */
            <div className="space-y-4 py-2 animate-fade-in text-center sm:text-left">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto sm:mx-0">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Link de Assinatura Gerado com Sucesso!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Envie este link para <strong>{signerName}</strong> ({signerEmail}) para conferência e assinatura do laudo.
                </p>
              </div>

              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-bold uppercase text-slate-500">Link Seguro Único (Válido por 7 dias)</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedLink}
                    className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-700 select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow'
                    }`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
