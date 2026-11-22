import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EntitlementService } from '../enrollments/entitlement.service';
import { CloudflareStreamProvider } from './providers/cloudflare-stream.provider';

const PLAYBACK_TOKEN_TTL_SECONDS = 60 * 20; // 20 minutes — long enough to cover a lesson, short if leaked

@Injectable()
export class VideoService {
  constructor(
    private prisma: PrismaService,
    private entitlement: EntitlementService,
    private provider: CloudflareStreamProvider,
  ) {}

  // The only path to a playable URL. There is deliberately no endpoint that
  // returns Lesson.videoAssetId directly to a client (see courses.service.ts,
  // where it's excluded from the public payload) — this is the single choke
  // point where enrollment is checked before any video reference leaves the
  // server.
  async getPlaybackAuthorization(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('lesson not found');
    if (lesson.contentType !== 'VIDEO' || !lesson.videoAssetId) {
      throw new NotFoundException('this lesson has no video content');
    }

    const allowed = await this.entitlement.canAccessLesson(userId, lessonId);
    if (!allowed) {
      throw new ForbiddenException('you are not enrolled in this course');
    }

    const auth = await this.provider.generatePlaybackToken(
      lesson.videoAssetId,
      PLAYBACK_TOKEN_TTL_SECONDS,
    );

    return {
      lessonId,
      playbackUrl: auth.playbackUrl,
      expiresAt: auth.expiresAt,
      resumeFromSeconds: await this.getResumePosition(userId, lessonId),
    };
  }

  private async getResumePosition(userId: string, lessonId: string): Promise<number> {
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });
    return progress?.lastPositionSeconds ?? 0;
  }

  // ---------- Admin: upload flow ----------

  // Step 1: admin panel calls this to get a one-time upload URL. It uploads
  // the file directly to Cloudflare from the browser — the video bytes and
  // the Cloudflare API token both stay off our server entirely.
  async createUploadUrl(maxDurationSeconds = 3600) {
    return this.provider.createDirectUploadUrl(maxDurationSeconds);
  }

  // Step 2: once the browser-side upload finishes, the admin panel calls
  // this with the videoAssetId from step 1 to actually attach it to the
  // lesson. Two-step rather than one endpoint because Cloudflare's upload
  // happens client-side and can take minutes for a large file — this
  // server-side call is what makes the lesson playable, not the upload
  // itself.
  async attachVideoToLesson(lessonId: string, videoAssetId: string, durationSeconds?: number) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('lesson not found');

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: { videoAssetId, contentType: 'VIDEO', durationSeconds },
    });
  }
}
