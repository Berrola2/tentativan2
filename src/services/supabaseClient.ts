import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InspectionData, SupabaseConfig } from '../types/inspection';

let supabaseInstance: SupabaseClient | null = null;
let currentConfig: SupabaseConfig | null = null;

export function getSupabaseClient(config?: SupabaseConfig): SupabaseClient | null {
  if (!config) {
    return supabaseInstance;
  }

  if (
    !supabaseInstance ||
    currentConfig?.url !== config.url ||
    currentConfig?.anonKey !== config.anonKey
  ) {
    if (config.url && config.anonKey) {
      try {
        supabaseInstance = createClient(config.url, config.anonKey);
        currentConfig = config;
      } catch (err) {
        console.error('Failed to initialize Supabase client:', err);
        return null;
      }
    }
  }

  return supabaseInstance;
}

export async function testSupabaseConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  try {
    const client = createClient(config.url, config.anonKey);
    const { error } = await client.from(config.tableName || 'inspections').select('count', { count: 'exact', head: true });
    
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
  config: SupabaseConfig
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Supabase não configurado.' };
  }

  try {
    const tableName = config.tableName || 'inspections';
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
