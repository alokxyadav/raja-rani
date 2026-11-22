# Security

Honest status against the brief's Section 43 checklist — each line says
what's actually true, not what's aspirational.

## Implemented

- **Passwords**: argon2 (not bcrypt/md5) — `auth.service.ts`. Never
  logged, never returned in any response.
- **Tokens**: short-lived access tokens (15 min default), rotating refresh
  tokens (each use invalidates the old one and issues a new pair — reuse
  of a revoked token is rejected, the standard defense against a stolen
  refresh token being used silently alongside the legitimate one).
- **Input validation**: every DTO uses `class-validator`, and the global
  `ValidationPipe` (`main.ts`) has `whitelist: true` +
  `forbidNonWhitelisted: true` — unknown fields in a request body are
  rejected outright, not silently ignored (blocks mass-assignment attacks
  where a client adds `"role": "ADMIN"` to a registration payload).
- **SQL injection**: not applicable in the traditional sense — every query
  goes through Prisma's query builder, which parameterizes automatically.
  No raw SQL string concatenation anywhere in the codebase.
- **Rate limiting**: global default (100 req/min) plus tighter per-route
  limits on auth endpoints (`@Throttle`) — register 5/min, login 10/min,
  OTP request 3/min, video playback-token 30/min. Different limits for
  different endpoint types, per the brief's explicit "don't use one global
  rate limit for everything."
- **Authorization**: `JwtAuthGuard` + `RolesGuard`, both global (every
  route is private by default, opts out via `@Public()`, opts into role
  restriction via `@Roles(...)`) — see `docs/ARCHITECTURE.md` for the full
  guard chain.
- **Webhook verification**: HMAC-SHA256 signature check against the raw
  request body (`razorpay.provider.ts`), using `crypto.timingSafeEqual`
  rather than `===` (prevents a timing attack that could otherwise leak
  the signature byte-by-byte).
- **CORS**: explicit origin allowlist from `CORS_ORIGINS` env var, not a
  wildcard.
- **Secrets**: `.env.example` documents every required secret with no real
  values; `.gitignore` excludes `.env*` and anything matching
  `*-service-account.json`; Docker images never bake secrets into the
  image layer (all injected via env at container runtime — see
  `docs/DEPLOYMENT.md`).
- **Audit logging**: sensitive admin actions (user suspend/reactivate)
  write to `AuditLog` with actor, action, resource, and a safe
  before/after summary — see `docs/DATABASE.md` for why `metadata` is
  intentionally unstructured.
- **File upload validation**: N/A yet — no file upload endpoint exists in
  this codebase (banners/thumbnails currently take a URL, not a file body;
  the video upload flow uses Cloudflare's own direct-upload, so the API
  server never receives file bytes to validate in the first place).

## Explicitly NOT done — real gaps, not implied

- ~~**No dependency/secret scanning in CI.**~~ **Closed**: `ci.yml` now
  runs `npm audit --audit-level=high` on every backend build and a
  `gitleaks` secret-scan job across full git history, both on every PR.
- ~~**No IDOR testing performed.**~~ **Closed**: `test/e2e/app.e2e-spec.ts`
  runs against a real Postgres and the real HTTP layer (not mocked
  Prisma), and specifically tests three IDOR shapes: a student reaching an
  admin-only endpoint with someone else's resource ID (blocked by RBAC),
  one student marking a different student's notification as read (blocked
  by the service scoping the update to `{id, userId}` together, verified
  by asserting zero rows were actually affected — not just the HTTP
  status), and an unenrolled student fetching a paid lesson's playback
  token (blocked by the entitlement check, proven end-to-end rather than
  against mocked Prisma). Also exercises the full guard chain and the real
  `ValidationPipe`'s mass-assignment protection, which unit tests
  structurally can't do. Requires a real database to run — see
  `docs/TESTING.md`.
- ~~**No expired-token / malformed-JWT test coverage.**~~ **Closed**:
  `jwt-auth.guard.spec.ts` asserts expired tokens, tampered signatures,
  missing/malformed headers are all rejected, `@Public()` routes correctly
  skip the check entirely, and the raw jwt-library error message never
  leaks to the client (only the generic "invalid or expired access token").
- ~~**No brute-force account lockout** beyond the rate limit on the login
  endpoint itself.~~ **Closed**: `auth.service.ts`'s `login()` now locks an
  account for 15 minutes after 5 consecutive failed attempts (tracked via
  `User.failedLoginAttempts`/`lockedUntil`), independent of and
  complementary to the per-IP rate limit — a distributed attack across
  many IPs still can't grind one specific account. The OTP flow already
  had an equivalent per-code attempt limit (`OTP_MAX_ATTEMPTS`).
- **No MFA.** ~~Mentioned as "MFA-ready architecture" in the brief for
  admin accounts~~ **Closed**: real TOTP-based MFA (RFC 6238, the standard
  Google Authenticator/Authy algorithm, implemented directly against
  Node's `crypto` module — no external dependency) via
  `POST /api/v1/auth/mfa/setup` → `/mfa/enable` → then login returns
  `{mfaRequired: true, mfaToken}` instead of tokens for an MFA-enabled
  account, exchanged via `/mfa/verify-login`. Tested against the actual
  RFC 6238 published test vector, not just internal consistency (see
  `totp.util.spec.ts`). Not yet *required* for admin accounts specifically
  (any account can enable it) — enforcing it as mandatory for `ADMIN`/
  `SUPER_ADMIN` roles is a policy decision, not a technical one, and is a
  small addition once you decide on it.
- **No malware/virus scanning strategy** — moot right now since there's no
  file upload endpoint, but if thumbnail/resource fields become real file
  uploads later, this becomes a real requirement, not a hypothetical.
- **Swagger docs are live by default outside production** (see
  `docs/API.md`) — fine for dev/staging, but worth double-checking
  `NODE_ENV` is actually set correctly wherever this deploys, since a
  misconfigured environment variable is the whole difference between
  "docs are appropriately open" and "docs are an attacker's map of every
  endpoint."

## Where to verify this yourself

`entitlement.service.spec.ts`, `auth.service.spec.ts`, and
`payments.service.spec.ts` (`docs/TESTING.md`) are the closest thing this
repo has to security testing today — they pin down the authorization and
money-correctness logic, but they're unit tests against mocked Prisma, not
the IDOR/expired-token/brute-force testing the brief's Section 59
describes. Treat this file as the honest list of what that section still
needs.
