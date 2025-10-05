# Contract: Delete Idea

## Endpoint
- **Server Action**: `deleteIdeaAction` in `app/(authenticated)/ideas/api/route.ts`
- **REST**: `DELETE /api/ideas/{id}`

## Description
Soft-deletes an idea owned by the authenticated user, generates an undo token valid for 10 seconds, and removes the idea from active listings.

## Authentication & Authorization
- Requires Auth.js session.
- Verify idea ownership; otherwise respond `403 Forbidden`.

## Response Schema (200 OK)
```json
{
  "status": "deleted",
  "undoToken": "uuid",
  "undoExpiresAt": "ISO-8601"
}
```

## Error Cases
| Status | Reason |
|--------|--------|
| 401 | Unauthorized |
| 403 | Forbidden (idea belongs to another user) |
| 404 | NotFound (already deleted or missing) |
| 429 | RateLimitExceeded |
| 500 | UnexpectedError |

## Rate Limiting
- 60 deletions per user per minute.

## Side Effects
- Sets `deleted_at`, `undo_token`, `undo_expires_at` columns.
- Emits analytics event `idea_deleted` with `undoExpiresAt` delta.
- Triggers background job scheduling for retention purge (30-day hard delete).

## Contract Tests
- Vitest: soft-delete mutation sets expected fields.
- Playwright: delete action displays undo snackbar for 10 seconds and hides entry immediately.
- HTTP test: attempt to delete after undo expiry returns 404.
