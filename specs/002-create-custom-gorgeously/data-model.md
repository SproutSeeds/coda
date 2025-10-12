# Data Model — Custom Light & Dark Mode Preferences

## Theme Preference
- **Table**: `theme_preferences`
- **Description**: Stores the latest explicit theme choice made by a user.
- **Fields**:
  - `id` (uuid, primary key, default generated)
  - `user_id` (text, FK → `auth_user.id`, unique)
  - `theme` (enum: `light` | `dark`)
  - `source` (enum: `explicit` | `system-default` | `restored`)
  - `prompt_dismissed_at` (timestamptz, nullable) — records when the 10-second onboarding prompt was dismissed or acted upon.
  - `created_at` (timestamptz, default `now()`)
  - `updated_at` (timestamptz, default `now()`, updated via trigger)
- **Constraints**:
  - Unique index on `user_id` to ensure one record per user.
  - `theme` defaults to `dark` when inserted without explicit value (matches clarification #1).
  - `source` defaults to `system-default` on insert.
- **Relationships**:
  - `auth_user` (1:1) — cascades on delete to prevent orphan preferences.

## Derived State
- Theme preference is read on session load; if absent, dark mode is applied and the onboarding prompt is triggered.
- High-contrast OS detection does not mutate the table but is logged in telemetry for audits.

