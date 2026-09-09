// ==============================================================================
// VISTORIA YZZY — SERVICE: LOGGING ESTRUTURADO & REDAÇÃO DE DADOS (ETAPA 11)
// ==============================================================================

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  operation: string;
  companyId?: string;
  userId?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

const SENSITIVE_KEYS = [
  'password',
  'temp_password',
  'token',
  'secret',
  'jwt',
  'authorization',
  'apikey',
  'api_key',
  'card',
  'cardnumber',
  'card_number',
  'cvv',
  'signature_token',
  'webhook_secret',
  'service_role'
];

/**
 * Sanitiza recursivamente objetos removendo/redigindo credenciais e dados sensíveis
 */
export function sanitizeLogData(data: any): any {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(k => lowerKey.includes(k));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Cria ou recupera o ID de correlação da requisição/sessão atual
 */
let currentCorrelationId = `req_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Date.now()}`;

export function getRequestId(): string {
  return currentCorrelationId;
}

export function refreshRequestId(): string {
  currentCorrelationId = `req_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 16) : Date.now()}`;
  return currentCorrelationId;
}

class Logger {
  private formatLog(level: LogLevel, operation: string, metadata?: Record<string, any>, error?: Error): StructuredLog {
    return {
      timestamp: new Date().toISOString(),
      level,
      requestId: getRequestId(),
      operation,
      metadata: metadata ? sanitizeLogData(metadata) : undefined,
      error: error ? {
        message: error.message,
        code: error.name,
        stack: error.stack?.slice(0, 300)
      } : undefined
    };
  }

  info(operation: string, metadata?: Record<string, any>): void {
    const log = this.formatLog('INFO', operation, metadata);
    console.log(`[YZ-INFO] ${log.timestamp} [${log.requestId}] ${operation}`, log.metadata || '');
  }

  warn(operation: string, metadata?: Record<string, any>): void {
    const log = this.formatLog('WARN', operation, metadata);
    console.warn(`[YZ-WARN] ${log.timestamp} [${log.requestId}] ${operation}`, log.metadata || '');
  }

  error(operation: string, error?: Error | any, metadata?: Record<string, any>): void {
    const errObj = error instanceof Error ? error : (error ? new Error(String(error)) : undefined);
    const log = this.formatLog('ERROR', operation, metadata, errObj);
    console.error(`[YZ-ERROR] ${log.timestamp} [${log.requestId}] ${operation}`, log.error?.message, log.metadata || '');
  }
}

export const logger = new Logger();
