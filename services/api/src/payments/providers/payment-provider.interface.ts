// Business logic (OrdersService, webhook handling) depends only on this
// interface, never on Razorpay/Play Billing directly, per the "no vendor
// lock-in" requirement. Swapping providers means writing a new adapter,
// not touching order/enrollment logic.

export interface CreateProviderOrderResult {
  providerOrderId: string;
  // Everything the client needs to open the provider's checkout UI.
  checkoutPayload: Record<string, unknown>;
}

export interface RefundResult {
  refundId: string;
  status: string;
}

export interface VerifyWebhookResult {
  valid: boolean;
  providerOrderId?: string;
  providerPaymentId?: string;
  amount?: number;
  currency?: string;
  status?: 'SUCCESS' | 'FAILED';
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(amountInPaise: number, currency: string, receiptId: string): Promise<CreateProviderOrderResult>;
  // rawBody must be the exact, unparsed request body — signature verification
  // breaks silently if you verify against a re-serialized JSON object instead.
  verifyWebhookSignature(rawBody: string, signatureHeader: string): VerifyWebhookResult;
  // amountInPaise omitted = full refund. Partial refunds pass a smaller
  // amount than the original payment.
  refundPayment(providerPaymentId: string, amountInPaise?: number): Promise<RefundResult>;
}
