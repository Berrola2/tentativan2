// ==============================================================================
// VISTORIA YZZY — SERVICE: ADMINISTRAÇÃO SaaS, PLANOS E BILLING (ETAPA 10)
// ==============================================================================

import { supabase } from './supabaseClient';
import type {
  SaasPlan,
  CompanyPlanAndUsage,
  SaasMetrics,
  BillingInvoice,
  PlanCode
} from '../types/billing';
import { defaultBillingProvider } from './billing/billingProvider';

/**
 * Busca o plano atual, limites efetivos e consumo consolidado da empresa
 */
export async function fetchCompanyPlanAndUsage(companyId: string): Promise<CompanyPlanAndUsage> {
  const { data, error } = await supabase.rpc('get_company_plan_and_usage', {
    p_company_id: companyId,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Erro ao obter dados comerciais do plano.');
  }

  return data as CompanyPlanAndUsage;
}

/**
 * Lista todos os planos SaaS disponíveis publicamente
 */
export async function fetchPublicSaasPlans(): Promise<SaasPlan[]> {
  const { data, error } = await supabase
    .from('saas_plans')
    .select('*')
    .eq('active', true)
    .eq('is_public', true)
    .order('price_cents', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Erro ao listar planos.');
  }

  return data as SaasPlan[];
}

/**
 * Lista o histórico de faturas e pagamentos da empresa
 */
export async function fetchCompanyInvoices(companyId: string): Promise<BillingInvoice[]> {
  const { data, error } = await supabase
    .from('billing_invoices')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Erro ao listar faturas.');
  }

  return data as BillingInvoice[];
}

/**
 * Inicia sessão de checkout seguro para alteração / contratação de plano
 */
export async function initiatePlanCheckout(
  companyId: string,
  planCode: PlanCode
): Promise<{ checkoutUrl: string }> {
  const session = await defaultBillingProvider.createCheckoutSession({
    companyId,
    planCode,
    successUrl: `${window.location.origin}/dashboard?checkout=success`,
    cancelUrl: `${window.location.origin}/dashboard?checkout=canceled`
  });

  return { checkoutUrl: session.checkoutUrl };
}

/**
 * [SUPER ADMIN] Obtém métricas consolidadas de SaaS (MRR, ARR, assinaturas)
 */
export async function fetchSuperAdminSaasMetrics(): Promise<SaasMetrics> {
  const { data, error } = await supabase.rpc('admin_get_saas_metrics');

  if (error || !data) {
    throw new Error(error?.message || 'Erro ao buscar métricas SaaS.');
  }

  return data as SaasMetrics;
}

/**
 * [SUPER ADMIN] Altera o plano de uma empresa com justificativa comercial
 */
export async function adminUpdateCompanyPlan(
  companyId: string,
  planCode: PlanCode,
  reason: string
): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('admin_update_company_plan', {
    p_company_id: companyId,
    p_plan_code: planCode,
    p_reason: reason,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: data?.message };
}

/**
 * [SUPER ADMIN] Estende o período de trial de uma empresa com auditoria
 */
export async function adminExtendTrial(
  companyId: string,
  additionalDays: number,
  reason: string
): Promise<{ success: boolean; newTrialEndsAt?: string; message?: string }> {
  try {
    const { data, error } = await supabase.rpc('admin_extend_trial', {
      p_company_id: companyId,
      p_additional_days: additionalDays,
      p_reason: reason,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, newTrialEndsAt: data?.new_trial_ends_at };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * [SUPER ADMIN] Lista todas as empresas com seus planos e status de assinatura
 */
export async function fetchSuperAdminCompaniesList(): Promise<any[]> {
  const { data, error } = await supabase
    .from('companies')
    .select(`
      id,
      name,
      trade_name,
      slug,
      document_number,
      phone,
      active,
      created_at,
      company_subscriptions (
        id,
        status,
        trial_started_at,
        trial_ends_at,
        current_period_start,
        current_period_end,
        cancel_at_period_end,
        saas_plans (
          id,
          code,
          name,
          price_cents,
          billing_interval
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Erro ao listar empresas e planos.');
  }

  return data || [];
}

/**
 * [SUPER ADMIN] Força a reconciliação e recálculo dos contadores da empresa
 */
export async function adminRecalculateUsage(companyId: string): Promise<CompanyPlanAndUsage> {
  return fetchCompanyPlanAndUsage(companyId);
}
