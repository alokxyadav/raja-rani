import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { AdminService } from './admin.service';
import { SearchUsersDto } from './dto/admin.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@Roles('ADMIN')
@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.getDashboardMetrics();
  }

  @Get('users')
  listUsers(@Query() query: SearchUsersDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.admin.getUserDetail(id);
  }

  @Get('orders')
  listOrders() {
    return this.admin.listOrders();
  }

  @Get('certificates')
  listCertificates() {
    return this.admin.listCertificates();
  }

  @Get('audit-logs')
  listAuditLogs() {
    return this.admin.listAuditLogs();
  }

  @Post('users/:id/suspend')
  suspend(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.admin.suspendUser(actor.id, id);
  }

  @Post('users/:id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.admin.reactivateUser(actor.id, id);
  }
}
