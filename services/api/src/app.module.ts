import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { HealthController } from './health.controller';
import { CoursesModule } from './courses/courses.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { PaymentsModule } from './payments/payments.module';
import { VideoModule } from './video/video.module';
import { LiveClassesModule } from './live-classes/live-classes.module';
import { CommunityModule } from './community/community.module';
import { CertificatesModule } from './certificates/certificates.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BannersModule } from './banners/banners.module';
import { CouponsModule } from './coupons/coupons.module';
import { AdminModule } from './admin/admin.module';
import { SettingsModule } from './settings/settings.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SupportModule } from './support/support.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]), // sane global default
    JwtModule.register({}),
    AuthModule,
    CoursesModule,
    EnrollmentsModule,
    PaymentsModule,
    VideoModule,
    LiveClassesModule,
    CommunityModule,
    CertificatesModule,
    NotificationsModule,
    BannersModule,
    CouponsModule,
    AdminModule,
    SettingsModule,
    SchedulerModule,
    ReviewsModule,
    SupportModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // global: every route needs a token unless @Public()
    { provide: APP_GUARD, useClass: RolesGuard }, // global: enforces @Roles() where present
  ],
})
export class AppModule {}
