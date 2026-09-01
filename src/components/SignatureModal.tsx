import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  PenTool, 
  RotateCcw, 
  Save, 
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useToast } from './Toast';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectorName: string;
  tenantName: string;
  inspectorSignature?: string;
  tenantSignature?: string;
  useGovBrSignatures?: boolean;
  onSave: (signatures: {
    inspectorSignature?: string;
    tenantSignature?: string;
    useGovBrSignatures?: boolean;
  }) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  inspectorName,
  tenantName,
  inspectorSignature,
  tenantSignature,
  useGovBrSignatures = false,
  onSave,
}) => {
  const { showToast } = useToast();

  const inspectorCanvasRef = useRef<HTMLCanvasElement>(null);
  const tenantCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isGovBr, setIsGovBr] = useState(useGovBrSignatures);
  const [hasInspectorSigned, setHasInspectorSigned] = useState(!!inspectorSignature);
  const [hasTenantSigned, setHasTenantSigned] = useState(!!tenantSignature);

  // Setup canvas drawing listeners
  const setupCanvas = (
    canvas: HTMLCanvasElement | null, 
    initialImage?: string,
    onSignStateChange?: (signed: boolean) => void
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high DPI display scale
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#0f172a'; // dark corporate ink
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear background to white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // If existing signature dataUrl, draw it
    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialImage;
    }

    let isDrawing = false;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      if (onSignStateChange) onSignStateChange(true);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawing = false;
    };

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - r.left,
        y: clientY - r.top,
      };
    };

    canvas.onmousedown = startDrawing;
    canvas.onmousemove = draw;
    canvas.onmouseup = stopDrawing;
    canvas.onmouseleave = stopDrawing;

    canvas.ontouchstart = (e) => {
      e.preventDefault();
      startDrawing(e);
    };
    canvas.ontouchmove = (e) => {
      e.preventDefault();
      draw(e);
    };
    canvas.ontouchend = stopDrawing;
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        setupCanvas(inspectorCanvasRef.current, inspectorSignature, setHasInspectorSigned);
        setupCanvas(tenantCanvasRef.current, tenantSignature, setHasTenantSigned);
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClearInspector = () => {
    const canvas = inspectorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasInspectorSigned(false);
  };

  const handleClearTenant = () => {
    const canvas = tenantCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasTenantSigned(false);
  };

  const handleSave = () => {
    let finalInspectorSig: string | undefined = undefined;
    let finalTenantSig: string | undefined = undefined;

    if (inspectorCanvasRef.current && hasInspectorSigned) {
      finalInspectorSig = inspectorCanvasRef.current.toDataURL('image/png');
    }
    if (tenantCanvasRef.current && hasTenantSigned) {
      finalTenantSig = tenantCanvasRef.current.toDataURL('image/png');
    }

    onSave({
      inspectorSignature: finalInspectorSig,
      tenantSignature: finalTenantSig,
      useGovBrSignatures: isGovBr,
    });

    showToast('Assinaturas salvas com sucesso!', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Assinaturas do Laudo</h2>
              <p className="text-xs text-slate-400">Assine com o dedo/caneta na tela ou selecione Gov.br</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Gov.br Option */}
          <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-start gap-3">
            <input
              type="checkbox"
              id="chk-govbr"
              checked={isGovBr}
              onChange={(e) => setIsGovBr(e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-brand-600 bg-slate-800 border-slate-700 focus:ring-brand-500"
            />
            <label htmlFor="chk-govbr" className="text-xs text-slate-300 cursor-pointer">
              <strong className="text-white block mb-0.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                Opção: Utilizar Assinatura Digital Externa (Gov.br / ICP-Brasil)
              </strong>
              Ao marcar esta opção, o PDF incluirá a declaração formal de conformidade para assinatura com certificado digital Gov.br ou Adobe Sign após o download.
            </label>
          </div>

          {/* Inspector Signature Pad */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-brand-400" />
                Assinatura do Vistoriador ({inspectorName || 'Vistoriador'})
              </span>
              <button
                type="button"
                onClick={handleClearInspector}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-white touch-none">
              <canvas
                ref={inspectorCanvasRef}
                className="w-full h-32 cursor-crosshair block"
              />
              <div className="absolute bottom-1 right-2 text-[10px] text-slate-400 pointer-events-none select-none font-medium">
                Desenhe sua assinatura acima
              </div>
            </div>
          </div>

          {/* Tenant Signature Pad */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                Assinatura do Locatário / Inquilino ({tenantName || 'Locatário'})
              </span>
              <button
                type="button"
                onClick={handleClearTenant}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar</span>
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-white touch-none">
              <canvas
                ref={tenantCanvasRef}
                className="w-full h-32 cursor-crosshair block"
              />
              <div className="absolute bottom-1 right-2 text-[10px] text-slate-400 pointer-events-none select-none font-medium">
                Desenhe sua assinatura acima
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-3 bg-slate-900/90">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-600/30 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Assinaturas</span>
          </button>
        </div>

      </div>
    </div>
  );
};
