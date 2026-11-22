import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@Controller('api/v1')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Public()
  @Get('courses/:courseId/reviews')
  listForCourse(@Param('courseId') courseId: string) {
    return this.reviews.listForCourse(courseId);
  }

  @Post('courses/:courseId/reviews')
  create(
    @Param('courseId') courseId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.reviews.create(user.id, courseId, dto);
  }

  @Patch('reviews/:id')
  update(@Param('id') id: string, @Body() dto: UpdateReviewDto, @CurrentUser() user: CurrentUserPayload) {
    return this.reviews.update(user.id, id, dto);
  }

  @Delete('reviews/:id')
  deleteOwn(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.reviews.deleteOwn(user.id, id);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Delete('reviews/:id/moderate')
  moderateDelete(@Param('id') id: string) {
    return this.reviews.moderateDelete(id);
  }
}
