# Data Model – IdeaVault MVP

## Entities

### Idea
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | Primary key; generated via `uuidv7()` | Stable identifier for an idea |
| `user_id` | UUID | FK → `users.id`; on delete cascade | Ensures isolation per owner |
| `title` | `varchar(200)` | NOT NULL; unique constraint per (`user_id`, `title`, `deleted_at IS NULL`) | Enforces concise titles (≤200 chars) and prevents duplicate active ideas |
| `notes` | `text` | NOT NULL | Stores sanitized Markdown (CommonMark subset) rendered via `rehype-sanitize` |
| `created_at` | `timestamptz` | NOT NULL default `now()` | Ordering + audit |
| `updated_at` | `timestamptz` | NOT NULL default `now()`; updated via trigger/server action | Tracks edits |
| `deleted_at` | `timestamptz` | NULL | Indicates soft deletion timestamp |
| `undo_token` | `uuid` | NULL | Temporary token returned after delete |
| `undo_expires_at` | `timestamptz` | NULL | 10 s window for undo; background task clears expired tokens |

**Indexes**:
- `idx_ideas_user_created_at` on (`user_id`, `created_at` DESC)
- `idx_ideas_search_trgm` on (`title`, `notes`) using `gin_trgm_ops` for substring search
- Partial index `idx_ideas_active` on (`user_id`) WHERE `deleted_at IS NULL`

### IdeaSearchAudit *(feature-flagged, disabled by default)*
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | Primary key | |
| `user_id` | UUID | FK → `users.id` | Links query to owner without exposing to others |
| `query` | `text` | NOT NULL | Raw search term (store only if privacy approved) |
| `results_count` | `integer` | NOT NULL | Count of matches returned |
| `queried_at` | `timestamptz` | NOT NULL default `now()` | Timestamp for analytics |

**Indexes**:
- `idx_search_audit_user_time` on (`user_id`, `queried_at` DESC)

## Relationships
- `Idea.user_id` references `users.id` (Auth.js credentials).
- `IdeaSearchAudit.user_id` references `users.id` when audit logging flag is enabled.
- Cascading delete from `users` ensures orphaned ideas are removed.

## Derived Types & Validation
- `IdeaInputSchema` (Zod) derived via `drizzle-zod` enforcing title/notes length, trimming whitespace, and sanitizing Markdown via shared helper.
- `IdeaPatchSchema` extends input schema allowing partial updates but requiring at least one field.
- `UndoTokenSchema` ensures UUID format and expiry check before restore.

## State Transitions
1. **Create** → insert `ideas` row with timestamps (undo fields NULL).
2. **Edit** → update `title`, `notes`, `updated_at`; maintain unique constraint.
3. **Delete** → set `deleted_at = now()`, generate `undo_token` + `undo_expires_at = now()+10s`.
4. **Undo** → if token valid and not expired, clear soft-delete fields; update `updated_at`.
5. **Expire** → scheduled worker clears expired `undo_token` values; Vercel Cron hard-deletes rows with `deleted_at` older than 30 days.

## Data Volume & Retention
- Expect ≤1,000 active ideas per user; soft-deleted rows pruned after 30 days.
- Audit table optional; if enabled, ensure PII review and retention policy (e.g., 90-day rolling window).

## Open Items
- None — decisions locked; revisit if analytics/audit scope expands.
