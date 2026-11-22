import { SupportService } from './support.service';
import { NotFoundException } from '@nestjs/common';

function makePrismaMock() {
  return {
    supportTicket: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
}

function makeNotificationsMock() {
  return { notify: jest.fn().mockResolvedValue(undefined) };
}

describe('SupportService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let notifications: ReturnType<typeof makeNotificationsMock>;
  let service: SupportService;

  beforeEach(() => {
    prisma = makePrismaMock();
    notifications = makeNotificationsMock();
    service = new SupportService(prisma as any, notifications as any);
  });

  it('creates a ticket for any authenticated user with no entitlement check', async () => {
    prisma.supportTicket.create.mockResolvedValue({ id: 'ticket-1' });
    const result = await service.create('user-1', {
      category: 'PAYMENT',
      subject: 'Payment not reflecting',
      message: 'I paid but the course is not unlocked yet.',
    });
    expect(result.id).toBe('ticket-1');
    expect(prisma.supportTicket.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        category: 'PAYMENT',
        subject: 'Payment not reflecting',
        message: 'I paid but the course is not unlocked yet.',
      },
    });
  });

  it('lists open tickets before others in the admin view', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);
    await service.listAllForAdmin();
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ status: 'asc' }, { createdAt: 'desc' }] }),
    );
  });

  it('filters admin listing by status when provided', async () => {
    prisma.supportTicket.findMany.mockResolvedValue([]);
    await service.listAllForAdmin('OPEN');
    expect(prisma.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'OPEN' } }),
    );
  });

  describe('respond', () => {
    it('throws NotFound for a nonexistent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue(null);
      await expect(
        service.respond('ticket-1', 'admin-1', { response: 'x', status: 'RESOLVED' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the ticket and notifies the original ticket owner (not the admin)', async () => {
      prisma.supportTicket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        userId: 'student-1',
        subject: 'Video not loading',
      });
      prisma.supportTicket.update.mockResolvedValue({ id: 'ticket-1', status: 'RESOLVED' });

      await service.respond('ticket-1', 'admin-1', { response: 'Fixed, please retry.', status: 'RESOLVED' });

      expect(notifications.notify).toHaveBeenCalledWith(
        'student-1', // the ticket's owner, not the responding admin
        'SYSTEM',
        expect.any(String),
        expect.stringContaining('Fixed, please retry.'),
      );
      expect(prisma.supportTicket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { adminResponse: 'Fixed, please retry.', status: 'RESOLVED', respondedById: 'admin-1' },
      });
    });
  });
});
