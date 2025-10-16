# Feature Specification: Bulk JSON Idea Import

**Feature Branch**: `003-build-out-a`
**Created**: 2025-10-11
**Status**: Draft
**Input**: User description: "Build out a import json button that takes an expected JSON format base this format on the way we export the JSON with the export JSON button. In the JSON file you can have as many ideas as you would like and as many features within those ideas that you would like to have."

## User Scenarios & Testing *(mandatory)*

### Primary User Story
As a workspace owner reviewing ideas on the dashboard, I want an "Import ideas" button beside the "Export all ideas" control so I can select a JSON file that mirrors the export format, review any detected differences, and then apply bulk updates or additions to my ideas and their features in one action.

### Acceptance Scenarios
1. **Given** I am on the ideas dashboard with permission to manage ideas, **When** I click the "Import ideas" button located to the right of "Export all ideas" and choose a JSON file from my computer, **Then** the system uploads the file, validates it against the export schema, and presents a pre-import summary of what would change.
2. **Given** the summary shows a mix of new items and updates, **When** I confirm the import, **Then** the system applies the changes in bulk—adding new ideas, attaching their features (including multi-section detail blocks), and updating existing ideas/features that differ—followed by a success report detailing the results.
3. **Given** my import file contains ideas whose titles already exist in the workspace, **When** the system detects these conflicts during the summary step, **Then** it stops for each duplicate title and asks whether to update the existing idea or create a new copy, with an "apply to all" option before continuing.
4. **Given** I choose to update an existing idea, **When** the system applies the import, **Then** only the fields that differ between the JSON payload and the stored record are updated, leaving all other attributes and unmatched features unchanged.
5. **Given** the uploaded file is malformed JSON or omits required fields, **When** I attempt to import it, **Then** the system rejects the file, explains what is invalid, and leaves the current ideas untouched.

### Edge Cases
- What happens when the file contains no new or changed ideas (should return a "no changes detected" summary without altering data)?
- How does the system handle very large imports (must respect performance budgets and present progress feedback if processing exceeds a short duration)?
- How are partially failing imports handled (should roll back or isolate failures so data integrity remains intact)?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: The ideas dashboard MUST expose an "Import ideas" control positioned immediately to the right of the existing "Export all ideas" button so owners can start the flow without navigating away.
- **FR-002**: The import workflow MUST accept only JSON files that conform to the structure produced by the platform's idea export (including idea metadata and nested feature lists).
- **FR-003**: After upload, the system MUST compare the payload against existing workspace data and present a diff summary (new ideas, updated ideas/features, unchanged records) before any changes are committed.
- **FR-004**: The system MUST validate the uploaded file client-side and server-side, providing actionable error messaging for malformed JSON, missing fields, or unsupported schema versions.
- **FR-005**: When conflicts arise (e.g., same idea title), the system MUST present a review step that lets users decide to update the existing idea, create a separate copy, or apply one decision to all similar conflicts before any records are changed.
- **FR-006**: Upon completion, the system MUST display a summary outlining how many ideas/features were created, updated, skipped, or unchanged, and confirm that the dashboard view reflects the latest state.
- **FR-007**: The import flow MUST uphold accessibility, security, and performance guardrails (WCAG AA interactions, rate limiting, data validation against the current account, and Lighthouse ≥ 90 on affected routes).
- **FR-008**: When the user selects "update" for a duplicate title, the system MUST adjust only the fields that differ between the import payload and the existing record while keeping untouched fields and unreferenced features intact.

## Clarifications

### Session 2025-10-11
- Q: When an imported idea matches an existing idea title and the user chooses “update,” how should the existing idea’s fields be treated? → A: update only fields needing change

### Key Entities *(include if feature involves data)*
- **Idea Import Payload**: Represents each idea record within the uploaded JSON, including title, notes, ordering metadata, and associated features.
- **Feature Import Item**: Represents a nested feature belonging to an idea payload, capturing its title, detail copy, completion flags, and position.
- **Conflict Resolution Decision**: Captures the user's choice for each detected duplicate (update existing vs. create new) and whether the decision should cascade to similar conflicts.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria include constitution-driven guardrails where relevant
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified (Auth.js, Vercel deploy cadence, env vars)
- [ ] No conflicts with Constitution v1.0.0

---

## Execution Status
*Updated by main() during processing*

- [ ] User description parsed
- [ ] Key concepts extracted
- [ ] Ambiguities marked
- [ ] Constitution conflicts checked
- [ ] User scenarios defined
- [ ] Requirements generated
- [ ] Entities identified
- [ ] Review checklist passed
