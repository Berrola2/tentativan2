// ==============================================================================
// VISTORIA YZZY — SERVICE: MOTOR DE GERAÇÃO PROFISSIONAL DE PDF (ETAPAS 06, 07 E 08)
// ==============================================================================

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { 
  InspectionSnapshotData, 
  SnapshotMediaItem, 
  DocumentSignature 
} from '../types/document';
import type { InspectionComparison } from '../types/comparison';
import { ITEM_CONDITION_LABELS } from '../types/inspection';
import { COMPARISON_CHANGE_LABELS } from '../types/comparison';

const PALETTE = {
  PRIMARY: [37, 99, 235] as [number, number, number], // Blue 600
  PRIMARY_DARK: [30, 58, 138] as [number, number, number], // Blue 900
  TEXT_MAIN: [15, 23, 42] as [number, number, number], // Slate 900
  TEXT_MUTED: [100, 116, 139] as [number, number, number], // Slate 500
  TEXT_LIGHT: [148, 163, 184] as [number, number, number], // Slate 400
  BG_LIGHT: [248, 250, 252] as [number, number, number], // Slate 50
  BORDER: [226, 232, 240] as [number, number, number], // Slate 200
  CARD_BG: [255, 255, 255] as [number, number, number],
  ALERT_BG: [254, 242, 242] as [number, number, number], // Rose 50
  ALERT_BORDER: [254, 202, 202] as [number, number, number], // Rose 200
  ALERT_TEXT: [185, 28, 28] as [number, number, number], // Rose 700
  SUCCESS_BG: [240, 253, 244] as [number, number, number], // Emerald 50
  SUCCESS_TEXT: [21, 128, 61] as [number, number, number], // Emerald 700
};

/**
 * Calcula o hash criptográfico SHA-256 do arquivo PDF gerado.
 */
export async function calculatePdfChecksum(pdfBytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes as unknown as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'sha256-' + Date.now().toString(16);
}

/**
 * Gera imagem de QR Code em formato base64 Data URL.
 */
export async function generateQrCodeDataUrl(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 256,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.warn('Erro ao gerar QR Code:', err);
    return '';
  }
}

/**
 * Carrega imagem assíncrona para inserção no PDF como base64 data URL.
 */
async function loadImageAsDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) return url;

  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Tradução pericial amigável de tipos de signatários
 */
function formatSignerTypeLabel(signerType: string): string {
  switch (signerType) {
    case 'INSPECTOR':
      return 'VISTORIADOR RESPONSÁVEL';
    case 'MANAGER':
      return 'GERENTE OPERACIONAL';
    case 'TENANT':
      return 'LOCATÁRIO (INQUILINO)';
    case 'OWNER':
      return 'LOCADOR (PROPRIETÁRIO)';
    case 'WITNESS':
      return 'TESTEMUNHA';
    default:
      return 'SIGNATÁRIO AUTORIZADO';
  }
}

/**
 * Tradução de métodos de assinatura
 */
function formatSignatureMethodLabel(method: string): string {
  switch (method) {
    case 'AUTHENTICATED_ACCEPTANCE':
      return 'Aceite Eletrônico Autenticado (Plataforma YZZY)';
    case 'DRAWN_SIGNATURE':
      return 'Assinatura Manuscrita Eletrônica (Touch / Mouse)';
    case 'EXTERNAL_LINK_ACCEPTANCE':
      return 'Aceite Eletrônico via Link Seguro';
    case 'CERTIFICATE':
      return 'Certificado Digital A1/A3';
    case 'ICP_BRASIL':
      return 'Certificação ICP-Brasil';
    default:
      return 'Assinatura Eletrônica';
  }
}

/**
 * Motor Principal de Compilação de PDF Oficial (INSPECTION_REPORT)
 */
export async function generateOfficialInspectionPdf(snapshot: InspectionSnapshotData): Promise<{
  doc: jsPDF;
  pdfBytes: Uint8Array;
  checksum: string;
  fileSize: number;
}> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 14;

  const mediaMap = new Map<string, string>();
  for (const m of snapshot.media || []) {
    const sourceUrl = m.data_url || m.signed_url;
    if (sourceUrl) {
      const base64 = await loadImageAsDataUrl(sourceUrl);
      if (base64) {
        mediaMap.set(m.id, base64);
      }
    }
  }

  const ensurePageSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 20;
      drawPageHeader();
      return true;
    }
    return false;
  };

  const drawPageHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PALETTE.TEXT_LIGHT);
    const companyTitle = snapshot.company.name || 'Vistoria YZZY';
    doc.text(
      `${companyTitle.toUpperCase()} • LAUDO DE VISTORIA #${snapshot.document_number} (v${snapshot.version})`,
      marginX,
      12
    );

    doc.setDrawColor(...PALETTE.BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  };

  // 1. Capa
  doc.setFillColor(...PALETTE.PRIMARY_DARK);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(snapshot.company.name || 'VISTORIA YZZY', marginX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PALETTE.TEXT_LIGHT);
  const companySubtitle = snapshot.company.cnpj
    ? `CNPJ: ${snapshot.company.cnpj} • Tel: ${snapshot.company.phone || '-'}`
    : 'Laudo Pericial de Inspeção e Vistoria Imobiliária';
  doc.text(companySubtitle, marginX, 18);

  const inspectionTypeLabel = `VISTORIA DE ${String(snapshot.inspection.inspection_type || 'Entrada').toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const badgeWidth = doc.getTextWidth(inspectionTypeLabel) + 8;
  doc.setFillColor(...PALETTE.PRIMARY);
  doc.roundedRect(pageWidth - marginX - badgeWidth, 7, badgeWidth, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(inspectionTypeLabel, pageWidth - marginX - badgeWidth + 4, 16);

  currentY = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...PALETTE.TEXT_MAIN);
  doc.text('LAUDO DE VISTORIA DE IMÓVEL', marginX, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PALETTE.TEXT_MUTED);
  doc.text(`Documento Nº: ${snapshot.document_number} • Versão Oficial: ${snapshot.version}`, marginX, currentY);

  currentY += 8;

  // Box 1: Identificação do Imóvel e Vistoria
  doc.setFillColor(...PALETTE.BG_LIGHT);
  doc.setDrawColor(...PALETTE.BORDER);
  doc.roundedRect(marginX, currentY, contentWidth, 38, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PALETTE.PRIMARY_DARK);
  doc.text('DADOS DO IMÓVEL E DA VISTORIA', marginX + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PALETTE.TEXT_MAIN);

  const prop = snapshot.property;
  const fullAddress = `${prop.street}${prop.number ? `, ${prop.number}` : ''}${prop.complement ? ` - ${prop.complement}` : ''}, ${prop.neighborhood || ''}, ${prop.city}/${prop.state}`;
  
  doc.text(`Endereço: ${fullAddress}`, marginX + 4, currentY + 13, { maxWidth: contentWidth - 8 });
  doc.text(`Tipo de Imóvel: ${prop.property_type || 'Residencial'} • CEP: ${prop.postal_code || 'Não informado'}`, marginX + 4, currentY + 19);
  
  const formattedDate = new Date(snapshot.inspection.inspection_date).toLocaleDateString('pt-BR');
  doc.text(`Data da Vistoria: ${formattedDate} • Status: CONCLUÍDA`, marginX + 4, currentY + 25);
  doc.text(`Vistoriador Responsável: ${snapshot.inspector.name} (${snapshot.inspector.role})`, marginX + 4, currentY + 31);

  currentY += 44;

  // Box 2: Resumo Estatístico do Laudo
  const totalRooms = snapshot.rooms.length;
  const totalItems = snapshot.rooms.reduce((acc, r) => acc + (r.items?.length || 0), 0);
  const totalPhotos = snapshot.media.length;
  const totalRepairs = snapshot.rooms.reduce(
    (acc, r) => acc + (r.items?.filter((it) => it.requires_repair).length || 0),
    0
  );

  const cardW = (contentWidth - 6) / 4;
  const statsData = [
    { label: 'Ambientes', value: totalRooms.toString() },
    { label: 'Itens Inspecionados', value: totalItems.toString() },
    { label: 'Fotos Registradas', value: totalPhotos.toString() },
    { label: 'Reparos Indicados', value: totalRepairs.toString() },
  ];

  statsData.forEach((st, idx) => {
    const cardX = marginX + idx * (cardW + 2);
    doc.setFillColor(...PALETTE.BG_LIGHT);
    doc.setDrawColor(...PALETTE.BORDER);
    doc.roundedRect(cardX, currentY, cardW, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...(idx === 3 && totalRepairs > 0 ? PALETTE.ALERT_TEXT : PALETTE.PRIMARY));
    doc.text(st.value, cardX + cardW / 2, currentY + 8, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...PALETTE.TEXT_MUTED);
    doc.text(st.label, cardX + cardW / 2, currentY + 14, { align: 'center' });
  });

  currentY += 24;

  let photoGlobalIndex = 1;
  const renderPhotoGrid = (photos: SnapshotMediaItem[]) => {
    if (!photos || photos.length === 0) return;

    const colWidth = (contentWidth - 6) / 3;
    const photoHeight = 42;
    const captionHeight = 9;
    const totalRowHeight = photoHeight + captionHeight + 4;

    for (let i = 0; i < photos.length; i += 3) {
      ensurePageSpace(totalRowHeight);

      for (let col = 0; col < 3; col++) {
        const photoIndex = i + col;
        if (photoIndex >= photos.length) break;

        const photo = photos[photoIndex];
        const photoX = marginX + col * (colWidth + 3);

        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(...PALETTE.BORDER);
        doc.roundedRect(photoX, currentY, colWidth, photoHeight, 1.5, 1.5, 'FD');

        const base64 = mediaMap.get(photo.id);
        if (base64) {
          try {
            doc.addImage(base64, 'JPEG', photoX + 0.5, currentY + 0.5, colWidth - 1, photoHeight - 1, undefined, 'FAST');
          } catch (e) {
            console.warn('Erro ao embutir foto no PDF:', e);
          }
        }

        const badgeText = `Foto ${String(photoGlobalIndex++).padStart(2, '0')}`;
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(photoX + 2, currentY + 2, 14, 4.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(255, 255, 255);
        doc.text(badgeText, photoX + 9, currentY + 5.2, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...PALETTE.TEXT_MAIN);
        const captionText = photo.caption ? photo.caption : 'Sem observações adicionais.';
        doc.text(captionText, photoX, currentY + photoHeight + 3.5, {
          maxWidth: colWidth,
          lineHeightFactor: 1.15,
        });
      }

      currentY += totalRowHeight;
    }
  };

  const generalInspectionPhotos = snapshot.media.filter((m) => !m.room_id && !m.item_id);
  if (generalInspectionPhotos.length > 0) {
    ensurePageSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...PALETTE.PRIMARY_DARK);
    doc.text('FOTOS GERAIS DA VISTORIA (FACHADA E MEDIDORES)', marginX, currentY);
    currentY += 4;
    renderPhotoGrid(generalInspectionPhotos);
    currentY += 6;
  }

  const sortedRooms = [...snapshot.rooms].sort((a, b) => (a.position || 0) - (b.position || 0));

  for (const room of sortedRooms) {
    ensurePageSpace(16);

    doc.setFillColor(...PALETTE.PRIMARY_DARK);
    doc.roundedRect(marginX, currentY, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(room.name.toUpperCase(), marginX + 4, currentY + 5);

    currentY += 10;

    if (room.notes) {
      ensurePageSpace(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...PALETTE.TEXT_MUTED);
      doc.text(`Observações do ambiente: ${room.notes}`, marginX + 2, currentY, { maxWidth: contentWidth - 4 });
      currentY += 6;
    }

    const roomGeneralPhotos = snapshot.media.filter((m) => m.room_id === room.id && !m.item_id);
    if (roomGeneralPhotos.length > 0) {
      renderPhotoGrid(roomGeneralPhotos);
      currentY += 4;
    }

    const sortedItems = [...(room.items || [])].sort((a, b) => (a.position || 0) - (b.position || 0));

    for (const item of sortedItems) {
      ensurePageSpace(18);

      doc.setFillColor(...PALETTE.BG_LIGHT);
      doc.setDrawColor(...PALETTE.BORDER);
      doc.roundedRect(marginX, currentY, contentWidth, 6.5, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...PALETTE.TEXT_MAIN);
      doc.text(item.name, marginX + 3, currentY + 4.5);

      const condLabel = ITEM_CONDITION_LABELS[item.condition_status] || item.condition_status || 'Bom';
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...PALETTE.PRIMARY_DARK);
      const condText = `Estado: ${condLabel}`;
      doc.text(condText, pageWidth - marginX - doc.getTextWidth(condText) - 3, currentY + 4.5);

      currentY += 9;

      if (item.requires_repair) {
        ensurePageSpace(12);
        doc.setFillColor(...PALETTE.ALERT_BG);
        doc.setDrawColor(...PALETTE.ALERT_BORDER);
        doc.roundedRect(marginX, currentY, contentWidth, 9, 1, 1, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...PALETTE.ALERT_TEXT);
        doc.text('NECESSITA REPARO: SIM', marginX + 3, currentY + 4);

        if (item.repair_notes) {
          doc.setFont('helvetica', 'normal');
          doc.text(`Detalhes: ${item.repair_notes}`, marginX + 3, currentY + 7.2, { maxWidth: contentWidth - 6 });
        }

        currentY += 11;
      }

      if (item.description) {
        ensurePageSpace(10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...PALETTE.TEXT_MAIN);
        const splitDesc = doc.splitTextToSize(item.description, contentWidth - 4);
        const descHeight = splitDesc.length * 3.5;
        ensurePageSpace(descHeight + 2);
        doc.text(splitDesc, marginX + 2, currentY);
        currentY += descHeight + 2;
      }

      const itemPhotos = snapshot.media.filter((m) => m.item_id === item.id);
      if (itemPhotos.length > 0) {
        renderPhotoGrid(itemPhotos);
        currentY += 4;
      }

      currentY += 4;
    }

    currentY += 4;
  }

  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    if (p > 1) {
      drawPageHeader();
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PALETTE.TEXT_LIGHT);

    const footerTextLeft = `Documento Oficial • Vistoria YZZY • Nº ${snapshot.document_number} (v${snapshot.version})`;
    const footerTextRight = `Página ${p} de ${totalPages}`;

    doc.setDrawColor(...PALETTE.BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.text(footerTextLeft, marginX, pageHeight - 8);
    doc.text(footerTextRight, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBytes = new Uint8Array(pdfArrayBuffer);
  const checksum = await calculatePdfChecksum(pdfBytes);
  const fileSize = pdfBytes.byteLength;

  return {
    doc,
    pdfBytes,
    checksum,
    fileSize,
  };
}

/**
 * Geração de Laudo Assinado com Página de Assinaturas e QR Code (SIGNED_REPORT)
 */
export async function generateSignedInspectionPdf(
  snapshot: InspectionSnapshotData,
  signatures: DocumentSignature[],
  verificationCode: string,
  verificationBaseUrl?: string
): Promise<{
  doc: jsPDF;
  pdfBytes: Uint8Array;
  checksum: string;
  fileSize: number;
}> {
  const baseResult = await generateOfficialInspectionPdf(snapshot);
  const doc = baseResult.doc;

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;

  doc.addPage();
  let currentY = 16;

  doc.setFillColor(...PALETTE.PRIMARY_DARK);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('ASSINATURAS E ACEITES ELETRÔNICOS', marginX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PALETTE.TEXT_LIGHT);
  doc.text(`Laudo Vinculado: #${snapshot.document_number} (v${snapshot.version}) • Registro Pericial Oficial`, marginX, 17);

  currentY = 32;

  doc.setFillColor(...PALETTE.BG_LIGHT);
  doc.setDrawColor(...PALETTE.BORDER);
  doc.roundedRect(marginX, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PALETTE.PRIMARY_DARK);
  doc.text('DECLARAÇÃO DE VALIDADE E INTEGRIDADE DOCUMENTAL', marginX + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PALETTE.TEXT_MAIN);
  const legalText = `Este documento constitui a versão assinada eletronicamente do Laudo de Vistoria de Imóvel #${snapshot.document_number} (v${snapshot.version}). Todas as assinaturas registradas abaixo foram validadas com evidências técnicas, endereço IP auditável, identificação de signatários e vinculação criptográfica estrita ao Checksum SHA-256 do documento original.`;
  doc.text(legalText, marginX + 4, currentY + 10.5, { maxWidth: contentWidth - 8, lineHeightFactor: 1.2 });

  currentY += 27;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...PALETTE.TEXT_MUTED);
  doc.text(`Checksum do Laudo Original (SHA-256): ${baseResult.checksum}`, marginX, currentY);

  currentY += 6;

  const validSignatures = signatures.filter((s) => s.signature_status === 'SIGNED');

  for (const sig of validSignatures) {
    const cardHeight = sig.signature_image_path || sig.signature_image_url ? 34 : 24;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...PALETTE.BORDER);
    doc.roundedRect(marginX, currentY, contentWidth, cardHeight, 2, 2, 'FD');

    doc.setFillColor(...PALETTE.PRIMARY);
    doc.roundedRect(marginX, currentY, 3, cardHeight, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...PALETTE.PRIMARY_DARK);
    doc.text(formatSignerTypeLabel(sig.signer_type), marginX + 6, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...PALETTE.TEXT_MAIN);
    doc.text(sig.signer_name, marginX + 6, currentY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PALETTE.TEXT_MUTED);
    const dateFormatted = new Date(sig.signed_at).toLocaleString('pt-BR');
    doc.text(`Assinado em: ${dateFormatted}`, marginX + 6, currentY + 16);
    doc.text(`Método: ${formatSignatureMethodLabel(sig.signature_method)}`, marginX + 6, currentY + 20);

    doc.setFontSize(6);
    doc.setTextColor(...PALETTE.TEXT_LIGHT);
    doc.text(`Hash de Evidência: ${sig.signature_evidence_hash.substring(0, 36)}...`, marginX + 6, currentY + (cardHeight > 24 ? 30 : 23));

    if (sig.signature_image_url) {
      const drawnDataUrl = await loadImageAsDataUrl(sig.signature_image_url);
      if (drawnDataUrl) {
        try {
          doc.addImage(drawnDataUrl, 'PNG', pageWidth - marginX - 45, currentY + 3, 40, 18, undefined, 'FAST');
        } catch (e) {
          console.warn('Erro ao embutir assinatura manuscrita:', e);
        }
      }
    }

    currentY += cardHeight + 4;
  }

  currentY = Math.max(currentY + 2, pageHeight - 56);
  const baseUrl = verificationBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://app.yzzy.com.br');
  const verifyUrl = `${baseUrl}/verify/${verificationCode}`;
  const qrDataUrl = await generateQrCodeDataUrl(verifyUrl);

  doc.setFillColor(...PALETTE.BG_LIGHT);
  doc.setDrawColor(...PALETTE.BORDER);
  doc.roundedRect(marginX, currentY, contentWidth, 34, 2, 2, 'FD');

  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, 'PNG', marginX + 3, currentY + 3, 28, 28);
    } catch (err) {
      console.warn('Erro ao inserir QR Code:', err);
    }
  }

  const qrTextX = marginX + 35;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PALETTE.PRIMARY_DARK);
  doc.text('VERIFICAÇÃO DE AUTENTICIDADE PÚBLICA', qrTextX, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PALETTE.TEXT_MAIN);
  doc.text('Aponte a câmera para o QR Code ao lado ou acesse:', qrTextX, currentY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PALETTE.PRIMARY);
  doc.text(verifyUrl, qrTextX, currentY + 19, { maxWidth: contentWidth - 38 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PALETTE.TEXT_MUTED);
  doc.text(`Código de Verificação: ${verificationCode}`, qrTextX, currentY + 26);

  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PALETTE.TEXT_LIGHT);

    const footerTextLeft = `Laudo Oficial Assinado • Vistoria YZZY • Nº ${snapshot.document_number} (v${snapshot.version})`;
    const footerTextRight = `Página ${p} de ${totalPages}`;

    doc.setDrawColor(...PALETTE.BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.text(footerTextLeft, marginX, pageHeight - 8);
    doc.text(footerTextRight, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  const signedPdfArrayBuffer = doc.output('arraybuffer');
  const signedPdfBytes = new Uint8Array(signedPdfArrayBuffer);
  const signedChecksum = await calculatePdfChecksum(signedPdfBytes);
  const signedFileSize = signedPdfBytes.byteLength;

  return {
    doc,
    pdfBytes: signedPdfBytes,
    checksum: signedChecksum,
    fileSize: signedFileSize,
  };
}

/**
 * Geração de Relatório Comparativo Pericial (COMPARISON_REPORT)
 */
export async function generateOfficialComparisonPdf(
  comparison: InspectionComparison,
  onlyChanges = false
): Promise<{
  doc: jsPDF;
  pdfBytes: Uint8Array;
  checksum: string;
  fileSize: number;
}> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 14;

  const ensurePageSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 20;
      drawPageHeader();
      return true;
    }
    return false;
  };

  const drawPageHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PALETTE.TEXT_LIGHT);
    doc.text('RELATÓRIO COMPARATIVO DE VISTORIA — ENTRADA × SAÍDA', marginX, 12);

    doc.setDrawColor(...PALETTE.BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, 14, pageWidth - marginX, 14);
  };

  // 1. Capa
  doc.setFillColor(...PALETTE.PRIMARY_DARK);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('VISTORIA YZZY', marginX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PALETTE.TEXT_LIGHT);
  doc.text('Relatório Comparativo Automatizado e Pericial', marginX, 18);

  const badgeText = 'ENTRADA × SAÍDA';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const badgeWidth = doc.getTextWidth(badgeText) + 8;
  doc.setFillColor(...PALETTE.PRIMARY);
  doc.roundedRect(pageWidth - marginX - badgeWidth, 7, badgeWidth, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, pageWidth - marginX - badgeWidth + 4, 16);

  currentY = 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...PALETTE.TEXT_MAIN);
  doc.text('RELATÓRIO COMPARATIVO DE VISTORIA', marginX, currentY);

  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PALETTE.TEXT_MUTED);
  doc.text(`Comparativo Oficial • Versão ${comparison.version || 1} • Status: ${comparison.status}`, marginX, currentY);

  currentY += 8;

  // Box: Dados do Imóvel e Vistorias
  doc.setFillColor(...PALETTE.BG_LIGHT);
  doc.setDrawColor(...PALETTE.BORDER);
  doc.roundedRect(marginX, currentY, contentWidth, 34, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...PALETTE.PRIMARY_DARK);
  doc.text('IDENTIFICAÇÃO DO IMÓVEL E CONFRONTO DE VISTORIAS', marginX + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...PALETTE.TEXT_MAIN);

  const prop = comparison.property;
  const addressStr = prop ? `${prop.street}${prop.number ? `, ${prop.number}` : ''}, ${prop.city}/${prop.state}` : 'Imóvel Registrado';
  doc.text(`Imóvel: ${addressStr}`, marginX + 4, currentY + 12);

  const checkInDate = comparison.check_in_inspection?.inspection_date 
    ? new Date(comparison.check_in_inspection.inspection_date).toLocaleDateString('pt-BR') 
    : '-';
  const checkOutDate = comparison.check_out_inspection?.inspection_date 
    ? new Date(comparison.check_out_inspection.inspection_date).toLocaleDateString('pt-BR') 
    : '-';

  doc.text(`Vistoria de Entrada: ${checkInDate} (Concluída)`, marginX + 4, currentY + 18);
  doc.text(`Vistoria de Saída: ${checkOutDate} (Concluída)`, marginX + 4, currentY + 24);

  currentY += 40;

  // Resumo Quantitativo
  const summary = comparison.summary_json || {
    total_items: 0,
    unchanged: 0,
    worsened: 0,
    improved: 0,
    repairs_added: 0,
    items_added: 0,
    items_removed: 0,
  };

  const cardW = (contentWidth - 8) / 5;
  const statsList = [
    { label: 'Itens Comparados', value: String(summary.total_items || 0) },
    { label: 'Sem Alteração', value: String(summary.unchanged || 0) },
    { label: 'Piora de Condição', value: String(summary.worsened || 0) },
    { label: 'Reparos Adicionados', value: String(summary.repairs_added || 0) },
    { label: 'Itens Novos/Ausentes', value: String((summary.items_added || 0) + (summary.items_removed || 0)) },
  ];

  statsList.forEach((st, idx) => {
    const cardX = marginX + idx * (cardW + 2);
    doc.setFillColor(...PALETTE.BG_LIGHT);
    doc.setDrawColor(...PALETTE.BORDER);
    doc.roundedRect(cardX, currentY, cardW, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...(idx >= 2 && Number(st.value) > 0 ? PALETTE.ALERT_TEXT : PALETTE.PRIMARY));
    doc.text(st.value, cardX + cardW / 2, currentY + 7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...PALETTE.TEXT_MUTED);
    doc.text(st.label, cardX + cardW / 2, currentY + 12.5, { align: 'center' });
  });

  currentY += 22;

  // Itens da Comparação
  let itemsToRender = comparison.items || [];
  if (onlyChanges) {
    itemsToRender = itemsToRender.filter((it) => it.change_type !== 'UNCHANGED');
  }

  ensurePageSpace(12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...PALETTE.PRIMARY_DARK);
  doc.text(
    onlyChanges ? 'APONTAMENTO EXCLUSIVO DE ALTERAÇÕES IDENTIFICADAS' : 'QUADRO COMPARATIVO DETALHADO POR AMBIENTE',
    marginX,
    currentY
  );
  currentY += 5;

  for (const item of itemsToRender) {
    ensurePageSpace(26);

    const changeInfo = COMPARISON_CHANGE_LABELS[item.change_type] || { label: item.change_type };

    doc.setFillColor(...PALETTE.BG_LIGHT);
    doc.setDrawColor(...PALETTE.BORDER);
    doc.roundedRect(marginX, currentY, contentWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...PALETTE.TEXT_MAIN);
    doc.text(`${item.room_name} • ${item.item_name}`, marginX + 3, currentY + 5);

    // Badge do tipo de mudança
    const changeBadge = changeInfo.label.toUpperCase();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    const cWidth = doc.getTextWidth(changeBadge) + 6;
    doc.setFillColor(...(item.change_type === 'UNCHANGED' ? PALETTE.BG_LIGHT : PALETTE.ALERT_BG));
    doc.setDrawColor(...(item.change_type === 'UNCHANGED' ? PALETTE.BORDER : PALETTE.ALERT_BORDER));
    doc.roundedRect(pageWidth - marginX - cWidth - 2, currentY + 2, cWidth, 5, 1, 1, 'FD');
    doc.setTextColor(...(item.change_type === 'UNCHANGED' ? PALETTE.TEXT_MUTED : PALETTE.ALERT_TEXT));
    doc.text(changeBadge, pageWidth - marginX - cWidth / 2 - 2, currentY + 5.5, { align: 'center' });

    // Colunas Entrada vs Saída
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PALETTE.TEXT_MUTED);

    const colHalf = (contentWidth - 8) / 2;
    // Coluna Entrada
    doc.text(
      `Entrada: Estado ${item.previous_condition || 'N/A'} • Reparo: ${item.previous_requires_repair ? 'SIM' : 'NÃO'}`,
      marginX + 3,
      currentY + 11
    );
    if (item.previous_description) {
      doc.text(`Obs: ${item.previous_description.substring(0, 65)}...`, marginX + 3, currentY + 15, { maxWidth: colHalf });
    }

    // Coluna Saída
    doc.text(
      `Saída: Estado ${item.current_condition || 'N/A'} • Reparo: ${item.current_requires_repair ? 'SIM' : 'NÃO'}`,
      marginX + colHalf + 5,
      currentY + 11
    );
    if (item.current_description) {
      doc.text(`Obs: ${item.current_description.substring(0, 65)}...`, marginX + colHalf + 5, currentY + 15, { maxWidth: colHalf });
    }

    // Resumo da IA ou Apontamento
    if (item.ai_summary || item.reviewer_notes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(...PALETTE.PRIMARY_DARK);
      const note = item.reviewer_notes || item.ai_summary;
      doc.text(`Diferença Pericial: ${note}`, marginX + 3, currentY + 20, { maxWidth: contentWidth - 6 });
    }

    currentY += 28;
  }

  // Rodapés
  const totalPages = doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    if (p > 1) {
      drawPageHeader();
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PALETTE.TEXT_LIGHT);

    const footerTextLeft = `Relatório Comparativo Entrada × Saída • Vistoria YZZY`;
    const footerTextRight = `Página ${p} de ${totalPages}`;

    doc.setDrawColor(...PALETTE.BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.text(footerTextLeft, marginX, pageHeight - 8);
    doc.text(footerTextRight, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  const pdfBytes = new Uint8Array(pdfArrayBuffer);
  const checksum = await calculatePdfChecksum(pdfBytes);
  const fileSize = pdfBytes.byteLength;

  return {
    doc,
    pdfBytes,
    checksum,
    fileSize,
  };
}

/**
 * Wrapper de compatibilidade legado
 */
export async function generateInspectionPdf(data: any): Promise<jsPDF> {
  if (data && data.document_number && data.company) {
    const res = await generateOfficialInspectionPdf(data as InspectionSnapshotData);
    return res.doc;
  }

  const snapshot: InspectionSnapshotData = {
    document_id: data.id || 'preview-id',
    document_number: 'PRÉVIA-' + (data.id?.substring(0, 6) || '001'),
    version: 1,
    generated_at: new Date().toISOString(),
    company: {
      id: 'comp-preview',
      name: data.companyName || 'Vistoria YZZY',
      slug: 'yzzy',
      cnpj: data.companyCnpj || null,
      phone: data.companyPhone || null,
      logo: data.companyLogo || null,
    },
    property: {
      id: 'prop-preview',
      internal_code: null,
      property_type: 'Residencial',
      street: data.propertyAddress || 'Endereço',
      number: data.propertyNumber || null,
      complement: data.propertyComplement || null,
      neighborhood: data.propertyNeighborhood || null,
      city: data.propertyCity || 'Cidade',
      state: data.propertyState || 'UF',
      postal_code: data.propertyZip || null,
      notes: null,
    },
    inspection: {
      id: data.id || 'insp-preview',
      title: data.title || 'Vistoria',
      inspection_type: data.inspectionType || 'Entrada',
      status: 'COMPLETED',
      inspection_date: data.date || new Date().toISOString(),
      completed_at: data.date || new Date().toISOString(),
      notes: data.generalObservations || null,
    },
    inspector: {
      id: 'inspector-preview',
      name: data.inspectorName || 'Vistoriador',
      role: 'INSPECTOR',
    },
    rooms: (data.rooms || []).map((r: any, rIdx: number) => ({
      id: r.id || `r-${rIdx}`,
      name: r.name || `Ambiente ${rIdx + 1}`,
      position: rIdx + 1,
      notes: r.generalNotes || null,
      items: (r.items || []).map((it: any, itIdx: number) => ({
        id: it.id || `it-${itIdx}`,
        name: it.name || `Item ${itIdx + 1}`,
        position: itIdx + 1,
        condition_status: it.condition_status || it.status || 'Bom',
        requires_repair: !!(it.needRepair || it.requires_repair),
        repair_notes: it.repairDetails || it.repair_notes || null,
        description: it.description || it.observations || null,
      })),
    })),
    media: [],
  };

  const res = await generateOfficialInspectionPdf(snapshot);
  return res.doc;
}
