// ==============================================================================
// VISTORIA YZZY — SERVICE: FEATURE FLAGS & KILL SWITCHES (ETAPA 11)
// ==============================================================================

import { supabase } from './supabaseClient';
import { logger } from './logging';

export type SystemFlagKey = 
  | 'AI_ENABLED_GLOBALLY'
  | 'EXTERNAL_SIGNATURES_ENABLED'
  | 'BILLING_ENABLED'
  | 'UPLOADS_ENABLED'
  | 'OFFLINE_SYNC_ENABLED';

export interface FeatureFlagItem {
  key: string;
  enabled: boolean;
  description: string;
}

let cachedFlags: Record<string, boolean> = {
  AI_ENABLED_GLOBALLY: true,
  EXTERNAL_SIGNATURES_ENABLED: true,
  BILLING_ENABLED: true,
  UPLOADS_ENABLED: true,
  OFFLINE_SYNC_ENABLED: true,
};

let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30s

/**
 * Carrega o mapa de feature flags do backend
 */
export async function fetchFeatureFlags(force = false): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (!force && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedFlags;
  }

  try {
    const { data, error } = await supabase.rpc('get_system_feature_flags');
    if (!error && data) {
      const parsed: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(data as Record<string, { enabled: boolean }>)) {
        parsed[k] = v.enabled;
      }
      cachedFlags = parsed;
      lastFetchTime = now;
    }
  } catch (err) {
    logger.warn('Falha ao atualizar feature flags do servidor, utilizando cache local.', { error: err });
  }

  return cachedFlags;
}

/**
 * Checa se uma funcionalidade está globalmente habilitada
 */
export function isFeatureGloballyEnabled(flag: SystemFlagKey): boolean {
  return cachedFlags[flag] !== false;
}

/**
 * [SUPER ADMIN] Alterna estado de uma flag com justificativa auditada
 */
export async function adminToggleFeatureFlag(
  flagKey: SystemFlagKey,
  enabled: boolean,
  reason: string
): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('admin_toggle_feature_flag', {
    p_key: flagKey,
    p_enabled: enabled,
    p_reason: reason,
  });

  if (error) {
    logger.error('Erro ao alternar feature flag', error, { flagKey, enabled, reason });
    return { success: false, message: error.message };
  }

  cachedFlags[flagKey] = enabled;
  logger.info(`Feature flag ${flagKey} alterada para ${enabled}`, { reason });
  return { success: true, message: data?.message };
}
