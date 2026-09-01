import React, { useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { speechService, isSpeechRecognitionSupported } from '../services/speechRecognition';
import { useToast } from './Toast';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  className = '',
}) => {
  const { showToast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const toggleListening = () => {
    if (!supported) {
      showToast('Ditado por voz não suportado neste navegador. Use o Chrome ou Edge.', 'error');
      return;
    }

    if (isListening) {
      speechService.stop();
      setIsListening(false);
    } else {
      const started = speechService.start(
        (text, isFinal) => {
          if (isFinal) {
            onTranscript(text);
          }
        },
        (error) => {
          setIsListening(false);
          showToast(`Aviso de voz: ${error}`, 'info');
        },
        () => {
          setIsListening(false);
        }
      );

      if (started) {
        setIsListening(true);
        showToast('Fale agora... Seu áudio está sendo transcrito!', 'info');
      } else {
        showToast('Permissão de microfone negada ou indisponível.', 'error');
      }
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
        isListening
          ? 'bg-rose-600 text-white animate-recording ring-4 ring-rose-300 shadow-md'
          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm'
      } ${className}`}
      title={isListening ? 'Parar gravação' : 'Ditar descrição por voz'}
    >
      {isListening ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          <MicOff className="w-3.5 h-3.5" />
          <span>Ouvindo...</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5 text-brand-600" />
          <span>Ditar por Voz</span>
        </>
      )}
    </button>
  );
};
