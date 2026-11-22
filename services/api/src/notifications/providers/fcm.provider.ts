import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Lazily imports firebase-admin so the module can load (and the rest of the
// API can run) even before a service-account JSON exists — but every send
// attempt without real credentials throws clearly rather than pretending
// to succeed. Never fake a push notification "success".
@Injectable()
export class FcmProvider {
  private readonly logger = new Logger(FcmProvider.name);
  private app: import('firebase-admin').app.App | null = null;

  constructor(private config: ConfigService) {}

  private getApp() {
    if (this.app) return this.app;

    const admin = require('firebase-admin');
    const keyPath = this.config.get<string>('FCM_SERVICE_ACCOUNT_JSON_PATH');
    if (!keyPath) {
      throw new Error(
        'FCM is not configured — set FCM_SERVICE_ACCOUNT_JSON_PATH in .env to a ' +
          'Firebase service-account JSON file. Requires a Firebase project with ' +
          'Cloud Messaging enabled.',
      );
    }

    this.app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
    return this.app;
  }

  // Sends to a batch of device tokens, drops invalid/unregistered tokens
  // from the caller's DB so the token list stays clean over time.
  async sendToTokens(
    tokens: string[],
    payload: { title: string; body: string; deepLink?: string },
  ): Promise<{ successCount: number; invalidTokens: string[] }> {
    if (tokens.length === 0) return { successCount: 0, invalidTokens: [] };

    const admin = require('firebase-admin');
    this.getApp();

    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.deepLink ? { deepLink: payload.deepLink } : undefined,
    });

    const invalidTokens: string[] = [];
    res.responses.forEach((r: any, i: number) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[i]);
      } else if (!r.success) {
        this.logger.warn(`FCM send failed for token[${i}]: ${r.error?.message}`);
      }
    });

    return { successCount: res.successCount, invalidTokens };
  }
}
