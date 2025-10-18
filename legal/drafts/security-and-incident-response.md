---
title: "Security & Incident Response Overview"
version: "2025-01-01"
effectiveDate: "2025-01-01"
---

_Last updated: January 1, 2025_

This document summarizes security practices and incident-response procedures for Coda CLI, Inc.

## 1. Security Program
- Executive sponsorship via the CTO; security reviews tracked in quarterly OKRs.
- Policies covering access control, secure development lifecycle, vendor management, and business continuity.
- Annual risk assessment aligned with SOC 2 Type I control families (formal audit roadmap in progress).

## 2. Infrastructure
- Hosting on Vercel with regional failover and automatic TLS.
- Primary data stored in Neon Postgres with point-in-time recovery; rate limiting via Upstash Redis.
- Secrets managed via Vercel environment variables and restricted to least-privilege service accounts.

## 3. Application Security
- Mandatory code review for changes touching authentication, authorization, or data handling.
- Static analysis (ESLint, TypeScript) and dependency scanning via `pnpm audit` before release.
- Playwright, Vitest, and integration tests enforced in CI prior to deploy.
- Content Security Policy headers and strict mode in Next.js 15.

## 4. Access Management
- SSO enforced for internal admin tools.
- Multi-factor authentication required for production consoles (Vercel, Neon, Upstash).
- Quarterly access reviews and immediate revocation on employee offboarding.

## 5. Data Protection
- TLS 1.2+ for data in transit; database encryption handled by Neon at rest.
- Backups retained for 30 days; DR tabletop exercises twice per year.
- Customer data separated by workspace ID with strict row-level filtering in server actions.

## 6. Incident Response
- 24/7 monitoring through Vercel alerts, Upstash metrics, and custom health checks.
- Incident severity levels (SEV0–SEV3) with on-call rotation.
- For SEV0/SEV1, initial customer notification via status page within 60 minutes; postmortem published within 5 business days.
- Security incidents reported to cody@codacli.com; we coordinate with affected customers and regulators where required.

## 7. Vulnerability Disclosure
- Responsible disclosure program available at cody@codacli.com.
- We acknowledge reports within 2 business days and target remediation within 30 days for critical issues.
- No bug bounty program yet; good-faith researchers are asked to avoid data exfiltration or service disruption.

## 8. Business Continuity
- Primary operations in the United States with remote-first team.
- Daily infrastructure snapshots and automated redeploy scripts.
- Critical runbooks stored in shared secure knowledge base with offline access.

## 9. Compliance Roadmap
- 2025: SOC 2 Type I readiness, documented pen test scope.
- 2026: SOC 2 Type II audit, ISO 27001 gap assessment.

## 10. Contacts
- Security: cody@codacli.com
- Status page: status.codacli.com (planned)
