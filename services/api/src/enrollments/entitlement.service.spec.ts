import { EntitlementService } from './entitlement.service';

// Manual Prisma mock rather than a real DB — these tests exercise pure
// authorization logic, which is exactly where a mistake is most expensive
// and least visible in manual testing. No DB needed to prove this correct.
function makePrismaMock() {
  return {
    course: { findUnique: jest.fn() },
    lesson: { findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn() },
  };
}

describe('EntitlementService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: EntitlementService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new EntitlementService(prisma as any);
  });

  describe('canAccessCourse', () => {
    it('denies access to an unpublished course even for the owner', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'DRAFT',
        deletedAt: null,
        accessType: 'FREE',
      });
      const result = await service.canAccessCourse('user-1', 'course-1');
      expect(result).toBe(false);
    });

    it('denies access to a soft-deleted course', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        deletedAt: new Date(),
        accessType: 'FREE',
      });
      expect(await service.canAccessCourse('user-1', 'course-1')).toBe(false);
    });

    it('grants access to a published FREE course with no user (anonymous)', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'FREE',
      });
      expect(await service.canAccessCourse(null, 'course-1')).toBe(true);
    });

    it('denies a PAID course to an anonymous (unauthenticated) caller', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
      });
      expect(await service.canAccessCourse(null, 'course-1')).toBe(false);
    });

    it('denies a PAID course to a logged-in user with no enrollment row', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);
      expect(await service.canAccessCourse('user-1', 'course-1')).toBe(false);
    });

    it('grants a PAID course to an enrolled user', async () => {
      prisma.course.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
      });
      prisma.enrollment.findUnique.mockResolvedValue({ id: 'enr-1' });
      expect(await service.canAccessCourse('user-1', 'course-1')).toBe(true);
    });

    it('returns false for a course that does not exist', async () => {
      prisma.course.findUnique.mockResolvedValue(null);
      expect(await service.canAccessCourse('user-1', 'nonexistent')).toBe(false);
    });
  });

  describe('canAccessLesson', () => {
    it('grants a free-preview lesson without enrollment', async () => {
      prisma.lesson.findUnique.mockResolvedValue({
        isFreePreview: true,
        chapter: { courseId: 'course-1' },
      });
      expect(await service.canAccessLesson(null, 'lesson-1')).toBe(true);
      // Must not even need to check course access for a preview lesson.
      expect(prisma.course.findUnique).not.toHaveBeenCalled();
    });

    it('falls back to course-level entitlement for a non-preview lesson', async () => {
      prisma.lesson.findUnique.mockResolvedValue({
        isFreePreview: false,
        chapter: { courseId: 'course-1' },
      });
      prisma.course.findUnique.mockResolvedValue({
        status: 'PUBLISHED',
        deletedAt: null,
        accessType: 'PAID',
      });
      prisma.enrollment.findUnique.mockResolvedValue(null);

      expect(await service.canAccessLesson('user-1', 'lesson-1')).toBe(false);
    });

    it('returns false for a lesson that does not exist', async () => {
      prisma.lesson.findUnique.mockResolvedValue(null);
      expect(await service.canAccessLesson('user-1', 'nonexistent')).toBe(false);
    });
  });
});
