# Architecture

## Shape: modular monolith, not microservices

One NestJS process (`services/api`) with clearly separated modules
(`auth`, `courses`, `enrollments`, `payments`, `video`, `live-classes`,
`community`, `certificates`, `notifications`, `banners`, `coupons`,
`admin`, `settings`) rather than one service per domain. This was a
deliberate choice, not a shortcut: a modular monolith is faster to
develop, easier to debug (one process, one log stream, one stack trace),
and cheaper to run than microservices at this scale. Module boundaries
are still real — each has its own service/controller/DTOs and only
imports another module's service through that module's exported provider
(see `enrollments.module.ts` exporting `EntitlementService`, or
`certificates.module.ts` exporting `CertificatesService` for
`enrollments.module.ts` to consume) — so extracting a module into its own
service later, if you ever actually need to, doesn't require a rewrite.

## The one rule every module follows: entitlement is centralized

`EntitlementService.canAccessCourse()` / `canAccessLesson()`
(`src/enrollments/entitlement.service.ts`) is the single place that
decides whether a user can see paid content. Every module that gates
access — video playback, live-class join — calls through this rather than
re-implementing an enrollment check. This is the concrete answer to the
brief's "do not duplicate authorization logic in multiple places"
requirement, and it's the reason a bug in access control would show up in
one file's tests (`entitlement.service.spec.ts`) rather than needing to be
independently correct in five different controllers.

## Request flow (a protected endpoint)

```
Client request with Authorization: Bearer <token>
  → ThrottlerGuard (rate limiting, global default + per-route overrides)
  → JwtAuthGuard (verifies the token, attaches req.user, skips @Public() routes)
  → RolesGuard (enforces @Roles(...) where present)
  → ValidationPipe (whitelists + validates the request body against the DTO)
  → Controller → Service → PrismaService → Postgres
```
All three guards are registered globally in `app.module.ts` — a new
controller is locked down by default and has to opt out (`@Public()`) or
opt into role restriction (`@Roles(...)`), rather than the reverse.

## Provider abstractions (no vendor lock-in)

Payments, video, and live-classes each sit behind a TypeScript interface
(`PaymentProvider`, `VideoProvider`, `LiveClassProvider`) with one real
adapter each (Razorpay, Cloudflare Stream, Jitsi). Business logic
(`PaymentsService`, `VideoService`, `LiveClassesService`) depends only on
the interface. Swapping Razorpay for Stripe, or Jitsi for LiveKit, means
writing a new adapter class — the service and its tests don't change. See
`docs/PAYMENTS.md`, `docs/VIDEO.md`, `docs/LIVE_CLASSES.md` for why each
current adapter is (or isn't) production-ready as-is.

## Data consistency

Every operation that must not partially succeed uses a Prisma transaction:
payment-success handling (mark payment SUCCESS + order PAID + create
enrollment + bump coupon redemption, all together —
`payments.service.ts`), so a crash mid-way never leaves a paid order
without course access. Webhook handling is idempotent by construction
(payments are looked up by provider order ID, and an already-SUCCESS
payment is a no-op on redelivery) rather than relying on Razorpay never
retrying a webhook, which it does.

## Frontend/backend boundary

Three separate apps talk to one API:
- `apps/mobile` (Flutter) — students
- `apps/admin` (Next.js) — staff
- `apps/web` — not built (wasn't in the original brief's scope; the folder
  exists as a placeholder if a public marketing site is wanted later)

Both real clients use the same versioned REST API
(`/api/v1/...`, see `docs/API.md`) — there's no client-specific backend
logic; an admin-only endpoint is enforced by `@Roles('ADMIN')`, not by
which app is calling it.

## Where to look for more detail

- `docs/DATABASE.md` — schema design decisions
- `docs/SECURITY.md` — what's actually enforced and how
- `docs/TESTING.md` — what's covered by the test suite
- `PROJECT_STATUS.md` — phase-by-phase build history and what's not done yet
