import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { LiveClassesService } from './live-classes.service';
import { CreateLiveClassDto, EndLiveClassDto } from './dto/live-class.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('live-classes')
@Controller('api/v1/live-classes')
export class LiveClassesController {
  constructor(private liveClasses: LiveClassesService) {}

  @Public()
  @Get()
  list(@Query('courseId') courseId?: string) {
    return this.liveClasses.listUpcoming(courseId);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post()
  create(@Body() dto: CreateLiveClassDto) {
    return this.liveClasses.create(dto);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.liveClasses.start(id);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post(':id/end')
  end(@Param('id') id: string, @Body() dto: EndLiveClassDto) {
    return this.liveClasses.end(id, dto);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.liveClasses.cancel(id);
  }

  @Post(':id/reminder')
  setReminder(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.liveClasses.setReminder(user.id, id);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.liveClasses.join(user.id, id);
  }
}
