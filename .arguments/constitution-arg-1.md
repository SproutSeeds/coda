SOURCE OF TRUTH
Use the following Tech Stack Decision Record (TSDR) as the canonical content to update the project constitution.
All rules, defaults, and guardrails below are MANDATORY unless amended via governance.

PROJECT FACTS
- PROJECT_NAME: Coda Platform / Ideas Engine
- ORGANIZATION_NAME: Playsol / RoyalWavs
- PRIMARY_HOST: Vercel (auto-deploy on push)
- DATABASE_PROVIDER: Vercel Postgres (default), Neon (allowed variant)
- AUTH_PROVIDER: Auth.js (NextAuth) with Credentials + GitHub OAuth
- RATIFICATION_DATE: TODO(RATIFICATION_DATE): If known from prior file, keep it; if unknown, insert the original ratification date when available.
- LAST_AMENDED_DATE: today (ISO)
- CONSTITUTION_VERSION:
  - If this is the first constitution: set to 1.0.0
  - Else decide bump type:
    * MAJOR for breaking principle changes/removals
    * MINOR for added/expanded principles/sections
    * PATCH for clarifications/wording fixes
  - If ambiguous, choose MINOR and note rationale in the Sync Impact Report.

PRINCIPLES & MANDATES (from TSDR)
1) Overview
- Application type: Modern web apps (marketing → SaaS dashboards)
- Priorities: fast iteration, excellent performance, premium motion, portable auth, minimal lock-in, easy CI/CD
- Primary host: Vercel with automatic deployments on every push

2) Core Stack (FINAL, REQUIRED)
- Frontend & Runtime: Next.js (App Router) + TypeScript (strict). Rendering via RSC + SSR/SSG; mutations via Server Actions.
  Default runtime = Node; use Edge ONLY for DB-free routes.
- Styling & Design System: Tailwind CSS + shadcn/ui (Radix primitives we own). Icons: lucide-react.
- Motion / Animations: Framer Motion for page transitions, enter/exit, micro-interactions.
  Use transform/opacity where possible; micro-transitions 150–200 ms.
- Data Layer: PostgreSQL. Primary host = Vercel Postgres; allowed variant = Neon Serverless (HTTP/WebSocket driver or multi-project sharing).
  ORM & migrations: Drizzle ORM + Drizzle Kit.
- Authentication: Auth.js (NextAuth) — Credentials + GitHub OAuth by default. Password hashing: bcryptjs (≥12 rounds).
- Fetching & Client State: Prefer Server Actions + RSC. Use @tanstack/react-query per-feature only when polling or optimistic updates are required.
- Validation: Zod for runtime validation; derive schemas from Drizzle via drizzle-zod to prevent drift.
- Testing & Quality: ESLint + Prettier (tailwind + import-sort); TypeScript --noEmit; Vitest (unit); Playwright (e2e when flows stabilize).
- Observability & Analytics: Vercel Analytics by default; add Sentry/PostHog when product matures.
- CI/CD: GitHub Actions gate (typecheck, lint, build) on PRs. Vercel: Preview on PR, Production on merge to main.
  Optionally run Drizzle migrate postbuild in production (guarded by env) or manual release step.

3) Repository Conventions (REQUIRED)
- Structure:
  app/            # routes, layouts, server/client components
  components/     # shadcn primitives + feature components
  lib/
    auth/         # Auth.js config and helpers
    db/           # drizzle client, schema, migrations config
    validations/  # zod schemas (or generated via drizzle-zod)
    utils/        # misc helpers
  public/
  styles/         # globals.css (tailwind)
  scripts/        # deploy/migrate scripts
  tests/
    unit/
    e2e/
- TypeScript: "strict": true; path alias @/* → project root
- Prettier: plugins = prettier-plugin-tailwindcss, @ianvs/prettier-plugin-sort-imports;
  import order = React/Next → third-party → @/* → relative
- Branching: trunk-based; feature branches (feat/*) → PR → main; require green CI + Vercel Preview OK before merge

4) Environments & Secrets (REQUIRED)
- Baseline env vars: DATABASE_URL, NEXTAUTH_SECRET (stable random), NEXTAUTH_URL (prod domain or http://localhost:3000 in dev),
  GITHUB_ID, GITHUB_SECRET.
- Define in Vercel for Production, Preview, Development. Use .env.local for local dev (never commit).

5) Deployment (VERCEL, AUTO ON PUSH) (REQUIRED)
- Connect GitHub repo to Vercel (Production branch = main).
- Add Vercel Postgres integration; ensure DATABASE_URL present in Preview/Prod.
- CI at .github/workflows/ci.yml runs typecheck/lint/build on PRs.
- Auto-deploys:
  * push → Preview build & URL
  * merge to main → Production deploy
- Migrations:
  * A: Postbuild Drizzle migrate (prod only; guard with VERCEL_ENV === "production") [DEFAULT]
  * B: Manual one-off CLI during release

6) Defaults & Guardrails (REQUIRED)
- Runtime: Node by default; Edge only for stateless pages/functions
- Security:
  * Hash passwords with bcrypt (≥12)
  * Never expose secrets client-side
  * Rate-limit auth endpoints (Vercel middleware)
  * Validate inputs with Zod before DB ops
- Accessibility:
  * Follow Radix/shadcn patterns; visible focus; aria labels; contrast ≥ WCAG AA
- Performance:
  * CLS ≈ 0; LCP < 2.5 s on mid-tier device
  * Keep client bundles lean; prefer RSC + Server Actions
  * Animations: transform/opacity; avoid layout thrash

7) Scaffold & Bootstrap (MANDATORY, ONE-TIME PER REPO)
- Purpose: guarantee a working Next.js workspace before any implementation tasks run.
- Gate G0: **Scaffold MUST exist** before tasks ≥ T001 execute.
- Sentinel: `.specify/memory/scaffold.ok` indicates scaffold is present; if found, skip re-scaffold.
- Allowed commands for agents (when G0 unmet):
  - `git rev-parse --is-inside-work-tree || git init`
  - `pnpm dlx create-next-app@latest . --ts --app --use-pnpm --eslint --tailwind --import-alias "@/*"`
  - `pnpm add framer-motion lucide-react clsx tailwind-merge class-variance-authority`
  - `pnpm dlx shadcn@latest init`
  - `pnpm dlx shadcn@latest add button input textarea card label form toast separator`
  - `pnpm add drizzle-orm postgres && pnpm add -D drizzle-kit`
  - `pnpm add zod drizzle-zod`
  - `pnpm add next-auth bcryptjs`
  - *(Optional per plan)* `pnpm add @upstash/ratelimit @upstash/redis`
  - Create dirs: `lib/{db,auth,validations,utils}`, `scripts`, `tests/{unit,e2e}`
  - Create `drizzle.config.ts` and placeholder `lib/db/schema.ts`
  - Write `.gitignore` entries:
    ```
    .env*
    node_modules/
    .next/
    .drizzle/
    .specify/memory/
    ```
  - `touch .specify/memory/scaffold.ok`
  - Commit: `chore: scaffold Next.js app per constitution`
- Acceptance for scaffold:
  - `app/` exists; `pnpm dev` runs
  - Tailwind + shadcn initialized
  - `drizzle.config.ts` present; `lib/db/schema.ts` file created
  - `package.json` scripts include: dev, build, start, typecheck, lint, drizzle:gen, drizzle:migrate
  - Sentinel file present

8) Golden-Path Commands (REFERENCE; DO NOT COPY INTO CONSTITUTION TEXT)
- Initialize (if fresh):
  pnpm dlx create-next-app@latest my-app --ts --app --use-pnpm --eslint --import-alias "@/*"
  cd my-app
- Tailwind + shadcn:
  pnpm add -D tailwindcss postcss autoprefixer prettier prettier-plugin-tailwindcss @ianvs/prettier-plugin-sort-imports
  pnpm dlx tailwindcss init -p
  pnpm dlx shadcn@latest init
  pnpm dlx shadcn@latest add button input textarea card form label toast separator
- Motion, validation, forms:
  pnpm add framer-motion zod react-hook-form
- Data:
  pnpm add drizzle-orm postgres
  pnpm add -D drizzle-kit
- Auth:
  pnpm add next-auth bcryptjs
- Optional client-state cache:
  pnpm add @tanstack/react-query
- Drizzle:
  pnpm dlx drizzle-kit generate
  pnpm dlx drizzle-kit migrate

9) Definition of Done (DoD) (REQUIRED)
- Auth: Credentials + GitHub OAuth working end-to-end
- DB: Postgres reachable; Drizzle migrations applied in Preview & Prod
- CRUD demo slice (Ideas): server actions; Zod-validated; optimistic UX where appropriate
- Motion: page transition + list enter/exit under 200 ms
- CI: Green (typecheck/lint/build)
- Vercel: Auto Preview per PR; Production on main merge
- Lighthouse: Perf/Best-Practices/SEO/A11y ≥ 90 on a representative page

10) Allowed Variations (WITH JUSTIFICATION)
- Neon instead of Vercel Postgres (multi-region / HTTP driver needs)
- Clerk instead of Auth.js (hosted orgs/SSO mandatory)
- tRPC (heavy typed client↔server contract)
- Sentry/PostHog (telemetry required)

INSTRUCTIONS TO THE AGENT
- Load `.specify/memory/constitution.md` (template), detect all [ALL_CAPS] tokens, and fill them using the mandates above.
  Leave no unexplained placeholders; if something must remain undefined, include explicit justification.
- Preserve heading hierarchy. Convert vague language into MUST/SHOULD with rationale.
- Ensure a Governance section exists (amendment procedure, semantic versioning, compliance cadence).
- Versioning: compute CONSTITUTION_VERSION per rules; set LAST_AMENDED_DATE to today (ISO). If RATIFICATION_DATE is unknown,
  keep prior value or leave TODO(RATIFICATION_DATE) and list it in the Sync Impact Report.
- **Propagate Scaffold Gate:** update plan/spec/tasks templates so Gate G0 (scaffold) is a hard prerequisite; ensure tasks template includes **T000 — Scaffold base Next.js app** with the acceptance and sentinel rules above.
- Prepend a Sync Impact Report (HTML comment) with: old→new version; renamed/added/removed sections; templates updated (✅)/pending (⚠) with paths; deferred TODOs.
- Validate before write: no stray bracket tokens; ISO dates; version line matches report; principles are declarative/testable.
- Overwrite `.specify/memory/constitution.md` and output: new version + bump rationale; files needing follow-up; suggested commit message:
  docs: amend constitution to vX.Y.Z (stack + scaffold mandate + governance update)