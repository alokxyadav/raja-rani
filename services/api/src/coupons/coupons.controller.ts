import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.guard';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/coupon.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@Roles('ADMIN')
@ApiTags('coupons')
@ApiBearerAuth('access-token')
@Controller('api/v1/coupons')
export class CouponsController {
  constructor(private coupons: CouponsService) {}

  @Get()
  list() {
    return this.coupons.list();
  }

  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.coupons.deactivate(id);
  }
}
