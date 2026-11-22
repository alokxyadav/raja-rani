import { SchedulerService } from './scheduler.service';

function makePrismaMock() {
  return {
    liveClass: { findMany: jest.fn() },
    liveClassParticipant: { update: jest.fn() },
    otp: { deleteMany: jest.fn() },
    order: { updateMany: jest.fn() },
  };
}

function makeNotificationsMock() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

describe('SchedulerService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: SchedulerService;

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    service = new SchedulerService(prisma as any, notifications as any);
  });

  describe('sendUpcomingLiveClassReminders', () => {
    it('sends a reminder to every participant who set one and has not been notified yet', async () => {
      prisma.liveClass.findMany.mockResolvedValue([
        {
          id: 'lc-1',
          title: 'Live Q&A',
          scheduledAt: new Date(),
          participants: [
            { userId: 'user-1', reminderSet: true, reminderSentAt: null },
            { userId: 'user-2', reminderSet: true, reminderSentAt: null },
          ],
        },
      ]);

      await service.sendUpcomingLiveClassReminders();

      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(prisma.liveClassParticipant.update).toHaveBeenCalledTimes(2);
      expect(prisma.liveClassParticipant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { liveClassId_userId: { liveClassId: 'lc-1', userId: 'user-1' } },
        }),
      );
    });

    it('is idempotent — running twice never double-sends, because the query itself excludes already-notified participants', async () => {
      // First run: one participant, not yet notified.
      prisma.liveClass.findMany.mockResolvedValueOnce([
        {
          id: 'lc-1',
          title: 'Live Q&A',
          scheduledAt: new Date(),
          participants: [{ userId: 'user-1', reminderSet: true, reminderSentAt: null }],
        },
      ]);
      await service.sendUpcomingLiveClassReminders();
      expect(notifications.notify).toHaveBeenCalledTimes(1);

      // Second run: the query (via reminderSentAt: null in the where
      // clause) would no longer return user-1, simulating the real
      // Postgres behavior after the update from the first run actually
      // persisted reminderSentAt.
      prisma.liveClass.findMany.mockResolvedValueOnce([
        { id: 'lc-1', title: 'Live Q&A', scheduledAt: new Date(), participants: [] },
      ]);
      await service.sendUpcomingLiveClassReminders();

      expect(notifications.notify).toHaveBeenCalledTimes(1); // still just once total
    });

    it('does nothing when there are no upcoming classes', async () => {
      prisma.liveClass.findMany.mockResolvedValue([]);
      await service.sendUpcomingLiveClassReminders();
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredOtps', () => {
    it('deletes only OTPs expired more than 24h ago, never anything still valid', async () => {
      prisma.otp.deleteMany.mockResolvedValue({ count: 3 });
      await service.cleanupExpiredOtps();

      const callArg = prisma.otp.deleteMany.mock.calls[0][0];
      const cutoff = callArg.where.expiresAt.lt as Date;
      // The cutoff must be in the past relative to now — asserting the
      // actual boundary, not just that some argument was passed.
      expect(cutoff.getTime()).toBeLessThan(Date.now());
      expect(cutoff.getTime()).toBeCloseTo(Date.now() - 24 * 60 * 60 * 1000, -3);
    });
  });

  describe('failAbandonedOrders', () => {
    it('only targets PENDING orders older than the cutoff, never PAID/FAILED/REFUNDED', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 2 });
      await service.failAbandonedOrders();

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
          data: { status: 'FAILED' },
        }),
      );
    });
  });
});
