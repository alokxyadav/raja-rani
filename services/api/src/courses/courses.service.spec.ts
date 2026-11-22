import { CoursesService } from './courses.service';
import { BadRequestException } from '@nestjs/common';

function makePrismaMock() {
  return {
    course: { findUnique: jest.fn(), update: jest.fn() },
    chapter: { count: jest.fn() },
  };
}

describe('CoursesService — publish validation', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: CoursesService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new CoursesService(prisma as any);
  });

  it('refuses to publish a course missing a thumbnail', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      deletedAt: null,
      title: 'Test Course',
      shortDescription: 'desc',
      thumbnailUrl: null,
      accessType: 'FREE',
      price: null,
    });
    prisma.chapter.count.mockResolvedValue(1);

    await expect(service.publish('c1')).rejects.toThrow(BadRequestException);
    await expect(service.publish('c1')).rejects.toThrow(/thumbnailUrl/);
  });

  it('refuses to publish a course with zero chapters', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      deletedAt: null,
      title: 'Test Course',
      shortDescription: 'desc',
      thumbnailUrl: 'https://x.com/img.png',
      accessType: 'FREE',
      price: null,
    });
    prisma.chapter.count.mockResolvedValue(0);

    await expect(service.publish('c1')).rejects.toThrow(/at least one chapter/);
  });

  it('refuses to publish a PAID course with no price set', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      deletedAt: null,
      title: 'Test Course',
      shortDescription: 'desc',
      thumbnailUrl: 'https://x.com/img.png',
      accessType: 'PAID',
      price: null,
    });
    prisma.chapter.count.mockResolvedValue(2);

    await expect(service.publish('c1')).rejects.toThrow(/price/);
  });

  it('publishes successfully once every required field is present', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'c1',
      deletedAt: null,
      title: 'Test Course',
      shortDescription: 'desc',
      thumbnailUrl: 'https://x.com/img.png',
      accessType: 'FREE',
      price: null,
    });
    prisma.chapter.count.mockResolvedValue(1);
    prisma.course.update.mockResolvedValue({ id: 'c1', status: 'PUBLISHED' });

    const result = await service.publish('c1');
    expect(prisma.course.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'PUBLISHED' },
    });
    expect(result.status).toBe('PUBLISHED');
  });
});

// Separate describe block with its own richer mock — the publish-
// validation tests above only need course/chapter; discovery needs
// course.findMany, $transaction, and review.groupBy too.
function makeDiscoveryPrismaMock() {
  return {
    course: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    review: { groupBy: jest.fn() },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
}

describe('CoursesService — discovery (filtering & sorting)', () => {
  let prisma: ReturnType<typeof makeDiscoveryPrismaMock>;
  let service: CoursesService;

  beforeEach(() => {
    prisma = makeDiscoveryPrismaMock();
    service = new CoursesService(prisma as any);
  });

  it('applies a price range filter to the where clause', async () => {
    prisma.course.findMany.mockResolvedValue([]);
    prisma.course.count.mockResolvedValue(0);
    prisma.review.groupBy.mockResolvedValue([]);

    await service.list({ minPrice: 500, maxPrice: 2000, page: 1, pageSize: 20 } as any);

    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ price: { gte: 500, lte: 2000 } }),
      }),
    );
  });

  it('sorts by price ascending when requested', async () => {
    prisma.course.findMany.mockResolvedValue([]);
    prisma.course.count.mockResolvedValue(0);
    prisma.review.groupBy.mockResolvedValue([]);

    await service.list({ sort: 'price_low_to_high', page: 1, pageSize: 20 } as any);

    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { price: 'asc' } }),
    );
  });

  it('defaults to newest-first when no sort is given', async () => {
    prisma.course.findMany.mockResolvedValue([]);
    prisma.course.count.mockResolvedValue(0);
    prisma.review.groupBy.mockResolvedValue([]);

    await service.list({ page: 1, pageSize: 20 } as any);

    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  describe('rating-based filtering (the two-step path)', () => {
    it('excludes courses below minRating', async () => {
      prisma.course.findMany.mockImplementation(({ where, select }: any) => {
        // First call (candidateIds): no select narrowing beyond id.
        if (select && Object.keys(select).length === 1 && select.id) {
          return Promise.resolve([{ id: 'course-low' }, { id: 'course-high' }]);
        }
        // Second call (full details for the surviving page).
        return Promise.resolve([{ id: 'course-high', title: 'High Rated' }]);
      });
      prisma.review.groupBy.mockResolvedValue([
        { courseId: 'course-low', _avg: { rating: 2 }, _count: { rating: 3 } },
        { courseId: 'course-high', _avg: { rating: 4.5 }, _count: { rating: 10 } },
      ]);

      const result = await service.list({ minRating: 4, page: 1, pageSize: 20 } as any);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('course-high');
    });

    it('sorts highest-rated first when requested', async () => {
      prisma.course.findMany.mockImplementation(({ select }: any) => {
        if (select && Object.keys(select).length === 1 && select.id) {
          return Promise.resolve([{ id: 'course-a' }, { id: 'course-b' }]);
        }
        return Promise.resolve([
          { id: 'course-a', title: 'A' },
          { id: 'course-b', title: 'B' },
        ]);
      });
      prisma.review.groupBy.mockResolvedValue([
        { courseId: 'course-a', _avg: { rating: 3 }, _count: { rating: 5 } },
        { courseId: 'course-b', _avg: { rating: 4.8 }, _count: { rating: 20 } },
      ]);

      const result = await service.list({ sort: 'highest_rated', page: 1, pageSize: 20 } as any);

      // course-b (4.8) must come before course-a (3) despite the
      // candidate query returning them in the opposite order.
      expect(result.items[0].id).toBe('course-b');
      expect(result.items[1].id).toBe('course-a');
    });

    it('treats a course with zero reviews as rating 0, not excluded by default', async () => {
      prisma.course.findMany.mockImplementation(({ select }: any) => {
        if (select && Object.keys(select).length === 1 && select.id) {
          return Promise.resolve([{ id: 'unrated-course' }]);
        }
        return Promise.resolve([{ id: 'unrated-course', title: 'Unrated' }]);
      });
      prisma.review.groupBy.mockResolvedValue([]); // no reviews at all

      const result = await service.list({ sort: 'highest_rated', page: 1, pageSize: 20 } as any);
      expect(result.items[0].averageRating).toBeNull(); // displayed as "no rating yet", not 0 stars
    });
  });
});
