import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.guard';
import { BannersService } from './banners.service';
import { CreateBannerDto, UpdateBannerDto } from './dto/banner.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('banners')
@Controller('api/v1/banners')
export class BannersController {
  constructor(private banners: BannersService) {}

  @Public()
  @Get('active')
  listActive() {
    return this.banners.listActive();
  }

  @Roles('ADMIN')
  @Get()
  listAll() {
    return this.banners.listAllForAdmin();
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateBannerDto) {
    return this.banners.create(dto);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.banners.update(id, dto);
  }
}
