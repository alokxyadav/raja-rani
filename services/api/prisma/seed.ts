// Development-only seed data. NEVER run against production.
// Usage: npm run seed
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'stitching-tailoring' },
    update: {},
    create: { name: 'Stitching & Tailoring', slug: 'stitching-tailoring' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@dev.local' },
    update: {},
    create: {
      name: 'Dev Admin',
      email: 'admin@dev.local',
      passwordHash: await argon2.hash('ChangeMe123!'), // DEV ONLY — never use in production
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@dev.local' },
    update: {},
    create: {
      name: 'Priya MG',
      email: 'instructor@dev.local',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'INSTRUCTOR',
      emailVerified: true,
    },
  });

  const paidCourse = await prisma.course.upsert({
    where: { slug: 'blouse-kurti-crash-course' },
    update: {},
    create: {
      title: 'Blouse & Kurti Crash Course',
      slug: 'blouse-kurti-crash-course',
      shortDescription: 'Learn to stitch a well-fitted blouse and kurti from scratch.',
      thumbnailUrl: 'https://placehold.co/600x400',
      categoryId: category.id,
      instructorId: instructor.id,
      accessType: 'PAID',
      price: 999,
      status: 'PUBLISHED',
      certificateEnabled: true,
    },
  });

  const paidChapter = await prisma.chapter.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      courseId: paidCourse.id,
      title: 'Getting Started',
      order: 1,
    },
  });

  await prisma.lesson.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      chapterId: paidChapter.id,
      title: 'Tools you will need',
      order: 1,
      contentType: 'VIDEO',
      videoAssetId: 'dev-placeholder-asset-id',
      durationSeconds: 300,
      isFreePreview: true, // watchable without enrolling, to test the preview path
    },
  });

  const freeCourse = await prisma.course.upsert({
    where: { slug: 'intro-to-hand-stitching' },
    update: {},
    create: {
      title: 'Intro to Hand Stitching',
      slug: 'intro-to-hand-stitching',
      shortDescription: 'A free beginner course on basic hand-stitching techniques.',
      thumbnailUrl: 'https://placehold.co/600x400',
      categoryId: category.id,
      instructorId: instructor.id,
      accessType: 'FREE',
      status: 'PUBLISHED',
    },
  });

  console.log(`Seeded.`);
  console.log(`Dev admin login: admin@dev.local / ChangeMe123!`);
  console.log(`Paid course slug: ${paidCourse.slug}`);
  console.log(`Free course slug: ${freeCourse.slug}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
