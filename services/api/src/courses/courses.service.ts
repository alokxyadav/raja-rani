import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { slugify } from '../common/slugify';
import { CreateChapterDto, CreateCourseDto, CreateLessonDto, CourseSortOption, ListCoursesQueryDto, UpdateCourseDto } from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  // ---------- Admin: CMS ----------

  async create(dto: CreateCourseDto) {
    if (dto.accessType === 'PAID' && (dto.price === undefined || dto.price === null)) {
      throw new BadRequestException('price is required for a paid course');
    }

    const baseSlug = slugify(dto.title);
    const slug = await this.uniqueSlug(baseSlug);

    return this.prisma.course.create({
      data: {
        title: dto.title,
        slug,
        shortDescription: dto.shortDescription,
        description: dto.description,
        learningOutcomes: dto.learningOutcomes ?? [],
        categoryId: dto.categoryId,
        instructorId: dto.instructorId,
        accessType: dto.accessType,
        price: dto.price,
        discountPrice: dto.discountPrice,
        certificateEnabled: dto.certificateEnabled ?? false,
        certificateMinCompletionPct: dto.certificateMinCompletionPct ?? 100,
        status: 'DRAFT',
      },
    });
  }

  async update(courseId: string, dto: UpdateCourseDto) {
    await this.findByIdOrThrow(courseId);
    return this.prisma.course.update({ where: { id: courseId }, data: dto });
  }

  // Publishing validates the fields a real course listing needs — this is
  // the "publishing should validate required fields" requirement, enforced
  // server-side rather than just hinted at in an admin UI.
  async publish(courseId: string) {
    const course = await this.findByIdOrThrow(courseId);

    const missing: string[] = [];
    if (!course.title) missing.push('title');
    if (!course.shortDescription) missing.push('shortDescription');
    if (!course.thumbnailUrl) missing.push('thumbnailUrl');
    if (course.accessType === 'PAID' && (course.price === null || Number(course.price) <= 0)) {
      missing.push('price');
    }
    const chapterCount = await this.prisma.chapter.count({ where: { courseId } });
    if (chapterCount === 0) missing.push('at least one chapter');

    if (missing.length > 0) {
      throw new BadRequestException(`cannot publish — missing: ${missing.join(', ')}`);
    }

    return this.prisma.course.update({ where: { id: courseId }, data: { status: 'PUBLISHED' } });
  }

  async unpublish(courseId: string) {
    await this.findByIdOrThrow(courseId);
    return this.prisma.course.update({ where: { id: courseId }, data: { status: 'UNPUBLISHED' } });
  }

  async archive(courseId: string) {
    await this.findByIdOrThrow(courseId);
    return this.prisma.course.update({ where: { id: courseId }, data: { deletedAt: new Date() } });
  }

  async addChapter(courseId: string, dto: CreateChapterDto) {
    await this.findByIdOrThrow(courseId);
    return this.prisma.chapter.create({ data: { courseId, title: dto.title, order: dto.order } });
  }

  async addLesson(chapterId: string, dto: CreateLessonDto) {
    const chapter = await this.prisma.chapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('chapter not found');

    if (dto.contentType === 'VIDEO' && !dto.videoAssetId) {
      // Deliberately strict: a video lesson with no provider asset ID would
      // silently break playback later. Fail at creation time instead.
      throw new BadRequestException('videoAssetId is required for VIDEO lessons');
    }

    return this.prisma.lesson.create({
      data: {
        chapterId,
        title: dto.title,
        order: dto.order,
        contentType: dto.contentType,
        videoAssetId: dto.videoAssetId,
        durationSeconds: dto.durationSeconds,
        pdfUrl: dto.pdfUrl,
        resourceUrl: dto.resourceUrl,
        isFreePreview: dto.isFreePreview ?? false,
      },
    });
  }

  // ---------- Admin: list-all (any status, not just published) ----------
  // Distinct from the public list() below, which deliberately hides
  // DRAFT/UNPUBLISHED/archived courses. The admin panel needs to see and
  // manage drafts, so it calls this instead.

  async listAllForAdmin() {
    return this.prisma.course.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        accessType: true,
        price: true,
        thumbnailUrl: true,
      },
    });
  }

  // ---------- Public: discovery ----------

  async list(query: ListCoursesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 50);

    const where = {
      status: 'PUBLISHED' as const,
      deletedAt: null,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.accessType ? { accessType: query.accessType } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
    };

    // Rating-based filtering/sorting needs ratings computed BEFORE
    // pagination (you can't correctly page "highest rated first" by
    // paginating first and sorting the page afterward) — so this path
    // branches into a two-step id-then-detail fetch. Every other
    // sort/filter combination stays on the simpler single-query path
    // below, since most browsing won't touch rating filters at all.
    if (query.minRating !== undefined || query.sort === CourseSortOption.HIGHEST_RATED) {
      return this.listWithRatingFilter(where, query, page, pageSize);
    }

    const orderBy = this.resolveSortOrder(query.sort);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        select: {
          id: true,
          title: true,
          slug: true,
          thumbnailUrl: true,
          shortDescription: true,
          accessType: true,
          price: true,
          discountPrice: true,
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    // One aggregate query for the whole page rather than one per course —
    // groupBy avoids an N+1 here even though ratings weren't part of the
    // original select above.
    const ratings = await this.prisma.review.groupBy({
      by: ['courseId'],
      where: { courseId: { in: items.map((c) => c.id) }, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const ratingMap = new Map(ratings.map((r) => [r.courseId, r]));
    const itemsWithRatings = items.map((course) => {
      const r = ratingMap.get(course.id);
      return {
        ...course,
        averageRating: r ? Math.round((r._avg.rating ?? 0) * 10) / 10 : null,
        reviewCount: r?._count.rating ?? 0,
      };
    });

    return { items: itemsWithRatings, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  private resolveSortOrder(sort?: CourseSortOption) {
    switch (sort) {
      case CourseSortOption.PRICE_LOW_TO_HIGH:
        return { price: 'asc' as const };
      case CourseSortOption.PRICE_HIGH_TO_LOW:
        return { price: 'desc' as const };
      case CourseSortOption.NEWEST:
      default:
        return { createdAt: 'desc' as const };
    }
  }

  // Handles minRating filtering and/or "highest rated" sorting — both need
  // ratings computed before pagination, so this fetches every matching
  // course's rating first (bounded by the same `where` clause, so it's
  // never scanning the whole table), filters/sorts in memory, THEN pages
  // and fetches full details only for the courses that survive to this
  // page. Correct at the catalog sizes this brief targets; would want a
  // materialized rating column before this scales to a huge catalog.
  private async listWithRatingFilter(
    where: any,
    query: ListCoursesQueryDto,
    page: number,
    pageSize: number,
  ) {
    const candidateIds = await this.prisma.course.findMany({ where, select: { id: true } });
    const ratings = await this.prisma.review.groupBy({
      by: ['courseId'],
      where: { courseId: { in: candidateIds.map((c) => c.id) }, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const ratingMap = new Map(ratings.map((r) => [r.courseId, r]));

    let qualifying = candidateIds.map((c) => ({
      id: c.id,
      averageRating: ratingMap.get(c.id)?._avg.rating ?? 0,
      reviewCount: ratingMap.get(c.id)?._count.rating ?? 0,
    }));

    if (query.minRating !== undefined) {
      qualifying = qualifying.filter((c) => c.averageRating >= query.minRating!);
    }
    if (query.sort === CourseSortOption.HIGHEST_RATED) {
      qualifying.sort((a, b) => b.averageRating - a.averageRating);
    }

    const total = qualifying.length;
    const pageIds = qualifying.slice((page - 1) * pageSize, page * pageSize);

    const courses = await this.prisma.course.findMany({
      where: { id: { in: pageIds.map((c) => c.id) } },
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnailUrl: true,
        shortDescription: true,
        accessType: true,
        price: true,
        discountPrice: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    // Preserve the rating-sorted order from `pageIds` — the findMany above
    // doesn't guarantee result order matches the `in` array.
    const items = pageIds
      .map((p) => {
        const course = courseMap.get(p.id);
        if (!course) return null;
        return {
          ...course,
          averageRating: p.averageRating ? Math.round(p.averageRating * 10) / 10 : null,
          reviewCount: p.reviewCount,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  // ---------- Admin: get one course, any status, full detail ----------
  // Distinct from getBySlugPublic below: this one includes DRAFT courses
  // (needed to manage a course before it's publishable) and does NOT
  // exclude videoAssetId — the admin panel needs it to show "video
  // attached" state, and this endpoint is @Roles('ADMIN', 'INSTRUCTOR')
  // only, so it's not the same public-payload exposure that
  // getBySlugPublic deliberately avoids.

  async getByIdForAdmin(courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        instructor: { select: { id: true, name: true } },
        chapters: {
          orderBy: { order: 'asc' },
          include: { lessons: { orderBy: { order: 'asc' } } },
        },
      },
    });
    if (!course || course.deletedAt) throw new NotFoundException('course not found');
    return course;
  }

  async getBySlugPublic(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED', deletedAt: null },
      include: {
        category: true,
        instructor: { select: { id: true, name: true, avatarUrl: true } },
        chapters: {
          orderBy: { order: 'asc' },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              // videoAssetId intentionally excluded from the public payload —
              // playback authorization happens through the entitlement +
              // signed-token flow, never by handing out the raw asset ID.
              select: {
                id: true,
                title: true,
                order: true,
                contentType: true,
                durationSeconds: true,
                isFreePreview: true,
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('course not found');

    const reviewAgg = await this.prisma.review.aggregate({
      where: { courseId: course.id, deletedAt: null },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      ...course,
      averageRating: reviewAgg._count.rating > 0 ? Math.round((reviewAgg._avg.rating ?? 0) * 10) / 10 : null,
      reviewCount: reviewAgg._count.rating,
    };
  }

  // ---------- Shared ----------

  private async findByIdOrThrow(courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.deletedAt) throw new NotFoundException('course not found');
    return course;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let n = 1;
    while (await this.prisma.course.findUnique({ where: { slug } })) {
      slug = `${base}-${++n}`;
    }
    return slug;
  }
}
