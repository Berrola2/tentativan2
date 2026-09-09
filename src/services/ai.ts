// ==============================================================================
// VISTORIA YZZY — SERVICE: ASSISTENTE DE IA E TRANSCRIÇÃO (ETAPA 05)
// ==============================================================================

import { supabase } from './supabaseClient';
import type { 
  ProcessAudioParams, 
  InspectionTranscription, 
  AcceptTranscriptionParams 
} from '../types/audio';

/**
 * Envia fala/transcrição para processamento pela IA Gemini server-side.
 * Nunca expõe chaves secretas no cliente.
 */
export async function processAudioWithAI(params: ProcessAudioParams): Promise<InspectionTranscription> {
  const { inspectionId, roomId, itemId, roomName, itemName, rawTranscript } = params;

  if (!rawTranscript || !rawTranscript.trim()) {
    throw new Error('A transcrição de áudio está vazia.');
  }

  // 1. Chamar Supabase Edge Function com autenticação JWT
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const { data, error } = await supabase.functions.invoke('process-inspection-audio', {
      body: {
        inspectionId,
        roomId: roomId || null,
        itemId: itemId || null,
        roomName: roomName || 'Ambiente',
        itemName: itemName || 'Item',
        rawTranscript: rawTranscript.trim(),
      },
    });

    if (error) {
      console.warn('[AIService] Edge function retornou aviso, aplicando fallback:', error.message);
      // Fallback: criar registro direto no banco
      return createDirectTranscriptionFallback(params);
    }

    if (data?.success && data?.transcription) {
      return data.transcription as InspectionTranscription;
    }

    return createDirectTranscriptionFallback(params);
  } catch (err: unknown) {
    console.warn('[AIService] Falha na invocação da Edge Function, aplicando fallback:', err);
    return createDirectTranscriptionFallback(params);
  }
}

/**
 * Fallback determinístico de segurança caso a Edge Function esteja offline.
 */
async function createDirectTranscriptionFallback(params: ProcessAudioParams): Promise<InspectionTranscription> {
  const { inspectionId, roomId, itemId, rawTranscript } = params;
  
  // Normalização básica no cliente
  let processed = rawTranscript.trim();
  processed = processed.charAt(0).toUpperCase() + processed.slice(1);
  if (!processed.endsWith('.')) processed += '.';

  processed = processed
    .replace(/\btá\b/gi, 'está')
    .replace(/\btão\b/gi, 'estão')
    .replace(/\bné\b/gi, '')
    .replace(/\bmarquinha\b/gi, 'pequena marca')
    .replace(/\brisquinho\b/gi, 'pequeno risco');

  const { data, error } = await supabase
    .from('inspection_transcriptions')
    .insert({
      inspection_id: inspectionId,
      room_id: roomId || null,
      item_id: itemId || null,
      raw_transcript: rawTranscript.trim(),
      processed_text: processed,
      status: 'READY',
      model: 'deterministic-fallback',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao registrar transcrição no banco: ${error.message}`);
  }

  return data as InspectionTranscription;
}

/**
 * Aceita a transcrição e atualiza a descrição do item (REPLACE ou APPEND).
 */
export async function acceptTranscription(params: AcceptTranscriptionParams): Promise<{
  success: boolean;
  appliedDescription?: string;
  error?: string;
}> {
  const { transcriptionId, mode, customText } = params;

  const { data, error } = await supabase.rpc('accept_inspection_transcription', {
    p_transcription_id: transcriptionId,
    p_mode: mode,
    p_custom_text: customText || null,
  });

  if (error) {
    console.error('[AIService] Erro ao aceitar transcrição via RPC:', error.message);
    throw new Error(`Falha ao aplicar descrição: ${error.message}`);
  }

  const res = data as { success: boolean; applied_description?: string; error?: string };

  if (!res.success) {
    throw new Error(res.error || 'Não foi possível aplicar a descrição no item.');
  }

  return {
    success: true,
    appliedDescription: res.applied_description,
  };
}

/**
 * Lista transcrições históricas de um item.
 */
export async function listTranscriptions(inspectionId: string, itemId?: string): Promise<InspectionTranscription[]> {
  let query = supabase
    .from('inspection_transcriptions')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('created_at', { ascending: false });

  if (itemId) {
    query = query.eq('item_id', itemId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[AIService] Erro ao listar transcrições:', error.message);
    return [];
  }

  return (data || []) as InspectionTranscription[];
}
