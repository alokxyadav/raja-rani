import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Single source of truth for "can this user access this content". Every
// other module (lesson content, video playback tokens, PDFs, live classes)
// must call through here rather than re-implementing the enrollment check —
// that's how we avoid the classic bug where one endpoint enforces access
// and a sibling endpoint forgets to.
@Injectable()
export class EntitlementService {
  constructor(private prisma: PrismaService) {}

  async canAccessCourse(userId: string | null, courseId: string): Promise<boolean> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { status: true, deletedAt: true, accessType: true },
    });
    if (!course || course.deletedAt || course.status !== 'PUBLISHED') return false;

    if (course.accessType === 'FREE') return true; // published free course: open to anyone
    if (!userId) return false;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return !!enrollment;
  }

  async canAccessLesson(userId: string | null, lessonId: string): Promise<boolean> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { isFreePreview: true, chapter: { select: { courseId: true } } },
    });
    if (!lesson) return false;
    if (lesson.isFreePreview) return true; // preview lessons bypass enrollment by design

    return this.canAccessCourse(userId, lesson.chapter.courseId);
  }
}
