import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EntitlementService } from '../enrollments/entitlement.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private entitlement: EntitlementService,
  ) {}

  // "Prevent fake review creation by non-enrolled users if configured" —
  // the brief frames this as optional, but there's no real argument for
  // letting someone review a course they never took, so it's enforced
  // unconditionally rather than behind a settings flag. Reuses the same
  // EntitlementService every other module depends on, per
  // docs/ARCHITECTURE.md's "entitlement is centralized" rule.
  async create(userId: string, courseId: string, dto: CreateReviewDto) {
    const allowed = await this.entitlement.canAccessCourse(userId, courseId);
    if (!allowed) {
      throw new ForbiddenException('you must be enrolled in this course to review it');
    }

    const existing = await this.prisma.review.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) {
      throw new BadRequestException('you have already reviewed this course — edit your existing review instead');
    }

    return this.prisma.review.create({
      data: { userId, courseId, rating: dto.rating, body: dto.body },
    });
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.findOwnedOrThrow(userId, reviewId);
    return this.prisma.review.update({
      where: { id: review.id },
      data: { rating: dto.rating, body: dto.body },
    });
  }

  async deleteOwn(userId: string, reviewId: string) {
    const review = await this.findOwnedOrThrow(userId, reviewId);
    return this.prisma.review.update({ where: { id: review.id }, data: { deletedAt: new Date() } });
  }

  async moderateDelete(reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.deletedAt) throw new NotFoundException('review not found');
    return this.prisma.review.update({ where: { id: reviewId }, data: { deletedAt: new Date() } });
  }

  // Public — listed on the course detail page. Includes whether each
  // reviewer is actually enrolled ("verified enrollment badge" from the
  // brief) even though every review here already required enrollment at
  // creation time; kept as an explicit field rather than assumed, since a
  // refund (payments.service.ts's refundOrder) can revoke enrollment
  // after the fact without deleting the review itself.
  async listForCourse(courseId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const stillEnrolledIds = new Set(
      (
        await this.prisma.enrollment.findMany({
          where: { courseId, userId: { in: reviews.map((r) => r.userId) } },
          select: { userId: true },
        })
      ).map((e) => e.userId),
    );

    const items = reviews.map((r) => ({ ...r, verifiedEnrollment: stillEnrolledIds.has(r.userId) }));
    const averageRating = reviews.length
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : null;

    return { items, count: reviews.length, averageRating };
  }

  private async findOwnedOrThrow(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review || review.deletedAt) throw new NotFoundException('review not found');
    if (review.userId !== userId) throw new ForbiddenException('not your review');
    return review;
  }
}
