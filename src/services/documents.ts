// ==============================================================================
// VISTORIA YZZY — SERVICE: GERENCIADOR DE LAUDOS E ASSINATURAS (ETAPAS 06 E 07)
// ==============================================================================

import { supabase } from './supabaseClient';
import { generateOfficialInspectionPdf, generateSignedInspectionPdf } from './pdfGenerator';
import { getSignedMediaUrl } from './media';
import type { 
  InspectionDocument, 
  GenerateDocumentResult, 
  InspectionSnapshotData,
  DocumentSignature,
  DocumentSignatureRequest,
  PublicVerificationResult,
  ExternalSignatureRequestInfo,
  SignerType
} from '../types/document';

/**
 * Gera um novo laudo oficial com snapshot imutável, PDF, upload e checksum.
 */
export async function generateInspectionReport(inspectionId: string): Promise<GenerateDocumentResult> {
  if (!inspectionId) {
    throw new Error('Identificador da vistoria não informado.');
  }

  try {
    // 1. Chamar RPC para criar snapshot e registro em status GENERATING
    const { data: snapRes, error: snapErr } = await supabase.rpc(
      'create_inspection_document_snapshot',
      { p_inspection_id: inspectionId }
    );

    if (snapErr) {
      console.error('[DocumentService] Erro ao criar snapshot:', snapErr.message);
      throw new Error(`Falha ao criar snapshot do laudo: ${snapErr.message}`);
    }

    const snapData = snapRes as {
      success: boolean;
      document_id: string;
      document_number: string;
      version: number;
      storage_path: string;
      storage_bucket: string;
      snapshot: InspectionSnapshotData;
      error?: string;
    };

    if (!snapData.success || !snapData.snapshot) {
      throw new Error(snapData.error || 'Não foi possível gerar snapshot da vistoria.');
    }

    const snapshot = snapData.snapshot;

    // 2. Enriquecer mídias do snapshot com signed URLs ativas
    if (snapshot.media && snapshot.media.length > 0) {
      for (const m of snapshot.media) {
        if (!m.signed_url && m.storage_path) {
          const url = await getSignedMediaUrl(m.storage_path);
          if (url) m.signed_url = url;
        }
      }
    }

    // 3. Compilar PDF oficial e calcular Checksum SHA-256
    const pdfResult = await generateOfficialInspectionPdf(snapshot);

    // 4. Fazer upload do arquivo PDF no bucket privado `inspection-documents`
    const { error: uploadErr } = await supabase.storage
      .from('inspection-documents')
      .upload(snapData.storage_path, pdfResult.pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false, // Zero overwrite para segurança e histórico
      });

    if (uploadErr) {
      console.error('[DocumentService] Erro ao fazer upload do PDF:', uploadErr.message);
      throw new Error(`Falha no armazenamento do PDF: ${uploadErr.message}`);
    }

    // 5. Finalizar laudo no banco via RPC
    const { error: compErr } = await supabase.rpc(
      'complete_inspection_document',
      {
        p_document_id: snapData.document_id,
        p_file_size: pdfResult.fileSize,
        p_checksum: pdfResult.checksum,
      }
    );

    if (compErr) {
      console.error('[DocumentService] Erro ao concluir registro do documento:', compErr.message);
      throw new Error(`Falha ao registrar conclusão do laudo: ${compErr.message}`);
    }

    // 6. Gerar Signed URL para visualização imediata
    const { data: signedData } = await supabase.storage
      .from('inspection-documents')
      .createSignedUrl(snapData.storage_path, 900); // 15 minutos

    return {
      success: true,
      documentId: snapData.document_id,
      documentNumber: snapData.document_number,
      version: snapData.version,
      storagePath: snapData.storage_path,
      signedUrl: signedData?.signedUrl || undefined,
      fileSize: pdfResult.fileSize,
      checksum: pdfResult.checksum,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido ao gerar laudo.';
    console.error('[DocumentService] Falha geral na geração do laudo:', msg);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Lista todos os documentos e versões de uma vistoria, incluindo suas assinaturas.
 */
export async function listInspectionDocuments(inspectionId: string): Promise<InspectionDocument[]> {
  const { data, error } = await supabase
    .from('inspection_documents')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('version', { ascending: false });

  if (error) {
    console.error('[DocumentService] Erro ao listar documentos:', error.message);
    return [];
  }

  const docs = (data || []) as InspectionDocument[];
  const enriched = await Promise.all(
    docs.map(async (doc) => {
      let signedUrl: string | undefined;
      if (doc.document_status === 'READY' && doc.storage_path) {
        const { data: sData } = await supabase.storage
          .from('inspection-documents')
          .createSignedUrl(doc.storage_path, 900);
        signedUrl = sData?.signedUrl;
      }

      // Buscar assinaturas registradas para este documento
      const signatures = await listDocumentSignatures(doc.id);

      return { 
        ...doc, 
        signed_url: signedUrl,
        signatures 
      };
    })
  );

  return enriched;
}

/**
 * Obtém URL assinada temporária para um PDF de laudo.
 */
export async function getDocumentSignedUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;

  try {
    const { data, error } = await supabase.storage
      .from('inspection-documents')
      .createSignedUrl(storagePath, 900);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Upload de imagem manuscrita da assinatura para o bucket privado `document-signatures`.
 */
export async function uploadSignatureImage(
  documentId: string,
  signatureBlob: Blob
): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user;
  const companyId = user?.user_metadata?.company_id || '00000000-0000-0000-0000-000000000000';
  const sigId = crypto.randomUUID();
  const storagePath = `${companyId}/${documentId}/${sigId}/signature.png`;

  const { error } = await supabase.storage
    .from('document-signatures')
    .upload(storagePath, signatureBlob, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) {
    console.error('[DocumentService] Erro no upload da assinatura desenhada:', error.message);
    throw new Error(`Falha no upload da assinatura: ${error.message}`);
  }

  return storagePath;
}

/**
 * Assina eletronicamente um laudo por usuário autenticado interno (Vistoriador / Gerente).
 */
export async function signDocumentAuthenticated(params: {
  documentId: string;
  signatureMethod: 'AUTHENTICATED_ACCEPTANCE' | 'DRAWN_SIGNATURE';
  signatureImageBlob?: Blob | null;
  signerDocument?: string | null;
  signerPhone?: string | null;
  termsVersion?: string;
}): Promise<{ success: boolean; signatureId?: string; error?: string }> {
  try {
    let signatureImagePath: string | null = null;
    if (params.signatureImageBlob && params.signatureMethod === 'DRAWN_SIGNATURE') {
      signatureImagePath = await uploadSignatureImage(params.documentId, params.signatureImageBlob);
    }

    const { data, error } = await supabase.rpc('sign_inspection_document', {
      p_document_id: params.documentId,
      p_signature_method: params.signatureMethod,
      p_signature_image_path: signatureImagePath,
      p_signer_document: params.signerDocument || null,
      p_signer_phone: params.signerPhone || null,
      p_terms_version: params.termsVersion || 'v1.0',
    });

    if (error) {
      console.error('[DocumentService] Erro ao assinar documento:', error.message);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      signatureId: (data as any)?.signature_id 
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao assinar documento.';
    return { success: false, error: msg };
  }
}

/**
 * Cria uma solicitação de assinatura externa para terceiros (Inquilino / Proprietário).
 */
export async function createExternalSignatureRequest(params: {
  documentId: string;
  signerType: SignerType;
  signerName: string;
  signerEmail: string;
  signerDocument?: string | null;
  signerPhone?: string | null;
}): Promise<{ 
  success: boolean; 
  requestId?: string; 
  rawToken?: string; 
  signUrl?: string; 
  expiresAt?: string; 
  error?: string; 
}> {
  try {
    const { data, error } = await supabase.rpc('create_signature_request', {
      p_document_id: params.documentId,
      p_signer_type: params.signerType,
      p_signer_name: params.signerName,
      p_signer_email: params.signerEmail,
      p_signer_document: params.signerDocument || null,
      p_signer_phone: params.signerPhone || null,
    });

    if (error) {
      console.error('[DocumentService] Erro ao criar solicitação de assinatura:', error.message);
      return { success: false, error: error.message };
    }

    const res = data as any;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.yzzy.com.br';
    const signUrl = `${origin}/sign/${res.raw_token}`;

    return {
      success: true,
      requestId: res.request_id,
      rawToken: res.raw_token,
      signUrl,
      expiresAt: res.expires_at,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao criar solicitação.';
    return { success: false, error: msg };
  }
}

/**
 * Consulta os dados da solicitação externa pelo token público (para página /sign/:token).
 */
export async function fetchExternalSignatureRequest(rawToken: string): Promise<ExternalSignatureRequestInfo> {
  try {
    // Calcular SHA-256 do token
    const tokenBytes = new TextEncoder().encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const { data, error } = await supabase.rpc('get_external_signature_request', {
      p_token_hash: tokenHash,
    });

    if (error) {
      console.error('[DocumentService] Erro ao buscar solicitação externa:', error.message);
      return { valid: false, message: 'Link inválido ou expirado.' };
    }

    const res = data as ExternalSignatureRequestInfo;
    if (res.valid && res.storage_path) {
      const signedUrl = await getDocumentSignedUrl(res.storage_path);
      if (signedUrl) res.signed_url = signedUrl;
    }

    return res;
  } catch (err: unknown) {
    console.error('[DocumentService] Falha na consulta do token:', err);
    return { valid: false, message: 'Link inválido ou expirado.' };
  }
}

/**
 * Assina externamente o laudo via token.
 */
export async function signDocumentExternal(params: {
  rawToken: string;
  signerDocument?: string | null;
  signatureImageBlob?: Blob | null;
  termsVersion?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const tokenBytes = new TextEncoder().encode(params.rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    let signatureImagePath: string | null = null;
    if (params.signatureImageBlob) {
      // Obter document_id do token antes
      const reqInfo = await fetchExternalSignatureRequest(params.rawToken);
      if (reqInfo.valid && reqInfo.document_id) {
        signatureImagePath = await uploadSignatureImage(reqInfo.document_id, params.signatureImageBlob);
      }
    }

    const { error } = await supabase.rpc('sign_document_external', {
      p_token_hash: tokenHash,
      p_signer_document: params.signerDocument || null,
      p_signature_image_path: signatureImagePath,
      p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      p_terms_version: params.termsVersion || 'v1.0',
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Assinatura registrada com sucesso.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar assinatura.';
    return { success: false, message: msg };
  }
}

/**
 * Recusa uma assinatura externa via token.
 */
export async function declineDocumentExternal(rawToken: string, reason?: string): Promise<{ success: boolean; message?: string }> {
  try {
    const tokenBytes = new TextEncoder().encode(rawToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const { data, error } = await supabase.rpc('decline_document_external', {
      p_token_hash: tokenHash,
      p_reason: reason || null,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: (data as any)?.message || 'Assinatura recusada.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao recusar.';
    return { success: false, message: msg };
  }
}

/**
 * Consulta a verificação pública de um laudo (/verify/:code).
 */
export async function fetchPublicDocumentVerification(verificationCode: string): Promise<PublicVerificationResult> {
  try {
    const { data, error } = await supabase.rpc('get_document_public_verification', {
      p_verification_code: verificationCode.trim(),
    });

    if (error) {
      return { valid: false, message: 'Documento não localizado no registro pericial.' };
    }

    return data as PublicVerificationResult;
  } catch (err: unknown) {
    return { valid: false, message: 'Erro ao verificar documento.' };
  }
}

/**
 * Lista as assinaturas registradas para um documento.
 */
export async function listDocumentSignatures(documentId: string): Promise<DocumentSignature[]> {
  const { data, error } = await supabase
    .from('document_signatures')
    .select('*')
    .eq('document_id', documentId)
    .order('signed_at', { ascending: true });

  if (error) {
    console.error('[DocumentService] Erro ao listar assinaturas:', error.message);
    return [];
  }

  const sigs = (data || []) as DocumentSignature[];
  const enriched = await Promise.all(
    sigs.map(async (s) => {
      if (s.signature_image_path) {
        const { data: sData } = await supabase.storage
          .from('document-signatures')
          .createSignedUrl(s.signature_image_path, 900);
        return { ...s, signature_image_url: sData?.signedUrl };
      }
      return s;
    })
  );

  return enriched;
}

/**
 * Lista as solicitações de assinatura externa para um documento.
 */
export async function listDocumentSignatureRequests(documentId: string): Promise<DocumentSignatureRequest[]> {
  const { data, error } = await supabase
    .from('document_signature_requests')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[DocumentService] Erro ao listar solicitações:', error.message);
    return [];
  }

  return (data || []) as DocumentSignatureRequest[];
}

/**
 * Gera e registra o relatório assinado pericial (SIGNED_REPORT) com página de assinaturas e QR Code.
 */
export async function generateAndRegisterSignedReport(documentId: string): Promise<GenerateDocumentResult> {
  try {
    // 1. Buscar o documento original
    const { data: docData, error: docErr } = await supabase
      .from('inspection_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docErr || !docData) {
      throw new Error('Documento original não encontrado.');
    }

    const originalDoc = docData as InspectionDocument;
    const snapshot = originalDoc.snapshot_json;

    // 2. Enriquecer mídias do snapshot com signed URLs ativas
    if (snapshot.media && snapshot.media.length > 0) {
      for (const m of snapshot.media) {
        if (!m.signed_url && m.storage_path) {
          const url = await getSignedMediaUrl(m.storage_path);
          if (url) m.signed_url = url;
        }
      }
    }

    // 3. Buscar todas as assinaturas do documento
    const signatures = await listDocumentSignatures(documentId);
    if (signatures.length === 0) {
      throw new Error('Este laudo ainda não possui assinaturas eletrônicas registradas para emissão do relatório assinado.');
    }

    // 4. Compilar PDF assinado com a página pericial e QR Code
    const verificationCode = originalDoc.verification_code || crypto.randomUUID().replace(/-/g, '');
    const signedPdf = await generateSignedInspectionPdf(snapshot, signatures, verificationCode);

    // 5. Upload do SIGNED_REPORT no storage
    const signedDocId = crypto.randomUUID();
    const storagePath = `${originalDoc.company_id}/${originalDoc.inspection_id}/${originalDoc.id}/signed/${signedDocId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('inspection-documents')
      .upload(storagePath, signedPdf.pdfBytes, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadErr) {
      throw new Error(`Falha no upload do laudo assinado: ${uploadErr.message}`);
    }

    // 6. Registrar no banco via RPC
    const { data: regData, error: regErr } = await supabase.rpc('register_signed_document', {
      p_source_document_id: originalDoc.id,
      p_storage_path: storagePath,
      p_file_size: signedPdf.fileSize,
      p_checksum: signedPdf.checksum,
    });

    if (regErr) {
      throw new Error(`Falha ao registrar laudo assinado no banco: ${regErr.message}`);
    }

    // 7. Obter signed URL
    const { data: sData } = await supabase.storage
      .from('inspection-documents')
      .createSignedUrl(storagePath, 900);

    return {
      success: true,
      documentId: (regData as any)?.signed_document_id,
      documentNumber: originalDoc.document_number,
      version: originalDoc.version,
      storagePath,
      signedUrl: sData?.signedUrl,
      fileSize: signedPdf.fileSize,
      checksum: signedPdf.checksum,
      verificationCode: (regData as any)?.verification_code || verificationCode,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro ao emitir laudo assinado.';
    console.error('[DocumentService] Erro na emissão do laudo assinado:', msg);
    return {
      success: false,
      error: msg,
    };
  }
}
