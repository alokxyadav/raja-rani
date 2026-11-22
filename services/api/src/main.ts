import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true keeps req.rawBody available so webhook signature
  // verification (payments.controller.ts) hashes the exact bytes Razorpay
  // sent, not a re-serialized copy of the parsed JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties — no silent mass-assignment
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : false, credentials: true });

  // Generated from the actual controllers/DTOs below — not hand-maintained,
  // so it can't drift out of sync with the real endpoints the way a
  // manually-written API.md would. Disabled in production by default: an
  // interactive "try it out" console against your real API is a
  // reconnaissance tool for an attacker if left open publicly.
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Raja Rani API')
      .setDescription(
        'E-learning platform API. Most endpoints require a bearer token ' +
          '(POST /api/v1/auth/login or /register to obtain one). Endpoints ' +
          'marked with a padlock require auth; unmarked ones are public.',
      )
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
      .addTag('auth', 'Registration, login, OTP, token refresh')
      .addTag('courses', 'Course discovery and CMS')
      .addTag('enrollments', 'Enrollment, library, progress')
      .addTag('payments', 'Orders and Razorpay webhook')
      .addTag('video', 'Signed video playback and upload')
      .addTag('live-classes', 'Live class scheduling and join flow')
      .addTag('community', 'Posts, comments, moderation')
      .addTag('certificates', 'Issuance and public verification')
      .addTag('notifications', 'Device registration and broadcast')
      .addTag('admin', 'Dashboard, users, orders, audit logs')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 4000);
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${process.env.PORT ?? 4000}`);
  // eslint-disable-next-line no-console
  console.log(`API docs at http://localhost:${process.env.PORT ?? 4000}/docs`);
}
bootstrap();
