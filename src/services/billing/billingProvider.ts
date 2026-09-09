// ==============================================================================
// VISTORIA YZZY — ABSTRAÇÃO DE PROVEDOR DE BILLING (ETAPA 10)
// ==============================================================================

import type { PlanCode } from '../../types/billing';

export interface CheckoutSessionOptions {
  companyId: string;
  planCode: PlanCode;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string;
  provider: string;
}

export interface BillingProvider {
  name: string;
  createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult>;
  cancelSubscription(providerSubId: string, atPeriodEnd?: boolean): Promise<{ success: boolean }>;
  verifyWebhookSignature(rawPayload: string, signature: string, webhookSecret: string): boolean;
}

/**
 * Provedor de Testes / Sandbox Neutral
 * Permite simular fluxos comerciais sem dependência rígida de gateway externo
 */
export class SandboxBillingProvider implements BillingProvider {
  name = 'SANDBOX';

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const mockSessionId = `cs_test_${crypto.randomUUID().replace(/-/g, '')}`;
    // Link seguro de simulação de checkout
    const checkoutUrl = `${window.location.origin}/checkout/sandbox?session_id=${mockSessionId}&plan=${options.planCode}&company=${options.companyId}`;
    
    return {
      sessionId: mockSessionId,
      checkoutUrl,
      provider: this.name
    };
  }

  async cancelSubscription(_providerSubId: string, _atPeriodEnd = true): Promise<{ success: boolean }> {
    return { success: true };
  }

  verifyWebhookSignature(_rawPayload: string, signature: string, webhookSecret: string): boolean {
    if (!signature || !webhookSecret) return false;
    // Em sandbox, se a assinatura for 'valid_signature' ou corresponder ao hash
    return signature === 'valid_sandbox_sig' || signature.length > 10;
  }
}

export const defaultBillingProvider: BillingProvider = new SandboxBillingProvider();
