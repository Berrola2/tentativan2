// ==============================================================================
// VISTORIA YZZY — TIPOS OFICIAIS: ETAPA 06 E 07 (LAUDOS, ASSINATURAS E INTEGRIDADE)
// ==============================================================================

export type DocumentType = 
  | 'INSPECTION_REPORT' 
  | 'COMPARISON_REPORT' 
  | 'ADDENDUM' 
  | 'SIGNED_REPORT';

export type DocumentStatus = 
  | 'GENERATING' 
  | 'READY' 
  | 'FAILED' 
  | 'SUPERSEDED';

export type SignerType = 
  | 'INSPECTOR' 
  | 'MANAGER' 
  | 'TENANT' 
  | 'OWNER' 
  | 'WITNESS' 
  | 'OTHER';

export type SignatureMethod = 
  | 'AUTHENTICATED_ACCEPTANCE' 
  | 'DRAWN_SIGNATURE' 
  | 'EXTERNAL_LINK_ACCEPTANCE' 
  | 'CERTIFICATE' 
  | 'ICP_BRASIL';

export type SignatureStatus = 
  | 'PENDING' 
  | 'SIGNED' 
  | 'DECLINED' 
  | 'REVOKED' 
  | 'EXPIRED';

export type DocumentEventType = 
  | 'SIGNATURE_REQUEST_CREATED' 
  | 'SIGNATURE_REQUEST_REVOKED' 
  | 'DOCUMENT_VIEWED' 
  | 'DOCUMENT_SIGNED' 
  | 'DOCUMENT_DECLINED' 
  | 'SIGNED_REPORT_GENERATED';

export interface SnapshotMediaItem {
  id: string;
  room_id: string | null;
  item_id: string | null;
  storage_path: string;
  caption: string | null;
  position: number;
  width: number | null;
  height: number | null;
  file_size: number;
  signed_url?: string;
  data_url?: string;
}

export interface SnapshotItem {
  id: string;
  name: string;
  position: number;
  condition_status: string;
  requires_repair: boolean;
  repair_notes: string | null;
  description: string | null;
}

export interface SnapshotRoom {
  id: string;
  name: string;
  position: number;
  notes: string | null;
  items: SnapshotItem[];
}

export interface InspectionSnapshotData {
  document_id: string;
  document_number: string;
  version: number;
  generated_at: string;
  company: {
    id: string;
    name: string;
    slug: string;
    cnpj?: string | null;
    phone?: string | null;
    email?: string | null;
    logo?: string | null;
  };
  property: {
    id: string;
    internal_code: string | null;
    property_type: string;
    street: string;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    postal_code: string | null;
    notes: string | null;
  };
  inspection: {
    id: string;
    title: string;
    inspection_type: string;
    status: string;
    inspection_date: string;
    completed_at: string | null;
    notes: string | null;
  };
  inspector: {
    id: string;
    name: string;
    role: string;
  };
  rooms: SnapshotRoom[];
  media: SnapshotMediaItem[];
}

export interface InspectionDocument {
  id: string;
  company_id: string;
  inspection_id: string;
  document_type: DocumentType;
  document_status: DocumentStatus;
  document_number: string;
  version: number;
  snapshot_json: InspectionSnapshotData;
  storage_bucket: string;
  storage_path: string;
  file_size: number;
  checksum: string | null;
  verification_code?: string;
  source_document_id?: string | null;
  generated_by: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
  signed_url?: string;
  signatures?: DocumentSignature[];
}

export interface DocumentSignature {
  id: string;
  company_id: string;
  document_id: string;
  inspection_id: string;
  signer_type: SignerType;
  signer_user_id: string | null;
  signer_name: string;
  signer_document: string | null;
  signer_email: string | null;
  signer_phone: string | null;
  signature_method: SignatureMethod;
  signature_status: SignatureStatus;
  signature_image_path: string | null;
  document_checksum: string;
  accepted_terms_version: string;
  ip_address_hash: string | null;
  user_agent: string | null;
  signature_evidence_hash: string;
  signed_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  declined_reason: string | null;
  created_at: string;
  updated_at: string;
  signature_image_url?: string;
}

export interface DocumentSignatureRequest {
  id: string;
  company_id: string;
  document_id: string;
  inspection_id: string;
  signer_type: SignerType;
  signer_name: string;
  signer_email: string;
  signer_document: string | null;
  signer_phone: string | null;
  token_hash: string;
  status: SignatureStatus;
  expires_at: string;
  created_by: string | null;
  created_at: string;
  used_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  declined_reason: string | null;
}

export interface DocumentEvent {
  id: string;
  company_id: string;
  document_id: string;
  event_type: DocumentEventType;
  actor_user_id: string | null;
  signature_id: string | null;
  request_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PublicVerificationResult {
  valid: boolean;
  message?: string;
  document_number?: string;
  version?: number;
  document_type?: string;
  document_status?: string;
  company_name?: string;
  inspection_type?: string;
  inspection_date?: string;
  generated_at?: string;
  document_checksum?: string;
  signatures_count?: number;
  signatures?: Array<{
    signer_name: string;
    signer_type: string;
    signature_method: string;
    signed_at: string;
    terms_version: string;
  }>;
}

export interface ExternalSignatureRequestInfo {
  valid: boolean;
  message?: string;
  request_id?: string;
  document_id?: string;
  document_number?: string;
  version?: number;
  document_checksum?: string;
  storage_path?: string;
  signer_name?: string;
  signer_email?: string;
  signer_type?: string;
  company_name?: string;
  property_street?: string;
  property_city?: string;
  property_state?: string;
  inspection_type?: string;
  inspection_date?: string;
  signed_url?: string;
}

export interface GenerateDocumentResult {
  success: boolean;
  documentId?: string;
  documentNumber?: string;
  version?: number;
  storagePath?: string;
  signedUrl?: string;
  fileSize?: number;
  checksum?: string;
  verificationCode?: string;
  error?: string;
}
