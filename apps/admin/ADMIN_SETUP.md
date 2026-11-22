# Raja Rani — Admin Panel Setup

## Prerequisites
Same as the backend: Node.js 20 LTS. The backend (`services/api`) must be
running — see `../../docs/SETUP_GUIDE.md` in the repo root.

## Install and run

```bash
cd apps/admin
cp .env.example .env.local
npm install
npm run dev
```
Opens at http://localhost:3001.

## Log in

Use the seeded admin account from the backend's `npm run seed`:
`admin@dev.local` / `ChangeMe123!`

Any account with `role: ADMIN` works — the login page itself doesn't check
the role client-side, but every admin API call is enforced server-side by
`@Roles('ADMIN')` (Phase 7), so a non-admin account will hit 403s
immediately after logging in.

## What's built

- Login (real auth against `/api/v1/auth/login`)
- Dashboard — every metric is a live query, auto-refreshes every 30s
- Courses — list all (including drafts, via the admin-only
  `/api/v1/courses/admin/all` endpoint added specifically because the
  public course list correctly hides unpublished courses), create draft,
  publish (surfaces the backend's real validation errors, e.g. "missing:
  thumbnailUrl, at least one chapter")
- Users — search, suspend/reactivate (writes an audit log entry
  server-side automatically)

## What's not built yet

Every one of these has a working backend endpoint already (see
`PROJECT_STATUS.md` at the repo root) — this is UI work, not backend work:
- Chapters/lessons management within a course (currently API-only)
- Orders/Payments/Refunds view
- Live Classes scheduling UI
- Community moderation UI
- Certificates management UI
- Banners/Coupons management UI
- Notifications (send/broadcast) UI
- Settings, Audit Log viewer
- Video upload flow (needs the admin upload-URL backend endpoint too,
  which also isn't built yet — see docs/VIDEO.md at the repo root)

The pattern for each is the same as Courses/Users (SWR fetch + table +
action buttons calling existing endpoints) — genuinely repetitive work
rather than hard problems, which is why it's listed as remaining scope
rather than something blocking on a design decision.
