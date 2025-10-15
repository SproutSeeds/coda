# Observability & Analytics

## Event Catalog

| Event | Trigger | Properties |
| --- | --- | --- |
| `idea_created` | Server action `createIdeaAction` | `ideaId` |
| `idea_updated` | Server action `updateIdeaAction` | `ideaId` |
| `idea_deleted` | Soft delete (ideas dashboard) | `ideaId` |
| `idea_restored` | Undo flow or recently deleted restore | `ideaId`, optional `source` |
| `idea_searched` | Search action in dashboard | `query` |
| `idea_reordered` | Drag reordering completes | `count` |
| `idea_starred` / `idea_unstarred` | Star toggle | `ideaId` |
| `feature_updated` | Feature edits via server action | `ideaId`, `featureId` |
| `feature_deleted` | Feature deletion | `featureId` |
| `feature_reordered` | Feature drag-and-drop reorder | `ideaId`, `count` |
| `suggestion_created` / `suggestion_updated` / `suggestion_deleted` | Suggestion board actions | `suggestionId` |
| `suggestion_restored` / `suggestion_purged` | Suggestion recover/purge flows | `suggestionId`, optional `source` |
| `suggestion_starred` / `suggestion_unstarred` | Suggestion star toggle | `suggestionId` |
| `suggestion_reordered` | Suggestion reorder | `count` |
| `suggestion_completed` / `suggestion_reopened` | Completion toggle | `suggestionId` |
| `ideas_import_attempt` | Import preview request succeeds | `ideaCount`, `featureCount`, `schemaVersion`, `conflicts` |
| `ideas_import_complete` | Import commit succeeds | `created`, `updated`, `skipped`, `duration` |
| `ideas_import_error` | Import preview/commit throws | `reason`, `validationErrors` |
| `auth_magic_link_requested` | Magic link request API | `email` |
| `auth_password_updated` | Password change | `userId` |

## Dashboard Recommendations
-
- Track import success ratio by plotting `ideas_import_complete` / (`ideas_import_complete` + `ideas_import_error`).
- Alert when `ideas_import_error` exceeds a rolling threshold or when `duration` (ms) crosses service-level budgets.
- Use `idea_restored` and `idea_purged` to ensure the undo cron is running. If events disappear, verify the Vercel Cron job and `CRON_SECRET` configuration.

## Logging Tips
- Server actions already surface stack traces in Vercel logs. Pair event data with request IDs for incident reports.
- When running locally, watch the Next.js terminal output for import validation errors—the import server action logs schema issues before throwing.
