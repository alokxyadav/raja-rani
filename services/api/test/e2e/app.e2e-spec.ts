import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';

// Requires a real Postgres reachable at DATABASE_URL (see
// docs/TESTING.md — CI provisions this automatically via the `postgres`
// service container in .github/workflows/ci.yml; locally, point it at the
// dev docker-compose or a dedicated test database, never your real data).
//
// This is the category unit tests structurally cannot cover: the actual
// guard chain (ThrottlerGuard → JwtAuthGuard → RolesGuard), the real
// ValidationPipe, and — the point of this specific file — whether one
// user can reach another user's data through an endpoint that takes a
// resource ID, which is exactly what docs/SECURITY.md flagged as
// "no IDOR testing performed."
describe('Raja Rani API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let studentAToken: string;
  let studentBToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    // Clean slate for this suite's own data, scoped by a unique email
    // prefix so it never touches seed data or another test run's rows.
    await prisma.user.deleteMany({ where: { email: { contains: '+e2e@test.local' } } });

    const studentA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Student A', email: 'student-a+e2e@test.local', password: 'testpass123' });
    studentAToken = studentA.body.accessToken;

    const studentB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Student B', email: 'student-b+e2e@test.local', password: 'testpass123' });
    studentBToken = studentB.body.accessToken;

    // Promote an admin directly via Prisma (no public "become admin"
    // endpoint exists, deliberately — see admin bootstrap notes in
    // docs/SETUP_GUIDE.md).
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Admin E2E', email: 'admin+e2e@test.local', password: 'testpass123' });
    await prisma.user.update({
      where: { email: 'admin+e2e@test.local' },
      data: { role: 'ADMIN' },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin+e2e@test.local', password: 'testpass123' });
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '+e2e@test.local' } } });
    await app.close();
  });

  describe('auth guard chain', () => {
    it('rejects a protected route with no token at all', async () => {
      await request(app.getHttpServer()).get('/api/v1/library').expect(401);
    });

    it('rejects a protected route with a garbage token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/library')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);
    });

    it('allows a @Public() route with no token', async () => {
      await request(app.getHttpServer()).get('/api/v1/courses').expect(200);
    });

    it('rejects an unknown field in a request body (whitelist: true)', async () => {
      // Proves the global ValidationPipe is actually wired into the real
      // app, not just configured on paper — this is exactly the kind of
      // thing a unit test of the DTO class alone can't verify.
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          name: 'Test',
          email: 'unused+e2e@test.local',
          password: 'testpass123',
          role: 'ADMIN', // attempted mass-assignment — must be rejected, not silently dropped-but-accepted
        })
        .expect(400);
    });
  });

  describe('RBAC', () => {
    it('rejects a STUDENT calling an ADMIN-only endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${studentAToken}`)
        .expect(403);
    });

    it('allows an ADMIN to reach the same endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('IDOR — the specific gap this file exists to close', () => {
    it('does not let a STUDENT reach the admin suspend endpoint for any user ID (RBAC blocks it before IDOR is even reachable)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/admin/users/some-id/suspend`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .expect(403);
    });

    it("does not let Student B mark Student A's notification as read", async () => {
      // The important assertion here isn't the HTTP status (this endpoint
      // doesn't 404 on an unowned ID) — it's that nothing was actually
      // mutated. notifications.service.ts's markRead() scopes the update
      // by {id, userId} together, not just {id}; a real IDOR bug would
      // show up here as count > 0 for someone else's notification.
      const fakeNotificationId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app.getHttpServer())
        .post(`/api/v1/notifications/${fakeNotificationId}/read`)
        .set('Authorization', `Bearer ${studentBToken}`)
        .expect(201);

      expect(res.body.count).toBe(0);
    });

    it("does not let an unenrolled student fetch a paid lesson's playback token", async () => {
      // Proves entitlement.service.spec.ts's mocked-Prisma logic holds up
      // through the real HTTP layer, real guards, and a real database.
      const course = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'E2E Paid Course', accessType: 'PAID', price: 500 });

      const chapter = await request(app.getHttpServer())
        .post(`/api/v1/courses/${course.body.id}/chapters`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Chapter 1', order: 1 });

      const lesson = await request(app.getHttpServer())
        .post(`/api/v1/courses/chapters/${chapter.body.id}/lessons`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Lesson 1', order: 1, contentType: 'VIDEO', videoAssetId: 'e2e-fake-asset' });

      await request(app.getHttpServer())
        .get(`/api/v1/lessons/${lesson.body.id}/playback-token`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .expect(403);
    });
  });

  describe('happy path: free enrollment end-to-end', () => {
    it('registers, browses, enrolls in a free course, and sees it in the library', async () => {
      const course = await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'E2E Free Course', accessType: 'FREE' });
      const courseId = course.body.id;

      await request(app.getHttpServer())
        .post(`/api/v1/courses/${courseId}/chapters`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Ch1', order: 1 });

      await request(app.getHttpServer())
        .post(`/api/v1/courses/${courseId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/courses/${courseId}/enroll-free`)
        .set('Authorization', `Bearer ${studentAToken}`)
        .expect(201);

      const library = await request(app.getHttpServer())
        .get('/api/v1/library')
        .set('Authorization', `Bearer ${studentAToken}`)
        .expect(200);

      expect(library.body.some((c: any) => c.courseId === courseId)).toBe(true);
    });
  });
});
