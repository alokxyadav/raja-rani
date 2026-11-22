# Database

Postgres via Prisma. Full schema: `services/api/prisma/schema.prisma`.

## Design decisions worth explaining

**UUID primary keys everywhere.** Sequential integer IDs leak information
(course count, growth rate over time via `/courses/1234`) and make
enumeration attacks trivial (`/courses/1`, `/courses/2`, ...). UUIDs cost a
little index space; the tradeoff favors UUIDs for anything with an
externally-visible ID, which here is everything.

**Soft deletes on `User` and `Course` (`deletedAt`), hard deletes
elsewhere.** A deleted user's enrollments/orders/certificates need to
survive for financial records and support history — an admin viewing a
suspended user's order history depends on this. Comments and community
posts also use soft delete (moderation needs to distinguish "removed by
moderator" from "never existed" for audit purposes) via their own
`deletedAt`. Refresh tokens and OTPs are hard-deleted/expired — no reason
to retain a used one-time code.

**`Payment` is separate from `Order`, one-to-many.** An order can have
multiple payment *attempts* (a failed card, then a successful retry) —
collapsing this into a single status field on `Order` would lose the
failed-attempt history that Section 41 ("Payment Admin") explicitly wants
to show (failed payments, pending payments, alongside successful ones).
`Payment.providerPaymentId` is unique — this is what makes webhook
processing idempotent (see `docs/ARCHITECTURE.md`).

**`LessonProgress` is keyed on `(userId, lessonId)`, not on `(userId,
courseId)`.** Per-lesson granularity is what lets the library screen show
"12 of 20 lessons complete" and lets certificate eligibility check actual
per-lesson completion rather than a single "did they open the course"
flag. Course-level progress is *computed* from this table
(`enrollments.service.ts`'s `getLibrary()`), never stored redundantly —
one source of truth, no risk of the two drifting out of sync.

**`Enrollment` has a unique constraint on `(userId, courseId)`**, not a
separate "already enrolled" check scattered across every place that
creates one. The database itself refuses a duplicate — `enrollFree()` and
the payment-webhook handler both use `upsert` specifically so a race
(double-click, webhook redelivery) can't create two rows or throw an
ugly constraint-violation error to the user.

**Money is `Decimal(10,2)`, never `Float`.** Floating-point rounding
errors in prices compound — `0.1 + 0.2 !== 0.3` is the canonical example,
and it's exactly the kind of bug that's invisible until a real transaction
comes out off by a fraction of a rupee from what a customer was actually
charged.

**`Certificate` has a unique constraint on `(userId, courseId)`** — the
same enforcement pattern as `Enrollment`, for the same reason:
`maybeIssueCertificate()` checks for an existing certificate before
generating one, but the unique constraint is the actual guarantee, not
just the application-level check (a second process racing the same
completion event can't create two certificates for one completion).

**`AuditLog.metadata` is a `Json` field with no fixed shape.** Different
admin actions have different relevant "what changed" data (a suspension
records `{from, to}` status; other future actions might record something
else). A rigid schema here would mean a migration every time a new admin
action type is added — the tradeoff (harder to query metadata contents in
raw SQL) is worth it for that flexibility, and nothing sensitive is ever
allowed into this field (see `docs/SECURITY.md`).

## Indexes

Every foreign key has an index (Prisma doesn't add these automatically
without `@@index` — each one here was added deliberately, matching the
actual query patterns in each service: `Course.status` because the public
course list always filters on it, `Notification.[userId, readAt]` because
the unread-count query filters on both, `AuditLog.[resource, resourceId]`
because "show me the history of this specific course" is exactly the
query the admin panel would want).

## Migrations

`npx prisma migrate dev` locally (interactive, generates a new migration
file when the schema changes). `npx prisma migrate deploy` in production
(non-interactive, applies pending migrations, never prompts) — see
`docs/DEPLOYMENT.md` for why these are deliberately different commands and
why deploy is a separate release step, not baked into container startup.

## Seeding

`prisma/seed.ts` — clearly separated dev-only data (a dev admin, a dev
instructor, one free and one paid seeded course). Production never runs
this; nothing in the application logic depends on seed data existing.
