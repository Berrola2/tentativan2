import React, { useState, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Upload, 
  Sparkles, 
  Camera, 
  Save, 
  Trash2, 
  AlertTriangle, 
  Maximize2,
  FileAudio,
  ArrowLeft
} from 'lucide-react';
import { speechService, isSpeechRecognitionSupported } from '../services/speechRecognition';
import { 
  parseTranscribedTextToSections, 
  convertSectionsToRooms, 
  type TranscribedSection 
} from '../services/audioTranscription';
import { compressImage } from '../services/imageCompressor';
import { useToast } from './Toast';
import type { Room } from '../types/inspection';

interface AudioInspectionViewProps {
  onBack: () => void;
  onSaveToInspection: (newRooms: Room[]) => void;
  onViewPhoto: (url: string, caption?: string) => void;
}

export const AudioInspectionView: React.FC<AudioInspectionViewProps> = ({
  onBack,
  onSaveToInspection,
  onViewPhoto,
}) => {
  const { showToast } = useToast();
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [sections, setSections] = useState<TranscribedSection[]>([]);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  const startVoiceRecording = () => {
    if (!isSpeechRecognitionSupported()) {
      showToast('Navegador sem suporte ao ditado de voz contínuo. Use o Google Chrome ou Edge.', 'error');
      return;
    }

    const started = speechService.start(
      (text, isFinal) => {
        if (isFinal) {
          setTranscribedText((prev) => (prev ? `${prev} ${text}` : text));
        }
      },
      (error) => {
        setIsRecording(false);
        showToast(`Aviso de áudio: ${error}`, 'info');
      },
      () => {
        setIsRecording(false);
      }
    );

    if (started) {
      setIsRecording(true);
      showToast('Gravação iniciada! Fale os cômodos e detalhes (ex: "Sala: pintura nova. Cozinha: pia com torneira vazando...")', 'info');
    }
  };

  const stopVoiceRecording = () => {
    speechService.stop();
    setIsRecording(false);
    showToast('Gravação finalizada! Clique em "Estruturar Texto" para organizar os itens.', 'success');
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const audioUrl = URL.createObjectURL(file);
    setAudioSrc(audioUrl);
    showToast(`Áudio "${file.name}" carregado!`, 'success');
  };

  const handleProcessTranscription = () => {
    if (!transcribedText.trim()) {
      showToast('Grave um áudio ou digite o texto para estruturar os itens.', 'error');
      return;
    }

    const parsed = parseTranscribedTextToSections(transcribedText);
    setSections(parsed);
    showToast(`${parsed.length} itens identificados a partir do áudio!`, 'success');
  };

  const handleAddPhotoToSection = async (
    sectionId: string,
    files: FileList | null
  ) => {
    if (!files || files.length === 0) return;

    try {
      const processed: { id: string; dataUrl: string; timestamp: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i]);
        processed.push({
          id: Math.random().toString(36).substring(2, 9),
          dataUrl: compressed,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }

      setSections((prev) =>
        prev.map((sec) => {
          if (sec.id === sectionId) {
            return {
              ...sec,
              photos: [...sec.photos, ...processed],
            };
          }
          return sec;
        })
      );
      showToast(`${processed.length} foto(s) anexada(s) ao item!`, 'success');
    } catch (err) {
      showToast('Erro ao processar fotos.', 'error');
    }
  };

  const handleRemovePhoto = (sectionId: string, photoId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id === sectionId) {
          return {
            ...sec,
            photos: sec.photos.filter((p) => p.id !== photoId),
          };
        }
        return sec;
      })
    );
  };

  const handleDeleteSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const handleSaveAllToInspection = () => {
    if (sections.length === 0) {
      showToast('Nenhum item estruturado para salvar.', 'error');
      return;
    }

    const newRooms = convertSectionsToRooms(sections);
    onSaveToInspection(newRooms);
    showToast(`${newRooms.length} cômodo(s) integrado(s) com sucesso ao Laudo!`, 'success');
    onBack();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <Mic className="w-5 h-5 text-brand-600" />
              Vistoria por Áudio & Atribuição de Fotos
            </h1>
            <p className="text-xs text-slate-500">
              Grave ou suba o áudio do que foi falado no imóvel, e depois apenas anexe as fotos para cada item descrito.
            </p>
          </div>
        </div>

        {sections.length > 0 && (
          <button
            onClick={handleSaveAllToInspection}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-brand-600/20 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Salvar no Laudo</span>
          </button>
        )}
      </div>

      {/* 1. Audio Recording & Upload Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Passo 1: Gravar Áudio ou Carregar Arquivo de Voz</h2>
            <p className="text-xs text-slate-500">
              Fale livremente descrevendo os cômodos, estado dos materiais e avarias.
            </p>
          </div>

          {/* Action triggers */}
          <div className="flex items-center gap-2">
            {isRecording ? (
              <button
                onClick={stopVoiceRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg animate-recording"
              >
                <MicOff className="w-4 h-4" />
                <span>Parar Gravação</span>
              </button>
            ) : (
              <button
                onClick={startVoiceRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/20 transition-all active:scale-95"
              >
                <Mic className="w-4 h-4" />
                <span>Gravar Voz ao Vivo</span>
              </button>
            )}

            <button
              onClick={() => audioFileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Subir Áudio Gravado</span>
            </button>
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.aac"
              onChange={handleAudioFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Audio Player if file uploaded */}
        {audioSrc && (
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileAudio className="w-5 h-5 text-brand-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-slate-800 block truncate max-w-xs">{audioFileName}</span>
                <span className="text-[10px] text-slate-400">Arquivo de áudio carregado</span>
              </div>
            </div>
            <audio src={audioSrc} controls className="h-9 w-64 max-w-full" />
          </div>
        )}

        {/* Transcribed text box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">
              Texto Transcrito do Áudio / Descrição Falada
            </label>
            <span className="text-[11px] text-slate-400">
              {isRecording ? 'Gravando e transcrevendo ao vivo...' : 'Você pode editar ou digitar se preferir'}
            </span>
          </div>

          <textarea
            value={transcribedText}
            onChange={(e) => setTranscribedText(e.target.value)}
            rows={4}
            placeholder="Exemplo do que você pode falar ou colar:&#10;&#10;Sala de Estar: pintura nova na cor branca, piso laminado intacto sem riscos, janela de alumínio funcionando perfeitamente.&#10;&#10;Cozinha: bancada de granito sem trincas, torneira com gotejamento constante precisando de reparo, tomadas 110V testadas.&#10;&#10;Banheiro: vaso sanitário com descarga em ordem, box de vidro temperado limpo e sem folga."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 text-xs sm:text-sm focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
          />

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleProcessTranscription}
              disabled={!transcribedText.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Estruturar Cômodos e Itens Automaticamente</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Structured Sections with Photo Attribution */}
      {sections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Passo 2: Atribuir Fotos aos Itens Descritos ({sections.length})
              </h2>
              <p className="text-xs text-slate-500">
                Toque no botão da câmera de cada bloco para tirar ou selecionar as fotos correspondentes ao que foi falado.
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            {sections.map((sec) => {
              const fileCameraRef = React.createRef<HTMLInputElement>();
              const fileGalleryRef = React.createRef<HTMLInputElement>();

              return (
                <div
                  key={sec.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 border border-brand-200">
                        {sec.roomName}
                      </span>
                      <strong className="text-sm font-bold text-slate-800">
                        {sec.itemName}
                      </strong>
                      {sec.needRepair && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Reparo Detectado
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteSection(sec.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 self-end sm:self-center transition-colors"
                      title="Excluir item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Description from Speech */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700">
                    <span className="font-semibold text-slate-500 block text-[10px] uppercase mb-0.5">Descrição Falada:</span>
                    {sec.description}
                  </div>

                  {/* Photo Attribution Area */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-700">
                        Fotos Atribuídas a este Item ({sec.photos.length})
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileCameraRef.current?.click()}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Tirar Foto</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileGalleryRef.current?.click()}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs border border-slate-200 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Galeria</span>
                        </button>

                        <input
                          ref={fileCameraRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          onChange={(e) => handleAddPhotoToSection(sec.id, e.target.files)}
                          className="hidden"
                        />
                        <input
                          ref={fileGalleryRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleAddPhotoToSection(sec.id, e.target.files)}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Photos grid */}
                    {sec.photos.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                        {sec.photos.map((photo, pIdx) => (
                          <div
                            key={photo.id}
                            className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm"
                          >
                            <img
                              src={photo.dataUrl}
                              alt={`Foto ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => onViewPhoto(photo.dataUrl, `${sec.itemName} - Foto ${pIdx + 1}`)}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(sec.id, photo.id)}
                              className="absolute top-1 right-1 p-1 rounded-md bg-rose-600 text-white shadow transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        onClick={() => fileCameraRef.current?.click()}
                        className="border border-dashed border-slate-300 hover:border-brand-500 rounded-xl p-3 text-center bg-slate-50 cursor-pointer text-slate-400 hover:text-brand-600 flex items-center justify-center gap-2 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        <span className="text-xs">Nenhuma foto anexada. Toque aqui para tirar a foto deste item.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Save CTA */}
          <div className="flex justify-end pt-3 pb-8">
            <button
              onClick={handleSaveAllToInspection}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-600/30 transition-all active:scale-95"
            >
              <Save className="w-5 h-5" />
              <span>Concluir e Salvar no Laudo de Vistoria</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
