// ==============================================================================
// VISTORIA YZZY — COMPONENT: MODAL DE ASSINATURA ELETRÔNICA DO LAUDO
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { 
  FileCheck2, 
  PenTool, 
  CheckCircle2, 
  X, 
  RotateCcw, 
  ShieldCheck, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { InspectionDocument } from '../../types/document';
import { signDocumentAuthenticated } from '../../services/documents';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';

interface SignDocumentModalProps {
  document: InspectionDocument;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SignDocumentModal: React.FC<SignDocumentModalProps> = ({
  document,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [signatureMethod, setSignatureMethod] = useState<'AUTHENTICATED_ACCEPTANCE' | 'DRAWN_SIGNATURE'>('AUTHENTICATED_ACCEPTANCE');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signerDocument, setSignerDocument] = useState('');
  const [signerPhone, setSignerPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Canvas para assinatura manuscrita
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAcceptedTerms(false);
      setErrorMessage(null);
      setHasDrawn(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (signatureMethod === 'DRAWN_SIGNATURE' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [signatureMethod]);

  if (!isOpen) return null;

  // Handlers do Canvas
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const getCanvasBlob = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return null;
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  const handleSign = async () => {
    if (!acceptedTerms) {
      setErrorMessage('É obrigatório aceitar a declaração de conferência pericial para assinar.');
      return;
    }

    if (signatureMethod === 'DRAWN_SIGNATURE' && !hasDrawn) {
      setErrorMessage('Por favor, desenhe sua assinatura no quadro antes de confirmar.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let signatureBlob: Blob | null = null;
      if (signatureMethod === 'DRAWN_SIGNATURE') {
        signatureBlob = await getCanvasBlob();
      }

      const res = await signDocumentAuthenticated({
        documentId: document.id,
        signatureMethod,
        signatureImageBlob: signatureBlob,
        signerDocument: signerDocument.trim() || null,
        signerPhone: signerPhone.trim() || null,
        termsVersion: 'v1.0',
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Falha ao registrar assinatura eletrônica.');
        setIsSubmitting(false);
        return;
      }

      showToast('O laudo pericial foi assinado eletronicamente com sucesso e vinculado ao checksum.', 'success');

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar assinatura.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600/30 border border-blue-400/30 rounded-lg text-blue-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Assinatura Eletrônica do Laudo</h3>
              <p className="text-xs text-slate-300">
                Laudo Nº {document.document_number} (v{document.version})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-sm">
          {/* Alerta de Integridade */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900">
              <span className="font-bold">Garantia de Integridade e Fé Pública:</span> Esta assinatura ficará vinculada de forma imutável ao 
              Checksum SHA-256 (<span className="font-mono">{document.checksum?.substring(0, 16)}...</span>) do laudo oficial.
            </div>
          </div>

          {/* Dados do Signatário */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Signatário Autenticado</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400">Nome:</span> <strong className="text-slate-800">{user?.fullName || 'Usuário YZZY'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Perfil:</span> <strong className="text-slate-800">{user?.role || 'Vistoriador'}</strong>
              </div>
            </div>
          </div>

          {/* Escolha do Método de Assinatura */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Método de Assinatura
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSignatureMethod('AUTHENTICATED_ACCEPTANCE')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  signatureMethod === 'AUTHENTICATED_ACCEPTANCE'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-900'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${signatureMethod === 'AUTHENTICATED_ACCEPTANCE' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold text-xs">Aceite Autenticado</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Assinatura direta com credenciais e sessão segura YZZY.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSignatureMethod('DRAWN_SIGNATURE')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  signatureMethod === 'DRAWN_SIGNATURE'
                    ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 text-blue-900'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <PenTool className={`w-4 h-4 mt-0.5 shrink-0 ${signatureMethod === 'DRAWN_SIGNATURE' ? 'text-blue-600' : 'text-slate-400'}`} />
                <div>
                  <div className="font-bold text-xs">Assinatura Manuscrita</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Desenhe sua rubrica ou traço pericial na tela.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Quadro de Canvas para Desenho */}
          {signatureMethod === 'DRAWN_SIGNATURE' && (
            <div className="space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">Desenhe sua assinatura abaixo:</label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Limpar
                </button>
              </div>
              <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white touch-none shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-36 cursor-crosshair bg-white"
                />
              </div>
            </div>
          )}

          {/* Dados Opcionais Complementares */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CPF / Registro Profissional (opcional)</label>
              <input
                type="text"
                value={signerDocument}
                onChange={(e) => setSignerDocument(e.target.value)}
                placeholder="000.000.000-00 ou CRECI"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Telefone de Contato (opcional)</label>
              <input
                type="text"
                value={signerPhone}
                onChange={(e) => setSignerPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Declaração Legal de Aceite */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 space-y-2.5">
            <p className="text-xs text-amber-950 leading-relaxed italic">
              "Declaro que revisei este laudo de vistoria e confirmo que todas as fotografias, descrições dos itens e apontamentos de conservação refletem fielmente a vistoria realizada conforme meu conhecimento técnico."
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 rounded border-amber-400 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="text-xs font-bold text-amber-900">
                Li, conferi os dados da vistoria e concordo integralmente com a emissão da assinatura eletrônica.
              </span>
            </label>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSign}
            disabled={isSubmitting || !acceptedTerms}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registrando Assinatura...
              </>
            ) : (
              <>
                <FileCheck2 className="w-4 h-4" />
                Assinar Laudo Eletronicamente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
