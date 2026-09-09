// ==============================================================================
// VISTORIA YZZY — COMPONENT: InspectionDocumentsPanel (Laudos e Assinaturas)
// ==============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Eye, 
  Plus, 
  Loader2, 
  AlertCircle, 
  ShieldCheck, 
  CheckCircle2,
  FileCheck2,
  Send,
  Users,
  Award
} from 'lucide-react';
import { 
  listInspectionDocuments, 
  generateInspectionReport,
  generateAndRegisterSignedReport
} from '../../services/documents';
import type { InspectionDocument } from '../../types/document';
import { DocumentViewerModal } from './DocumentViewerModal';
import { SignDocumentModal } from './SignDocumentModal';
import { RequestSignatureModal } from './RequestSignatureModal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';

interface InspectionDocumentsPanelProps {
  inspectionId: string;
  isCompleted: boolean;
  canGenerate?: boolean;
}

export const InspectionDocumentsPanel: React.FC<InspectionDocumentsPanelProps> = ({
  inspectionId,
  isCompleted,
  canGenerate = true,
}) => {
  const { isViewer } = useAuth();
  const { showToast } = useToast();

  const [documents, setDocuments] = useState<InspectionDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEmittingSigned, setIsEmittingSigned] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<InspectionDocument | null>(null);
  
  // Modais de Assinatura
  const [signingDoc, setSigningDoc] = useState<InspectionDocument | null>(null);
  const [requestingDoc, setRequestingDoc] = useState<InspectionDocument | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listInspectionDocuments(inspectionId);
      setDocuments(list);
    } catch (err) {
      console.error('[DocumentsPanel] Erro ao listar laudos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleGenerate = async () => {
    if (isGenerating || !isCompleted || isViewer) return;

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await generateInspectionReport(inspectionId);
      if (res.success) {
        setSuccessMessage(`Laudo oficial #${res.documentNumber} (v${res.version}) gerado com sucesso!`);
        await loadDocuments();
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setError(res.error || 'Falha ao gerar laudo.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar laudo oficial.';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEmitSignedReport = async (doc: InspectionDocument) => {
    if (isEmittingSigned || isViewer) return;
    setIsEmittingSigned(true);
    setError(null);

    try {
      const res = await generateAndRegisterSignedReport(doc.id);
      if (res.success) {
        showToast('O Laudo Assinado oficial com QR Code pericial foi gerado com sucesso!', 'success');
        await loadDocuments();
      } else {
        setError(res.error || 'Erro ao emitir laudo assinado.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar laudo assinado.';
      setError(msg);
    } finally {
      setIsEmittingSigned(false);
    }
  };

  const handleDownload = (doc: InspectionDocument) => {
    if (!doc.signed_url) return;
    const a = window.document.createElement('a');
    a.href = doc.signed_url;
    a.download = `${doc.document_type === 'SIGNED_REPORT' ? 'LAUDO-ASSINADO' : doc.document_number}-v${doc.version}.pdf`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  const handlePrint = (doc: InspectionDocument) => {
    if (!doc.signed_url) return;
    const printWindow = window.open(doc.signed_url, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4">
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Laudos Oficiais e Assinaturas
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gestão de PDFs oficiais, snapshots imutáveis, assinaturas eletrônicas e relatórios periciais.
            </p>
          </div>
        </div>

        {/* Botão de Geração */}
        {isCompleted && canGenerate && !isViewer && (
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-95 transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Compilando Laudo PDF...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>
                  {documents.length === 0 ? 'Gerar Laudo Oficial' : `Gerar Nova Versão (v${documents.filter(d => d.document_type === 'INSPECTION_REPORT').length + 1})`}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Alerta de Vistoria Aberta */}
      {!isCompleted && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            A geração de laudos oficiais e assinaturas é permitida somente após a <strong>finalização da vistoria (COMPLETED)</strong>.
          </span>
        </div>
      )}

      {/* Mensagens de Sucesso / Erro */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Lista de Documentos */}
      {isLoading ? (
        <div className="py-8 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-xs font-semibold">Carregando histórico de laudos e assinaturas...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="py-6 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-medium text-slate-600">Nenhum laudo oficial gerado ainda.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {isCompleted
              ? 'Clique no botão acima para compilar o primeiro laudo PDF.'
              : 'Finalize a vistoria para habilitar a emissão do laudo.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {documents.map((doc, idx) => {
            const isSignedReport = doc.document_type === 'SIGNED_REPORT';
            const isLatest = idx === 0;
            const signaturesCount = doc.signatures?.length || 0;

            return (
              <div
                key={doc.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  isSignedReport
                    ? 'bg-emerald-50/40 border-emerald-200 shadow-xs'
                    : isLatest
                    ? 'bg-blue-50/30 border-blue-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Linha Principal do Documento */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-bold text-slate-900">
                        {doc.document_number}
                      </span>
                      
                      {isSignedReport ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                          <Award className="w-3 h-3" /> Laudo Assinado (v{doc.version})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Versão {doc.version}
                        </span>
                      )}

                      {isLatest && !isSignedReport && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Atual
                        </span>
                      )}

                      {signaturesCount > 0 && !isSignedReport && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <FileCheck2 className="w-3 h-3" /> {signaturesCount} {signaturesCount === 1 ? 'assinatura' : 'assinaturas'}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Emitido em {new Date(doc.generated_at).toLocaleString('pt-BR')} • {((doc.file_size || 0) / 1024).toFixed(0)} KB
                      {doc.checksum && (
                        <span className="hidden md:inline font-mono text-[10px] text-slate-400 ml-2">
                          (SHA-256: {doc.checksum.substring(0, 10)}...)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Ações Primárias */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedDoc(doc)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-xs transition-all active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Visualizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePrint(doc)}
                      className="p-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all active:scale-95"
                      title="Imprimir"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-all active:scale-95"
                      title="Baixar PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Seção de Assinaturas e Ações Periciais (Para relatórios padrão) */}
                {!isSignedReport && doc.document_status === 'READY' && (
                  <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    {/* Listagem de Signatários Registrados */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Users className="w-3 h-3" /> Signatários:
                      </span>

                      {signaturesCount === 0 ? (
                        <span className="text-xs text-slate-400 italic">Nenhuma assinatura registrada</span>
                      ) : (
                        doc.signatures?.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 font-medium shadow-2xs"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <strong>{s.signer_name}</strong>
                            <span className="text-[10px] text-slate-400">({s.signer_type})</span>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Botões de Assinatura */}
                    {!isViewer && (
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0">
                        <button
                          type="button"
                          onClick={() => setSigningDoc(doc)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Assinar Laudo</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRequestingDoc(doc)}
                          className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Convidar Signatário</span>
                        </button>

                        {signaturesCount > 0 && (
                          <button
                            type="button"
                            disabled={isEmittingSigned}
                            onClick={() => handleEmitSignedReport(doc)}
                            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                          >
                            {isEmittingSigned ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Award className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span>Emitir Laudo Assinado</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Nota de Auditoria e Imutabilidade */}
      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>
          Garantia de integridade documental e fé pública: assinaturas vinculadas criptograficamente ao SHA-256 de cada laudo.
        </span>
      </div>

      {/* Modal de Visualização */}
      {selectedDoc && (
        <DocumentViewerModal
          isOpen={!!selectedDoc}
          document={selectedDoc}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      {/* Modal de Assinatura Eletrônica Interna */}
      {signingDoc && (
        <SignDocumentModal
          isOpen={!!signingDoc}
          document={signingDoc}
          onClose={() => setSigningDoc(null)}
          onSuccess={loadDocuments}
        />
      )}

      {/* Modal de Solicitação Externa */}
      {requestingDoc && (
        <RequestSignatureModal
          isOpen={!!requestingDoc}
          document={requestingDoc}
          onClose={() => setRequestingDoc(null)}
          onSuccess={loadDocuments}
        />
      )}
    </div>
  );
};
