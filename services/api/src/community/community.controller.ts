import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../auth/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { CommunityService } from './community.service';
import { CreateAnnouncementDto, CreateCommentDto, CreatePostDto } from './dto/community.dto';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('community')
@ApiBearerAuth('access-token')
@Controller('api/v1/community')
export class CommunityController {
  constructor(private community: CommunityService) {}

  @Get('feed')
  feed(@Query('page') page?: string) {
    return this.community.listFeed(page ? Number(page) : 1);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // basic abuse prevention on posting
  @Post('posts')
  createPost(@Body() dto: CreatePostDto, @CurrentUser() user: CurrentUserPayload) {
    return this.community.createPost(user.id, dto, false);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('announcements')
  createAnnouncement(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: CurrentUserPayload) {
    return this.community.createPost(user.id, dto, true);
  }

  @Delete('posts/:id')
  deleteOwnPost(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.community.deleteOwnPost(user.id, id);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Delete('posts/:id/moderate')
  moderateDelete(@Param('id') id: string) {
    return this.community.moderateDeletePost(id);
  }

  @Get('posts/:id/comments')
  listComments(@Param('id') id: string) {
    return this.community.listComments(id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('posts/:id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.community.addComment(user.id, id, dto);
  }
}
