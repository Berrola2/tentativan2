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
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Sugestões Inteligentes de Termos Técnicos</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[10px] text-slate-400 hidden sm:inline">Toque para inserir</span>
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
                className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                  selectedCategoryIndex === idx
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
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
                className="text-left text-xs bg-white hover:bg-brand-50 hover:border-brand-300 border border-slate-200 text-slate-700 hover:text-brand-700 px-2.5 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
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
