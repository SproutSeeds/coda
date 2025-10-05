# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

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
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (run `.specify/scripts/bash/update-agent-context.sh codex`)
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
[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context
**Language/Version**: [e.g., TypeScript 5.x]  
**Primary Dependencies**: [e.g., Next.js (App Router), Tailwind, Drizzle ORM]  
**Storage**: [PostgreSQL via Vercel Postgres/Neon]  
**Testing**: [Vitest, Playwright]  
**Target Platform**: [Vercel-hosted web app]  
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [LCP < 2.5s, CLS ≈ 0, etc.]  
**Constraints**: [e.g., Auth.js credentials + GitHub OAuth, motion polish <200 ms, etc.]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 50 dashboards or NEEDS CLARIFICATION]

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Stack Alignment**: Next.js App Router with strict TypeScript, Tailwind + shadcn/ui, lucide-react icons.  
- **Data & Validation**: PostgreSQL via Drizzle ORM/Kit with drizzle-zod schemas.  
- **Deployment**: Vercel Preview on every push; Production on merge to `main`; migrations handled via postbuild Drizzle migrate or approved manual flow.  
- **Environment & Security**: Baseline env vars present across environments; bcrypt ≥ 12 rounds; secrets never exposed client-side; auth endpoints rate-limited.  
- **Quality Gates**: Plan covers pnpm `typecheck`, `lint`, `build` in CI; Vitest + Playwright coverage strategy defined.  
- **Definition of Done**: Auth flows validated, optimistic CRUD slice, motion polish <200 ms, Lighthouse ≥ 90 in all categories.  
- **Performance & Accessibility**: RSC + Server Actions preference documented; WCAG AA contrast, focus states, and transform/opacity animations respected.  
- **Exceptions**: Any Neon, Clerk, tRPC, or telemetry deviations justified with explicit rationale.

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

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration (Auth.js, Drizzle, motion, analytics) → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each constitution mandate touched:
     Task: "Confirm best practices for {mandate}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules derived from Zod schemas / Drizzle models
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint or Server Action contract
   - Document request/response schemas and error cases
   - Output to `/contracts/` in OpenAPI, TypeScript types, or schema files

3. **Generate contract tests** from contracts:
   - One test file per endpoint or Server Action
   - Assert request/response schemas and auth guards
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario (Playwright/Vitest as appropriate)
   - Quickstart test = story validation steps

5. **Update agent file incrementally**:
   - Run `.specify/scripts/bash/update-agent-context.sh codex`
   - Add only NEW tech or decisions from current plan
   - Preserve manual additions between markers
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each contract → contract or Server Action test task [P]
- Each entity → model/schema task [P]
- Each user story → integration test task
- Implementation tasks align with Next.js App Router structure

**Ordering Strategy**:
- TDD order: Tests before implementation 
- Dependency order: Models before Server Actions before UI
- Mark [P] for parallel execution (independent files)

**Estimated Output**: 25-30 numbered, ordered tasks in tasks.md

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
| [e.g., Clerk instead of Auth.js] | [specific requirement] | [why Auth.js insufficient] |
| [e.g., Edge runtime] | [latency/SLA need] | [why Node runtime insufficient] |

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [ ] Phase 0: Research complete (/plan command)
- [ ] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [ ] Initial Constitution Check: PASS
- [ ] Post-Design Constitution Check: PASS
- [ ] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
