# Legal Documents

This directory contains the canonical public-facing policies for codacli.com. Each document includes version metadata in its frontmatter and lives under version control so we can track every revision.

## Files
- `terms-of-service.md`
- `privacy-policy.md`
- `data-processing-addendum.md`

## Maintenance Workflow
1. Edit the Markdown file, update the `version` and `effectiveDate` fields, and add a short change summary near the top when you make material updates.
2. Commit the change with a descriptive message (e.g., `docs(legal): update tos for paid plans`).
3. Regenerate or redeploy any static pages that consume these files so production stays in sync.
4. Log the new version in the application database so user acceptance records reference the correct document.
5. When you add or swap infrastructure providers (e.g., new email vendor), update Annex B of the DPA and the Privacy Policy provider list before rolling out the change.

## User Acceptance Logging
- Store events in a table such as `user_terms_acceptances` with fields: `user_id`, `document`, `version`, `accepted_at`, `ip_address`.
- Require re-acceptance any time the `version` increases.
- CLI users should confirm in-terminal and sync that acceptance to the server on next request.

## Contacts
- Legal: legal@codacli.com
- Privacy: privacy@codacli.com
