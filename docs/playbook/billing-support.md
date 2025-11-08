# Billing & Usage Support Playbook

Last updated: 2025-11-04

### Purpose

Equip frontline support (email, Intercom, Discord) with consistent answers about usage limits, credits, and billing. Reference this document before escalating to engineering.

---

## Quick Answers

**Q: Why did I hit a limit?**
- The action exceeded the allowance for your plan (see usage dashboard for the metric + remaining credits).
- If the limit shows "Blocked" with an Override button, ask the user to open a request with rationale + desired limit. Support can escalate in `/dashboard/admin/limits`.
- Remind the user about alternatives: sponsor via workspace pool, top up credits, or export to the CLI/local workflow.

**Q: How do I top up credits?**
- Navigate to `/dashboard/usage` → “Top up credits”.
- Choose an amount (increments of 100 credits). Stripe checkout (coming soon) handles payment; confirmation email includes an itemized receipt.
- Credits appear instantly; if not, advise the user to refresh. If still missing, check `credit_transactions` and the Stripe webhook logs.

**Q: Can my workspace sponsor collaborators?**
- Yes. Owners can allocate from workspace pools via `/dashboard/admin/billing`.
- When the pool funds an action, the usage dashboard labels it “Sponsored by workspace”.
- Support can grant one-time pool credits in the same admin view; document the reason in the grant note.

**Q: How long do free credits last?**
- Free tier includes 100 credits/month. They stack and never expire. If a user doesn’t spend them, they remain available for future spikes (similar to Splice credits).

**Q: What happens when I run out of credits mid-session (Dev Mode)?**
- Dev Mode will prompt to continue locally or request sponsorship.
- Minutes already consumed are logged; the relay call returns gracefully with instructions and a link to internal docs.
- Encourage the user to export the current progress for offline continuation.

**Q: How can I review all usage charges?**
- `/dashboard/usage` → “Download ledger” (CSV/JSON) lists every debit with vendor metadata.
- For audits, support can reference `usage_costs` (filtered by user/workspace) and attach the CSV.

**Q: An override was approved but limits still block me.**
- Overrides typically apply instantly. Confirm the request ID in `/dashboard/admin/limits`.
- Ask the user to refresh; counters are cached by the guard. If the issue persists, run `pnpm db:reconcile --metric <metric>` in staging to verify canonical counts.

**Q: Can I pause billing?**
- Users can switch to local/offline mode from the Upgrade dialog. Credits remain untouched while paused.
- Use cases: vacations, experimentation, or running the CLI inside private infrastructure.

---

## Escalation Checklist

1. Confirm the impacted metric and remaining credits (usage dashboard screenshot or ledger entry).
2. Check pending override status and expiry.
3. Review recent `usage_costs` entries to ensure deductions match expectations.
4. If a bug is suspected, file in Linear with:
   - User ID & idea ID
   - Metric name and last ledger entry
   - Screenshot of dashboard / error message
   - Steps leading to the block
5. Tag the issue `billing` + `limits` for quick triage.

---

## Communication Snippets

- **Soft warning copy**: “You’re nearing the monthly collaborator limit. You can keep building—consider topping up credits or asking your workspace to sponsor the idea.”
- **Hard block copy**: “We’ve paused this action to keep cloud costs under control. Top up credits, request sponsorship, or continue offline via the CLI.”
- **Transparency statement**: “Credits cover the actual vendor fees we incur (Postgres, Redis, analytics). We don’t markup usage; you only pay what we pay.”

Keep these snippets aligned with in-product messaging (`components/limit/LimitDialog`). Update the doc when copy changes in-app.
