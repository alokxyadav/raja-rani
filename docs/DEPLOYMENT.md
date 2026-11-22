# Deployment

## Status: templates, not a tested pipeline

Everything in this file is real, standard configuration — but none of it
has been run in this environment (no network access here to actually
build a Docker image, push it, or deploy anywhere). Treat this as a solid
starting point to adapt and test, not a "click and it's live" pipeline.

## CI (`.github/workflows/ci.yml`)

Runs on every PR/push to `main`:
- **Backend**: spins up a real Postgres service container, runs migrations,
  lint, the Phase 11 test suite with coverage, build, and a grep-based scan
  for leftover `TODO`/`FIXME`/hardcoded-looking strings outside test files
- **Admin**: lint + build
- **Mobile**: runs `flutter create` fresh (see `apps/mobile/MOBILE_SETUP.md`
  for why that step exists at all), `flutter analyze`, `flutter test`
  (currently a no-op — no mobile tests exist yet, doesn't fail the build)

No deploy step yet — it stops at build/test. Deploying on merge to `main`
is the natural next addition once you've picked a hosting target below.

## Docker

`infra/docker/Dockerfile.api` and `Dockerfile.admin` are multi-stage
builds (small final images, no build tooling shipped to production).
`infra/docker/docker-compose.prod.yml` wires them together with Postgres/
Redis **for self-hosting or local production-shaped testing** — for real
production, prefer a managed Postgres/Redis (see cost-tier notes below)
and point the API's `DATABASE_URL`/`REDIS_URL` at those instead of the
containers in this compose file.

Build and run locally to sanity-check the images:
```bash
cd infra/docker
POSTGRES_PASSWORD=devpass \
JWT_ACCESS_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
PUBLIC_API_URL=http://localhost:4000 \
docker compose -f docker-compose.prod.yml up --build
```

## Where to actually host

**Budget/early-stage** (matches PROJECT_STATUS.md's cost estimate):
- API + worker: Railway or Render (both build directly from the
  Dockerfiles above, or from a `render.yaml`/`railway.json` you'd add)
- Database: Railway/Render/Neon managed Postgres
- Redis: Railway/Render managed Redis, or Upstash
- Admin panel: Vercel (Next.js's own platform — simplest option, or the
  Dockerfile if you want everything on one host)
- Object storage: Cloudflare R2 (S3-compatible, no egress fees)

**Growth stage**: AWS/GCP with a managed Postgres (RDS/Cloud SQL), managed
Redis (ElastiCache/Memorystore), and the same Docker images behind a
container service (ECS/Cloud Run) — the images don't change, only where
they run.

## Database migrations in production

Never `prisma migrate dev` in production (that's the dev-only, interactive
command). Use:
```bash
npx prisma migrate deploy
```
As a separate release step — not baked into the container's `CMD` (see the
comment in `Dockerfile.api`) — so that scaling to multiple API replicas
doesn't race multiple simultaneous migration attempts.

## Secrets

Every secret in `services/api/.env.example` needs a real value in whatever
secret manager your host provides (Railway/Render's env var UI, GitHub
Actions secrets for CI, or AWS/GCP Secret Manager at larger scale). None of
them are — or should ever be — committed to git; `.gitignore` at the repo
root already excludes `.env*` and anything named `*-service-account.json`.

## Not built yet

- Actual deploy step in CI (currently stops at build/test)
- Staging environment configuration (separate from dev/prod)
- Health-check-based zero-downtime deploy config for your chosen host
- CDN/caching layer in front of the API for public GET endpoints
  (course listing, active banners) — would meaningfully cut DB load at
  scale, not needed at launch
