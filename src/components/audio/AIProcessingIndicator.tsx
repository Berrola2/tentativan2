// ==============================================================================
// VISTORIA YZZY — COMPONENT: AIProcessingIndicator (Feedback Visual em Fases)
// ==============================================================================

import React from 'react';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';

interface AIProcessingIndicatorProps {
  phase: 'RECORDING' | 'TRANSCRIBING' | 'FORMATTING' | 'READY';
  className?: string;
}

export const AIProcessingIndicator: React.FC<AIProcessingIndicatorProps> = ({
  phase,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
      phase === 'READY'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
    } ${className}`}>
      {phase === 'READY' ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
      )}

      <span>
        {phase === 'RECORDING' && 'Gravando áudio...'}
        {phase === 'TRANSCRIBING' && 'Transcrevendo fala...'}
        {phase === 'FORMATTING' && 'Redigindo descrição técnica com IA...'}
        {phase === 'READY' && 'Pronto para revisar'}
      </span>

      <Sparkles className="w-3 h-3 text-blue-500 ml-0.5" />
    </div>
  );
};
