# Contract: Search Ideas

## Endpoint
- **Server Action**: `searchIdeasAction` in `app/(authenticated)/ideas/api/search/route.ts`
- **REST**: `GET /api/ideas/search?q={string}&cursor={string}&limit={number}`

## Description
Returns ideas owned by the authenticated user where the keyword appears in title or notes (case-insensitive, partial matches allowed). Supports pagination consistent with list endpoint.

## Authentication
- Requires Auth.js session; otherwise `401 Unauthorized`.

## Query Parameters
| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `q` | string (1-120 chars) | Yes | Trimmed; reject empty values |
| `cursor` | string | No | Same semantics as list endpoint |
| `limit` | integer (default 20, max 50) | No | Page size |

## Response Schema (200 OK)
```json
{
  "query": "string",
  "items": [
    {
      "id": "uuid",
      "title": "string",
      "notes": "string",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "matchedFields": ["title" | "notes"]
    }
  ],
  "nextCursor": "string | null"
}
```

## Error Cases
| Status | Reason | Notes |
|--------|--------|-------|
| 400 | ValidationError | Missing `q`, over-length query, or unsupported characters |
| 401 | Unauthorized | Session missing |
| 429 | RateLimitExceeded | Excessive search traffic |
| 500 | UnexpectedError | Logged with tracing id |

## Rate Limiting
- 120 searches per user per minute to balance UX and abuse prevention.
- If IdeaSearchAudit enabled, ensure rate limiting still applies per user.

## Empty State Contract
- When no matches found, return empty `items` array; UI MUST show explanatory message with CTA to create new idea.

## Observability
- Emit analytics event `idea_searched` with `resultsCount` and `hasMatches` flag.
- If logging raw queries, scrub PII before persistence.

## Contract Tests
- Vitest: search utility handles partial matches and sanitized queries.
- Playwright: search refinement, no-result messaging, subsequent clearing of query.
- HTTP test: rate limit response includes `Retry-After` header.
