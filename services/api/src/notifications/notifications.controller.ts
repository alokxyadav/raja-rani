import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { RegisterDeviceTokenDto, BroadcastNotificationDto } from './dto/notification.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Post('devices')
  registerDevice(@Body() dto: RegisterDeviceTokenDto, @CurrentUser() user: CurrentUserPayload) {
    return this.notifications.registerDevice(user.id, dto);
  }

  @Get()
  list(@Query('unreadOnly') unreadOnly: string, @CurrentUser() user: CurrentUserPayload) {
    return this.notifications.listMine(user.id, unreadOnly === 'true');
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.notifications.markRead(user.id, id);
  }

  @Roles('ADMIN')
  @Post('broadcast')
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.notifications.broadcast('SYSTEM', dto.title, dto.body, dto.deepLink, dto.audience ?? 'STUDENT');
  }
}
