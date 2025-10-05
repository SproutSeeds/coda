# Contract: Edit Idea

## Endpoint
- **Server Action**: `updateIdeaAction` in `app/(authenticated)/ideas/edit/[id]/route.ts`
- **REST**: `PATCH /api/ideas/{id}` (optional wrapper for testing)

## Description
Allows the owner of an idea to update title and/or notes. Returns the updated record with fresh timestamps for optimistic UI reconciliation.

## Authentication & Authorization
- Requires Auth.js session.
- Must verify `idea.user_id === session.user.id`; otherwise respond `403 Forbidden`.

## Request Schema
```json
{
  "title": "string | undefined (trimmed, <= 200 chars)",
  "notes": "string | undefined (trimmed, <= 5000 chars)",
  "lastKnownUpdatedAt": "ISO-8601"
}
```
- At least one of `title` or `notes` MUST be provided and sanitized before persist.
- `lastKnownUpdatedAt` enables optimistic concurrency check; reject if stale.

## Response Schema (200 OK)
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
| 400 | ValidationError | No fields supplied or invalid lengths |
| 401 | Unauthorized | Missing session |
| 403 | Forbidden | Idea does not belong to user |
| 409 | Conflict | `lastKnownUpdatedAt` mismatch |
| 404 | NotFound | Idea does not exist or soft-deleted |
| 500 | UnexpectedError | Logged with request id |

## Rate Limiting
- 120 edit attempts per user per minute (shared limiter with create/delete).

## Side Effects
- Emits analytics event `idea_edited` with delta summary (no note content).
- Updates search index / materialized view if required by research outcome.

## Contract Tests
- Vitest: partial update success, conflict detection, validation errors.
- Playwright: edit flow from list (modal or inline) with optimistic UX.
- HTTP contract test: `PATCH /api/ideas/{id}` with stale timestamp returns 409.
