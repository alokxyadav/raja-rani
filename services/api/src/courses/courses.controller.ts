import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.guard';
import { CoursesService } from './courses.service';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateChapterDto,
  CreateCourseDto,
  CreateLessonDto,
  ListCoursesQueryDto,
  UpdateCourseDto,
} from './dto/course.dto';

@ApiTags('courses')
@Controller('api/v1/courses')
export class CoursesController {
  constructor(private courses: CoursesService) {}

  // ---- public ----

  @Public()
  @Get()
  list(@Query() query: ListCoursesQueryDto) {
    return this.courses.list(query);
  }

  // Declared before the ':slug' route below so Nest/Express matches this
  // exact path first — otherwise "admin/all" would be parsed as a slug.
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('admin/all')
  listAllForAdmin() {
    return this.courses.listAllForAdmin();
  }

  @Public()
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.courses.getBySlugPublic(slug);
  }

  // Same route-ordering note as admin/all above — 'admin/:id' must be
  // declared before the generic ':slug' route.
  @Roles('ADMIN', 'INSTRUCTOR')
  @Get('admin/:id')
  getByIdForAdmin(@Param('id') id: string) {
    return this.courses.getByIdForAdmin(id);
  }

  // ---- admin / instructor CMS ----

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.courses.create(dto);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.courses.update(id, dto);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.courses.publish(id);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post(':id/unpublish')
  unpublish(@Param('id') id: string) {
    return this.courses.unpublish(id);
  }

  @Roles('ADMIN')
  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.courses.archive(id);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post(':id/chapters')
  addChapter(@Param('id') id: string, @Body() dto: CreateChapterDto) {
    return this.courses.addChapter(id, dto);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('chapters/:chapterId/lessons')
  addLesson(@Param('chapterId') chapterId: string, @Body() dto: CreateLessonDto) {
    return this.courses.addLesson(chapterId, dto);
  }
}
