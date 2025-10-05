# Contract: List Ideas

## Endpoint
- **Server Action**: `listIdeasAction` in `app/(authenticated)/ideas/page.tsx`
- **REST**: `GET /api/ideas?cursor={string}&limit={number}`

## Description
Fetches authenticated user’s ideas in reverse chronological order with cursor-based pagination and soft-delete filtering.

## Authentication
- Requires Auth.js session; respond `401 Unauthorized` when absent.

## Query Parameters
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `cursor` | string (ISO timestamp or encoded UUID) | No | When provided, returns records after cursor |
| `limit` | integer (default 20, max 50) | No | Page size |

## Response Schema (200 OK)
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "string",
      "notes": "string",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ],
  "nextCursor": "string | null"
}
```
- `items` sorted newest first; excludes soft-deleted ideas.
- `nextCursor` null when final page reached.

## Error Cases
| Status | Reason |
|--------|--------|
| 400 | Invalid cursor or limit out of bounds |
| 401 | Unauthorized |
| 500 | UnexpectedError |

## Rate Limiting
- 300 list requests per user per minute (covers infinite scroll).

## Empty State Contract
- When `items` is empty and `cursor` omitted → UI MUST show “Capture your first idea” empty state.
- When `items` empty but `cursor` provided → treat as end-of-list (no empty-state messaging change).

## Contract Tests
- Vitest: cursor utility ensures deterministic pagination.
- Playwright: infinite scroll loads additional ideas without duplication.
- HTTP test: invalid cursor returns 400 with structured error payload.
