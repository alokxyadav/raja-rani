import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';

@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        ctaLabel: dto.ctaLabel,
        destination: dto.destination,
        priority: dto.priority ?? 0,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.findOrThrow(id);
    return this.prisma.banner.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async listAllForAdmin() {
    return this.prisma.banner.findMany({ orderBy: { priority: 'desc' } });
  }

  // Public — the home screen calls this. Filters by isActive AND the
  // date window server-side, so "hard-coded banners" never happens and a
  // banner scheduled for next week doesn't show up early.
  async listActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      orderBy: { priority: 'desc' },
    });
  }

  private async findOrThrow(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('banner not found');
    return banner;
  }
}
