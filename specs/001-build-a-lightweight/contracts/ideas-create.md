# Contract: Create Idea

## Endpoint
- **Server Action**: `createIdeaAction` in `app/(authenticated)/ideas/new/route.ts`
- **REST**: `POST /api/ideas`

## Description
Creates a new idea owned by the authenticated user with required title and notes fields. Returns the persisted record for optimistic UI updates.

## Authentication & Authorization
- Requires Auth.js session (email magic link or password credentials).
- Reject unauthenticated requests with `401 Unauthorized`.

## Request Schema
```json
{
  "title": "string (trimmed, <= 200 chars)",
  "notes": "string (trimmed, <= 5000 chars)"
}
```
- Validation via Zod + drizzle-zod to enforce length (≤200 chars) and sanitize Markdown via shared helper.
- Reject empty or whitespace-only titles/notes.

## Response Schema (201 Created)
```json
{
  "id": "uuid",
  "title": "string",
  "notes": "string",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

## Error Cases
| Status | Reason | Notes |
|--------|--------|-------|
| 400 | ValidationError | Include list of failed fields |
| 401 | Unauthorized | No active session |
| 429 | RateLimitExceeded | Return retry-after header |
| 500 | UnexpectedError | Logged with request id |

## Rate Limiting
- 60 create attempts per user per minute; responses include `X-RateLimit-*` headers.
- Leverage shared limiter implementation (`lib/utils/rate-limit.ts`).

## Side Effects
- Emits analytics event `idea_created` with anonymized user id.
- Enqueues optional search index warm-up (if using trigram, no-op).

## Contract Tests
- Vitest: schema validation (success + failure scenarios).
- Playwright: form submission success, validation errors, session expiry path.
- Contract HTTP test: `POST /api/ideas` returns 201 with correct payload and rate limit headers.
