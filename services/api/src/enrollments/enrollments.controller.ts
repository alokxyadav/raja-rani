import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { EnrollmentsService } from './enrollments.service';
import { UpdateProgressDto } from './dto/enrollment.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('enrollments')
@ApiBearerAuth('access-token')
@Controller('api/v1')
export class EnrollmentsController {
  constructor(private enrollments: EnrollmentsService) {}

  @Post('courses/:courseId/enroll-free')
  enrollFree(@Param('courseId') courseId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.enrollments.enrollFree(user.id, courseId);
  }

  @Get('library')
  library(@CurrentUser() user: CurrentUserPayload) {
    return this.enrollments.getLibrary(user.id);
  }

  @Put('progress')
  updateProgress(@Body() dto: UpdateProgressDto, @CurrentUser() user: CurrentUserPayload) {
    return this.enrollments.updateProgress(user.id, dto);
  }
}
