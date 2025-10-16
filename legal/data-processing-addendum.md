---
title: "Data Processing Addendum"
version: "2025-01-01"
effectiveDate: "2025-01-01"
---

_Last updated: January 1, 2025_

This Data Processing Addendum ("DPA") supplements the codacli.com Terms of Service (the "Agreement") between Coda CLI, Inc. ("Processor") and the customer identified in the Agreement ("Controller") when Controller transfers personal data subject to GDPR or UK GDPR to Processor.

## 1. Subject Matter
- **Purpose:** Processor will host, store, index, and analyze Controller Data to provide the Service defined in the Agreement.
- **Duration:** Matches the term of the Agreement plus any post-termination retention period required by law.
- **Nature of Processing:** Storage, retrieval, organization, transmission, and analytics of idea content, team membership, and usage telemetry.
- **Data Categories:** Names, emails, team metadata, authentication tokens, activity logs, and other personal data uploaded by Controller.
- **Data Subjects:** Controller's employees, contractors, and other end users whose data is provided through the Service.

## 2. Processor Obligations
Processor shall:
1. Process personal data only on documented instructions from Controller.
2. Implement appropriate technical and organizational measures outlined in Annex A.
3. Ensure confidentiality agreements are in place for personnel with access to personal data.
4. Notify Controller without undue delay after becoming aware of a personal data breach.
5. Assist Controller with data subject requests, regulatory inquiries, and impact assessments related to the Service.
6. Maintain records of processing activities and make them available to Controller upon request.
7. Inform Controller of any legally binding requests for disclosure unless prohibited by law.

## 3. Controller Obligations
Controller is responsible for: (a) obtaining all necessary consents and providing required notices; (b) ensuring personal data is processed lawfully; and (c) using the Service in accordance with the Agreement and applicable privacy laws.

## 4. Subprocessors
- Processor may engage subprocessors listed in Annex B. Processor will notify Controller of updates and allow reasonable objections.
- Processor remains responsible for subprocessors' performance and will ensure equivalent data protection obligations are imposed on each.

## 5. International Transfers
Processor may transfer personal data outside the EU/UK, including to the United States, using Standard Contractual Clauses or other lawful transfer mechanisms.

## 6. Return or Deletion
Upon termination of the Agreement, Processor will delete or return personal data within 30 days, unless retention is required by law. Controller may request written confirmation of deletion.

## 7. Audit Rights
Controller may audit Processor's compliance with this DPA up to once per year with 30 days' notice, during normal business hours, and subject to reasonable confidentiality obligations. Processor may satisfy audit requests by providing third-party certifications or summaries of its controls.

## 8. Conflict
If this DPA conflicts with the Agreement, the DPA controls to the extent of the conflict regarding personal data processing.

## Annex A – Security Measures
- Encryption in transit via TLS 1.2+.
- Role-based access controls and least-privilege access.
- Multifactor authentication for administrative accounts.
- Regular vulnerability scanning and patch management.
- Logging and monitoring of key system events.
- Secure development lifecycle practices with code review.

## Annex B – Subprocessors
| Provider | Purpose | Location |
|----------|---------|----------|
| Vercel, Inc. | Hosting, CDN, analytics | USA / EU regions |
| Neon, Inc. | Managed Postgres database | USA / EU regions |
| Upstash, Inc. | Redis rate limiting | USA / EU regions |
| PostHog, Inc. (optional) | Product analytics (if enabled) | USA / EU regions |
| Email provider (e.g., Controller-selected SMTP service) | Transactional email delivery | Varies by provider |

Both parties acknowledge and agree to this DPA as of the effective date above.
