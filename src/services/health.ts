// ==============================================================================
// VISTORIA YZZY — SERVICE: HEALTH CHECK & STATUS OPERACIONAL (ETAPA 11)
// ==============================================================================

import { supabase } from './supabaseClient';
import { logger } from './logging';

export interface SystemHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: string;
  database: {
    connected: boolean;
    latencyMs: number;
    activeTenants?: number;
    totalInspections?: number;
  };
  client: {
    online: boolean;
    indexedDb: boolean;
  };
  featureFlags: Record<string, boolean>;
  version: string;
}

/**
 * Executa health check integrado da aplicação e do backend
 */
export async function checkSystemHealth(): Promise<SystemHealthStatus> {
  const start = performance.now();
  let dbConnected = false;
  let rpcData: any = null;

  try {
    const { data, error } = await supabase.rpc('get_system_health');
    if (!error && data) {
      dbConnected = true;
      rpcData = data;
    }
  } catch (err) {
    logger.error('HealthCheck: Falha ao consultar backend', err);
  }

  const latencyMs = Math.round(performance.now() - start);
  const isOnline = navigator.onLine;
  const hasIndexedDb = typeof indexedDB !== 'undefined';

  const isHealthy = dbConnected && isOnline;

  const result: SystemHealthStatus = {
    status: isHealthy ? 'HEALTHY' : (isOnline ? 'DEGRADED' : 'UNHEALTHY'),
    timestamp: new Date().toISOString(),
    database: {
      connected: dbConnected,
      latencyMs,
      activeTenants: rpcData?.database?.active_tenants,
      totalInspections: rpcData?.database?.total_inspections,
    },
    client: {
      online: isOnline,
      indexedDb: hasIndexedDb,
    },
    featureFlags: rpcData?.feature_flags || {},
    version: '1.0.0-prod'
  };

  return result;
}
