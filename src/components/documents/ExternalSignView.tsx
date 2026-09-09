// ==============================================================================
// VISTORIA YZZY — VIEW: PÁGINA PÚBLICA DE ASSINATURA EXTERNA (/sign/:token)
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileCheck2, 
  ShieldCheck, 
  Eye, 
  PenTool, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Loader2, 
  Building2, 
  MapPin, 
  Calendar, 
  XCircle
} from 'lucide-react';
import type { ExternalSignatureRequestInfo } from '../../types/document';
import { 
  fetchExternalSignatureRequest, 
  signDocumentExternal, 
  declineDocumentExternal 
} from '../../services/documents';

interface ExternalSignViewProps {
  token: string;
}

export const ExternalSignView: React.FC<ExternalSignViewProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [requestInfo, setRequestInfo] = useState<ExternalSignatureRequestInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signerDocument, setSignerDocument] = useState('');
  const [includeDrawn, setIncludeDrawn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Recusa
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    loadRequest();
  }, [token]);

  const loadRequest = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchExternalSignatureRequest(token);
      if (!res.valid) {
        setErrorMessage(res.message || 'Link de assinatura inválido ou expirado.');
      } else {
        setRequestInfo(res);
      }
    } catch {
      setErrorMessage('Link inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

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
      setErrorMessage('É necessário ler e aceitar os termos da vistoria.');
      return;
    }

    if (includeDrawn && !hasDrawn) {
      setErrorMessage('Por favor, desenhe sua assinatura no quadro.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let signatureBlob: Blob | null = null;
      if (includeDrawn) {
        signatureBlob = await getCanvasBlob();
      }

      const res = await signDocumentExternal({
        rawToken: token,
        signerDocument: signerDocument.trim() || null,
        signatureImageBlob: signatureBlob,
        termsVersion: 'v1.0',
      });

      if (!res.success) {
        setErrorMessage(res.message || 'Falha ao processar assinatura.');
        setIsSubmitting(false);
        return;
      }

      setCompleted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar.';
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    try {
      const res = await declineDocumentExternal(token, declineReason.trim() || undefined);
      if (res.success) {
        setDeclined(true);
        setShowDeclineModal(false);
      } else {
        setErrorMessage(res.message || 'Erro ao registrar recusa.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao recusar.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Carregando dados da assinatura...
        </p>
      </div>
    );
  }

  if (errorMessage && !requestInfo?.valid) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Acesso Indisponível</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {errorMessage}
          </p>
          <div className="pt-2">
            <a 
              href="/"
              className="inline-block px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Voltar ao Início
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Laudo Assinado com Sucesso!</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sua assinatura eletrônica pericial foi registrada e vinculada ao documento 
            <strong> #{requestInfo?.document_number} (v{requestInfo?.version})</strong>.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 font-mono">
            Checksum: {requestInfo?.document_checksum?.substring(0, 24)}...
          </div>
          <div className="pt-2 text-xs text-slate-400">
            Você pode fechar esta página com segurança.
          </div>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-md w-full p-8 rounded-2xl shadow-xl border border-slate-200 text-center space-y-4 animate-fade-in">
          <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Assinatura Recusada</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            O registro de recusa foi gravado no sistema da vistoria para conhecimento do emissor.
          </p>
          <div className="pt-2">
            <a 
              href="/"
              className="inline-block px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
            >
              Fechar
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 flex justify-center items-start">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-400">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-white">Vistoria YZZY</h1>
                <p className="text-xs text-slate-300">Portal de Assinatura e Aceite Eletrônico</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-blue-600 text-white rounded-md">
                {requestInfo?.signer_type || 'SIGNATÁRIO'}
              </span>
            </div>
          </div>
        </div>

        {/* Informações do Laudo */}
        <div className="p-6 space-y-6">
          {/* Card do Imóvel e Empresa */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>{requestInfo?.company_name}</span>
              </div>
              <div className="text-xs font-bold text-slate-500">
                Laudo #{requestInfo?.document_number} (v{requestInfo?.version})
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-800">Endereço do Imóvel:</div>
                  <div>{requestInfo?.property_street}, {requestInfo?.property_city}/{requestInfo?.property_state}</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-800">Tipo de Vistoria:</div>
                  <div>Vistoria de {requestInfo?.inspection_type || 'Entrada'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão para Abrir PDF do Laudo */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-blue-950">Conferência do Laudo Pericial Oficial</h4>
                <p className="text-[11px] text-blue-800 mt-0.5">
                  Abra o arquivo PDF com fotos e descrições antes de confirmar sua assinatura.
                </p>
              </div>
            </div>
            {requestInfo?.signed_url && (
              <a
                href={requestInfo.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-2 shrink-0"
              >
                <Eye className="w-4 h-4" />
                Visualizar Laudo em PDF
              </a>
            )}
          </div>

          {/* Formulário de Assinatura */}
          <div className="space-y-4 pt-2">
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Identificação do Signatário</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    readOnly
                    value={requestInfo?.signer_name || ''}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 mb-1">E-mail</label>
                  <input
                    type="text"
                    readOnly
                    value={requestInfo?.signer_email || ''}
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-600 mb-1">CPF (opcional)</label>
                  <input
                    type="text"
                    value={signerDocument}
                    onChange={(e) => setSignerDocument(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Opção de Rubrica / Assinatura Manuscrita */}
            <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-800">Deseja desenhar sua assinatura manuscrita?</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeDrawn}
                  onChange={(e) => setIncludeDrawn(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
              </div>

              {includeDrawn && (
                <div className="space-y-1.5 pt-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Desenhe com o dedo (touch) ou mouse:</span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Limpar
                    </button>
                  </div>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white shadow-inner">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-32 cursor-crosshair bg-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Declaração de Aceite */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-3">
              <p className="text-xs text-amber-950 leading-relaxed italic">
                "Declaro que conferi este laudo pericial de vistoria de imóvel, tomei ciência de todas as fotografias e descrições dos ambientes e itens, e concordo formalmente com a emissão do presente aceite eletrônico."
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-xs font-bold text-amber-900">
                  Li, conferi os registros fotográficos e concordo com os termos do laudo de vistoria.
                </span>
              </label>
            </div>

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowDeclineModal(true)}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200"
              >
                Recusar Laudo
              </button>

              <button
                type="button"
                onClick={handleSign}
                disabled={isSubmitting || !acceptedTerms}
                className="w-full sm:w-auto px-6 py-3 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando Assinatura...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Confirmar e Assinar Laudo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Recusa */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6 space-y-4 border border-slate-200 animate-fade-in">
            <h3 className="font-bold text-base text-slate-900">Confirmar Recusa da Assinatura</h3>
            <p className="text-xs text-slate-600">
              Informe o motivo da recusa para que a empresa responsável pela vistoria possa analisar os apontamentos:
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Descreva o motivo da divergência ou recusa..."
              rows={4}
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeclineModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
