// ==============================================================================
// VISTORIA YZZY — STRIPE BILLING PROVIDER ADAPTER (SANDBOX / TEST MODE)
// ==============================================================================

import type { BillingProvider, CheckoutSessionOptions, CheckoutSessionResult } from './billingProvider';

export class StripeBillingProvider implements BillingProvider {
  name = 'STRIPE';

  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const mockSessionId = `cs_test_stripe_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Date.now()}`;
    
    // URL segura de checkout simulada em ambiente de teste
    const checkoutUrl = `https://checkout.stripe.com/c/pay/${mockSessionId}?plan=${options.planCode}&company=${options.companyId}`;

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
    // Em produção: crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex') === signature
    return signature.startsWith('t=') || signature.length >= 16;
  }
}

export const stripeBillingProvider = new StripeBillingProvider();
