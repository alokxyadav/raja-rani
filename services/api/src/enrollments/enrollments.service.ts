import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EntitlementService } from './entitlement.service';
import { CertificatesService } from '../certificates/certificates.service';
import { UpdateProgressDto } from './dto/enrollment.dto';

@Injectable()
export class EnrollmentsService {
  constructor(
    private prisma: PrismaService,
    private entitlement: EntitlementService,
    private certificates: CertificatesService,
  ) {}

  // Free-course enrollment only. Paid enrollment is created exclusively by
  // the payments module after server-side verification of a successful
  // payment — never from a client call like this one. See PAYMENTS.md /
  // Phase 4 for that flow; this method deliberately refuses PAID courses.
  async enrollFree(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.deletedAt || course.status !== 'PUBLISHED') {
      throw new NotFoundException('course not found');
    }
    if (course.accessType !== 'FREE') {
      throw new BadRequestException('this course requires payment — use the checkout flow');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return existing;

    return this.prisma.enrollment.create({
      data: { userId, courseId, source: 'FREE' },
    });
  }

  async getLibrary(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            chapters: { select: { lessons: { select: { id: true } } } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const results = await Promise.all(
      enrollments.map(async (e) => {
        const lessonIds = e.course.chapters.flatMap((c) => c.lessons.map((l) => l.id));
        const totalLessons = lessonIds.length;
        const completedCount = totalLessons
          ? await this.prisma.lessonProgress.count({
              where: { userId, lessonId: { in: lessonIds }, completed: true },
            })
          : 0;
        const progressPct = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

        return {
          courseId: e.course.id,
          title: e.course.title,
          slug: e.course.slug,
          thumbnailUrl: e.course.thumbnailUrl,
          enrolledAt: e.enrolledAt,
          progressPct,
          status: progressPct === 100 ? 'COMPLETED' : 'ONGOING',
        };
      }),
    );

    return results;
  }

  // Lightweight, throttled progress sync — the client should call this at
  // most every ~15-30s during playback, not every second, per the "don't
  // make a network request every second" requirement in the brief.
  async updateProgress(userId: string, dto: UpdateProgressDto) {
    const allowed = await this.entitlement.canAccessLesson(userId, dto.lessonId);
    if (!allowed) throw new ForbiddenException('not enrolled in this course');

    const result = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: dto.lessonId } },
      update: {
        lastPositionSeconds: dto.positionSeconds,
        completed: dto.completed ?? undefined,
        completedAt: dto.completed ? new Date() : undefined,
      },
      create: {
        userId,
        lessonId: dto.lessonId,
        lastPositionSeconds: dto.positionSeconds,
        completed: dto.completed ?? false,
        completedAt: dto.completed ? new Date() : null,
      },
    });

    // Fire-and-check on every completion, not just "the last lesson" —
    // there's no reliable client-side signal for "this was the final
    // lesson", so the cheap correct answer is: recompute after every
    // completion and let maybeIssueCertificate's own percentage check
    // decide whether the course is actually done.
    if (dto.completed) {
      const lesson = await this.prisma.lesson.findUnique({
        where: { id: dto.lessonId },
        select: { chapter: { select: { courseId: true } } },
      });
      if (lesson) {
        await this.certificates.maybeIssueCertificate(userId, lesson.chapter.courseId);
      }
    }

    return result;
  }
}
