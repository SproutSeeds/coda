Desired Outcome:
- Extend the authentication system so Coda supports passwordless email sign-in alongside the existing GitHub OAuth integration, powered by Auth.js’ Email provider with Drizzle-managed persistence. Users should be able to request a magic-link via email, confirm the link, and reach `/dashboard/ideas` while meeting FR-1 in `specs/001-build-a-lightweight/spec.md`.

Key Constraints & Considerations:
- Preserve the mandated tech stack (Next.js App Router, Drizzle ORM, Auth.js, Tailwind, shadcn/ui) and existing undo/search guarantees documented in the spec (FR-2…FR-7).
- Maintain TDD discipline: update Playwright + Vitest suites to cover both GitHub OAuth and email magic-link paths before refactoring implementation.
- Keep the owner-token dev shortcut available behind the `ENABLE_DEV_LOGIN` flag for automated tests, but gate it to non-production environments.
- Ensure new tables/migrations for Auth.js adapters comply with Drizzle conventions (`specs/001-build-a-lightweight/data-model.md`) and document changes in `specs/001-build-a-lightweight/quickstart.md` + README deployment guidance.
- Preserve rate limiting and analytics instrumentation for auth flows (see constitution mandates and plan Quality Expectations).

References:
- `specs/001-build-a-lightweight/spec.md` FR-1 (authentication requirement), Quality Expectations, and Test Plan sections.
- `specs/001-build-a-lightweight/quickstart.md` + `plan.md` for environment setup and auth expectations.
- Current auth tasks (T016, T037) in `specs/001-build-a-lightweight/tasks.md` to extend/adjust.
