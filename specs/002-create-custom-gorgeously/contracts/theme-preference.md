# Contract — updateThemePreference Server Action

## Summary
Allows an authenticated user to persist their explicit theme choice (light or dark).

## Endpoint
- **Type**: Next.js Server Action (`app/dashboard/account/actions.ts`)
- **Auth**: Requires active Auth.js session. Unauthorized requests return 401.

## Request
```ts
interface UpdateThemePreferenceRequest {
  theme: "light" | "dark";
  source?: "explicit" | "system-default" | "restored";
}
```
- `theme` is mandatory.
- `source` defaults to `explicit` when omitted.

## Response
```ts
interface UpdateThemePreferenceResponse {
  success: true;
  theme: "light" | "dark";
  effectiveSource: "explicit" | "system-default" | "restored";
}
```

## Error Cases
- `401 Unauthorized`: user session missing or expired.
- `422 Unprocessable Entity`: validation fails (invalid theme or source string).
- `500 Internal Error`: database failure; preference remains unchanged.

## Side Effects
- Upserts row in `theme_preferences` keyed by `user_id`.
- Emits telemetry event (`theme_preference.updated`).

## Tests (Phase 1 requirement)
1. Reject unauthenticated call with 401.
2. Accept valid payload for new user; preference row created with dark default when omitted.
3. Update existing preference and return new theme.
4. Reject invalid theme with 422.

