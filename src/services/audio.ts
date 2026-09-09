// ==============================================================================
// VISTORIA YZZY — SERVICE: GRAVAÇÃO E CAPTURA DE ÁUDIO NATIVO (ETAPA 05)
// ==============================================================================

import type { AudioRecorderResult } from '../types/audio';

export const AUDIO_CONFIG = {
  MAX_RECORDING_SECONDS: 120, // 2 minutos máximo por descrição
  WARNING_THRESHOLD_SECONDS: 100, // Avisar quando faltar 20 segundos
  SAMPLE_RATE: 44100,
};

// Detecção dos formatos de áudio suportados pelo navegador
export function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    return 'audio/webm';
  }

  const candidateTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/m4a',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/wav',
  ];

  for (const type of candidateTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return '';
}

export function isAudioRecordingSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder !== 'undefined'
  );
}

export class NativeAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private onTickCallback: ((seconds: number) => void) | null = null;
  private mimeType = '';

  public async start(onTick?: (seconds: number) => void): Promise<boolean> {
    if (!isAudioRecordingSupported()) {
      throw new Error('Gravação de áudio não suportada neste navegador.');
    }

    try {
      this.mimeType = getSupportedAudioMimeType();
      this.audioChunks = [];
      this.onTickCallback = onTick || null;

      // Solicitar APENAS permissão de microfone (sem câmera/localização)
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const options: MediaRecorderOptions = this.mimeType ? { mimeType: this.mimeType } : {};
      this.mediaRecorder = new MediaRecorder(this.audioStream, options);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250); // Coleta a cada 250ms
      this.startTime = Date.now();

      // Cronômetro em tempo real
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        this.onTickCallback?.(elapsedSeconds);

        // Auto-stop ao atingir o tempo máximo
        if (elapsedSeconds >= AUDIO_CONFIG.MAX_RECORDING_SECONDS) {
          this.stop();
        }
      }, 500);

      return true;
    } catch (err: unknown) {
      this.cleanup();
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Permission denied') || message.includes('NotAllowedError') || message.includes('denied')) {
        throw new Error('Permissão de microfone negada. Verifique as configurações do navegador e tente novamente.');
      } else if (message.includes('NotFoundError') || message.includes('DevicesNotFoundError')) {
        throw new Error('Nenhum microfone foi detectado neste dispositivo.');
      }
      throw new Error(`Não foi possível acessar o microfone: ${message || 'Erro desconhecido.'}`);
    }
  }

  public async stop(): Promise<AudioRecorderResult | null> {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      this.cleanup();
      return null;
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanup();
        return resolve(null);
      }

      this.mediaRecorder.onstop = () => {
        const durationMs = Date.now() - this.startTime;
        const blob = new Blob(this.audioChunks, {
          type: this.mimeType || 'audio/webm',
        });

        const result: AudioRecorderResult = {
          blob,
          durationMs,
          mimeType: this.mimeType || 'audio/webm',
          sizeBytes: blob.size,
        };

        this.cleanup();
        resolve(result);
      };

      try {
        this.mediaRecorder.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  public cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Silencioso no cancelamento
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}
