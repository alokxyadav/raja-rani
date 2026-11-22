# Notifications

## Flow (implemented)

Every module that needs to notify a user calls
`NotificationsService.notify(userId, type, title, body, deepLink?)`. This
is the one place that:

1. Writes a `Notification` row (the in-app source of truth — always
   succeeds if the DB write succeeds)
2. Best-effort sends a push via FCM to every registered device token
3. Prunes device tokens Firebase reports as unregistered/invalid
4. Never lets a push failure roll back or fail the caller's real action —
   a payment confirmation is still a successful payment even if FCM is
   down or misconfigured

Currently wired into:
- Payment success (Phase 4/7) → `PAYMENT_UPDATE`
- Live class going live, for everyone who set a reminder (Phase 6/7) →
  `LIVE_CLASS_REMINDER`

Not yet wired into: course publish/new-course, community replies,
certificate issuance. Same pattern, same one-line call — trivial to add
once you decide which events should actually notify students (notifying on
everything trains people to ignore notifications).

## Required one-time setup (needs a real Firebase project)

1. Create a Firebase project, enable Cloud Messaging.
2. Generate a service-account JSON (Project Settings → Service Accounts →
   Generate new private key).
3. Save it somewhere the API can read it (never commit it to git) and set
   `FCM_SERVICE_ACCOUNT_JSON_PATH` in `.env` to that path.

Without this configured, `NotificationsService.notify()` still writes the
in-app `Notification` row — it just logs a warning instead of pushing. It
never pretends to have sent a push it didn't.

## Client responsibilities (mobile app — not yet built)

- Call `POST /api/v1/notifications/devices` with the FCM device token after
  login and whenever the token refreshes (Firebase rotates these
  periodically)
- `GET /api/v1/notifications` to show notification history / unread badge
- `POST /api/v1/notifications/:id/read` when the user opens one
- Handle the `deepLink` field (e.g. `rajarani://course/{id}`) to navigate
  to the right screen when a push is tapped

## Not implemented yet

- Scheduled reminders (T-minus-X before a live class starts) — needs a
  background job/worker, not built in this backend-only phase
- Notification preferences (per-type opt-out) — schema has
  `NotificationPreference` planned but no model/endpoints yet
- Bulk/broadcast sends from the admin panel ("send push to all students")
