import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateReportDto } from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Validates the reported resource actually exists — a report against a
  // nonexistent or already-deleted ID would just be noise in the admin
  // queue with nothing for a moderator to act on.
  async create(reporterId: string, dto: CreateReportDto) {
    const exists = await this.resourceExists(dto.resourceType, dto.resourceId);
    if (!exists) throw new NotFoundException('reported content not found');

    return this.prisma.report.create({
      data: {
        reporterId,
        resourceType: dto.resourceType,
        resourceId: dto.resourceId,
        reason: dto.reason,
      },
    });
  }

  async listUnresolved() {
    return this.prisma.report.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'asc' }, // oldest unresolved first — first in, first reviewed
      include: { reporter: { select: { name: true } } },
    });
  }

  async resolve(reportId: string) {
    // Marking resolved does NOT delete the underlying content — that's a
    // separate, explicit moderation action (community.service.ts's
    // moderateDeletePost, reviews.service.ts's moderateDelete). A report
    // being reviewed and a report being upheld are different outcomes;
    // conflating them would delete content on a false report.
    return this.prisma.report.update({ where: { id: reportId }, data: { resolved: true } });
  }

  private async resourceExists(type: string, id: string): Promise<boolean> {
    switch (type) {
      case 'COMMUNITY_POST':
        return !!(await this.prisma.communityPost.findFirst({ where: { id, deletedAt: null } }));
      case 'COMMUNITY_COMMENT':
        return !!(await this.prisma.communityComment.findFirst({ where: { id, deletedAt: null } }));
      case 'REVIEW':
        return !!(await this.prisma.review.findFirst({ where: { id, deletedAt: null } }));
      default:
        return false;
    }
  }
}
