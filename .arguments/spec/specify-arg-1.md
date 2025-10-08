Build a lightweight web application called “IdeaVault” that lets signed-in users capture, browse, search, and remove their own project ideas.

## Problem & Why
Individuals collect scattered ideas in notes apps and lose them. IdeaVault centralizes quick capture and effortless recall so users can turn sparks into projects.

## Primary Outcomes (What must exist)
- A **runnable web application** that a user can open, sign in, and use end-to-end from a fresh clone.
- A **first-run experience** with clear empty states so a new user understands what to do next.
- **Idea capture** with two fields: **Title** and **Notes**.
- **Idea list** scoped to the signed-in user, ordered newest-first.
- **Search/filter** across title and notes (substring match is acceptable for v1).
- **Delete** ideas with an immediate, clearly animated removal.
- Basic **account/session** behavior sufficient to separate each user’s ideas.

> Delivery expectation: From a fresh repository, a developer can configure required environment values and run the app locally to exercise every behavior above.

## User Stories (Who & what)
- **As a creator**, I want to quickly save a new idea (title + notes) so I don’t lose it.
- **As a returning user**, I want to skim my latest ideas first so I can resume where I left off.
- **As an organized thinker**, I want to search by words I remember so I can find an idea fast.
- **As a curator**, I want to remove ideas I won’t pursue so my list stays focused.

## Functional Requirements (What the system must do)
1. **Create Idea**
   - Inputs: Title (required), Notes (optional).
   - On success: idea appears at the top of the list without full-page reload; form resets; user receives lightweight confirmation.
2. **List Ideas**
   - Only the current user’s ideas are visible; newest first; pagination not required for v1.
3. **Search/Filter**
   - Text input instantly narrows the visible list by substring match in title/notes.
4. **Delete Idea**
   - Removal is obvious and reversible intent is **not** required for v1 (see Non-Goals).
5. **Session Awareness**
   - A user only sees/acts on their own ideas; unauthenticated users cannot create or view ideas.

## Non-Goals (Intentionally out of scope for v1)
- Collaboration, sharing, comments, tags, rich formatting beyond basic text/markdown.
- Editing ideas after creation (capture→delete cycle only for MVP).
- Mobile app; web-responsive only is sufficient.
- Advanced search (e.g., fuzzy ranking, boolean operators).

## UX Principles (How it should feel—without naming technology)
- **Fast and smooth**: micro-interactions and state changes feel immediate; avoid jank.
- **Clarity first**: empty, loading, error states are explicit; no dead ends.
- **Accessible by default**: keyboard usable; visible focus; readable contrast; honors “reduced motion”.

## Success Criteria (Measurable)
- A new user can capture an idea in **< 10 seconds** from first load.
- Search returns expected matches in **< 200 ms** for typical lists.
- “Create → See on top” perceived within a single smooth transition.
- Basic accessibility checks pass (focus order, labels, contrast).

## Acceptance Criteria (Gherkin style)
- **Create**
  - Given I am signed in, When I submit a non-empty Title, Then the idea is saved and shown at the top of my list.
- **Search**
  - Given I have several ideas, When I type a word occurring in one idea’s notes, Then only matching ideas remain visible.
- **Delete**
  - Given I have at least one idea, When I delete it, Then it animates out and no longer appears in my list.
- **Isolation**
  - Given two different users, When each views IdeaVault, Then each sees only their own ideas.

## Data (Conceptual)
- **Idea**: id, owner, title, notes (text/markdown), createdAt, deletedAt (nullable for removal).
- **User**: id, display identifier sufficient to associate ideas.

## Operational Readiness (What “done” means for an MVP)
- The repository includes what is necessary to **run the application locally** (documented commands and environment placeholders).
- Minimal analytics events are defined at the product level (e.g., idea_created, idea_deleted, search_performed) to measure usage later.
- Documentation: a short **Quickstart** section exists telling a developer how to configure env values and run the app locally.

Please generate a complete feature specification using these constraints and outcomes. Focus on the **product behavior and value** (what/why), not implementation details or specific technologies. The specification should be ready for the planning phase to decide the architecture and stack, and it must be explicit enough that /plan can derive a clear scaffold and task breakdown without making product assumptions.