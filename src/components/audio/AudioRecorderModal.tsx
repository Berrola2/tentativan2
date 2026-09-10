// ==============================================================================
// VISTORIA YZZY — COMPONENT: AudioRecorderModal (Gravação Mobile-First e Timer)
// ==============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Square, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { NativeAudioRecorder, AUDIO_CONFIG, isAudioRecordingSupported } from '../../services/audio';
import { VoiceSpeechService, isSpeechRecognitionSupported } from '../../services/speechRecognition';

interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (transcript: string) => void;
  roomName?: string;
  itemName?: string;
}

export const AudioRecorderModal: React.FC<AudioRecorderModalProps> = ({
  isOpen,
  onClose,
  onRecordingComplete,
  roomName,
  itemName,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const recorderRef = useRef<NativeAudioRecorder | null>(null);
  const speechRef = useRef<VoiceSpeechService | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      setLiveTranscript('');
      setError(null);
      setIsStarting(false);
      setIsFinishing(false);
      return;
    }

    if (!isAudioRecordingSupported() && !isSpeechRecognitionSupported()) {
      setError('Gravação de voz não é suportada neste navegador. Utilize o Chrome, Edge ou Safari.');
      return;
    }

    const startRecording = async () => {
      setIsStarting(true);
      setError(null);

      try {
        // 1. Iniciar Speech Recognition se suportado para transcrição instantânea
        if (isSpeechRecognitionSupported()) {
          speechRef.current = new VoiceSpeechService();
          speechRef.current.start(
            (text) => {
              setLiveTranscript(text);
            },
            (err) => {
              console.warn('[AudioRecorderModal] Aviso de reconhecimento de fala:', err);
            }
          );
        }

        // 2. Iniciar Gravação de Áudio Nativa
        recorderRef.current = new NativeAudioRecorder();
        await recorderRef.current.start((secs) => {
          setElapsedSeconds(secs);
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Falha ao acessar microfone.';
        setError(msg);
      } finally {
        setIsStarting(false);
      }
    };

    startRecording();

    return () => {
      speechRef.current?.stop();
      recorderRef.current?.cancel();
    };
  }, [isOpen]);

  const handleCancel = () => {
    speechRef.current?.stop();
    recorderRef.current?.cancel();
    onClose();
  };

  const handleFinish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);

    speechRef.current?.stop();
    await recorderRef.current?.stop();

    const finalText = liveTranscript.trim() || 'Item em bom estado de conservação.';
    onRecordingComplete(finalText);
    onClose();
  };

  if (!isOpen) return null;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const maxTimeFormatted = '02:00';
  const isNearLimit = elapsedSeconds >= AUDIO_CONFIG.WARNING_THRESHOLD_SECONDS;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Header com contexto */}
        <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="text-left">
            <span className="text-[10px] font-black uppercase tracking-wider text-primary-600 block">
              {roomName || 'Ambiente'}
            </span>
            <h3 className="text-sm font-black text-slate-900 truncate max-w-[240px]">
              {itemName || 'Descrição do Item'}
            </h3>
          </div>
          <button
            onClick={handleCancel}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Erro de Permissão / Navegador */}
        {error ? (
          <div className="space-y-4 py-4 w-full">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <p className="text-xs font-medium text-rose-600 px-4">{error}</p>
            <button
              onClick={handleCancel}
              className="w-full min-h-[48px] py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Visualizador de Gravação com Animação Pulsante */}
            <div className="relative flex items-center justify-center py-4">
              <div className="absolute w-28 h-28 rounded-full bg-rose-100 animate-ping opacity-75" />
              <div className="absolute w-24 h-24 rounded-full bg-rose-200 animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
                {isStarting ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <Mic className="w-8 h-8 animate-bounce" />
                )}
              </div>
            </div>

            {/* Cronômetro */}
            <div className="space-y-1">
              <div className={`text-3xl font-black tracking-tight ${isNearLimit ? 'text-rose-600 animate-pulse' : 'text-slate-900'}`}>
                {formattedTime} <span className="text-sm font-semibold text-slate-400">/ {maxTimeFormatted}</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {isNearLimit ? 'Atenção: Limite máximo de 2 minutos se aproximando!' : 'Fale naturalmente sobre as características do item...'}
              </p>
            </div>

            {/* Transcrição em Tempo Real */}
            <div className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left min-h-[70px] max-h-[120px] overflow-y-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Sparkles className="w-3 h-3 text-primary-600" /> Transcrição em Tempo Real
              </span>
              <p className="text-xs text-slate-700 italic leading-relaxed">
                {liveTranscript || 'Ouvindo sua fala...'}
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="w-full flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="w-1/2 min-h-[48px] py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isStarting || isFinishing}
                onClick={handleFinish}
                className="w-1/2 min-h-[48px] py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary-600/20 active:scale-95 transition-all"
              >
                {isFinishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processando...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 fill-white" />
                    <span>Concluir Fala</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
