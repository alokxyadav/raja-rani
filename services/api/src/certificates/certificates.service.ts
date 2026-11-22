import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class CertificatesService {
  constructor(private prisma: PrismaService) {}

  // Called from EnrollmentsService right after a lesson is marked complete.
  // Recomputes completion from LessonProgress every time rather than
  // trusting a cached percentage — cheap at this scale, and it means a
  // certificate can never be issued for a course the student didn't
  // actually finish, even if some other bug left a stale progress number
  // lying around.
  async maybeIssueCertificate(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || !course.certificateEnabled) return null;

    const existing = await this.prisma.certificate.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) return existing; // already issued — idempotent

    const lessonIds = (
      await this.prisma.chapter.findMany({
        where: { courseId },
        select: { lessons: { select: { id: true } } },
      })
    ).flatMap((c) => c.lessons.map((l) => l.id));

    if (lessonIds.length === 0) return null;

    const completedCount = await this.prisma.lessonProgress.count({
      where: { userId, lessonId: { in: lessonIds }, completed: true },
    });
    const completionPct = Math.round((completedCount / lessonIds.length) * 100);

    if (completionPct < course.certificateMinCompletionPct) return null;

    const certificateNo = await this.generateCertificateNumber();

    return this.prisma.certificate.create({
      data: { userId, courseId, certificateNo },
    });
  }

  async listForUser(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId },
      include: { course: { select: { title: true, slug: true } } },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // Public — anyone with the certificate number/QR can confirm it's real,
  // without needing an account. Deliberately returns only what's needed to
  // confirm authenticity (name, course, date) — not the user's email,
  // phone, or any other account data.
  async verifyPublic(certificateNo: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { certificateNo },
      include: {
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });
    if (!cert) throw new NotFoundException('certificate not found');

    return {
      certificateNo: cert.certificateNo,
      studentName: cert.user.name,
      courseName: cert.course.title,
      issuedAt: cert.issuedAt,
      valid: true,
    };
  }

  private async generateCertificateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
      const candidate = `RR-${year}-${suffix}`;
      const exists = await this.prisma.certificate.findUnique({
        where: { certificateNo: candidate },
      });
      if (!exists) return candidate;
    }
    throw new Error('failed to generate a unique certificate number after 5 attempts');
  }
}
