import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FcmProvider } from './providers/fcm.provider';
import { RegisterDeviceTokenDto } from './dto/notification.dto';

type NotificationType =
  | 'COURSE_ANNOUNCEMENT'
  | 'LIVE_CLASS_REMINDER'
  | 'NEW_COURSE'
  | 'PAYMENT_UPDATE'
  | 'COMMUNITY'
  | 'SYSTEM';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private fcm: FcmProvider,
  ) {}

  async registerDevice(userId: string, dto: RegisterDeviceTokenDto) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform ?? 'android' },
      create: { userId, token: dto.token, platform: dto.platform ?? 'android' },
    });
  }

  async listMine(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  // The one place that creates a Notification row AND (best-effort) sends a
  // push. Every other module (live classes, payments, courses) should call
  // this rather than writing to the Notification table directly, so the
  // "record it, then try to push it, never fail the caller's real action
  // over a push failure" behavior stays consistent everywhere.
  async notify(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    deepLink?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, title, body, deepLink },
    });

    const devices = await this.prisma.deviceToken.findMany({ where: { userId } });
    if (devices.length === 0) return notification;

    try {
      const result = await this.fcm.sendToTokens(
        devices.map((d) => d.token),
        { title, body, deepLink },
      );
      if (result.invalidTokens.length) {
        await this.prisma.deviceToken.deleteMany({
          where: { token: { in: result.invalidTokens } },
        });
      }
    } catch (err) {
      // Push delivery is best-effort. The in-app notification (source of
      // truth) is already saved — a misconfigured FCM key should never
      // roll back or fail the caller's underlying action (e.g. a payment
      // confirmation, a live class going live).
      this.logger.warn(`push delivery failed for user ${userId}: ${(err as Error).message}`);
    }

    return notification;
  }

  // Bulk send from the admin panel ("send push to all students"). Batches
  // in groups of 200 users at a time rather than looping notify() once per
  // user, which would be N create() calls + N push calls for a userbase
  // that could be thousands — createMany for the DB rows, then FCM's own
  // batching (sendToTokens already chunks internally via
  // sendEachForMulticast) for the push side.
  async broadcast(
    type: NotificationType,
    title: string,
    body: string,
    deepLink?: string,
    audience: 'ALL' | 'STUDENT' = 'STUDENT',
  ) {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null, ...(audience === 'STUDENT' ? { role: 'STUDENT' } : {}) },
      select: { id: true },
    });

    await this.prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type, title, body, deepLink })),
    });

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      select: { token: true },
    });

    if (devices.length > 0) {
      try {
        await this.fcm.sendToTokens(devices.map((d) => d.token), { title, body, deepLink });
      } catch (err) {
        this.logger.warn(`broadcast push delivery failed: ${(err as Error).message}`);
      }
    }

    return { recipientCount: users.length };
  }
}
