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
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { Skeleton } from '../ui/Skeleton';

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
    <div className="bg-white rounded-card p-5 sm:p-6 border border-yzzy-border shadow-xs space-y-4 font-sans text-yzzy-text-primary">
      
      {/* Header do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-yzzy-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-btn bg-primary-50 text-primary-700 flex items-center justify-center font-bold shrink-0">
            <FileText className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-yzzy-text-primary">
                Laudos Oficiais e Assinaturas
              </h3>
              <Badge variant="primary" size="sm">
                {documents.length} {documents.length === 1 ? 'documento' : 'documentos'}
              </Badge>
            </div>
            <p className="text-xs text-yzzy-text-secondary mt-0.5">
              Gestão de PDFs com snapshot imutável, assinaturas eletrônicas e emissão pericial.
            </p>
          </div>
        </div>

        {/* Botão de Geração */}
        {isCompleted && canGenerate && !isViewer && (
          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isGenerating}
            onClick={handleGenerate}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold shadow-xs hover:shadow-subtle-blue"
          >
            {documents.length === 0 ? 'Gerar Laudo Oficial' : `Gerar Nova Versão (v${documents.filter(d => d.document_type === 'INSPECTION_REPORT').length + 1})`}
          </Button>
        )}
      </div>

      {/* Alerta de Vistoria Aberta */}
      {!isCompleted && (
        <Alert type="warning">
          <span>
            A geração de laudos oficiais e assinaturas é permitida somente após a <strong>finalização da vistoria (Concluída)</strong>.
          </span>
        </Alert>
      )}

      {/* Mensagens de Sucesso / Erro */}
      {successMessage && (
        <Alert type="success">
          <span>{successMessage}</span>
        </Alert>
      )}

      {error && (
        <Alert type="error">
          <span>{error}</span>
        </Alert>
      )}

      {/* Lista de Documentos */}
      {isLoading ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-16 w-full rounded-card" />
          <Skeleton className="h-16 w-full rounded-card" />
        </div>
      ) : documents.length === 0 ? (
        <div className="py-8 text-center border-2 border-dashed border-yzzy-border rounded-card bg-surface-secondary/40 space-y-2">
          <FileText className="w-8 h-8 mx-auto text-yzzy-text-muted" />
          <p className="text-xs font-bold text-yzzy-text-primary">Nenhum laudo oficial gerado ainda.</p>
          <p className="text-[11px] text-yzzy-text-muted max-w-sm mx-auto">
            {isCompleted
              ? 'Clique no botão acima para compilar o primeiro laudo PDF com snapshot imutável.'
              : 'Conclua a vistoria para habilitar a emissão do laudo.'}
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
                className={`p-4 rounded-card border transition-all space-y-3 ${
                  isSignedReport
                    ? 'bg-emerald-50/40 border-emerald-200 shadow-xs'
                    : isLatest
                    ? 'bg-primary-50/20 border-primary-200 shadow-xs'
                    : 'bg-white border-yzzy-border hover:border-slate-300'
                }`}
              >
                {/* Linha Principal do Documento */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-bold text-yzzy-text-primary">
                        {doc.document_number}
                      </span>
                      
                      {isSignedReport ? (
                        <Badge variant="success" size="sm" dot>
                          <Award className="w-3 h-3 mr-1" /> Laudo Assinado (v{doc.version})
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Versão {doc.version}
                        </Badge>
                      )}

                      {isLatest && !isSignedReport && (
                        <Badge variant="primary" size="sm">
                          Atual
                        </Badge>
                      )}

                      {signaturesCount > 0 && !isSignedReport && (
                        <Badge variant="success" size="sm">
                          <FileCheck2 className="w-3 h-3 mr-1" /> {signaturesCount} {signaturesCount === 1 ? 'assinatura' : 'assinaturas'}
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-yzzy-text-muted">
                      Emitido em {new Date(doc.generated_at).toLocaleString('pt-BR')} • {((doc.file_size || 0) / 1024).toFixed(0)} KB
                      {doc.checksum && (
                        <span className="hidden md:inline font-mono text-[10px] text-slate-500 ml-2">
                          (SHA-256: {doc.checksum.substring(0, 10)}...)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Ações Primárias */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedDoc(doc)}
                      leftIcon={<Eye className="w-3.5 h-3.5 text-primary-600" />}
                      className="text-xs font-bold"
                    >
                      Visualizar
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handlePrint(doc)}
                      className="p-2"
                      title="Imprimir"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      className="p-2"
                      title="Baixar PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Seção de Assinaturas e Ações Periciais */}
                {!isSignedReport && doc.document_status === 'READY' && (
                  <div className="pt-2 border-t border-yzzy-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    {/* Listagem de Signatários Registrados */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-yzzy-text-secondary uppercase flex items-center gap-1">
                        <Users className="w-3 h-3" /> Signatários:
                      </span>

                      {signaturesCount === 0 ? (
                        <span className="text-xs text-yzzy-text-muted italic">Nenhuma assinatura registrada</span>
                      ) : (
                        doc.signatures?.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-yzzy-border rounded-btn text-[11px] text-yzzy-text-primary font-medium shadow-2xs"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <strong>{s.signer_name}</strong>
                            <span className="text-[10px] text-yzzy-text-muted">({s.signer_type})</span>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Botões de Assinatura */}
                    {!isViewer && (
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0">
                        <Button
                          type="button"
                          variant="success"
                          size="sm"
                          onClick={() => setSigningDoc(doc)}
                          leftIcon={<FileCheck2 className="w-3.5 h-3.5" />}
                          className="text-xs font-bold"
                        >
                          Assinar Laudo
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setRequestingDoc(doc)}
                          leftIcon={<Send className="w-3.5 h-3.5" />}
                          className="text-xs font-bold"
                        >
                          Convidar Signatário
                        </Button>

                        {signaturesCount > 0 && (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            isLoading={isEmittingSigned}
                            onClick={() => handleEmitSignedReport(doc)}
                            leftIcon={<Award className="w-3.5 h-3.5 text-amber-400" />}
                            className="text-xs font-bold"
                          >
                            Emitir Laudo Assinado
                          </Button>
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
      <div className="pt-2 border-t border-yzzy-border/60 text-[10px] text-yzzy-text-muted flex items-center gap-1.5">
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
