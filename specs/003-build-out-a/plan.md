# Implementation Plan: Bulk JSON Idea Import

**Branch**: `003-build-out-a` | **Date**: 2025-10-11 | **Spec**: [/specs/003-build-out-a/spec.md](specs/003-build-out-a/spec.md)
**Input**: Feature specification from `/specs/003-build-out-a/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (default: Next.js web app)
   → Set Structure Decision based on constitution-mandated layout
3. Fill the Constitution Check section using the latest constitution mandates.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md; update any agent context file as needed
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Add an "Import ideas" control beside the existing export action on the dashboard so workspace owners can upload a JSON bundle that matches the platform’s export schema. The flow validates the file, shows a diff of new versus existing ideas/features, prompts for duplicate-title decisions, updates only changed fields, and then reports the results while leaving untouched content intact.

## Technical Context
**Language/Version**: TypeScript 5.x with strict mode  
**Primary Dependencies**: Next.js 14 App Router, Tailwind CSS + shadcn/ui, lucide-react, Framer Motion, Auth.js (credentials + magic link), Drizzle ORM with drizzle-zod, Upstash Redis rate limiting  
**Storage**: PostgreSQL (Neon for remote dev, Vercel Postgres in prod) accessed via Drizzle  
**Testing**: Vitest (unit, contract) and Playwright (E2E) with Lighthouse smoke checks  
**Target Platform**: Vercel-hosted Next.js web application  
**Project Type**: Single Next.js App Router web app following mandated repo structure  
**Performance Goals**: LCP < 2.5s, CLS ≈ 0, Framer Motion transitions 150–200 ms, Lighthouse ≥ 90 across categories  
**Constraints**: Server Actions for mutations, Auth.js session requirements, rate-limited file uploads, JSON schema parity with export flow, update-only diff for duplicates, maintain undo/store integrity  
**Scale/Scope**: Expect workspaces to import dozens to hundreds of ideas (JSON payload up to ~5 MB); operations must remain responsive and capped by existing pagination limits

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Stack Alignment**: Remains on Next.js App Router with strict TypeScript, Tailwind + shadcn/ui, lucide-react icons. Import UI will reuse existing client components, and the heavy lifting stays in Server Actions.
- **Data & Validation**: Extends Drizzle models and drizzle-zod validation to parse the import payload. No alternate data stores introduced.
- **Deployment**: No change—feature ships through existing Vercel preview→production pipeline with Drizzle migrations unaffected (import reuses existing tables).
- **Environment & Security**: Continues using existing Auth.js credentials, bcrypt policy, and Upstash middleware; file uploads limited to JSON and validated server-side to prevent injection.
- **Quality Gates**: Plan includes new Vitest contract tests and Playwright coverage for import diff + duplicate decisions; CI already runs lint/typecheck/build.
- **Definition of Done**: Import flow will honor undo safeguards, Framer Motion polish, and maintain Lighthouse ≥ 90 (no heavy client bundle additions).
- **Performance & Accessibility**: Diff summary work executes server-side with streaming feedback; UI follows WCAG AA focus/ARIA patterns and existing interactive button effects.
- **Exceptions**: None; Neon remains allowed with documented SSL handling.

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
app/
├── (routes, layouts, server/client components)
components/
├── (shadcn primitives + feature components)
lib/
├── auth/
├── db/
├── validations/
└── utils/
public/
styles/
scripts/
```

**Structure Decision**: Follow the mandated repository layout (App Router components in `app/`, shared UI in `components/`, data access in `lib/db/`, validations in `lib/validations/`). Import-specific server actions live under `app/dashboard/ideas/actions/`, while client UI enhancements stay in `app/dashboard/ideas/components/`.

## Phase 0: Outline & Research
- Captured open questions around payload schema, conflict detection, UX feedback, and observability.
- Documented decisions in [`research.md`](specs/003-build-out-a/research.md): reuse export schema with `schemaVersion`, enforce 5 MB size cap, title-based conflict prompts that merge by primary keys, confirmation modal with diff summary, and atomic failure semantics with analytics events.
- Alternatives (free-form schema, immediate import, partial success) were evaluated and rejected to protect data integrity and user control.

**Status**: ✅ Research recorded in `research.md`; no unresolved clarifications remain.

## Phase 1: Design & Contracts
*Prerequisites: research.md complete — satisfied*

- Modelled import entities and telemetry in [`data-model.md`](specs/003-build-out-a/data-model.md), covering IdeaImportBundle, FeatureImportItem, ImportEnvelope, DiffSummary, ConflictDecision, and analytics events.
- Authored Server Action contract in [`contracts/import-ideas.md`](specs/003-build-out-a/contracts/import-ideas.md) describing preview/commit responses and failure codes.
- Curated the developer flow in [`quickstart.md`](specs/003-build-out-a/quickstart.md) with smoke steps, negative case, and command checklist.
*Agent Context Note*: Sync AGENTS.md or other context files with new decisions (optional).
- Upcoming tests to author in Phase 2: Vitest contract suite for `importIdeasAction` and Playwright scenario covering preview, conflict resolution, and commit.

**Status**: ✅ Design artefacts generated; ready for task decomposition.

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
  Derive tasks directly from research/design artefacts (no external template).
- Derive contract tests for `importIdeasAction` (preview + commit) and validation helpers.
- Add Drizzle/zod schema tasks for import envelope and diff mapping.
- Sequence UI tasks for new button, modal, and toasts after server-side pieces; mark independent client/UI updates as `[P]` when safe.
- Ensure Playwright scenario covers upload, conflict dialog, and summary toast; Lighthouse run remains in polish phase.

**Ordering Strategy**:
- Enforce TDD: contract/unit tests before implementing server action; UI tests before wiring components.
- Process order: validation utilities → server action → analytics → UI integration → documentation updates.
- Use `[P]` for tasks that touch disjoint files (e.g., analytics event wiring vs. modal styling).

**Estimated Output**: ~26 tasks spanning validation, server action, UI, tests, analytics, and docs.

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _None_ | — | — |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [X] Phase 0: Research complete (/plan command)
- [X] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [X] Initial Constitution Check: PASS
- [X] Post-Design Constitution Check: PASS
- [X] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
