import { ReviewsService } from './reviews.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

function makePrismaMock() {
  return {
    review: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    enrollment: { findMany: jest.fn() },
  };
}

function makeEntitlementMock() {
  return { canAccessCourse: jest.fn() };
}

describe('ReviewsService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let entitlement: ReturnType<typeof makeEntitlementMock>;
  let service: ReviewsService;

  beforeEach(() => {
    prisma = makePrismaMock();
    entitlement = makeEntitlementMock();
    service = new ReviewsService(prisma as any, entitlement as any);
  });

  describe('create', () => {
    it('refuses a review from a non-enrolled user', async () => {
      entitlement.canAccessCourse.mockResolvedValue(false);
      await expect(
        service.create('user-1', 'course-1', { rating: 5 }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('refuses a second review from the same user for the same course', async () => {
      entitlement.canAccessCourse.mockResolvedValue(true);
      prisma.review.findUnique.mockResolvedValue({ id: 'existing-review' });
      await expect(
        service.create('user-1', 'course-1', { rating: 4 }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('creates a review for an enrolled user with no existing review', async () => {
      entitlement.canAccessCourse.mockResolvedValue(true);
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({ id: 'new-review', rating: 5 });

      const result = await service.create('user-1', 'course-1', { rating: 5, body: 'Great course' });
      expect(result.id).toBe('new-review');
    });
  });

  describe('update / delete ownership', () => {
    it('refuses to update a review that belongs to someone else', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'review-1', userId: 'other-user', deletedAt: null });
      await expect(
        service.update('user-1', 'review-1', { rating: 3 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to delete a review that belongs to someone else', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'review-1', userId: 'other-user', deletedAt: null });
      await expect(service.deleteOwn('user-1', 'review-1')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFound for an already-deleted review rather than silently succeeding', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'review-1', userId: 'user-1', deletedAt: new Date() });
      await expect(service.update('user-1', 'review-1', { rating: 3 })).rejects.toThrow(NotFoundException);
    });

    it('allows updating a review the caller actually owns', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'review-1', userId: 'user-1', deletedAt: null });
      prisma.review.update.mockResolvedValue({ id: 'review-1', rating: 2 });
      const result = await service.update('user-1', 'review-1', { rating: 2 });
      expect(result.rating).toBe(2);
    });
  });

  describe('listForCourse', () => {
    it('computes the average rating correctly', async () => {
      prisma.review.findMany.mockResolvedValue([
        { id: 'r1', userId: 'u1', rating: 5, deletedAt: null },
        { id: 'r2', userId: 'u2', rating: 3, deletedAt: null },
      ]);
      prisma.enrollment.findMany.mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]);

      const result = await service.listForCourse('course-1');
      expect(result.averageRating).toBe(4); // (5+3)/2
      expect(result.count).toBe(2);
    });

    it('returns null average when there are no reviews, not zero or NaN', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.enrollment.findMany.mockResolvedValue([]);

      const result = await service.listForCourse('course-1');
      expect(result.averageRating).toBeNull();
      expect(result.count).toBe(0);
    });

    it('marks a review as not-currently-enrolled if the user was refunded since reviewing', async () => {
      prisma.review.findMany.mockResolvedValue([{ id: 'r1', userId: 'u1', rating: 5, deletedAt: null }]);
      prisma.enrollment.findMany.mockResolvedValue([]); // no longer enrolled

      const result = await service.listForCourse('course-1');
      expect(result.items[0].verifiedEnrollment).toBe(false);
    });
  });
});
