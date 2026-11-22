import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmProvider } from './providers/fcm.provider';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmProvider, PrismaService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
