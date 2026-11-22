# Raja Rani — Setup Guide (Backend: complete feature set)

Covers auth, courses, enrollment, payments, video playback, live classes,
community, certificates, notifications, banners, coupons, and admin/users.
Mobile app and admin panel UI come next (see PROJECT_STATUS.md).

## 1. Prerequisites

Install these on your machine:

- Node.js 20 LTS — https://nodejs.org
- Docker Desktop (runs Postgres + Redis locally) — https://docker.com
- Git

Verify:
```bash
node -v     # should print v20.x
docker -v
git --version
```

## 2. Start the database

From the repo root:
```bash
cd infra/docker
docker compose -f docker-compose.dev.yml up -d
```
This starts Postgres on port 5432 and Redis on port 6379. Leave it running.

## 3. Configure the API

```bash
cd services/api
cp .env.example .env
```
Open `.env` and:
- Leave `DATABASE_URL` as-is — it matches the Docker Compose credentials.
- Generate two random secrets for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Run it twice, paste each result into the corresponding `.env` line.
- Leave the SMS/payment/video/storage keys blank for now — those features
  aren't wired up yet in Phase 1 and the app will run without them.

## 4. Install dependencies and set up the database

```bash
npm install
npx prisma migrate dev --name init
npm run seed
```
The seed script prints a dev admin login (`admin@dev.local` / `ChangeMe123!`)
— that account only exists in your local database, never in production.

## 5. Run the API

```bash
npm run dev
```
You should see `API listening on port 4000`.

## 6. Try it

```bash
# Register a student
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Student","email":"student@test.com","password":"testpass123"}'
# → {accessToken, refreshToken}. Save accessToken as $TOKEN below.

# Browse published courses (public, no token needed)
curl http://localhost:4000/api/v1/courses

# View the seeded free course
curl http://localhost:4000/api/v1/courses/intro-to-hand-stitching

# Enroll in the free course (needs a token)
curl -X POST http://localhost:4000/api/v1/courses/<courseId>/enroll-free \
  -H "Authorization: Bearer $TOKEN"

# Check your library
curl http://localhost:4000/api/v1/library -H "Authorization: Bearer $TOKEN"

# Start a paid checkout (needs RAZORPAY_KEY_ID/SECRET set — see docs/PAYMENTS.md)
curl -X POST http://localhost:4000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"courseId":"<paid-course-id>"}'
```

Admin-only endpoints (creating/publishing courses) need a token from the
seeded admin account (`admin@dev.local` / `ChangeMe123!`) via
`POST /api/v1/auth/login`.

```bash
# Get a signed playback URL for the seeded free-preview lesson
# (needs CF_ACCOUNT_ID/CF_STREAM_API_TOKEN set — see docs/VIDEO.md;
# without them this returns a clear "not configured" error, not a fake URL)
curl http://localhost:4000/api/v1/lessons/00000000-0000-0000-0000-000000000002/playback-token \
  -H "Authorization: Bearer $TOKEN"

# Community: post, then browse the feed (no external setup needed)
curl -X POST http://localhost:4000/api/v1/community/posts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"body":"Excited to start this course!"}'
curl http://localhost:4000/api/v1/community/feed

# Live classes: works today with zero external setup (Jitsi)
curl -X POST http://localhost:4000/api/v1/live-classes \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Live Q&A","instructorName":"Priya MG","scheduledAt":"2026-08-20T10:00:00Z","durationMinutes":60}'
curl -X POST http://localhost:4000/api/v1/live-classes/<id>/start -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST http://localhost:4000/api/v1/live-classes/<id>/join -H "Authorization: Bearer $TOKEN"

# Certificate verification (public, no token — try after completing the seeded course)
curl http://localhost:4000/api/v1/certificates/verify/RR-2026-XXXXXXXX

# Admin dashboard (real, live-computed numbers)
curl http://localhost:4000/api/v1/admin/dashboard -H "Authorization: Bearer $ADMIN_TOKEN"

# Active homepage banners (public)
curl http://localhost:4000/api/v1/banners/active

# Create a coupon (admin)
curl -X POST http://localhost:4000/api/v1/coupons \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"WELCOME10","percentOff":10}'
```

## 7. Inspect the database visually

```bash
npx prisma studio
```
Opens a browser UI at http://localhost:5555 to browse tables.

## Troubleshooting

- **`ECONNREFUSED` on startup** — Postgres isn't running. Check
  `docker compose -f infra/docker/docker-compose.dev.yml ps`.
- **`P1001` from Prisma** — same cause, or `DATABASE_URL` doesn't match your
  `.env`.
- **Port 4000 already in use** — change `PORT` in `.env`.

## What's next (not built yet)

See `PROJECT_STATUS.md` for the full picture — the backend now covers
every functional area in the brief. What remains is primarily the Flutter
mobile app and the Next.js admin panel.
