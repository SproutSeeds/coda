Develop the full technical implementation plan for the **IdeaVault MVP** — a lightweight, single-user web app that lets authenticated users add, search, and delete project ideas (title + notes).  
Focus on **how** the feature will be built: architecture, stack, scaffolding, data model, workflows, and quality gates — all while staying compliant with the project constitution.

**Primary goal:** translate the existing functional specification into a step-by-step execution blueprint that guarantees a runnable application from a fresh clone and makes coding, testing, and deployment predictable.

---

### 0. Gate G0 — Scaffold (One-Time, Mandatory)
Before any implementation tasks run, the repository **must contain a valid Next.js App Router scaffold** consistent with the constitution.  
If missing, include **T000 – Scaffold Next.js app** in the tasks list with the following commands:

- `git rev-parse --is-inside-work-tree || git init`
- `pnpm dlx create-next-app@latest . --ts --app --use-pnpm --eslint --tailwind --import-alias "@/*"`
- `pnpm add framer-motion lucide-react clsx tailwind-merge class-variance-authority`
- `pnpm dlx shadcn@latest init && pnpm dlx shadcn@latest add button input textarea card label form toast separator`
- `pnpm add drizzle-orm postgres && pnpm add -D drizzle-kit`
- `pnpm add zod drizzle-zod`
- `pnpm add next-auth bcryptjs`
- `pnpm add @upstash/ratelimit @upstash/redis`
- Create dirs `lib/{db,auth,validations,utils}`, `scripts`, `tests/{unit,e2e}`
- Add minimal `drizzle.config.ts` and `lib/db/schema.ts`
- Extend `.gitignore` with `.env*`, `node_modules/`, `.next/`, `.drizzle/`, `.specify/memory/`
- Touch sentinel `.specify/memory/scaffold.ok` to mark completion.

Acceptance for G0:
- `package.json` and `pnpm-lock.yaml` exist with valid scripts.  
- `app/` renders via `pnpm dev`.  
- Tailwind + shadcn initialized.  
- Sentinel present → subsequent runs skip T000.

---

### 1. Confirmed Context
The previous /specify step defined functional behavior; the constitution fixes our stack and quality standards.  
Phase 0–2 drafts exist and must now be finalized.  
Artifacts to update: `research.md`, `data-model.md`, `quickstart.md`, `contracts/`.

---

### 2. Required Technology Stack (per Constitution)
- **Framework + Language:** Next.js (App Router) + TypeScript (strict).  
- **Rendering:** React Server Components + SSR/SSG; Server Actions for mutations.  
- **Runtime:** Node default; Edge only for DB-free routes.  
- **UI System:** Tailwind CSS + shadcn/ui (Radix); lucide-react icons.  
- **Motion:** Framer Motion (150–200 ms transform/opacity transitions).  
- **Database:** PostgreSQL (Vercel Postgres primary, Neon optional).  
- **ORM & Migrations:** Drizzle ORM + Drizzle Kit.  
- **Auth:** Auth.js (NextAuth) with Credentials + GitHub OAuth; bcryptjs ≥ 12.  
- **Validation:** Zod (+ drizzle-zod).  
- **Client State:** Server Actions/RSC preferred; @tanstack/react-query only for polling or optimistic flows.  
- **Rate Limiting:** Upstash Redis (`@upstash/ratelimit`, `@upstash/redis`).  
- **CI/CD:** GitHub Actions (typecheck, lint, build) + Vercel Previews/Prod deploys.  
- **Analytics:** Vercel Analytics default; Sentry/PostHog optional later.  
- **Performance/A11y:** LCP < 2.5 s, CLS ≈ 0, TTI ≤ 2 s, WCAG AA.

---

### 3. Architecture & Structure
- **Frontend Routes:** `/login`, `/dashboard/ideas`.  
- **Server Actions:** `addIdea`, `listIdeas`, `searchIdeas`, `deleteIdea`, `restoreIdea`.  
- **Data Flow:** describe create/list/search/delete loops and cache revalidation.  
- **Auth Flow:** session retrieval, protected actions, redirects.  
- **Error Handling:** Zod validation + empty/error/loading states.  
- **Motion:** enter/exit animations and prefers-reduced-motion support.  

---

### 4. Data Model (to finalize in data-model.md)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | auto |
| user_id | uuid | FK → auth user |
| title | text NOT NULL | ≤ 200 chars, sanitized |
| notes | text | Markdown, sanitized |
| deleted_at | timestamptz NULL | soft delete |
| created_at | timestamptz DEFAULT now() |  |
Indexes: `(user_id, created_at desc)` + trigram (title, notes).  
Include undo token lifecycle and audit logging (off by default).

---

### 5. Research Decisions to Close (finalize and record)
- **Note format:** Sanitized Markdown.  
- **Undo persistence:** soft-delete + purge cadence (document policy).  
- **Search indexing:** trigram.  
- **Motion tokens:** centralized token set in `motion.ts`.  
- **Analytics scope:** idea_created, idea_deleted, search_performed.  
- **Rate limiting:** Upstash limit middleware per user/session.  
Cross-link final choices to `research.md` and `data-model.md`.

---

### 6. Testing & Quality Gates
- **Vitest:** unit tests for validators and server actions.  
- **Playwright:** e2e for login, CRUD, undo, search, delete.  
- **A11y:** keyboard flow, ARIA labels, focus visible.  
- **Perf:** LCP < 2.5 s, CLS ≈ 0, TTI ≤ 2 s.  
- **CI/CD:** typecheck, lint, build green; preview deploy on PR.  

---

### 7. Observability & Analytics
- Log server-action latency and DB query time.  
- Emit analytics events for create/delete/search.  
- Track a11y + perf budget metrics.  

---

### 8. Rollout Plan
- Environments: Dev → Preview → Prod.  
- Migrations: Drizzle generate + migrate; postbuild guarded by `VERCEL_ENV`.  
- Analytics/monitoring enabled Preview + Prod.  
- Feature flags for risky flows; cleanup documented in tasks.  

---

### 9. Acceptance Criteria for this Plan
- Scaffold (T000) complete → `.specify/memory/scaffold.ok` exists.  
- All research topics resolved or explicitly deferred with rationale.  
- Constitution check pass (performance, accessibility, structure).  
- `plan.md` references data-model, contracts, quickstart, research.  
- Progress tracking shows Phase 0–2 complete.  
- Ready for `/tasks` generation.  

---

### Output Expectations
The workflow should generate or refresh:
- `specs/001-build-a-lightweight/plan.md`  — finalized plan  
- `specs/001-build-a-lightweight/research.md`  — updated decisions  
- `specs/001-build-a-lightweight/data-model.md`  — final schema  
- `specs/001-build-a-lightweight/contracts/*`  — validated API/server actions  
- `specs/001-build-a-lightweight/quickstart.md`  — developer runbook  
and report the BRANCH and SPECS_DIR on completion.  

---

### Closing Note
This plan must keep **constitution compliance front-and-center**, verify the scaffold gate (G0) is satisfied, update all supporting artifacts, and explicitly transition the project into the **/tasks** phase with no open research blockers.