// ==============================================================================
// VISTORIA YZZY — TIPOS DE ADMINISTRAÇÃO SaaS, PLANOS E BILLING (ETAPA 10)
// ==============================================================================

export type PlanCode = 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED' | 'EXPIRED';
export type InvoiceStatus = 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE' | 'FAILED';

export interface SaasPlan {
  id: string;
  code: PlanCode;
  name: string;
  description?: string;
  billing_interval: 'MONTHLY' | 'YEARLY';
  price_cents: number;
  currency: string;
  active: boolean;
  is_public: boolean;
  trial_days: number;
  created_at: string;
  updated_at: string;
}

export interface PlanEntitlementItem {
  value: any;
  type: 'BOOLEAN' | 'INTEGER' | 'DECIMAL' | 'TEXT' | 'JSON';
  overridden: boolean;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_started_at?: string;
  trial_ends_at?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  provider: string;
  provider_subscription_id?: string;
}

export interface CompanyPlanAndUsage {
  company_id: string;
  subscription: CompanySubscription;
  plan: SaasPlan;
  entitlements: Record<string, PlanEntitlementItem>;
  usage: {
    ACTIVE_USERS?: number;
    INSPECTIONS_CREATED?: number;
    AI_OPERATIONS?: number;
    PDF_REPORTS?: number;
    COMPARISON_REPORTS?: number;
    EXTERNAL_SIGNATURES?: number;
    STORAGE_BYTES?: number;
    [key: string]: number | undefined;
  };
}

export interface SaasMetrics {
  total_companies: number;
  active_subscriptions: number;
  trials_active: number;
  past_due_subscriptions: number;
  suspended_subscriptions: number;
  mrr_cents: number;
  mrr_formatted: string;
  arr_cents: number;
  arr_formatted: string;
  total_storage_bytes: number;
  total_storage_gb: number;
  total_inspections: number;
}

export interface BillingInvoice {
  id: string;
  company_id: string;
  provider_invoice_id: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  currency: string;
  status: InvoiceStatus;
  due_at?: string;
  paid_at?: string;
  invoice_url?: string;
  created_at: string;
}

export interface CommercialAuditLog {
  id: string;
  company_id?: string;
  event_type: string;
  actor_user_id?: string;
  details: Record<string, any>;
  created_at: string;
}
