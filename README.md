# Raja Rani — E-Learning Platform

Android app + web admin for free/paid courses, recorded video, live classes,
community, certificates, and payments. Built from `overview.pdf`.

- **Setup:** see `docs/SETUP_GUIDE.md`
- **Status / what's built vs planned:** see `PROJECT_STATUS.md`
- **Database schema:** `services/api/prisma/schema.prisma`

## Structure

```
apps/
  mobile/        Flutter app — feature-complete for students except tests;
                 see apps/mobile/MOBILE_SETUP.md (one required setup step)
  admin/         Next.js admin panel — login/dashboard/courses/users done,
                 rest is repetitive UI work; see apps/admin/ADMIN_SETUP.md
  web/           Public website (not in original scope)
services/
  api/           NestJS backend — auth, courses, enrollment, payments, video,
                 live classes, community, certificates, notifications,
                 banners, coupons, admin/users all implemented
packages/        Shared types/config across apps (empty scaffold)
infra/docker/    Local dev Postgres + Redis
docs/            Setup guide and future architecture docs
```
