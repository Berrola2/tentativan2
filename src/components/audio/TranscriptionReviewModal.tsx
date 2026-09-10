// ==============================================================================
// VISTORIA YZZY — COMPONENT: TranscriptionReviewModal (Revisão e Aceite de IA)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Sparkles, 
  X, 
  RotateCw, 
  FileText, 
  AlertTriangle, 
  Loader2, 
  ShieldCheck 
} from 'lucide-react';
import type { InspectionTranscription } from '../../types/audio';
import { acceptTranscription } from '../../services/ai';

interface TranscriptionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcription: InspectionTranscription | null;
  existingDescription?: string | null;
  roomName?: string;
  itemName?: string;
  onApplied: (newDescription: string) => void;
  onReprocess?: (newRawText: string) => void;
}

export const TranscriptionReviewModal: React.FC<TranscriptionReviewModalProps> = ({
  isOpen,
  onClose,
  transcription,
  existingDescription,
  roomName,
  itemName,
  onApplied,
  onReprocess,
}) => {
  const [editedText, setEditedText] = useState('');
  const [editedRaw, setEditedRaw] = useState('');
  const [applyMode, setApplyMode] = useState<'REPLACE' | 'APPEND'>('REPLACE');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasExistingText = !!(existingDescription && existingDescription.trim().length > 0);

  useEffect(() => {
    if (transcription) {
      setEditedText(transcription.processed_text || transcription.raw_transcript);
      setEditedRaw(transcription.raw_transcript);
      setApplyMode(hasExistingText ? 'APPEND' : 'REPLACE');
      setError(null);
    }
  }, [transcription, hasExistingText]);

  if (!isOpen || !transcription) return null;

  const handleApply = async () => {
    if (!editedText.trim()) {
      setError('O texto da descrição não pode ficar vazio.');
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const result = await acceptTranscription({
        transcriptionId: transcription.id,
        mode: applyMode,
        customText: editedText.trim(),
      });

      if (result.success && result.appliedDescription) {
        onApplied(result.appliedDescription);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao aplicar descrição.';
      setError(msg);
    } finally {
      setIsApplying(false);
    }
  };

  const handleReprocess = () => {
    if (onReprocess && editedRaw.trim()) {
      onReprocess(editedRaw.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 flex flex-col space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-primary-600 block">
              Assistente de IA • {roomName || 'Ambiente'}
            </span>
            <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
              {itemName || 'Descrição do Item'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de Item com Texto Existente */}
        {hasExistingText && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Este item já possui uma descrição gravada:</span>
            </div>
            <p className="text-[11px] text-amber-800 italic bg-white/70 p-2.5 rounded-xl border border-amber-100 leading-relaxed">
              "{existingDescription}"
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setApplyMode('REPLACE')}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                  applyMode === 'REPLACE'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Substituir Atual
              </button>
              <button
                type="button"
                onClick={() => setApplyMode('APPEND')}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                  applyMode === 'APPEND'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Adicionar ao Final (+ Adicionar)
              </button>
            </div>
          </div>
        )}

        {/* Descrição Técnica Sugerida pela IA (Editável) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              <span>Descrição Técnica Sugerida (Editável)</span>
            </label>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Fatos Preservados
            </span>
          </div>

          <textarea
            rows={3}
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            placeholder="Texto técnico estruturado..."
            className="w-full p-3 bg-primary-50/30 border-2 border-primary-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white resize-none transition-all leading-relaxed"
          />
        </div>

        {/* Fala Original Transcrita (Editável para reprocessamento) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3 text-slate-400" />
              <span>Fala Original do Vistoriador</span>
            </label>
            {onReprocess && (
              <button
                type="button"
                onClick={handleReprocess}
                className="text-[11px] font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 min-h-[36px] px-2"
              >
                <RotateCw className="w-3 h-3" /> Reorganizar Novamente
              </button>
            )}
          </div>

          <textarea
            rows={2}
            value={editedRaw}
            onChange={(e) => setEditedRaw(e.target.value)}
            placeholder="Transcrição original..."
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 italic focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none leading-relaxed"
          />
        </div>

        {/* Erro */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* Ações com touch target >= 48px */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="sm:w-1/3 min-h-[48px] py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors flex items-center justify-center"
          >
            Manter Original
          </button>

          <button
            type="button"
            disabled={isApplying}
            onClick={handleApply}
            className="sm:w-2/3 min-h-[48px] py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Aplicando no Item...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>
                  {hasExistingText && applyMode === 'APPEND' ? 'Adicionar ao Final' : 'Usar Esta Sugestão'}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
