# Coda Platform Technical Documentation

## Overview

This directory contains comprehensive technical documentation for the Coda platform, derived from the Product Playbook and expanded with senior software engineer-level implementation details, architectural decisions, and operational guidance.

**Last Updated:** October 2025
**Platform Version:** V2.0+ (Post-DMG helper app release)
**Documentation Status:** Complete

---

## Document Structure

### Core Documents

#### 📖 [PRODUCT_PLAYBOOK_REFERENCE.md](./PRODUCT_PLAYBOOK_REFERENCE.md)
**Original product playbook** outlining Coda's product definition, personas, architecture rationale, and lessons learned. This is the source document from which all technical documentation is derived.

**Key Topics:**
- Product definition and vision
- User personas and use cases
- Stack rationale (Next.js, Drizzle, Upstash, Vercel)
- Development workflow and git history
- DevMode and Runner experience
- Lessons learned from MVP to production

**Audience:** Product managers, engineering leads, new team members

---

### Technical Deep Dives

#### 🏗️ [01 - Architecture Deep Dive](./technical/01-architecture-deep-dive.md)
**Comprehensive technical analysis** of Coda's system architecture, technology stack decisions, and implementation patterns.

**Key Topics:**
- System architecture overview with diagrams
- Next.js 15 App Router implementation patterns
- Drizzle ORM usage and query optimization
- Frontend component architecture (Server Components vs Client Components)
- State management strategy
- Performance optimizations (streaming SSR, caching)
- Scalability considerations and bottlenecks

**Use Cases:**
- Onboarding senior engineers
- Architectural decision reviews
- Performance optimization planning
- Technology evaluation

**Audience:** Senior engineers, architects, technical leads

---

#### ⚙️ [02 - Development Workflow & Tooling](./technical/02-development-workflow.md)
**Complete guide** to development practices, branch strategy, spec-driven development, and tooling setup.

**Key Topics:**
- Branch-first workflow (CRITICAL: never commit to main)
- Git commit message conventions
- Spec-driven development lifecycle (plan.md, tasks.md, contracts/)
- Local development environment setup
- Database migration workflow
- IDE configuration (VS Code, ESLint, Prettier)
- Code review process and checklist
- Debugging workflows and common issues

**Use Cases:**
- Onboarding new developers
- Establishing team conventions
- Troubleshooting development issues
- Setting up new development machines

**Audience:** All engineers, contributors

---

#### 🖥️ [03 - DevMode & Runner Technical Specification](./technical/03-devmode-runner-spec.md)
**Detailed technical specification** for the DevMode system, including Electron desktop app, CLI runner, WebSocket relay, and terminal synchronization.

**Key Topics:**
- Runner implementations (Desktop vs CLI)
- Electron app architecture (main, renderer, preload processes)
- Icon generation fix (macOS ICNS using iconutil)
- Signing and notarization (macOS DMG)
- Runner core (`@coda/runner-core`) internals
- PTY manager and tmux integration
- WebSocket relay protocol
- Job orchestration and pairing flow
- Terminal synchronization (xterm.js)
- Performance optimizations (log batching, resize throttling)

**Use Cases:**
- Developing DevMode features
- Debugging terminal/runner issues
- Packaging and distributing runner apps
- Understanding relay protocol
- Performance optimization

**Audience:** DevMode team, platform engineers

---

#### 🗄️ [04 - Data Layer & Schema Documentation](./technical/04-data-layer-schema.md)
**Complete database documentation** covering schema design, Drizzle ORM usage, migrations, and query patterns.

**Key Topics:**
- Postgres schema design (ERD diagrams)
- Core entity definitions (users, ideas, features, dev_* tables)
- Drizzle ORM configuration and usage
- drizzle-zod validation integration
- Migration workflow (generate, review, apply)
- Query patterns and optimization (N+1 prevention, pagination)
- Indexing strategy (partial indexes, composite indexes)
- Soft delete pattern
- Data integrity (cascading deletes, constraints)
- Backup and recovery procedures

**Use Cases:**
- Database schema evolution
- Writing efficient queries
- Migration creation and review
- Query performance optimization
- Data modeling decisions

**Audience:** Backend engineers, database administrators

---

#### 🚀 [05 - Operations & Deployment Guide](./technical/05-operations-deployment.md)
**Operational handbook** covering deployment, monitoring, incident response, and maintenance procedures.

**Key Topics:**
- Vercel deployment setup and configuration
- Environment variable management
- Database migration in production
- Rollback procedures (app + database)
- Cron jobs (soft delete purge, pairing cleanup)
- Monitoring and observability (Vercel Analytics, future Sentry)
- Performance monitoring (Web Vitals)
- Incident response runbooks (severity levels, common incidents)
- Operational runbooks (add env vars, migrations, scaling)
- Cost management and projections
- Disaster recovery plan

**Use Cases:**
- Production deployments
- Incident response
- Monitoring setup
- Cost optimization
- Disaster recovery

**Audience:** DevOps, SRE, platform engineers, on-call engineers

---

#### 🧪 [06 - Testing Strategy & Quality Assurance](./technical/06-testing-qa-strategy.md)
**Comprehensive testing guide** covering unit tests, E2E tests, performance tests, and QA processes.

**Key Topics:**
- Testing pyramid (unit, integration, E2E, manual QA)
- Unit testing with Vitest (utilities, validations, server actions)
- E2E testing with Playwright (auth, CRUD, drag-and-drop, export/import)
- Performance testing with Lighthouse (Web Vitals, benchmarks)
- Integration testing (database operations)
- Test coverage goals and critical paths
- CI/CD integration (GitHub Actions workflow)
- Manual QA checklist for releases

**Use Cases:**
- Writing tests for new features
- Setting up test infrastructure
- Pre-release QA validation
- CI/CD pipeline configuration
- Performance regression testing

**Audience:** All engineers, QA team, release managers

---

#### 🔒 [07 - Security & Compliance Technical Guide](./technical/07-security-compliance.md)
**Security architecture and compliance documentation** covering authentication, authorization, data security, and regulatory compliance.

**Key Topics:**
- Defense in depth strategy (network, application, auth, data layers)
- Authentication & authorization (Auth.js, JWT, RBAC)
- Password security (bcrypt, requirements)
- Session management (HTTP-only cookies, CSRF protection)
- Input validation and sanitization (Zod, XSS prevention, SQL injection)
- Rate limiting (Upstash configuration)
- Data security (encryption at rest/in transit, soft delete)
- DevMode security (pairing, relay token verification)
- Security headers (CSP, X-Frame-Options)
- GDPR compliance (data subject rights, retention policy)
- Security monitoring and incident response

**Use Cases:**
- Security audits
- Compliance certification
- Implementing authentication features
- Security incident response
- Data retention policy enforcement

**Audience:** Security engineers, compliance team, senior engineers

---

#### 🛣️ [08 - Technical Roadmap & Future Architecture](./technical/08-roadmap-future-architecture.md)
**Strategic technical vision** outlining planned features, architectural improvements, and long-term technology decisions.

**Key Topics:**
- Current state assessment (strengths, limitations)
- Roadmap phases (Foundation, Scale, Innovation)
- Detailed technical initiatives:
  - Observability stack (Sentry, Datadog, OpenTelemetry)
  - Performance optimization (Redis caching, read replicas)
  - Microservices architecture (extract DevMode service)
  - AI/ML integration (GPT-4 summarization, suggestions)
  - Real-time collaboration (Yjs CRDTs)
  - Native mobile apps (React Native)
- Technical debt prioritization
- Cost projections (100 users → 100,000 users)
- Success metrics (reliability, performance, adoption)
- Strategic decision points

**Use Cases:**
- Sprint planning and prioritization
- Resource allocation
- Technology evaluation
- Stakeholder communication
- Long-term architectural planning

**Audience:** Engineering leadership, product management, executives

---

## Quick Reference Guides

### For New Engineers

**First Week:**
1. Read [PRODUCT_PLAYBOOK_REFERENCE.md](./PRODUCT_PLAYBOOK_REFERENCE.md) for product context
2. Follow [02-development-workflow.md](./technical/02-development-workflow.md) to set up local environment
3. Review [01-architecture-deep-dive.md](./technical/01-architecture-deep-dive.md) for system overview

**First Month:**
4. Study [04-data-layer-schema.md](./technical/04-data-layer-schema.md) for database patterns
5. Read [06-testing-qa-strategy.md](./technical/06-testing-qa-strategy.md) for testing practices
6. Review [07-security-compliance.md](./technical/07-security-compliance.md) for security guidelines

### For DevMode Development

**Required Reading:**
- [03-devmode-runner-spec.md](./technical/03-devmode-runner-spec.md) - Complete DevMode architecture
- [02-development-workflow.md](./technical/02-development-workflow.md#desktop-app-development) - Runner development workflow
- [05-operations-deployment.md](./technical/05-operations-deployment.md#runbook-update-runner-desktop-app) - Runner deployment procedures

**Common Tasks:**
- Debug terminal issues → [03-devmode-runner-spec.md#troubleshooting](./technical/03-devmode-runner-spec.md)
- Update runner app → [05-operations-deployment.md#runbook-update-runner-desktop-app](./technical/05-operations-deployment.md)
- Optimize log performance → [03-devmode-runner-spec.md#performance-optimizations](./technical/03-devmode-runner-spec.md)

### For Database Changes

**Required Reading:**
- [04-data-layer-schema.md](./technical/04-data-layer-schema.md) - Schema design and migration workflow
- [05-operations-deployment.md](./technical/05-operations-deployment.md#runbook-database-migration) - Production migration runbook

**Common Tasks:**
- Add new table → [04-data-layer-schema.md#schema-definitions](./technical/04-data-layer-schema.md)
- Create migration → [04-data-layer-schema.md#migration-workflow](./technical/04-data-layer-schema.md)
- Optimize query → [04-data-layer-schema.md#query-patterns-optimization](./technical/04-data-layer-schema.md)

### For Production Issues

**Incident Response:**
1. Check [05-operations-deployment.md#incident-response](./technical/05-operations-deployment.md) for severity levels
2. Follow [05-operations-deployment.md#common-incidents-solutions](./technical/05-operations-deployment.md) for known issues
3. Use [05-operations-deployment.md#operational-runbooks](./technical/05-operations-deployment.md) for procedures

**Common Issues:**
- 500 errors → [05-operations-deployment.md#incident-production-500-errors](./technical/05-operations-deployment.md)
- Database connection errors → [05-operations-deployment.md#incident-database-connection-pool-exhausted](./technical/05-operations-deployment.md)
- Relay server down → [05-operations-deployment.md#incident-relay-server-down](./technical/05-operations-deployment.md)

### For Security Reviews

**Required Reading:**
- [07-security-compliance.md](./technical/07-security-compliance.md) - Complete security architecture
- [06-testing-qa-strategy.md](./technical/06-testing-qa-strategy.md) - Security testing procedures

**Security Checklist:**
- [ ] Authentication properly implemented ([07-security-compliance.md#authentication-authorization](./technical/07-security-compliance.md))
- [ ] Input validation present ([07-security-compliance.md#input-validation-sanitization](./technical/07-security-compliance.md))
- [ ] Rate limiting configured ([07-security-compliance.md#rate-limiting](./technical/07-security-compliance.md))
- [ ] SQL injection prevented ([07-security-compliance.md#sql-injection-prevention](./technical/07-security-compliance.md))
- [ ] XSS vulnerabilities addressed ([07-security-compliance.md#xss-prevention](./technical/07-security-compliance.md))

---

## Document Maintenance

### Updating Documentation

**When to Update:**
- **Architecture changes:** Update `01-architecture-deep-dive.md`
- **New workflows:** Update `02-development-workflow.md`
- **Schema changes:** Update `04-data-layer-schema.md`
- **Deployment changes:** Update `05-operations-deployment.md`
- **Security changes:** Update `07-security-compliance.md`
- **Roadmap changes:** Update `08-roadmap-future-architecture.md`

**How to Update:**
1. Create feature branch: `git checkout -b docs/update-architecture`
2. Make changes to relevant `.md` files
3. Update "Last Updated" date in affected documents
4. Commit with conventional format: `docs: Update architecture for microservices`
5. Create PR and request review from technical lead

### Documentation Review Schedule

- **Quarterly:** Review all technical documents for accuracy
- **After major releases:** Update roadmap and current state
- **Monthly:** Review and update known issues
- **Ad-hoc:** Update immediately for critical changes (security, deployment)

---

## Additional Resources

### Related Documentation

- **Root Level:**
  - [README.md](../../README.md) - Project overview and quick start
  - [CLAUDE.md](../../CLAUDE.md) - Claude Code AI assistant instructions
  - [AGENTS.md](../../AGENTS.md) - Agent integration guide (if exists)

- **Specs Directory:**
  - [specs/](../../specs/) - Feature specifications and task lists

- **Code Documentation:**
  - [lib/db/schema.ts](../../lib/db/schema.ts) - Database schema source
  - [app/api/](../../app/api/) - API route implementations
  - [apps/runner-desktop/](../../apps/runner-desktop/) - Desktop app code

### External Resources

**Next.js:**
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [App Router Migration Guide](https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration)

**Drizzle ORM:**
- [Drizzle Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle with Next.js](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)

**Vercel:**
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)

**Playwright:**
- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

## Contributing to Documentation

### Documentation Standards

**Markdown Conventions:**
- Use ATX-style headers (`#`, `##`, `###`)
- Include code fences with language specifiers (```typescript```)
- Use tables for structured data
- Include diagrams where helpful (ASCII art or Mermaid)
- Link to related documents

**Code Examples:**
- Show complete, runnable examples
- Include comments for clarity
- Highlight anti-patterns with "Bad:" and "Good:"
- Use realistic variable names

**Technical Depth:**
- Senior engineer level (assume strong technical background)
- Explain "why" decisions were made, not just "what"
- Include trade-offs and alternatives considered
- Document historical context where relevant

### Review Process

**Documentation PRs require:**
1. Technical accuracy review (senior engineer)
2. Clarity review (can a new hire understand this?)
3. Completeness check (are all sections filled out?)
4. Link validation (all references working?)

---

## Contact & Support

**For questions about:**
- **Product direction:** Reference [PRODUCT_PLAYBOOK_REFERENCE.md](./PRODUCT_PLAYBOOK_REFERENCE.md)
- **Technical architecture:** Reference [01-architecture-deep-dive.md](./technical/01-architecture-deep-dive.md)
- **Development workflow:** Reference [02-development-workflow.md](./technical/02-development-workflow.md)
- **Production issues:** Reference [05-operations-deployment.md](./technical/05-operations-deployment.md)

**Documentation Issues:**
- Open issue: [GitHub Issues](https://github.com/yourorg/coda/issues)
- Label: `documentation`
- Assign to: Engineering Lead

---

## Changelog

### 2025-10-30
- Initial comprehensive technical documentation suite created
- All 8 technical documents completed
- Index document with quick reference guides added
- Cross-references and navigation established

### 2025-10-29
- Product Playbook finalized (PRODUCT_PLAYBOOK_REFERENCE.md)
- Historical context from git commits documented
- Lessons learned section added

---

**Document Version:** 1.0
**Documentation Coverage:** Complete (8 technical documents + index)
**Maintained By:** Engineering Team
**Review Cycle:** Quarterly + ad-hoc updates
