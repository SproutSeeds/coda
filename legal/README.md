# Legal Documents

This directory contains the canonical public-facing policies for codacli.com. Each document includes version metadata in its frontmatter and lives under version control so we can track every revision.

## Published Policies
- `terms-of-service.md`
- `privacy-policy.md`
- `cookie-policy.md`
- `acceptable-use-policy.md`
- `dmca-policy.md`
- `data-processing-addendum.md`

## Draft Library
Future-facing documents remain under `drafts/` until the supporting product and operational work exists. Move a draft into the published list only after those dependencies are live.

- `drafts/refund-and-billing-policy.md`
- `drafts/service-level-agreement.md`
- `drafts/api-cli-terms.md`
- `drafts/beta-features-addendum.md`
- `drafts/security-and-incident-response.md`
- `drafts/enterprise-msa-template.md`

## Maintenance Workflow
1. Edit the Markdown file, update the `version` and `effectiveDate`, and add a short change summary near the top when you make material updates.
2. Commit the change with a descriptive message (e.g., `docs(legal): update tos for paid plans`).
3. Regenerate or redeploy any static pages that consume these files so production stays in sync.
4. Log new versions in the database so user acceptance records always reference the correct document.
5. When you add or swap infrastructure providers (e.g., a new email vendor), update Annex B of the DPA and the Privacy Policy provider list before rolling out the change.

## Operational Follow-Ups
- **Consent flows:**
  - Display ToS + Privacy acceptance at sign-up and log `document`, `version`, `accepted_at`, and `ip_address` per user.
  - Surface a cookie banner (linked to `cookie-policy.md`) for EU/UK visitors and persist granular opt-in states once analytics tooling ships.
- **Policy surfacing:**
  - Publish a `/legal` index page linking each published document with its current version number.
  - Keep in-product help and CLI `--help` output pointing at the policies that are in force.
- **Draft activation:**
  - Before publishing a draft, ensure SLA monitoring, billing workflows, security roadmap milestones, or enterprise contracting processes (as applicable) are production-ready.
- **Document lifecycle:**
  - Send 30-day notices for material ToS/Privacy changes and require re-acceptance when versions increment.
  - Audit acceptance logs quarterly to verify the database matches the markdown revisions in this directory.

## User Acceptance Logging
- Store events in a table such as `document_acceptances` with fields `user_id`, `document`, `version`, `accepted_at`, and `ip_address`.
- Require re-acceptance any time a published document’s version increases.
- CLI users should confirm in-terminal and sync that acceptance to the server on the next request.

## Contacts
- Primary: cody@codacli.com
