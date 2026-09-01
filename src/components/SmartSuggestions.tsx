import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { SMART_SUGGESTIONS } from '../data/suggestions';

interface SmartSuggestionsProps {
  onSelectSuggestion: (text: string) => void;
}

export const SmartSuggestions: React.FC<SmartSuggestionsProps> = ({ onSelectSuggestion }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);

  return (
    <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sugestões Inteligentes de Termos Técnicos</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[10px] text-slate-500 hidden sm:inline">Toque para inserir</span>
      </div>

      {isOpen && (
        <div className="pt-2 space-y-2.5 animate-fadeIn">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
            {SMART_SUGGESTIONS.map((cat, idx) => (
              <button
                key={cat.title}
                type="button"
                onClick={() => setSelectedCategoryIndex(idx)}
                className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                  selectedCategoryIndex === idx
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.title}
              </button>
            ))}
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {SMART_SUGGESTIONS[selectedCategoryIndex].items.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectSuggestion(suggestion)}
                className="text-left text-xs bg-slate-800/70 hover:bg-brand-900/40 hover:border-brand-500/50 border border-slate-700/60 text-slate-200 hover:text-brand-200 px-2.5 py-1.5 rounded-lg transition-all active:scale-95"
              >
                + {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
