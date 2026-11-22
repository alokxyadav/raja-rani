import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { SupportService } from './support.service';
import { CreateSupportTicketDto, RespondToTicketDto } from './dto/support.dto';

@Controller('api/v1/support')
export class SupportController {
  constructor(private support: SupportService) {}

  @Post('tickets')
  create(@Body() dto: CreateSupportTicketDto, @CurrentUser() user: CurrentUserPayload) {
    return this.support.create(user.id, dto);
  }

  @Get('tickets/mine')
  listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.support.listMine(user.id);
  }

  @Roles('ADMIN')
  @Get('tickets')
  listAll(@Query('status') status?: string) {
    return this.support.listAllForAdmin(status);
  }

  @Roles('ADMIN')
  @Post('tickets/:id/respond')
  respond(
    @Param('id') id: string,
    @Body() dto: RespondToTicketDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    return this.support.respond(id, admin.id, dto);
  }
}
