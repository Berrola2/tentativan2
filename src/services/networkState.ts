// ==============================================================================
// VISTORIA YZZY — GESTOR DE ESTADO DE REDE E CONECTIVIDADE (ETAPA 09)
// ==============================================================================

export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'RECONNECTING';

export interface NetworkStateListener {
  (status: NetworkStatus, pingLatencyMs?: number): void;
}

class NetworkStateManager {
  private currentStatus: NetworkStatus = typeof navigator !== 'undefined' && navigator.onLine ? 'ONLINE' : 'OFFLINE';
  private listeners: Set<NetworkStateListener> = new Set();
  private pingIntervalId: any = null;
  private consecutiveFailures: number = 0;
  private lastLatencyMs: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleBrowserOnline());
      window.addEventListener('offline', () => this.handleBrowserOffline());
      
      // Checagem periódica suave de conectividade real (a cada 15 segundos)
      this.startPeriodicHealthCheck();
      
      // Checagem inicial
      setTimeout(() => this.checkRealConnectivity(), 1000);
    }
  }

  public getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  public getLatency(): number {
    return this.lastLatencyMs;
  }

  public subscribe(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);
    // Notificação imediata com estado atual
    listener(this.currentStatus, this.lastLatencyMs);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentStatus, this.lastLatencyMs);
      } catch (err) {
        console.error('Erro em listener de rede:', err);
      }
    });
  }

  private setStatus(newStatus: NetworkStatus) {
    if (this.currentStatus !== newStatus) {
      console.log(`[NetworkState] Transição de estado: ${this.currentStatus} -> ${newStatus}`);
      this.currentStatus = newStatus;
      this.notify();
    }
  }

  private handleBrowserOffline() {
    this.setStatus('OFFLINE');
    this.consecutiveFailures = 3;
  }

  private async handleBrowserOnline() {
    this.setStatus('RECONNECTING');
    await this.checkRealConnectivity();
  }

  /**
   * Executa um ping leve ao backend Supabase para testar conectividade e latência reais
   */
  public async checkRealConnectivity(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus('OFFLINE');
      return false;
    }

    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      // Ping leve ao endpoint público do Supabase
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wyyigrlqxwjxjqkazeof.supabase.co';
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        }
      });
      clearTimeout(timeoutId);

      const endTime = performance.now();
      this.lastLatencyMs = Math.round(endTime - startTime);

      if (response.ok || response.status === 200 || response.status === 401 || response.status === 404) {
        this.consecutiveFailures = 0;
        if (this.lastLatencyMs > 2500) {
          this.setStatus('DEGRADED');
        } else {
          this.setStatus('ONLINE');
        }
        return true;
      } else {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= 2) {
          this.setStatus('DEGRADED');
        }
        return false;
      }
    } catch (err: any) {
      this.consecutiveFailures++;
      if (err.name === 'AbortError') {
        // Timeout -> Modo Degradado
        this.setStatus('DEGRADED');
      } else {
        // Erro de rede -> Offline
        this.setStatus('OFFLINE');
      }
      return false;
    }
  }

  private startPeriodicHealthCheck() {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    this.pingIntervalId = setInterval(() => {
      this.checkRealConnectivity();
    }, 15000);
  }
}

export const networkState = new NetworkStateManager();
