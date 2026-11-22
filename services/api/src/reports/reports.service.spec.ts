import { ReportsService } from './reports.service';
import { NotFoundException } from '@nestjs/common';

function makePrismaMock() {
  return {
    report: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    communityPost: { findFirst: jest.fn() },
    communityComment: { findFirst: jest.fn() },
    review: { findFirst: jest.fn() },
  };
}

describe('ReportsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: ReportsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new ReportsService(prisma as any);
  });

  describe('create', () => {
    it('rejects a report against a community post that does not exist', async () => {
      prisma.communityPost.findFirst.mockResolvedValue(null);
      await expect(
        service.create('user-1', { resourceType: 'COMMUNITY_POST', resourceId: 'fake-id', reason: 'spam' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.report.create).not.toHaveBeenCalled();
    });

    it('rejects a report against an already-deleted review (findFirst excludes deletedAt)', async () => {
      prisma.review.findFirst.mockResolvedValue(null); // the where clause already excludes deletedAt
      await expect(
        service.create('user-1', { resourceType: 'REVIEW', resourceId: 'deleted-review', reason: 'abusive' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts a report against a real, existing community comment', async () => {
      prisma.communityComment.findFirst.mockResolvedValue({ id: 'comment-1' });
      prisma.report.create.mockResolvedValue({ id: 'report-1' });

      const result = await service.create('user-1', {
        resourceType: 'COMMUNITY_COMMENT',
        resourceId: 'comment-1',
        reason: 'harassment',
      });
      expect(result.id).toBe('report-1');
      expect(prisma.report.create).toHaveBeenCalledWith({
        data: { reporterId: 'user-1', resourceType: 'COMMUNITY_COMMENT', resourceId: 'comment-1', reason: 'harassment' },
      });
    });
  });

  describe('listUnresolved', () => {
    it('only queries unresolved reports, oldest first', async () => {
      prisma.report.findMany.mockResolvedValue([]);
      await service.listUnresolved();
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { resolved: false }, orderBy: { createdAt: 'asc' } }),
      );
    });
  });

  describe('resolve', () => {
    it('marks a report resolved without deleting any underlying content', async () => {
      prisma.report.update.mockResolvedValue({ id: 'report-1', resolved: true });
      const result = await service.resolve('report-1');
      expect(result.resolved).toBe(true);
      // Confirms this service never touches communityPost/review/comment
      // tables directly — resolving a report is not the same action as
      // moderating the content it points at.
      expect(prisma.communityPost.findFirst).not.toHaveBeenCalled();
    });
  });
});
