import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Printer, 
  Loader2 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { InspectionData } from '../types/inspection';
import { generateInspectionPdf } from '../services/pdfGenerator';
import { useToast } from './Toast';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: InspectionData;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const { showToast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  useEffect(() => {
    let active = true;

    async function buildPdf() {
      if (!isOpen) {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
        return;
      }

      setIsGenerating(true);
      try {
        const doc = await generateInspectionPdf(data);
        if (active) {
          setPdfDoc(doc);
          const blob = doc.output('blob');
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
        }
      } catch (err) {
        console.error('Error generating PDF', err);
        showToast('Erro ao compilar laudo em PDF.', 'error');
      } finally {
        if (active) setIsGenerating(false);
      }
    }

    buildPdf();

    return () => {
      active = false;
    };
  }, [isOpen, data]);

  if (!isOpen) return null;

  const fileName = `Laudo_Vistoria_${(data.title || 'Imovel').replace(/\s+/g, '_')}_${data.inspectionType}.pdf`;

  const handleDownload = () => {
    if (pdfDoc) {
      pdfDoc.save(fileName);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
      showToast('Download do Laudo em PDF concluído!', 'success');
    }
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl, '_blank');
      printWindow?.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-hidden">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[95vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                Pré-visualização do Laudo de Vistoria
              </h2>
              <p className="text-[11px] text-slate-400 truncate max-w-[280px] sm:max-w-md">
                {fileName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Imprimir"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isGenerating || !pdfUrl}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-brand-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 bg-slate-950 p-2 sm:p-4 relative flex items-center justify-center overflow-hidden">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
              <p className="text-xs font-semibold">Renderizando fotos em alta resolução e diagramando PDF...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="PDF Preview"
              className="w-full h-full rounded-xl border border-slate-800 shadow-2xl bg-white"
            />
          ) : (
            <div className="text-center text-slate-500 text-xs">
              Falha ao carregar pré-visualização.
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
