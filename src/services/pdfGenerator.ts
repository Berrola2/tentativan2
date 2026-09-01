import jsPDF from 'jspdf';
import type { InspectionData, ConservationStatus } from '../types/inspection';

interface StatusColor {
  bg: [number, number, number];
  text: [number, number, number];
}

const STATUS_COLORS: Record<ConservationStatus, StatusColor> = {
  Novo: { bg: [16, 185, 129], text: [255, 255, 255] }, // Emerald
  Bom: { bg: [14, 165, 233], text: [255, 255, 255] }, // Sky Blue
  Regular: { bg: [245, 158, 11], text: [255, 255, 255] }, // Amber
  Ruim: { bg: [239, 68, 68], text: [255, 255, 255] }, // Red
};

export async function generateInspectionPdf(data: InspectionData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let currentY = 14;

  // Helper for adding new page with header/footer
  const checkNewPage = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 16;
      return true;
    }
    return false;
  };

  // --- 1. CORPORATE HEADER ---
  // Top bar background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Company logo (custom or default Vistoria YZZY)
  const logoToUse = data.companyLogo || '/logo.jpg';
  try {
    doc.addImage(logoToUse, 'JPEG', marginX, 4, 20, 20);
  } catch (e) {
    console.warn('Could not add logo to PDF', e);
  }

  // Header Title
  const headerTextX = marginX + 24;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(data.companyName || 'VISTORIA YZZY - LAUDO TÉCNICO', headerTextX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  const subHeader = data.companyCnpj ? `CNPJ: ${data.companyCnpj} • Tel: ${data.companyPhone || '-'}` : 'Serviços de Inspeção e Avaliação Imobiliária';
  doc.text(subHeader, headerTextX, 18);

  // Type badge top-right
  const typeBadgeText = `VISTORIA DE ${data.inspectionType.toUpperCase()}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const badgeWidth = doc.getTextWidth(typeBadgeText) + 8;
  doc.setFillColor(2, 132, 199); // sky-600
  doc.roundedRect(pageWidth - marginX - badgeWidth, 7, badgeWidth, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(typeBadgeText, pageWidth - marginX - badgeWidth + 4, 16);

  currentY = 34;

  // --- 2. PROPERTY & INSPECTION DETAILS BOX ---
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(marginX, currentY, contentWidth, 34, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('DADOS DA VISTORIA E DO IMÓVEL', marginX + 5, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const fullAddress = `${data.propertyAddress}, ${data.propertyNumber}${data.propertyComplement ? ` - ${data.propertyComplement}` : ''}, ${data.propertyNeighborhood || ''} - ${data.propertyCity || ''}/${data.propertyState || ''}`;

  // Left column
  doc.text(`Endereço: ${fullAddress}`, marginX + 5, currentY + 13, { maxWidth: 110 });
  doc.text(`Vistoriador: ${data.inspectorName || 'Não informado'} ${data.inspectorCpfCreci ? `(${data.inspectorCpfCreci})` : ''}`, marginX + 5, currentY + 20, { maxWidth: 110 });
  doc.text(`Locatário / Inquilino: ${data.tenantName || 'Não informado'} ${data.tenantCpf ? `(CPF: ${data.tenantCpf})` : ''}`, marginX + 5, currentY + 26, { maxWidth: 110 });
  if (data.ownerName) {
    doc.text(`Proprietário: ${data.ownerName}`, marginX + 5, currentY + 31, { maxWidth: 110 });
  }

  // Right column
  const rightColX = marginX + 118;
  doc.text(`Data: ${data.date ? new Date(data.date + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}`, rightColX, currentY + 13);
  doc.text(`Hora: ${data.time || '-'}` , rightColX, currentY + 19);

  // Meters info
  const meterParts: string[] = [];
  if (data.waterMeter) meterParts.push(`Água: ${data.waterMeter}`);
  if (data.energyMeter) meterParts.push(`Luz: ${data.energyMeter}`);
  if (data.gasMeter) meterParts.push(`Gás: ${data.gasMeter}`);
  if (meterParts.length > 0) {
    doc.text(`Medidores: ${meterParts.join(' | ')}`, rightColX, currentY + 25, { maxWidth: 58 });
  }
  if (data.keysInfo) {
    doc.text(`Chaves: ${data.keysInfo}`, rightColX, currentY + 31, { maxWidth: 58 });
  }

  currentY += 40;

  // --- 3. SUMMARY STATS CHIPS ---
  let totalItems = 0;
  let repairsCount = 0;
  const statusCounts: Record<string, number> = { Novo: 0, Bom: 0, Regular: 0, Ruim: 0 };

  data.rooms.forEach((r) => {
    r.items.forEach((item) => {
      totalItems++;
      if (item.needRepair) repairsCount++;
      if (statusCounts[item.status] !== undefined) {
        statusCounts[item.status]++;
      }
    });
  });

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, currentY, contentWidth, 11, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  const statsText = `Resumo: ${data.rooms.length} Ambientes • ${totalItems} Itens Vistoriados • ${repairsCount} Reparos Necessários • [Novo: ${statusCounts['Novo']} | Bom: ${statusCounts['Bom']} | Regular: ${statusCounts['Regular']} | Ruim: ${statusCounts['Ruim']}]`;
  doc.text(statsText, marginX + 4, currentY + 7);

  currentY += 16;

  // --- 4. ROOMS AND ITEMS (WITH 3-PHOTOS-PER-ROW GRID) ---
  for (let rIndex = 0; rIndex < data.rooms.length; rIndex++) {
    const room = data.rooms[rIndex];
    checkNewPage(24);

    // Room Section Title Bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(marginX, currentY, contentWidth, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`${rIndex + 1}. AMBIENTE: ${room.name.toUpperCase()} (${room.items.length} ITENS)`, marginX + 4, currentY + 5.5);

    currentY += 12;

    if (room.generalNotes) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Observações do ambiente: ${room.generalNotes}`, marginX + 4, currentY);
      currentY += 6;
    }

    // Items within Room
    for (let iIndex = 0; iIndex < room.items.length; iIndex++) {
      const item = room.items[iIndex];
      const hasPhotos = item.photos && item.photos.length > 0;
      
      // Calculate needed height for this item block
      // 3 photos per row grid: rows needed = Math.ceil(photos / 3)
      const photoRows = hasPhotos ? Math.ceil(item.photos.length / 3) : 0;
      const photoBlockHeight = photoRows * 42; // each photo card row is ~42mm
      const baseBlockHeight = 22 + (item.needRepair ? 10 : 0);
      const totalItemHeight = baseBlockHeight + photoBlockHeight;

      checkNewPage(Math.min(totalItemHeight, 45));

      // Item Card Outline
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(marginX, currentY, contentWidth, totalItemHeight, 2, 2, 'FD');

      // Item Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${item.name}`, marginX + 4, currentY + 6);

      // Status Badge
      const statusColor = STATUS_COLORS[item.status] || STATUS_COLORS['Bom'];
      doc.setFillColor(statusColor.bg[0], statusColor.bg[1], statusColor.bg[2]);
      const statusBadgeW = doc.getTextWidth(item.status) + 7;
      doc.roundedRect(marginX + contentWidth - statusBadgeW - 4, currentY + 2, statusBadgeW, 5.5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(item.status, marginX + contentWidth - statusBadgeW - 0.5, currentY + 5.8);

      // Repair needed badge if true
      if (item.needRepair) {
        const repairBadge = `REPARO NECESSÁRIO (${(item.repairUrgency || 'MÉDIA').toUpperCase()})`;
        doc.setFillColor(239, 68, 68);
        doc.roundedRect(marginX + contentWidth - statusBadgeW - 55, currentY + 2, 48, 5.5, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text(repairBadge, marginX + contentWidth - statusBadgeW - 53, currentY + 5.8);
      }

      // Item Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const descLines = doc.splitTextToSize(`Descrição: ${item.description || 'Sem avarias observadas.'}`, contentWidth - 8);
      doc.text(descLines, marginX + 4, currentY + 12);

      let itemInnerY = currentY + 12 + descLines.length * 3.5;

      // Repair details text if applicable
      if (item.needRepair && item.repairDetails) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(185, 28, 28);
        doc.text(`Reparo Solicitado: ${item.repairDetails}`, marginX + 4, itemInnerY + 1, { maxWidth: contentWidth - 8 });
        itemInnerY += 6;
      }

      // Photos Grid: 3 PHOTOS PER ROW
      if (hasPhotos) {
        itemInnerY += 2;
        const photoColWidth = (contentWidth - 12) / 3; // ~56.6mm each
        const photoHeight = 36; // 36mm height per photo

        for (let pIndex = 0; pIndex < item.photos.length; pIndex++) {
          const photo = item.photos[pIndex];
          const col = pIndex % 3;
          const row = Math.floor(pIndex / 3);
          const photoX = marginX + 3 + col * (photoColWidth + 3);
          const photoY = itemInnerY + row * (photoHeight + 4);

          // Check if photo overflows page
          if (photoY + photoHeight > pageHeight - 20) {
            doc.addPage();
            currentY = 16;
            // Draw photo on top of new page
          }

          try {
            doc.addImage(photo.dataUrl, 'JPEG', photoX, photoY, photoColWidth, photoHeight, undefined, 'FAST');
            doc.setDrawColor(203, 213, 225);
            doc.rect(photoX, photoY, photoColWidth, photoHeight); // border
          } catch (err) {
            console.warn('Failed to embed photo into PDF', err);
          }
        }
      }

      currentY += totalItemHeight + 4;
    }

    currentY += 4;
  }

  // --- 5. GENERAL OBSERVATIONS ---
  if (data.generalObservations) {
    checkNewPage(30);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, currentY, contentWidth, 24, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text('OBSERVAÇÕES GERAIS E TERMOS', marginX + 4, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const obsLines = doc.splitTextToSize(data.generalObservations, contentWidth - 8);
    doc.text(obsLines, marginX + 4, currentY + 12);

    currentY += 30;
  }

  // --- 6. SIGNATURES BLOCK ---
  checkNewPage(48);
  // --- 6. SIGNATURES & FINAL DECLARATION ---
  checkNewPage(45);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, currentY, contentWidth, 42, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, contentWidth, 42, 3, 3, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('DECLARAÇÃO DE CONFORMIDADE E ASSINATURAS', marginX + 5, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('As partes declaram que conferiram as informações deste laudo de vistoria e concordam com as condições e fotos registradas.', marginX + 5, currentY + 11);

  const sigBoxWidth = (contentWidth - 15) / 2;

  // Inspector Signature Line (Left)
  const leftSigX = marginX + 5;
  doc.setDrawColor(148, 163, 184);
  doc.line(leftSigX, currentY + 28, leftSigX + sigBoxWidth, currentY + 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(data.inspectorName || 'Vistoriador Responsável', leftSigX + sigBoxWidth / 2, currentY + 32, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(data.inspectorCpfCreci ? `CPF/CRECI: ${data.inspectorCpfCreci}` : 'Vistoriador / Avaliador', leftSigX + sigBoxWidth / 2, currentY + 36, { align: 'center' });

  // Tenant Signature Line (Right)
  const rightSigX = marginX + 10 + sigBoxWidth;
  doc.line(rightSigX, currentY + 28, rightSigX + sigBoxWidth, currentY + 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(data.tenantName || 'Locatário / Inquilino', rightSigX + sigBoxWidth / 2, currentY + 32, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(data.tenantCpf ? `CPF: ${data.tenantCpf}` : 'Locatário / Responsável', rightSigX + sigBoxWidth / 2, currentY + 36, { align: 'center' });

  // --- 7. NUMBERING OF PAGES & FOOTERS ON ALL PAGES ---
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    // Footer divider line
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    // Footer text
    const footerText = `${data.companyName || 'VistoriaPro'} • Laudo Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    doc.text(footerText, marginX, pageHeight - 7);

    // Page number
    const pageNumText = `Página ${i} de ${totalPages}`;
    doc.text(pageNumText, pageWidth - marginX, pageHeight - 7, { align: 'right' });
  }

  return doc;
}
