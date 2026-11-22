# Testing

## Backend unit tests

```bash
cd services/api
npm test          # run once
npm run test:watch
npm run test:cov  # with coverage report
```

No database needed — every test mocks `PrismaService` manually (plain
`jest.fn()` objects, no test-DB, no fixtures). That's a deliberate choice:
these tests exist to pin down *authorization and money logic*, where a
mistake is expensive and easy to miss in manual testing — not to
re-verify Prisma itself.

**What's covered:**
- `entitlement.service.spec.ts` — every branch of `canAccessCourse`/
  `canAccessLesson`: draft courses, soft-deleted courses, free vs paid,
  anonymous vs enrolled vs not-enrolled, free-preview bypass
- `auth.service.spec.ts` — password hashing never leaks plaintext,
  suspended accounts can't log in even with the right password, refresh
  token rotation + reuse detection, OTP expiry/attempt-limit rejection
- `payments.service.spec.ts` — free courses can't go through checkout,
  can't double-charge an already-enrolled user, coupon expiry/limit
  validation, **the discount math is asserted against the actual amount
  sent to Razorpay** (this is where a client-trusted-amount bug would
  show up), webhook idempotency, and the amount-mismatch-fails-closed path
- `courses.service.spec.ts` — every publish-validation branch (missing
  thumbnail, zero chapters, paid-with-no-price)
- `certificates.service.spec.ts` — won't issue below the completion
  threshold, idempotent (won't double-issue), certificate number format
- `jwt-auth.guard.spec.ts` — expired tokens, tampered signatures, missing/
  malformed headers all rejected; `@Public()` routes skip the check
  entirely; the underlying jwt-library error never leaks to the client

## What's NOT covered yet (see PROJECT_STATUS.md):

- Integration/E2E tests hitting a real test database — **now added**, see
  below
- Webhook signature verification itself (`razorpay.provider.ts`'s HMAC
  check) — the logic is straightforward crypto, but it deserves a test
  that it rejects a tampered body, not just a manual read-through
- Live classes, community, notifications *services* (the notification
  ownership-scoping is covered indirectly by the E2E IDOR test below, but
  the service itself has no unit test)
- Refunds, MFA setup edge cases beyond what's in `auth.service.spec.ts`
  and `totp.util.spec.ts`

## E2E tests

`services/api/test/e2e/app.e2e-spec.ts` — genuinely different from the
unit tests above: runs the real Nest app (`Test.createTestingModule` +
`supertest`), a real `ValidationPipe`, the real guard chain, and a real
Postgres database. This is the category that can actually catch an IDOR
bug, since unit tests mock Prisma and can't observe whether a WHERE
clause is actually scoped correctly.

```bash
cd services/api
npm run test:e2e
```

Requires `DATABASE_URL` pointing at a real Postgres — CI provisions one
automatically (see `.github/workflows/ci.yml`'s `postgres` service
container); locally, point it at the dev `docker-compose.dev.yml` database
or a dedicated test database, **never your real data** (the suite deletes
every user matching `+e2e@test.local` at start and end).

Covers: the full auth guard chain (missing/garbage tokens, `@Public()`
bypass, mass-assignment rejection via `whitelist: true`), RBAC (student
vs. admin), three specific IDOR shapes (see `docs/SECURITY.md` for the
detail), and one full happy-path flow (register → browse → enroll free →
see it in the library).

## Mobile tests

Two pure-Dart unit test files (no widget rendering needed, so no
`flutter create` platform folders required to at least read them):

- `test/features/courses/course_models_test.dart` — pins the manual
  `fromJson` parsing in `course_models.dart` against the actual backend
  response shapes. This is exactly where a backend field rename would
  otherwise only surface as a silent null/crash deep in a widget.
- `test/features/auth/auth_state_test.dart` — **caught a real bug while
  being written**: `AuthState.copyWith()`'s `error` parameter wasn't
  defaulting to `this.error`, so calling `copyWith()` without an explicit
  error would silently clear any existing one. Currently unused elsewhere
  in the app (state transitions construct `AuthState(...)` directly), so
  nothing was actually broken by it — but it's fixed now, with the test
  pinning the correct behavior.

Run once you've done the one-time `flutter create` setup step
(`apps/mobile/MOBILE_SETUP.md`):
```bash
cd apps/mobile
flutter test
```

Not covered yet: any widget tests (screens aren't tested in isolation),
the repository classes (they're thin Dio wrappers — worth a test once
there's a mocking setup, e.g. `mocktail`, which isn't a dependency yet).

## Admin panel tests

None written yet.

## Why unit tests first, not E2E

E2E tests (spin up the real app + a real Postgres, hit real HTTP
endpoints) give more confidence per test, but cost more to write and run,
and need a test-database setup this environment couldn't provide (no
network access to run `docker compose` + migrations here). Fast, mocked
unit tests on the modules where a bug is expensive — auth, money,
authorization — were the higher-value thing to build first. E2E tests
covering the full request pipeline (guards, pipes, real Prisma) are the
natural next addition once you're running this locally.
