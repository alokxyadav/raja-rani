import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/report.dto';

@Controller('api/v1')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Post('reports')
  create(@Body() dto: CreateReportDto, @CurrentUser() user: CurrentUserPayload) {
    return this.reports.create(user.id, dto);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('admin/reports')
  listUnresolved() {
    return this.reports.listUnresolved();
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('admin/reports/:id/resolve')
  resolve(@Param('id') id: string) {
    return this.reports.resolve(id);
  }
}
