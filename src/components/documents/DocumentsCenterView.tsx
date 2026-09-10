import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Search, 
  Download, 
  Eye, 
  ShieldCheck, 
  PenTool, 
  Calendar, 
  Building, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  XCircle,
  ExternalLink
} from 'lucide-react';
import { listAllCompanyDocuments, getDocumentSignedUrl } from '../../services/documents';
import type { InspectionDocument } from '../../types/document';
import { DocumentViewerModal } from './DocumentViewerModal';
import { SignDocumentModal } from './SignDocumentModal';
import { RequestSignatureModal } from './RequestSignatureModal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { Alert } from '../ui/Alert';
import { useToast } from '../Toast';

interface DocumentsCenterViewProps {
  onOpenInspection?: (inspectionId: string) => void;
}

export const DocumentsCenterView: React.FC<DocumentsCenterViewProps> = ({
  onOpenInspection,
}) => {
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INSPECTION_REPORT' | 'SIGNED_REPORT'>('ALL');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modais
  const [viewerDoc, setViewerDoc] = useState<InspectionDocument | null>(null);
  const [signingDoc, setSigningDoc] = useState<InspectionDocument | null>(null);
  const [requestingDoc, setRequestingDoc] = useState<InspectionDocument | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await listAllCompanyDocuments();
      setDocuments(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar documentos oficiais.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = documents.filter((doc) => {
    if (typeFilter !== 'ALL' && doc.document_type !== typeFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const docNum = doc.document_number?.toLowerCase() || '';
      const street = doc.inspection?.property?.street?.toLowerCase() || '';
      const city = doc.inspection?.property?.city?.toLowerCase() || '';
      const title = doc.inspection?.title?.toLowerCase() || '';
      return docNum.includes(term) || street.includes(term) || city.includes(term) || title.includes(term);
    }

    return true;
  });

  const handleDownload = async (doc: any) => {
    let url = doc.signed_url;
    if (!url && doc.storage_path) {
      url = await getDocumentSignedUrl(doc.storage_path);
    }

    if (!url) {
      showToast('Não foi possível obter o link para download do PDF.', 'error');
      return;
    }

    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.document_type === 'SIGNED_REPORT' ? 'LAUDO-ASSINADO' : doc.document_number}-v${doc.version}.pdf`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  const handleCopyVerificationLink = (doc: any) => {
    const code = doc.verification_code || doc.id;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.yzzy.com.br';
    const verifyUrl = `${origin}/verify/${code}`;
    navigator.clipboard.writeText(verifyUrl);
    setCopiedId(doc.id);
    showToast('Link público de verificação pericial copiado!', 'success');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getDocTypeBadge = (type: string) => {
    if (type === 'SIGNED_REPORT') {
      return (
        <Badge variant="success" size="sm" dot>
          Laudo Assinado
        </Badge>
      );
    }
    return (
      <Badge variant="primary" size="sm">
        Laudo Oficial
      </Badge>
    );
  };

  return (
    <div className="space-y-6 font-sans text-yzzy-text-primary animate-fadeIn">
      
      {/* 1. Header do Módulo */}
      <div className="bg-white p-6 sm:p-7 rounded-card border border-yzzy-border shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100/60">
            <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
            <span>Documentação Oficial & Integridade</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-yzzy-text-primary tracking-tight font-display">
            Central de Documentos & Laudos
          </h1>
          <p className="text-xs sm:text-sm text-yzzy-text-secondary">
            Consulte laudos emitidos, assinaturas eletrônicas e verifique a integridade dos snapshots periciais.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" size="md">
            Integridade SHA-256 Ativa
          </Badge>
        </div>
      </div>

      {/* 2. Barra de Busca e Filtros */}
      <div className="bg-white p-4 sm:p-5 rounded-card border border-yzzy-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-yzzy-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por número do laudo (#LAUDO-...), endereço ou imóvel..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-surface-secondary border border-yzzy-border rounded-input text-xs sm:text-sm text-yzzy-text-primary placeholder:text-yzzy-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 hover:border-slate-300 transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-yzzy-text-muted hover:text-yzzy-text-primary p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
                typeFilter === 'ALL'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('INSPECTION_REPORT')}
              className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
                typeFilter === 'INSPECTION_REPORT'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
              }`}
            >
              Laudos Oficiais
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('SIGNED_REPORT')}
              className={`px-3 py-1.5 rounded-btn text-xs font-bold transition-colors whitespace-nowrap ${
                typeFilter === 'SIGNED_REPORT'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-secondary text-yzzy-text-secondary hover:text-yzzy-text-primary'
              }`}
            >
              Laudos Assinados
            </button>
          </div>

        </div>
      </div>

      {errorMessage && (
        <Alert type="error">
          <span>{errorMessage}</span>
        </Alert>
      )}

      {/* 3. Listagem de Documentos Oficiais */}
      <div className="bg-white rounded-card border border-yzzy-border shadow-xs overflow-hidden">
        
        <div className="px-6 py-4 border-b border-yzzy-border/60 flex justify-between items-center bg-surface-secondary/30">
          <h2 className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
            Documentos Homologados
          </h2>
          <span className="text-xs text-yzzy-text-muted font-semibold">
            {filteredDocuments.length} documento(s) encontrado(s)
          </span>
        </div>

        {/* Loading Skeletons */}
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="p-5 border border-yzzy-border/60 rounded-card space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="w-48 h-5" />
                  <Skeleton className="w-24 h-5 rounded-full" />
                </div>
                <Skeleton className="w-3/4 h-4" />
                <Skeleton className="w-1/2 h-4" />
              </div>
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          /* Empty State (Rule 32) */
          <div className="py-14 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-yzzy-text-primary">
              Nenhum documento disponível.
            </h3>
            <p className="text-xs text-yzzy-text-muted max-w-md mx-auto">
              Os laudos são emitidos a partir das vistorias finalizadas. Conclua uma vistoria para gerar seu PDF com snapshot imutável e coletar assinaturas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-yzzy-border/60">
            {filteredDocuments.map((doc) => {
              const signaturesCount = doc.signatures?.length || 0;
              const formattedDate = doc.created_at 
                ? new Date(doc.created_at).toLocaleDateString('pt-BR') 
                : 'Data recente';
              const property = doc.inspection?.property;

              return (
                <div
                  key={doc.id}
                  className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-surface-secondary/40 transition-colors group"
                >
                  <div className="space-y-2.5 min-w-0">
                    
                    {/* Linha Superior: Número do Laudo, Tipo e Versão */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-bold text-yzzy-text-primary bg-surface-secondary px-2.5 py-1 rounded-md border border-yzzy-border">
                        #{doc.document_number}
                      </span>
                      {getDocTypeBadge(doc.document_type)}
                      <span className="text-[11px] font-mono font-bold text-yzzy-text-muted bg-surface-secondary px-2 py-0.5 rounded-md border border-yzzy-border">
                        v{doc.version}
                      </span>
                      {doc.checksum_sha256 && (
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 hidden sm:inline" title={`Checksum SHA-256: ${doc.checksum_sha256}`}>
                          SHA-256: {doc.checksum_sha256.substring(0, 8)}...
                        </span>
                      )}
                    </div>

                    {/* Imóvel e Vistoria */}
                    {property && (
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-yzzy-text-primary">
                        <Building className="w-4 h-4 text-primary-600 shrink-0" />
                        <span>
                          {property.street}{property.number ? `, ${property.number}` : ''}
                          {property.complement ? ` • ${property.complement}` : ''}
                          <span className="text-yzzy-text-muted font-normal"> — {property.city}</span>
                        </span>
                      </div>
                    )}

                    {/* Metadados e Status de Assinaturas */}
                    <div className="flex items-center gap-3 text-xs text-yzzy-text-secondary flex-wrap pt-0.5">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-yzzy-text-muted" />
                        <span>Emitido em {formattedDate}</span>
                      </span>

                      {signaturesCount > 0 ? (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {signaturesCount} {signaturesCount === 1 ? 'assinatura coletada' : 'assinaturas coletadas'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span>•</span>
                          <span className="text-amber-700 font-medium flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Pendente de assinaturas
                          </span>
                        </>
                      )}

                      {doc.verification_code && (
                        <>
                          <span>•</span>
                          <span className="text-primary-700 font-mono text-[11px]">
                            Cód: {doc.verification_code}
                          </span>
                        </>
                      )}

                      {doc.inspection?.id && onOpenInspection && (
                        <>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => onOpenInspection(doc.inspection.id)}
                            className="text-primary-600 hover:text-primary-700 hover:underline font-medium inline-flex items-center gap-1"
                          >
                            <span>Ver vistoria</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>

                  </div>

                  {/* Ações de Documento */}
                  <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto shrink-0">
                    
                    {/* Visualizar PDF */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setViewerDoc(doc)}
                      leftIcon={<Eye className="w-3.5 h-3.5 text-primary-600" />}
                      className="text-xs font-bold"
                    >
                      Visualizar
                    </Button>

                    {/* Download */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(doc)}
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                      title="Baixar PDF"
                    >
                      Download
                    </Button>

                    {/* Assinar Eletronicamente */}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSigningDoc(doc)}
                      leftIcon={<PenTool className="w-3.5 h-3.5" />}
                      className="text-xs font-bold"
                    >
                      Assinar
                    </Button>

                    {/* Copiar Link de Verificação */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyVerificationLink(doc)}
                      leftIcon={copiedId === doc.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      className="text-xs font-semibold"
                      title="Copiar Link de Verificação"
                    >
                      {copiedId === doc.id ? 'Copiado!' : 'Verificação'}
                    </Button>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Modais de Visualização e Assinatura */}
      {viewerDoc && (
        <DocumentViewerModal
          isOpen={!!viewerDoc}
          document={viewerDoc}
          onClose={() => setViewerDoc(null)}
        />
      )}

      {signingDoc && (
        <SignDocumentModal
          isOpen={!!signingDoc}
          document={signingDoc}
          onClose={() => setSigningDoc(null)}
          onSuccess={() => {
            setSigningDoc(null);
            loadDocuments();
            showToast('Assinatura registrada com sucesso no documento!', 'success');
          }}
        />
      )}

      {requestingDoc && (
        <RequestSignatureModal
          isOpen={!!requestingDoc}
          document={requestingDoc}
          onClose={() => setRequestingDoc(null)}
          onSuccess={() => {
            setRequestingDoc(null);
            loadDocuments();
            showToast('Solicitação de assinatura externa enviada com sucesso!', 'success');
          }}
        />
      )}

    </div>
  );
};
