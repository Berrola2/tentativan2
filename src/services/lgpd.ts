// ==============================================================================
// VISTORIA YZZY — SERVICE: CONFORMIDADE LGPD & DATA SUBJECT REQUESTS (ETAPA 11)
// ==============================================================================

import { supabase } from './supabaseClient';
import { logger } from './logging';

export interface LgpdExportResult {
  company: any;
  profiles: any[];
  properties: any[];
  inspections: any[];
  exported_at: string;
}

/**
 * Solicita e exporta os dados da empresa em conformidade com a LGPD (DSR Export)
 */
export async function exportCompanyLgpdData(companyId: string): Promise<LgpdExportResult> {
  logger.info('LGPD: Exportação de dados solicitada', { companyId });

  const { data, error } = await supabase.rpc('export_company_lgpd_data', {
    p_company_id: companyId,
  });

  if (error || !data) {
    logger.error('LGPD: Erro ao exportar dados da empresa', error, { companyId });
    throw new Error(error?.message || 'Erro ao exportar dados para LGPD.');
  }

  return data as LgpdExportResult;
}

/**
 * Dispara o download no navegador do arquivo JSON estruturado contendo os dados exportados
 */
export function downloadLgpdExportAsJson(exportData: LgpdExportResult, companyName: string): void {
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const safeName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.download = `yzzy_lgpd_export_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
