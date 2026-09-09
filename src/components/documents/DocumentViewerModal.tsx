// ==============================================================================
// VISTORIA YZZY — COMPONENT: DocumentViewerModal (Visualizador Oficial de PDF)
// ==============================================================================

import React from 'react';
import { X, Download, Printer, FileText, ShieldCheck } from 'lucide-react';
import type { InspectionDocument } from '../../types/document';

interface DocumentViewerModalProps {
  document: InspectionDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  document,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !document) return null;

  const pdfUrl = document.signed_url;

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = window.document.createElement('a');
    a.href = pdfUrl;
    a.download = `${document.document_number}-v${document.version}.pdf`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!pdfUrl) return;
    const printWindow = window.open(pdfUrl, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200">
      
      {/* Top Bar */}
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white tracking-wide">
                {document.document_number}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/20">
                Versão {document.version}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Snapshot Imutável
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Gerado em {new Date(document.generated_at).toLocaleString('pt-BR')} • {((document.file_size || 0) / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
            title="Imprimir Laudo"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
            title="Baixar Arquivo PDF"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-2"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Visualizador Iframe / Object */}
      <div className="flex-1 bg-slate-950 p-2 sm:p-4 flex items-center justify-center overflow-hidden">
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            title={`Laudo ${document.document_number}`}
            className="w-full h-full rounded-2xl bg-white shadow-2xl border border-slate-800"
          />
        ) : (
          <div className="text-center text-slate-400 space-y-2">
            <FileText className="w-12 h-12 mx-auto text-slate-600 animate-pulse" />
            <p className="text-sm font-bold">Carregando visualização segura do PDF...</p>
          </div>
        )}
      </div>

      {/* Footer com Hash de Integridade */}
      {document.checksum && (
        <div className="bg-slate-900 px-4 py-2 text-center text-[10px] text-slate-500 font-mono border-t border-slate-800 truncate">
          SHA-256 Checksum: {document.checksum}
        </div>
      )}

    </div>
  );
};
