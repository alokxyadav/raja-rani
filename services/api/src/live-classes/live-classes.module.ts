import { Module } from '@nestjs/common';
import { LiveClassesController } from './live-classes.controller';
import { LiveClassesService } from './live-classes.service';
import { JitsiProvider } from './providers/jitsi.provider';
import { PrismaService } from '../prisma.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EnrollmentsModule, NotificationsModule], // reuse EntitlementService + NotificationsService
  controllers: [LiveClassesController],
  providers: [LiveClassesService, JitsiProvider, PrismaService],
})
export class LiveClassesModule {}
