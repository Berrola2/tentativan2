// ==============================================================================
// VISTORIA YZZY — TIPOS OFICIAIS: ETAPA 05 (ÁUDIO, TRANSCRIÇÃO E IA)
// ==============================================================================

export type TranscriptionStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'READY' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'FAILED';

export type AudioRecordingState = 
  | 'IDLE' 
  | 'RECORDING' 
  | 'UPLOADING' 
  | 'TRANSCRIBING' 
  | 'REVIEWING' 
  | 'ERROR';

export interface InspectionTranscription {
  id: string;
  company_id: string;
  inspection_id: string;
  room_id: string | null;
  item_id: string | null;
  media_id: string | null;
  created_by: string | null;
  raw_transcript: string;
  processed_text: string | null;
  status: TranscriptionStatus;
  model: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
  duration_ms?: number;
}

export interface AIProcessingLog {
  id: string;
  company_id: string;
  inspection_id: string;
  item_id: string | null;
  user_id: string | null;
  operation_type: string;
  model: string;
  status: string;
  duration_ms: number;
  input_char_count: number;
  output_char_count: number;
  prompt_tokens?: number;
  candidates_tokens?: number;
  total_tokens?: number;
  created_at: string;
}

export interface AudioRecorderResult {
  blob: Blob;
  durationMs: number;
  mimeType: string;
  sizeBytes: number;
}

export interface ProcessAudioParams {
  inspectionId: string;
  roomId?: string | null;
  itemId?: string | null;
  roomName?: string;
  itemName?: string;
  rawTranscript: string;
}

export interface AcceptTranscriptionParams {
  transcriptionId: string;
  mode: 'REPLACE' | 'APPEND';
  customText?: string;
}
