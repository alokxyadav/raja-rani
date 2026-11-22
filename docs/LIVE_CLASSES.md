# Live Classes

## States and transitions

```
SCHEDULED --start--> LIVE --end--> ENDED
    |
    +--cancel--> CANCELLED
```

`POST /api/v1/live-classes/:id/start|end|cancel` (ADMIN/INSTRUCTOR only)
drive these transitions. `join` only succeeds while `status = LIVE`,
matching the brief's per-state join-button behavior (SCHEDULED → reminder,
LIVE → join, ENDED → recording if present, CANCELLED → shown as cancelled).

## Provider

Ships with `JitsiProvider`, which needs **zero external account** — it
builds a `meet.jit.si` room URL. This is intentional: it's the one
integration in this whole stack you can test end-to-end today with no
signup. It is explicitly **not production-grade**:

- Room access is "anyone with the URL," not a real per-user auth check
  (the entitlement check in `LiveClassesService.join` still gates *who
  gets the URL*, but nothing stops someone from forwarding it)
- No recording, no participant limits, no host controls via API

Before launch, add a `LiveKitProvider` or `AgoraProvider` implementing the
same `LiveClassProvider` interface (`generateJoinUrl`) — `LiveClassesService`
doesn't change either way.

## Not implemented yet

- ~~Push/reminder notification actually firing at T-minus-X before
  `scheduledAt`~~ **Closed**: `SchedulerService.sendUpcomingLiveClassReminders()`
  (`src/scheduler/`) runs every minute, checks for classes starting within
  15 minutes, and notifies every participant who set a reminder — exactly
  once each, guarded by `LiveClassParticipant.reminderSentAt` so re-runs
  never double-send. See `docs/DEPLOYMENT.md`'s note on this needing a
  distributed lock before running multiple API replicas.
- Recording upload/storage flow (currently `recordingUrl` is set manually
  via the `end` endpoint)
