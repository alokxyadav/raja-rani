import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  CreateProviderOrderResult,
  PaymentProvider,
  VerifyWebhookResult,
} from './payment-provider.interface';

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';

  constructor(private config: ConfigService) {}

  async createOrder(
    amountInPaise: number,
    currency: string,
    receiptId: string,
  ): Promise<CreateProviderOrderResult> {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new Error(
        'Razorpay is not configured — set RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET in .env. ' +
          'Requires a Razorpay merchant account (KYC-verified for live mode).',
      );
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: amountInPaise, currency, receipt: receiptId }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Razorpay order creation failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as { id: string };
    return {
      providerOrderId: json.id,
      checkoutPayload: {
        key: keyId,
        order_id: json.id,
        amount: amountInPaise,
        currency,
      },
    };
  }

  // Razorpay webhook signature = HMAC-SHA256(rawBody, webhookSecret), sent
  // in the X-Razorpay-Signature header. Verify against the raw string —
  // never against JSON.stringify(parsedBody), which can reorder keys and
  // silently break every verification.
  verifyWebhookSignature(rawBody: string, signatureHeader: string): VerifyWebhookResult {
    const webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const valid =
      signatureHeader.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));

    if (!valid) return { valid: false };

    const payload = JSON.parse(rawBody);
    const entity = payload?.payload?.payment?.entity;
    const eventStatus = payload?.event as string; // e.g. "payment.captured" | "payment.failed"

    return {
      valid: true,
      providerOrderId: entity?.order_id,
      providerPaymentId: entity?.id,
      amount: entity?.amount,
      currency: entity?.currency,
      status: eventStatus === 'payment.captured' ? 'SUCCESS' : 'FAILED',
    };
  }

  async refundPayment(providerPaymentId: string, amountInPaise?: number) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!keyId || !keySecret) {
      throw new Error('Razorpay is not configured — see RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET in .env.');
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/payments/${providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(amountInPaise ? { amount: amountInPaise } : {}),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Razorpay refund failed: ${res.status} ${body}`);
    }

    const json = (await res.json()) as { id: string; status: string };
    return { refundId: json.id, status: json.status };
  }
}
