# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Cross-check requested outcomes against constitutional mandates (stack, auth, performance)
   → If conflict: record [NEEDS CLARIFICATION: constitution conflict]
5. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
6. Generate Functional Requirements
   → Each requirement must be testable and constitution-compliant
   → Mark ambiguous requirements
7. Identify Key Entities (if data involved)
8. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
9. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no code, frameworks, or stack decisions)
- 📘 Call out constitution-driven guardrails (e.g., Auth.js, Vercel deploy cadence, performance budgets) when they influence acceptance criteria
- 👥 Written for business stakeholders, not developers
- ⚠️ If the request conflicts with the constitution (e.g., non-Next.js runtime), flag it with [NEEDS CLARIFICATION]

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth details), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Performance targets and scale (Lighthouse ≥ 90, LCP < 2.5s, CLS ≈ 0)
   - Error handling behaviors
   - Integration requirements (Auth.js providers, Drizzle/Postgres)
   - Security/compliance needs (bcrypt ≥ 12, secrets management)

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
[Describe the main user journey in plain language]

### Acceptance Scenarios
1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

### Edge Cases
- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST [specific capability, e.g., "allow creators to publish an idea"].
- **FR-002**: System MUST [specific capability, e.g., "authenticate via Auth.js using Credentials or GitHub OAuth"].  
- **FR-003**: Users MUST be able to [key interaction, e.g., "view optimistic updates to idea lists"].
- **FR-004**: System MUST [data requirement, e.g., "persist ideas in PostgreSQL with Drizzle migrations"].
- **FR-005**: System MUST [performance/quality requirement, e.g., "maintain Lighthouse ≥ 90 on targeted routes"].

*Example of marking unclear requirements:*
- **FR-006**: System MUST support [NEEDS CLARIFICATION: additional identity provider?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*
- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

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

---
