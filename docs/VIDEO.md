# Video Security

## Flow (implemented)

```
Client → GET /api/v1/lessons/:lessonId/playback-token  (bearer token required)
       → server loads the lesson
       → server calls EntitlementService.canAccessLesson(userId, lessonId)
           (free-preview lessons pass without enrollment; everything else
            requires an Enrollment row — the same check used everywhere else)
       → if not entitled: 403, no video reference is ever returned
       → if entitled: server asks Cloudflare Stream for a short-lived
         signed token (20 min TTL) for that lesson's provider-side video ID
       → server returns {playbackUrl, expiresAt, resumeFromSeconds}
Client → plays playbackUrl directly (HLS manifest, works with any standard
         player — ExoPlayer on Android, video.js on web)
       → periodically calls PUT /api/v1/progress (already built in Phase 3)
         to sync watch position — throttled client-side, not per-second
```

Key properties:

- `Lesson.videoAssetId` (the Cloudflare-side video ID) is **never** sent to
  the client directly — not in the course-detail payload (see
  `courses.service.ts`, which excludes it), not anywhere. Only a short-lived
  signed playback URL is ever returned, and only after the entitlement check.
- The token expires in 20 minutes. A leaked/shared playback URL stops
  working shortly after — this is the practical anti-piracy measure; see
  "what this does NOT do" below for what it doesn't cover.
- `downloadable: false` is set on every token request — no direct file
  download of paid video.

## Required one-time setup (needs a real Cloudflare account)

1. Create a Cloudflare account, enable Stream.
2. When uploading each video (via the future admin "Video" module — not yet
   built), set `requireSignedURLs: true` on the video. Cloudflare Stream
   videos are public-by-default unless this flag is set; if it's ever
   forgotten on an upload, that video is playable without a token. Worth a
   deployment checklist item, not just a code comment.
3. Set `CF_ACCOUNT_ID` and `CF_STREAM_API_TOKEN` in `.env` (an API token
   scoped to Stream, not your global API key).

## What this does NOT do (and no system fully does)

- Doesn't stop someone from screen-recording playback. FLAG_SECURE on the
  Android player view (planned for the mobile app) blocks screenshots/
  screen-recording at the OS level on most devices, but isn't bulletproof
  (rooted devices, external capture hardware).
- Doesn't add visible watermarking yet. Cloudflare Stream doesn't offer this
  natively; a provider switch or a custom overlay would be needed if this
  matters for your content.
- Doesn't limit concurrent playback sessions per user yet — noted as a
  possible future addition (`docs/PAYMENTS.md`-style entitlement extension),
  not implemented in Phase 5.

None of this is unusual — no commercial platform (Udemy, Coursera included)
claims to fully prevent piracy; the goal is raising the cost of casual
sharing, not making it impossible.

## Not implemented yet

- Admin video upload flow (server-side upload URL generation, so the
  Cloudflare API token never reaches the frontend)
- Playback heartbeat/watch-time analytics beyond the existing progress sync
- Concurrent-session limiting
- PDF/resource signed access (currently `Lesson.pdfUrl`/`resourceUrl` are
  plain strings — fine for free resources, needs the same
  signed-URL-via-StorageProvider treatment as video before paid PDFs ship)
