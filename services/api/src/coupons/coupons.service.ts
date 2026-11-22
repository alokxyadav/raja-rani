import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCouponDto) {
    if (!dto.percentOff && !dto.amountOff) {
      throw new BadRequestException('provide either percentOff or amountOff');
    }
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('coupon code already exists');

    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        percentOff: dto.percentOff,
        amountOff: dto.amountOff,
        maxRedemptions: dto.maxRedemptions,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  // "Deactivate" by expiring immediately rather than deleting — orders that
  // already redeemed it keep a valid foreign key and accurate history.
  async deactivate(id: string) {
    return this.prisma.coupon.update({ where: { id }, data: { expiresAt: new Date() } });
  }
}
