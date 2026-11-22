import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CurrentUser, CurrentUserPayload } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.guard';
import { VideoService } from './video.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

class CreateUploadUrlDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDurationSeconds?: number;
}

class AttachVideoDto {
  @IsString()
  videoAssetId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}

@ApiTags('video')
@ApiBearerAuth('access-token')
@Controller('api/v1/lessons')
export class VideoController {
  constructor(private video: VideoService) {}

  // Rate-limited: a playback-token endpoint is an obvious target for
  // enumeration/abuse if left unthrottled, even though it's already
  // entitlement-gated.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':lessonId/playback-token')
  getPlaybackToken(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.video.getPlaybackAuthorization(user.id, lessonId);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post('video-upload-url')
  createUploadUrl(@Body() dto: CreateUploadUrlDto) {
    return this.video.createUploadUrl(dto.maxDurationSeconds);
  }

  @Roles('ADMIN', 'INSTRUCTOR')
  @Post(':lessonId/attach-video')
  attachVideo(@Param('lessonId') lessonId: string, @Body() dto: AttachVideoDto) {
    return this.video.attachVideoToLesson(lessonId, dto.videoAssetId, dto.durationSeconds);
  }
}
