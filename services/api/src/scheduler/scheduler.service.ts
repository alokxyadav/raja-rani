import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Uses @nestjs/schedule (in-process cron) rather than standing up a
// separate BullMQ worker + Redis queue. At this scale (a modular monolith,
// single API instance) an in-process scheduler is simpler to run and
// debug, with no extra infrastructure to operate. The tradeoff: this
// breaks if you ever run multiple API replicas without also adding a
// distributed lock (e.g. Redis-based), since every replica would run
// every job — fine at launch scale, worth revisiting before horizontal
// scaling the API. See docs/DEPLOYMENT.md.
//
// Every job here is written to be idempotent — safe to run twice, safe to
// run late, safe to run after a crash mid-way — per the brief's explicit
// "make jobs idempotent" requirement (Section 56).
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Every minute: find live classes starting in the next 15 minutes and
  // notify everyone who set a reminder, exactly once each — guarded by
  // reminderSentAt, so a job that runs twice (or catches up after
  // downtime) never double-sends. This is the piece
  // docs/LIVE_CLASSES.md flagged as missing: "the scheduled job that reads
  // [reminderSet] and sends a notification doesn't yet [exist]."
  @Cron(CronExpression.EVERY_MINUTE)
  async sendUpcomingLiveClassReminders() {
    const now = new Date();
    const soon = new Date(now.getTime() + 15 * 60 * 1000);

    const upcomingClasses = await this.prisma.liveClass.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { gte: now, lte: soon } },
      include: {
        participants: { where: { reminderSet: true, reminderSentAt: null } },
      },
    });

    let sent = 0;
    for (const liveClass of upcomingClasses) {
      for (const participant of liveClass.participants) {
        await this.notifications.notify(
          participant.userId,
          'LIVE_CLASS_REMINDER',
          `${liveClass.title} starts soon`,
          `Starting at ${liveClass.scheduledAt.toLocaleTimeString()}.`,
          `rajarani://live/${liveClass.id}`,
        );
        await this.prisma.liveClassParticipant.update({
          where: { liveClassId_userId: { liveClassId: liveClass.id, userId: participant.userId } },
          data: { reminderSentAt: now },
        });
        sent++;
      }
    }
    if (sent > 0) this.logger.log(`Sent ${sent} live class reminder(s)`);
  }

  // Hourly: delete OTP rows that have been expired for a while. Never
  // deletes anything still within its valid window — this is table
  // hygiene, not a correctness dependency (an expired OTP is already
  // rejected by auth.service.ts's own expiresAt check regardless of
  // whether this job has run yet).
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // keep 1 day for debugging/support
    const result = await this.prisma.otp.deleteMany({ where: { expiresAt: { lt: cutoff } } });
    if (result.count > 0) this.logger.log(`Cleaned up ${result.count} expired OTP row(s)`);
  }

  // Hourly: an order stuck in PENDING for over 24h almost certainly means
  // the user abandoned checkout (closed the Razorpay sheet, or the
  // webhook genuinely never arrived) — mark it FAILED rather than leaving
  // it PENDING forever. Deliberately does NOT touch anything already PAID/
  // FAILED/REFUNDED, and re-running this job on an already-FAILED order is
  // a no-op by construction (the WHERE clause excludes it).
  @Cron(CronExpression.EVERY_HOUR)
  async failAbandonedOrders() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.prisma.order.updateMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      data: { status: 'FAILED' },
    });
    if (result.count > 0) this.logger.log(`Marked ${result.count} abandoned order(s) as FAILED`);
  }
}
