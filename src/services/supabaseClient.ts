import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InspectionData, SupabaseConfig } from '../types/inspection';

// Variáveis de ambiente exclusivas do Supabase no Frontend
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

// Validação de configuração em ambiente de desenvolvimento
if (!supabaseUrl || !supabasePublishableKey) {
  if (import.meta.env.DEV) {
    console.error(
      '[Supabase Config] Erro de configuração: VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY / VITE_SUPABASE_ANON_KEY não foram informadas.'
    );
  }
}

let supabaseInstance: SupabaseClient | null = null;
let currentConfig: SupabaseConfig | null = null;

export function getInitialSupabaseConfig(): SupabaseConfig {
  return {
    url: supabaseUrl,
    anonKey: supabasePublishableKey,
    bucketName: 'inspection-photos',
    tableName: 'inspections',
    autoSync: true,
  };
}

export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient {
  const targetUrl = config?.url || supabaseUrl;
  const targetKey = config?.anonKey || supabasePublishableKey;

  if (!targetUrl || !targetKey) {
    if (import.meta.env.DEV) {
      console.error(
        '[Supabase] Configuração incompleta: informe VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.'
      );
    }
  }

  if (
    !supabaseInstance ||
    currentConfig?.url !== targetUrl ||
    currentConfig?.anonKey !== targetKey
  ) {
    supabaseInstance = createClient(
      targetUrl || 'https://placeholder-unconfigured.supabase.co',
      targetKey || 'placeholder-publishable-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );

    currentConfig = {
      url: targetUrl,
      anonKey: targetKey,
      bucketName: config?.bucketName || 'inspection-photos',
      tableName: config?.tableName || 'inspections',
      autoSync: config?.autoSync ?? true,
    };
  }

  return supabaseInstance;
}

// Instância padrão compartilhada do Supabase Client
export const supabase: SupabaseClient = getSupabaseClient();

export async function testSupabaseConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    if (!config.url || !config.anonKey) {
      return { success: false, message: 'URL e Chave Pública do Supabase são obrigatórias.' };
    }

    const client = createClient(config.url, config.anonKey);
    const { error } = await client.from('companies').select('id', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }

    return { success: true, message: 'Conexão com Supabase estabelecida com sucesso!' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Verifique a URL e a Chave';
    return { success: false, message: `Falha na conexão: ${message}` };
  }
}

export async function uploadInspectionToSupabase(
  inspection: InspectionData,
  config?: SupabaseConfig,
  companyId?: string
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(config);

  try {
    const tableName = config?.tableName || 'inspections';
    const payload: {
      id: string;
      title: string;
      inspection_type: string;
      date?: string;
      inspector_name?: string;
      tenant_name?: string;
      property_address?: string;
      data_json: InspectionData;
      company_id?: string;
      updated_at: string;
    } = {
      id: inspection.id,
      title: inspection.title || 'Vistoria Sem Título',
      inspection_type: inspection.inspectionType || 'Entrada',
      date: inspection.date,
      inspector_name: inspection.inspectorName || '',
      tenant_name: inspection.tenantName || '',
      property_address: `${inspection.propertyAddress || ''}, ${inspection.propertyNumber || ''}`.trim(),
      data_json: inspection,
      updated_at: new Date().toISOString(),
    };

    if (companyId) {
      payload.company_id = companyId;
    }

    const { error } = await client.from(tableName).upsert(payload);

    if (error) {
      return { success: false, message: `Erro ao salvar no Supabase: ${error.message}` };
    }

    return { success: true, message: 'Vistoria salva na nuvem com sucesso!' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, message: `Erro inesperado: ${message}` };
  }
}

export async function fetchInspectionsFromSupabase(
  config?: SupabaseConfig,
  companyId?: string
): Promise<{ success: boolean; data?: InspectionData[]; message: string }> {
  const client = getSupabaseClient(config);

  try {
    const tableName = config?.tableName || 'inspections';
    let query = client
      .from(tableName)
      .select('data_json, company_id')
      .order('updated_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, message: `Erro ao buscar da nuvem: ${error.message}` };
    }

    const inspections: InspectionData[] = ((data as Array<{ data_json: InspectionData }>) || []).map((row) => row.data_json);
    return { success: true, data: inspections, message: `${inspections.length} vistorias carregadas da nuvem!` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, message: `Erro: ${message}` };
  }
}

export async function deleteInspectionFromSupabase(
  id: string,
  config?: SupabaseConfig
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(config);

  try {
    const tableName = config?.tableName || 'inspections';
    const { error } = await client.from(tableName).delete().eq('id', id);

    if (error) {
      return { success: false, message: `Erro ao excluir na nuvem: ${error.message}` };
    }

    return { success: true, message: 'Vistoria removida da nuvem com sucesso!' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, message: `Erro: ${message}` };
  }
}
