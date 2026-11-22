import { Module } from '@nestjs/common';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../prisma.service';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [CertificatesModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EntitlementService, PrismaService],
  exports: [EntitlementService, EnrollmentsService],
})
export class EnrollmentsModule {}
