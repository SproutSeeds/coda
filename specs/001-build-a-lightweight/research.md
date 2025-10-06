# Coda Research Plan

## Overview
Target open questions that influence architecture, data safety, and UX polish for the Coda MVP. Each item below tracks current status, planned investigation, and expected deliverables. Decisions marked Pending must be resolved before implementation tasks begin.

## Research Items

### 1. Note Authoring Format
- **Question**: Should notes support Markdown formatting or remain plain text?
- **Decision**: Resolved — adopt sanitized Markdown (CommonMark subset) stored as text and cleaned via `rehype-sanitize` before render.
- **Rationale**: Markdown improves readability but introduces XSS and editor complexity; plain text keeps MVP fast.
- **Investigation**:
  - Evaluate shadcn/ui + TipTap integration and sanitization via `rehype-sanitize`.
  - Benchmark authoring latency and bundle impact versus textarea.
- **Alternatives**: Plain textarea with minimal styling; TipTap rich text; Markdown textarea with preview.
- **Follow-up**: Implement Markdown sanitization helper, update `lib/validations/ideas.ts`, and document safe components in quickstart.

### 2. Undo & Retention Strategy
- **Question**: How to persist undo tokens and enforce 10 s undo window plus 30-day permanent delete?
- **Decision**: Resolved — persist undo state in soft-delete columns (`deleted_at`, `undo_token`, `undo_expires_at`) with 10 s undo window and 30-day purge.
- **Rationale**: Database-backed state survives redeploys and scales beyond single instance.
- **Investigation**:
  - Prototype Drizzle schema for soft deletes and verify query filters.
  - Assess Vercel Cron Jobs vs. job queue to purge records older than 30 days.
- **Alternatives**: In-memory cache (insufficient in serverless), Redis-based queue, direct hard delete without undo.
- **Follow-up**: Generate Drizzle migration adding columns & indices; create Vercel Cron entry documented in quickstart.

### 3. Search Indexing Approach
- **Question**: Should keyword search use Postgres trigram (`pg_trgm`) or full-text `tsvector`?
- **Decision**: Resolved — use Postgres `pg_trgm` GIN index for substring matching; reserve full-text search for future stemming needs.
- **Rationale**: Requirement includes substring matches in title or notes; trigram may satisfy with acceptable performance for ≤1k ideas.
- **Investigation**:
  - Seed dataset locally, compare EXPLAIN ANALYZE results for both strategies.
  - Measure p95 latency under 1,000 row load.
- **Alternatives**: Supabase/Neon extensions, Algolia (out of scope), simple `ILIKE` (likely too slow).
- **Follow-up**: Apply index in migration, ensure search contract notes trigram expectations, and add performance monitoring snippet in quickstart.

### 4. Motion & Reduced-Motion Tokens
- **Question**: Which easing curves and tokens satisfy premium feel while respecting prefers-reduced-motion?
- **Decision**: Resolved — standardize on Framer Motion `easeOut` 180 ms enter / 160 ms exit transitions with opacity fade; reduce-motion users receive fade-only.
- **Rationale**: Need consistent, testable motion spec supporting <200 ms animations and accessible fallbacks.
- **Investigation**:
  - Audit existing design tokens or liaise with design to confirm ease values.
  - Prototype card enter/exit animations and record durations.
- **Alternatives**: Custom cubic-bezier curves, CSS transitions without Framer Motion.
- **Follow-up**: Codify tokens in dedicated motion config, add QA checklist step verifying reduce-motion behavior.

### 5. Analytics & Privacy Scope
- **Question**: Do we log search queries (IdeaSearchAudit) or aggregate only?
- **Decision**: Resolved — log aggregated events via Vercel Analytics only; omit IdeaSearchAudit table unless future compliance requires it.
- **Rationale**: Logging raw queries may contain sensitive text; aggregated metrics reduce privacy concerns.
- **Investigation**:
  - Review privacy guidelines; consult stakeholders on analytics requirements.
  - Evaluate Vercel Analytics vs. custom logging for event granularity.
- **Alternatives**: Full audit table, ephemeral telemetry, no search logging.
- **Follow-up**: Note optional audit table as feature-flagged in data model and quickstart; ensure analytics events include latency metrics.

### 6. Rate Limiting Mechanism
- **Question**: Implement rate limiting via Upstash Redis or custom in-memory tokens?
- **Decision**: Resolved — integrate `@upstash/ratelimit` (sliding window) backed by Upstash Redis; enforce per-user quotas aligned with contracts.
- **Rationale**: Need resilient rate limiting across serverless instances to meet security mandates.
- **Investigation**:
  - Validate Upstash integration with Next.js Server Actions and environment setup.
  - If using custom solution, design Drizzle-backed counters.
- **Alternatives**: Without rate limit (violates constitution), Vercel Edge config.
- **Follow-up**: Add Upstash env setup to quickstart and create reusable limiter helper in `lib/utils/rate-limit.ts`.

## Next Steps
- Implement migrations, cron schedule, and rate limiter helpers per decisions documented above.
- Monitor performance/telemetry post-launch; revisit analytics logging or search strategy if metrics degrade.
- No research blockers remain for `/tasks`.
