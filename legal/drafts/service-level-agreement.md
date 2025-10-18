---
title: "Service Level Agreement"
version: "2025-01-01"
effectiveDate: "2025-01-01"
---

_Last updated: January 1, 2025_

This Service Level Agreement ("SLA") describes uptime and support commitments for paid Coda plans. Capitalized terms follow the [Terms of Service](./terms-of-service.md).

## 1. Covered Services
The SLA applies to the hosted dashboard, APIs, webhooks, and CLI synchronization (collectively, "Covered Services"). Sandbox, beta, or free plans are excluded unless explicitly stated.

## 2. Uptime Commitment
We target **99.5% Monthly Uptime Percentage**. Monthly Uptime Percentage = 100% − (Downtime minutes ÷ total minutes in the calendar month × 100).

### 2.1 Downtime Definition
Downtime occurs when the Covered Services return HTTP 5xx errors or time out for more than one minute in production environments. Downtime excludes periods resulting from:
- Scheduled maintenance announced at least 48 hours in advance (max 4 hours per month).
- Customer-caused issues (e.g., invalid configuration, credential mismanagement).
- Force majeure events (Section 14 of the Terms).
- Failures of third-party services outside our reasonable control when we are in compliance with contracted SLAs.

## 3. Service Credits
If Monthly Uptime Percentage falls below 99.5%, you may request a credit within 30 days of the month end.

| Uptime | Credit |
|--------|--------|
| < 99.5% and ≥ 99.0% | 5% of the monthly fee |
| < 99.0% and ≥ 98.0% | 10% of the monthly fee |
| < 98.0% | 25% of the monthly fee |

Credits apply to future invoices and cannot exceed the fees paid for the affected month. Credits are unavailable to accounts with overdue balances.

## 4. Support Response Targets
- **P1 (Service down/security incident):** acknowledgement within 2 business hours, updates every 4 hours.
- **P2 (Degraded functionality):** acknowledgement within 8 business hours.
- **P3 (General questions):** acknowledgement within 2 business days.
Support is available Monday–Friday, 9am–6pm Pacific Time, excluding U.S. holidays unless otherwise agreed in writing.

## 5. Customer Responsibilities
- Provide accurate billing and contact information.
- Maintain supported versions of the CLI and SDK.
- Use reasonable retry/backoff logic for workflows to avoid cascading failures.
- Notify us promptly of suspected incidents via cody@codacli.com.

## 6. Exclusive Remedies
Service credits are the sole and exclusive remedy for SLA failures. They do not apply to free/beta tiers or non-production environments.

## 7. Changes
We may update this SLA with 30 days' notice. Existing customers may continue under prior terms for the remainder of the then-current subscription term.
