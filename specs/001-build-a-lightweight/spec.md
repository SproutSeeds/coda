# Title
Coda MVP Specification

**Feature Branch**: `001-build-a-lightweight`  
**Created**: 2025-10-04  
**Status**: Draft  
**Input**: User description from `.arguments/specify-arg-1.md`

## Clarifications

### Session 2025-10-05
- Q: Should Coda allow users to edit an existing idea after it’s been created? → A: Yes — users can edit both title and notes anytime

## Summary
Coda enables authenticated individuals to capture and retrieve personal project ideas in a focused workspace. The MVP delivers quick idea capture, chronological review, lightweight search, and confident cleanup so users can remember and revisit inspiration without friction.

## Goals
- Provide a trustworthy personal idea vault where entries are private to the author.
- Minimize cognitive load with immediate capture, ordered recall, and relevant filtering.
- Deliver a polished experience with responsive interactions, motion cues, and reassuring empty states.
- Establish measurable success criteria for performance, accessibility, and release readiness.

## Non-Goals
- Collaborative features such as shared vaults, commenting, or team workflows.
- Tagging, categories, or advanced metadata beyond title and rich notes.
- Offline support, native mobile clients, or push notifications.
- Integration with external productivity tools or import/export capabilities.

## Personas & User Stories
- **Solo Maker (primary)**: As an independent builder, I want to jot down an idea with context in seconds so that I never lose a spark of inspiration.
- **Product Strategist**: As a strategist juggling multiple initiatives, I want to scan recent ideas sorted by recency so that I can prioritize the most actionable concepts.
- **Returning User**: As a returning user, I want to search using keywords so that I can recover an older idea without scrolling through the entire list.
- **Decluttering User**: As a user refining my backlog, I want to delete ideas I no longer value so that my workspace stays relevant.

## Functional Requirements
- **FR-1**: The system MUST require the user to be authenticated before viewing or modifying ideas; unauthenticated visitors MUST be routed to the sign-in flow.
- **FR-2**: The system MUST allow an authenticated user to create an idea with a required title (≤120 characters) and rich-text notes (≤5,000 characters) and save it in under 300 ms server processing time.
- **FR-3**: The system MUST display the user’s own ideas in reverse chronological order (newest first) with pagination or infinite scroll once the list exceeds 20 items.
- **FR-4**: The system MUST provide keyword search that returns only ideas where the query matches title or notes (case-insensitive, partial matches) and respond within 400 ms on a dataset of 1,000 ideas per user.
- **FR-5**: The system MUST allow deletion of any idea owned by the signed-in user and immediately remove it from the visible list with an “Undo” affordance lasting 10 seconds.
- **FR-8**: The system MUST allow users to edit existing ideas (title and notes) with validations identical to creation and update `updated_at`.
- **FR-6**: The system MUST show empty, loading, error, and success states with motion cues that complete within 200 ms and comply with the constitution’s animation guardrails.
- **FR-7**: The system MUST maintain Lighthouse scores ≥90 for Performance, Accessibility, Best Practices, and SEO on the ideas list view under mid-tier 4G network conditions.

## Out of Scope
- Multi-user visibility into another person’s ideas.
- Bulk import/export, CSV downloads, or integrations with note-taking tools.
- Idea tagging, favoriting, or status workflows.
- AI-assisted summarization or recommendation features.

## Data Model
- **User** (existing Auth.js identity)  
  Fields: `id` (UUID), `email` (string), `created_at` (timestamp).
- **Idea**  
  Fields: `id` (UUID, primary key); `user_id` (UUID, foreign key → User.id); `title` (varchar 120, not null); `notes` (text, not null); `created_at` (timestamp with timezone, default now); `updated_at` (timestamp with timezone, default now, auto-managed on edits).  
  Indexes: `(user_id, created_at DESC)` for list ordering; `GIN` or `trigram` index on `title` and `notes` for search.  
  Constraints: Title required, notes required, cascade delete on user removal.
- **IdeaSearchAudit** (optional event log if analytics require raw query tracking)  
  Fields: `id`, `user_id`, `query`, `results_count`, `queried_at`.

## APIs & Integration Points
- **POST /api/ideas** (Auth required)  
  Request: `{ title: string, notes: string }`  
  Response: `{ id, title, notes, createdAt, updatedAt }` with 201 Created.  
  Errors: 400 validation failure, 401 unauthenticated.
- **GET /api/ideas?cursor&limit** (Auth required)  
  Returns paginated list ordered newest first; includes `items[]`, `nextCursor`.  
  Errors: 401 unauthenticated.
- **GET /api/ideas/search?q=&cursor&limit** (Auth required)  
  Returns filtered results matching `q`.  
  Errors: 400 missing query, 401 unauthenticated.
- **DELETE /api/ideas/{id}** (Auth required)  
  Soft delete with undo support (Server Action or API returns deletion token).  
  Errors: 401 unauthenticated, 403 if idea not owned, 404 if not found.
- **POST /api/ideas/{id}/restore** (Auth required)  
  Restores idea within undo window.
- Integrations: Authentication via Auth.js email magic links + password credentials; analytics via Vercel Analytics event hooks; optional telemetry via Sentry/PostHog per constitution.

## UX Flows & Wireframes (Low-Fi OK)
- **Create Idea Flow**: Dashboard → “New Idea” button → Modal or inline form (title, notes) → Save → Success toast → New card animates into list top with 150–200 ms motion. Validation errors inline per field.
- **List & Browse Flow**: User lands on Ideas list → Loading shimmer for ≤500 ms → Cards display newest first → Scrolling fetches more when 80% down → Empty state with CTA when zero ideas.
- **Search Flow**: User enters query in header search field → Debounced request (≤150 ms) → Results animate in with cross-fade → “No matches” empty state if zero results.
- **Delete Flow**: User selects Delete from card menu → Confirmation prompt → Item slides out with fade (≤200 ms) → Snackbar with Undo button; Undo reinstates card in place.

## Accessibility
- Keyboard-first navigation for creating, viewing, searching, and deleting ideas with focus outlines and logical tab order.
- ARIA labels on interactive controls (new idea button, delete menu, undo snackbar).
- Empty states include descriptive text and icons with sufficient contrast (WCAG AA, contrast ratio ≥4.5:1).
- Motion preferences respected: reduce-motion users receive fade-only transitions.
- Form fields announce errors via `aria-live` polite regions.

## Performance & SLAs
- Time to Interactive ≤2.0 s on mid-tier 4G, 3G fallback gracefully degraded.
- Server response for create, list, search, delete endpoints ≤400 ms p95 with 1,000 ideas per user.
- Idea list initial payload ≤200 KB compressed by preferring streamed Server Components and avoiding redundant client bundles.
- Animations complete within 200 ms; idle tasks scheduled post-interaction.
- Lighthouse metrics ≥90 across categories for the ideas list route.

## Security & Privacy
- Enforce per-user data isolation; requests scoped by authenticated `user_id` in Server Actions/APIs.
- Input validation for title and notes to prevent script injection; notes rendered with safe markdown or sanitized rich text.
- Rate-limit create, search, and delete actions (baseline 60 requests/min per user) to mitigate abuse.
- Store secrets (database URL, NEXTAUTH_SECRET) in environment variables per constitution; never expose them client-side.
- Purge soft-deleted ideas permanently after 30 days (configurable) and document retention policy.

## Observability & Analytics
- Events: `idea_created`, `idea_deleted`, `idea_restored`, `idea_searched`, `idea_viewed_empty_state` with user anonymized identifier.
- Metrics: daily active creators, search success rate (% queries returning ≥1 result), undo usage rate.
- Logs: structured logs for API actions including latency, user_id, and outcome status.
- Dashboards in Vercel Analytics; escalate to Sentry/PostHog when error rate >1% of requests in a day.

## Rollout & Migration
- **Dev**: Implement feature branch, seed test data, run automated suites locally.
- **Preview (Vercel)**: Deploy behind feature flag `coda.enabled`; enable QA reviewers; monitor analytics.
- **Production**: Gradually enable flag (10% increments) after verifying metrics and Lighthouse.
- **Migrations**: Generate Drizzle migration for `ideas` table (and optional audit table), apply via postbuild migrate in production; include rollback script to drop new tables if needed.
- **Cleanup**: Remove feature flag and audit-only logging once adoption metrics stable.

## Acceptance Criteria
- **AC-1 (FR-1, FR-2)**
  ```gherkin
  Given an unauthenticated visitor
  When they attempt to open the ideas dashboard
  Then they are redirected to the sign-in experience before any idea content loads
  ```
- **AC-2 (FR-2, FR-3)**
  ```gherkin
  Given an authenticated user on the ideas dashboard with existing entries
  When they submit a valid title and notes
  Then the new idea appears at the top of the list with a confirmation toast within 500 ms
  ```
- **AC-3 (FR-4)**
  ```gherkin
  Given an authenticated user with at least 10 ideas containing varied keywords
  When they search for a keyword present in the notes of one idea
  Then only matching ideas display and results return within 400 ms
  ```
- **AC-4 (FR-5, FR-6)**
  ```gherkin
  Given an authenticated user viewing the ideas list
  When they delete an idea
  Then the idea animates out within 200 ms and an undo snackbar stays visible for 10 seconds
  ```
- **AC-5 (FR-7)**
  ```gherkin
  Given Lighthouse smoke tests on the ideas list page under 150 ms RTT and 1.6 Mbps throughput
  When the page loads with 20 ideas
  Then Performance, Accessibility, Best Practices, and SEO scores each meet or exceed 90
  ```

## Test Plan
- **Automated**: Vitest unit tests for idea validation, search filtering logic, undo timer; Playwright scenarios covering create, search, delete, undo, empty state; Lighthouse CI budget check.
- **Manual QA**: Accessibility walkthrough with keyboard-only and screen reader; animation review to confirm motion duration and reduce-motion handling; error-state simulations (network failure, validation errors).
- **Performance**: Run WebPageTest or Vercel Speed Insights on Preview build; verify server response times under seeded 1,000 idea dataset.
- **Security**: Validate authorization by attempting cross-user access; fuzz test inputs for script injection.

## Risks & Mitigations
- **Search performance degradation with large notes** → Implement indexed search and cap notes length; monitor query latency.
- **Undo flow inconsistency** → Persist deletion events with timestamp and ensure timer-driven cleanup job; add Playwright coverage.
- **Animation overload for sensitive users** → Respect prefers-reduced-motion and offer toggle in settings backlog.
- **Data loss during deletion** → Provide undo with clear feedback and log deletions for audit.

## Open Questions
- Should note content support basic formatting (markdown) or plain text only?
- What retention policy should apply to soft-deleted ideas after the 30-day window (permanent deletion vs. archive)?

## Glossary
- **Coda**: The product experience for capturing and managing personal ideas.
- **Idea Card**: Visual representation of an idea in the list, showing title and excerpted notes.
- **Undo Snackbar**: Temporary message allowing the user to reverse a deletion within the defined window.
- **Empty State**: UI shown when no ideas or search results exist for the current user.
