import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { CloudflareStreamProvider } from './providers/cloudflare-stream.provider';
import { PrismaService } from '../prisma.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [EnrollmentsModule], // reuse the one EntitlementService, don't reimplement it here
  controllers: [VideoController],
  providers: [VideoService, CloudflareStreamProvider, PrismaService],
})
export class VideoModule {}
