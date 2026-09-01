import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InspectionData, SupabaseConfig } from '../types/inspection';

let supabaseInstance: SupabaseClient | null = null;
let currentConfig: SupabaseConfig | null = null;

// Read default env variables or use configured Supabase project
const defaultEnvUrl = import.meta.env.VITE_SUPABASE_URL || 'https://dgeczjzbohmveonqxxzv.supabase.co';
const defaultEnvAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_3S17TTx7Eh_2qSfPzzLw9w_l5ImSPKl';

export function getInitialSupabaseConfig(): SupabaseConfig {
  return {
    url: defaultEnvUrl,
    anonKey: defaultEnvAnonKey,
    bucketName: 'inspection-photos',
    tableName: 'inspections',
    autoSync: !!(defaultEnvUrl && defaultEnvAnonKey),
  };
}

export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  const targetUrl = config?.url || defaultEnvUrl;
  const targetKey = config?.anonKey || defaultEnvAnonKey;

  if (!targetUrl || !targetKey) {
    return null;
  }

  if (
    !supabaseInstance ||
    currentConfig?.url !== targetUrl ||
    currentConfig?.anonKey !== targetKey
  ) {
    try {
      supabaseInstance = createClient(targetUrl, targetKey);
      currentConfig = {
        url: targetUrl,
        anonKey: targetKey,
        bucketName: config?.bucketName || 'inspection-photos',
        tableName: config?.tableName || 'inspections',
        autoSync: config?.autoSync || false,
      };
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export async function testSupabaseConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    const client = createClient(config.url, config.anonKey);
    const { error } = await client.from(config.tableName || 'inspections').select('id', { count: 'exact', head: true });
    
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }

    return { success: true, message: 'Conexão com Supabase estabelecida com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Falha na conexão: ${err.message || 'Verifique a URL e a Chave'}` };
  }
}

export async function uploadInspectionToSupabase(
  inspection: InspectionData,
  config?: SupabaseConfig
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Supabase não configurado. Informe URL e Chave.' };
  }

  try {
    const tableName = config?.tableName || 'inspections';
    const { error } = await client.from(tableName).upsert({
      id: inspection.id,
      title: inspection.title,
      inspection_type: inspection.inspectionType,
      date: inspection.date,
      inspector_name: inspection.inspectorName,
      tenant_name: inspection.tenantName,
      property_address: `${inspection.propertyAddress}, ${inspection.propertyNumber}`,
      data_json: inspection,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, message: `Erro ao salvar no Supabase: ${error.message}` };
    }

    return { success: true, message: 'Vistoria sincronizada com a nuvem no Supabase com sucesso!' };
  } catch (err: any) {
    return { success: false, message: `Erro inesperado: ${err.message}` };
  }
}

export async function fetchInspectionsFromSupabase(
  config?: SupabaseConfig
): Promise<{ success: boolean; data?: InspectionData[]; message: string }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Supabase não configurado.' };
  }

  try {
    const tableName = config?.tableName || 'inspections';
    const { data, error } = await client
      .from(tableName)
      .select('data_json')
      .order('updated_at', { ascending: false });

    if (error) {
      return { success: false, message: `Erro ao buscar vistorias: ${error.message}` };
    }

    const inspections: InspectionData[] = (data || []).map((row: any) => row.data_json);
    return { success: true, data: inspections, message: `${inspections.length} vistorias carregadas da nuvem!` };
  } catch (err: any) {
    return { success: false, message: `Erro: ${err.message}` };
  }
}
