# Contract: Restore Idea

## Endpoint
- **Server Action**: `restoreIdeaAction` in `app/(authenticated)/ideas/api/route.ts`
- **REST**: `POST /api/ideas/{id}/restore`

## Description
Restores a soft-deleted idea when provided with a valid undo token that has not expired.

## Authentication & Authorization
- Requires Auth.js session.
- Confirms idea ownership and matching undo token.

## Request Schema
```json
{
  "undoToken": "uuid"
}
```

## Response Schema (200 OK)
```json
{
  "status": "restored",
  "idea": {
    "id": "uuid",
    "title": "string",
    "notes": "string",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
}
```

## Error Cases
| Status | Reason | Notes |
|--------|--------|-------|
| 400 | InvalidUndoToken | Token missing or malformed |
| 401 | Unauthorized | Session missing |
| 403 | Forbidden | Idea does not belong to user |
| 404 | NotFound | Idea not deleted or undo expired |
| 410 | Gone | Undo token expired (>10 s) |
| 500 | UnexpectedError | Logged with trace id |

## Rate Limiting
- 120 restore attempts per user per minute (covers repeated undo clicks within window).

## Side Effects
- Clears `deleted_at`, `undo_token`, `undo_expires_at` columns, updates `updated_at`.
- Emits analytics event `idea_restored`.

## Contract Tests
- Vitest: restore mutation fails when token expired.
- Playwright: undo snackbar triggers restore and reinserts card.
- HTTP test: expired undo returns 410 with explanatory message.
