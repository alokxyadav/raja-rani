import { CertificatesService } from './certificates.service';

function makePrismaMock() {
  return {
    course: { findUnique: jest.fn() },
    certificate: { findUnique: jest.fn(), create: jest.fn() },
    chapter: { findMany: jest.fn() },
    lessonProgress: { count: jest.fn() },
  };
}

describe('CertificatesService', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let service: CertificatesService;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new CertificatesService(prisma as any);
  });

  it('does nothing if the course does not have certificates enabled', async () => {
    prisma.course.findUnique.mockResolvedValue({ certificateEnabled: false });
    const result = await service.maybeIssueCertificate('user-1', 'course-1');
    expect(result).toBeNull();
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('is idempotent — returns the existing certificate without creating a duplicate', async () => {
    prisma.course.findUnique.mockResolvedValue({ certificateEnabled: true, certificateMinCompletionPct: 100 });
    prisma.certificate.findUnique.mockResolvedValue({ id: 'existing-cert' });

    const result = await service.maybeIssueCertificate('user-1', 'course-1');
    expect(result).toEqual({ id: 'existing-cert' });
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('does not issue below the required completion percentage', async () => {
    prisma.course.findUnique.mockResolvedValue({ certificateEnabled: true, certificateMinCompletionPct: 100 });
    prisma.certificate.findUnique.mockResolvedValue(null);
    prisma.chapter.findMany.mockResolvedValue([
      { lessons: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }] },
    ]);
    prisma.lessonProgress.count.mockResolvedValue(3); // 75%, below the 100% requirement

    const result = await service.maybeIssueCertificate('user-1', 'course-1');
    expect(result).toBeNull();
    expect(prisma.certificate.create).not.toHaveBeenCalled();
  });

  it('issues once completion meets the threshold, with a unique RR-prefixed number', async () => {
    prisma.course.findUnique.mockResolvedValue({ certificateEnabled: true, certificateMinCompletionPct: 100 });
    prisma.certificate.findUnique
      .mockResolvedValueOnce(null) // "already issued?" check
      .mockResolvedValueOnce(null); // uniqueness check inside number generation
    prisma.chapter.findMany.mockResolvedValue([{ lessons: [{ id: 'l1' }, { id: 'l2' }] }]);
    prisma.lessonProgress.count.mockResolvedValue(2); // 100%
    prisma.certificate.create.mockImplementation(({ data }: any) => ({ id: 'new-cert', ...data }));

    const result = await service.maybeIssueCertificate('user-1', 'course-1');
    expect(result).not.toBeNull();
   if (!result) throw new Error('Expected certificate to be issued');
   expect(result.certificateNo).toMatch(/^RR-\d{4}-[0-9A-F]{8}$/);
  });
});
