# Phase 0 Research — Custom Light & Dark Mode Preferences

## Decision Log

### 1. Persisting User Theme Preference
- **Decision**: Store a per-user theme record in PostgreSQL via Drizzle (`theme_preferences` table) with `theme` enum (`light` | `dark`) and `source` metadata.
- **Rationale**: Meets FR-002 requirement for cross-device persistence and aligns with constitution mandate to back data with Drizzle + Postgres.
- **Alternatives Considered**:
  - *LocalStorage only*: Rejected because it fails cross-device/clean session persistence.
  - *Auth.js session token*: Adds token bloat and risks stale cache; Postgres provides clearer lifecycle.

### 2. Theme Runtime Infrastructure
- **Decision**: Use `next-themes` provider with class-based switching to minimize hydration flash and respect system preference when no explicit choice exists.
- **Rationale**: Library is lightweight, works with App Router, and supports SSR hydration strategies; keeps implementation simple while meeting FR-003/FR-005.
- **Alternatives Considered**:
  - Custom context + cookie: more boilerplate and higher risk of hydration flicker; `next-themes` already solves.

### 3. Accessibility & Contrast Assurance
- **Decision**: Define shared design tokens for light and dark palettes, test with tooling (e.g., Stark or Tailwind contrast plugin) to guarantee WCAG AA for body text and controls.
- **Rationale**: Spec requires readability across modes; constitution mandates WCAG AA and premium motion/visual polish.
- **Alternatives Considered**:
  - Manual ad-hoc colors: too error-prone, no automated verification.

### 4. OS High-Contrast Handling
- **Decision**: Detect `forced-colors: active` via CSS and automatically defer to OS high-contrast rules while logging preference difference.
- **Rationale**: Aligns with clarification #3 and accessibility mandates; ensures we do not fight system-level accessibility.
- **Alternatives Considered**:
  - Prompt user for override: adds friction and risks non-compliance with accessibility expectations.

### 5. First-Load Prompt Behavior
- **Decision**: On first load without stored preference, render dark mode immediately and present a 10-second toast/banner countdown offering switch to light mode.
- **Rationale**: Matches clarification #1, provides gentle onboarding and ensures readability before user action.
- **Alternatives Considered**:
  - Modal blocking content: conflicts with fast iteration principle and could harm Lighthouse scores.

## Outstanding Questions
- None — all clarifications resolved in spec.

