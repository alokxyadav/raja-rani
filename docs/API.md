# API Documentation

## Interactive docs (Swagger/OpenAPI)

Once the backend is running (`npm run dev` in `services/api`):

```
http://localhost:4000/docs
```

This is generated directly from the real controllers and DTOs
(`@nestjs/swagger`'s `SwaggerModule`, wired in `main.ts`) — it can't drift
out of sync with the actual endpoints the way a hand-written API.md would,
because it's reading the same decorators the routes themselves use.

To try an authenticated endpoint: call `POST /api/v1/auth/login` from the
docs UI, copy the `accessToken` from the response, click **Authorize** at
the top of the page, paste it in (no `Bearer` prefix needed — Swagger adds
that), and every subsequent call in that browser session carries it.

Endpoints are grouped by tag (auth, courses, enrollments, payments, video,
live-classes, community, certificates, notifications, admin, banners,
coupons, settings) matching the module structure in `src/`.

## Production

Swagger is **disabled by default when `NODE_ENV=production`** — an
interactive "try it out" console against your real API is reconnaissance
material for an attacker if left open publicly. Set `ENABLE_SWAGGER=true`
in your production `.env` if you deliberately want it available (e.g.
behind a VPN, or because your API has no public traffic yet and you want
partners to explore it) — see the check in `main.ts`.

## What's documented vs not yet

Every route has a tag and (where relevant) shows the bearer-auth padlock.
**Not yet added:** per-endpoint `@ApiOperation`/`@ApiResponse` descriptions
and `@ApiProperty` decorators on the DTOs themselves — right now Swagger
infers field names and types correctly (that's automatic from the
`class-validator` decorators already on every DTO) but won't show
human-written descriptions or example values until those are added. That's
a real but bounded amount of remaining work — decorating ~15 DTO files,
not a design decision.

## Postman / curl alternative

Every `docs/*.md` file in this repo (SETUP_GUIDE, PAYMENTS, VIDEO,
LIVE_CLASSES, NOTIFICATIONS) already has working `curl` examples for the
flows they cover, if you'd rather not use the interactive UI.
