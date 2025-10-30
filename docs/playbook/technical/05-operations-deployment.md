# Operations & Deployment Guide

## Executive Summary

This document provides comprehensive guidance for deploying, operating, and maintaining the Coda platform in production environments. It covers Vercel deployment, environment configuration, monitoring, incident response, and operational runbooks.

## Deployment Architecture

### Production Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     Vercel Edge Network                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Next.js App (Serverless Functions)                    │    │
│  │  - SSR/SSG pages                                        │    │
│  │  - API routes                                           │    │
│  │  - Server Actions                                       │    │
│  │  Region: US East (primary)                             │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Vercel     │    │ Upstash Redis│    │   Fly.io     │
│  Postgres    │    │  (US East)   │    │   Relay      │
│  (Neon)      │    │              │    │  (Multi-AZ)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Environment Tiers

**Development:**
- Local machine (`pnpm dev`)
- Neon database (dev branch)
- Local relay server (optional)
- No CDN, no caching

**Preview (Staging):**
- Vercel preview deployments
- Neon database (preview branch)
- Fly.io relay (dev environment)
- Full feature parity with production

**Production:**
- Vercel production deployment
- Vercel Postgres (Neon-backed)
- Fly.io relay (production environment)
- Edge caching, Analytics enabled

## Vercel Deployment Setup

### Initial Configuration

**1. Connect GitHub Repository:**

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link project
vercel link
```

**2. Configure Project Settings:**

- **Framework Preset:** Next.js
- **Build Command:** `pnpm build`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install`
- **Node.js Version:** 20.x

**3. Environment Variables:**

Navigate to Vercel Dashboard → Project → Settings → Environment Variables

**Required Variables (All Environments):**

```env
# Database
DATABASE_URL="postgresql://..."

# Auth.js
NEXTAUTH_SECRET="random-32-byte-string"
NEXTAUTH_URL="https://yourdomain.com"  # Or preview URL

# Email
EMAIL_SERVER="smtp://user:pass@smtp.example.com:587"
EMAIL_FROM="Coda <hello@yourdomain.com>"

# Rate Limiting
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"

# Dev Mode
DEVMODE_JWT_SECRET="random-32-byte-string"
NEXT_PUBLIC_DEVMODE_RELAY_URL="wss://relay.example.com"

# Cron
CRON_SECRET="random-32-byte-string"
```

**Optional Variables:**

```env
# Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="xxx"

# Runner Downloads
NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE="https://github.com/yourorg/coda/releases/download"

# Feature Flags
NEXT_PUBLIC_ENABLE_DEVMODE="true"
```

**Environment-Specific Overrides:**

- **Production:** Use production database URL, SMTP server, relay URL
- **Preview:** Use preview database branch, test email (SendGrid sandbox)
- **Development:** Use local database, `EMAIL_SERVER="stream"` (console logging)

### Deployment Workflow

**Automatic Deployments:**

1. **Push to `main`** → Production deployment
2. **Push to feature branch** → Preview deployment
3. **Pull request opened** → Preview deployment linked in PR

**Manual Deployments:**

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel

# Inspect deployment
vercel inspect <deployment-url>
```

### Build Process

**Build Steps (automatic):**

1. **Install dependencies:** `pnpm install`
2. **Type checking:** `pnpm typecheck` (if configured)
3. **Build Next.js:** `pnpm build`
4. **Run migrations:** Postbuild script runs `pnpm db:migrate`
5. **Generate sitemap:** (if configured)
6. **Upload to Vercel Edge Network**

**Build Configuration (`vercel.json`):**

```json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "crons": [
    {
      "path": "/api/cron/purge-soft-deletes",
      "schedule": "0 8 * * *"
    }
  ]
}
```

### Database Migrations

**Automatic Migrations (Production):**

Migrations run automatically via `postbuild` script:

```json
// package.json
{
  "scripts": {
    "build": "next build",
    "postbuild": "pnpm db:migrate"
  }
}
```

**Manual Migration (if needed):**

```bash
# SSH into Vercel (not available, use remote execution)
# Instead, run migrations via Vercel CLI:

# Set DATABASE_URL
export DATABASE_URL="postgresql://prod-connection-string"

# Run migrations
pnpm db:migrate
```

**Migration Safety:**

1. **Test migrations on preview first**
2. **Ensure migrations are backwards compatible**
3. **Use transactions for multi-step migrations**
4. **Keep migrations idempotent** (safe to run multiple times)

### Rollback Procedures

**Instant Rollback (Vercel):**

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
```

**Database Rollback (Neon):**

```bash
# Create restore branch from specific timestamp
neon branches create --name rollback-2025-10-30 \
  --parent main \
  --timestamp "2025-10-30T10:00:00Z"

# Get connection string for restored branch
neon connection-string rollback-2025-10-30

# Update DATABASE_URL in Vercel
vercel env add DATABASE_URL
# Paste restored connection string

# Redeploy
vercel --prod
```

## Cron Jobs

### Configured Jobs

**1. Purge Soft Deletes:**

```typescript
// app/api/cron/purge-soft-deletes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ideas } from '@/lib/db/schema';
import { and, isNotNull, lt } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete ideas with expired undo tokens
  const result = await db.delete(ideas)
    .where(and(
      isNotNull(ideas.deletedAt),
      lt(ideas.undoExpiresAt, new Date())
    ));

  return NextResponse.json({
    success: true,
    deleted: result.rowCount,
    timestamp: new Date().toISOString(),
  });
}
```

**Schedule:** Daily at 8:00 AM UTC

**2. Cleanup Expired Pairings (Future):**

```typescript
// app/api/cron/cleanup-pairings/route.ts
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete expired pairings
  const result = await db.delete(devPairings)
    .where(and(
      isNull(devPairings.approvedAt),
      lt(devPairings.expiresAt, new Date())
    ));

  return NextResponse.json({
    success: true,
    deleted: result.rowCount,
  });
}
```

**Schedule:** Every 6 hours

### Cron Monitoring

**Test Cron Locally:**

```bash
# Set CRON_SECRET
export CRON_SECRET="your-cron-secret"

# Call endpoint
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/purge-soft-deletes
```

**Monitor Cron Execution:**

- Vercel Dashboard → Deployments → Functions → Cron
- Check invocation logs
- Set up alerts for failed executions

## Monitoring & Observability

### Vercel Analytics

**Metrics Tracked:**
- Page views
- Unique visitors
- Web Vitals (LCP, FID, CLS)
- Top pages
- Geographic distribution
- Device breakdown

**Access:**
- Vercel Dashboard → Project → Analytics
- Real-time metrics
- 30-day retention (Pro plan)

### Performance Monitoring

**Web Vitals Thresholds:**

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP    | < 2.5s | 2.5s - 4.0s | > 4.0s |
| FID    | < 100ms | 100ms - 300ms | > 300ms |
| CLS    | < 0.1 | 0.1 - 0.25 | > 0.25 |
| TTI    | < 3.5s | 3.5s - 7.3s | > 7.3s |

**Current Performance (Oct 2025):**
- LCP: ~1.8s (Good)
- FID: ~50ms (Good)
- CLS: ~0.05 (Good)
- TTI: ~2.9s (Good)

### Error Tracking (Future: Sentry)

**Setup:**

```bash
pnpm add @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV,
});
```

**Capture Errors:**

```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { feature: 'ideas', action: 'create' },
    user: { id: userId, email: userEmail },
  });
  throw error;
}
```

### Logging Strategy

**Server-Side Logging:**

```typescript
// lib/utils/logger.ts
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function log(level: LogLevel, message: string, meta?: object) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta,
  };

  console[level](JSON.stringify(logEntry));

  // In production, send to external logging service
  if (process.env.NODE_ENV === 'production') {
    // Send to Logtail/Datadog/CloudWatch
  }
}
```

**Usage:**

```typescript
import { log } from '@/lib/utils/logger';

log('info', 'User created idea', { userId, ideaId });
log('error', 'Database connection failed', { error: error.message });
```

### Database Monitoring

**Neon Dashboard Metrics:**
- Connection count
- Query duration (P50, P95, P99)
- Database size
- Replication lag (if replicas enabled)

**Critical Queries to Monitor:**

```sql
-- Long-running queries
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';

-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

## Incident Response

### Incident Severity Levels

**Severity 1 (Critical):**
- Production down (500 errors, database unavailable)
- Data loss or corruption
- Security breach
- **Response Time:** Immediate (< 15 minutes)

**Severity 2 (High):**
- Major feature broken (auth, ideas CRUD)
- Performance degradation (> 5s page load)
- **Response Time:** < 1 hour

**Severity 3 (Medium):**
- Minor feature broken (export, terminal)
- Intermittent errors
- **Response Time:** < 4 hours

**Severity 4 (Low):**
- Cosmetic issues
- Feature requests
- **Response Time:** Next sprint

### Incident Response Runbook

**1. Detect:**
- Monitor alerts (Vercel, Sentry, uptime monitoring)
- User reports
- Automated health checks

**2. Assess:**
- Check Vercel deployment status
- Review error logs
- Query database health
- Check external dependencies (Upstash, Neon, Fly.io)

**3. Mitigate:**
- Rollback deployment (if recent)
- Enable maintenance mode (if severe)
- Scale resources (if load-related)

**4. Resolve:**
- Fix root cause
- Deploy fix
- Verify resolution

**5. Document:**
- Write incident postmortem
- Update runbooks
- Implement preventive measures

### Common Incidents & Solutions

#### Incident: Production 500 Errors

**Symptoms:** Users seeing "Internal Server Error"

**Diagnosis:**
```bash
# Check Vercel function logs
vercel logs --prod

# Check for recent deployments
vercel ls

# Query database connectivity
psql $DATABASE_URL -c "SELECT 1;"
```

**Resolution:**
1. Identify failing endpoint from logs
2. Check if recent deployment caused issue
3. Rollback if deployment-related: `vercel rollback <prev-deployment>`
4. If database issue, check Neon dashboard for outages
5. If code bug, hotfix and redeploy

#### Incident: Database Connection Pool Exhausted

**Symptoms:** "Too many connections" errors

**Diagnosis:**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check connections by state
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
```

**Resolution:**
1. Increase Neon connection limit (if on free tier, upgrade)
2. Review code for connection leaks
3. Implement connection pooling (already in place with Neon serverless driver)
4. Consider read replicas to offload read queries

#### Incident: Cron Job Failing

**Symptoms:** Soft-deleted ideas not being purged

**Diagnosis:**
```bash
# Check cron logs in Vercel
# Vercel Dashboard → Functions → Cron

# Test endpoint manually
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://yourdomain.com/api/cron/purge-soft-deletes
```

**Resolution:**
1. Verify `CRON_SECRET` is set correctly in Vercel
2. Check cron endpoint logs for errors
3. Manually trigger cron to verify fix
4. Monitor next scheduled execution

#### Incident: Relay Server Down

**Symptoms:** Terminal connections failing

**Diagnosis:**
```bash
# Check Fly.io status
flyctl status --app coda-relay

# Check logs
flyctl logs --app coda-relay
```

**Resolution:**
1. Restart relay app: `flyctl apps restart coda-relay`
2. Check for resource limits: `flyctl scale show`
3. Scale up if needed: `flyctl scale count 2`
4. Deploy fix if code issue: `flyctl deploy`

## Operational Runbooks

### Runbook: Add New Environment Variable

**Steps:**

1. Add to `.env.example` with documentation:
   ```env
   # Feature Flag: Enable DevMode
   NEXT_PUBLIC_ENABLE_DEVMODE="true"
   ```

2. Add to Vercel (all environments):
   ```bash
   vercel env add NEXT_PUBLIC_ENABLE_DEVMODE production
   # Enter value when prompted

   vercel env add NEXT_PUBLIC_ENABLE_DEVMODE preview
   vercel env add NEXT_PUBLIC_ENABLE_DEVMODE development
   ```

3. Update `CLAUDE.md` with new variable

4. Redeploy if needed:
   ```bash
   vercel --prod
   ```

### Runbook: Database Migration

**Pre-Flight Checks:**

- [ ] Migration tested locally
- [ ] Migration tested on preview environment
- [ ] Backup of production database taken (Neon auto-backup)
- [ ] Migration is backwards compatible
- [ ] Migration script reviewed by 2+ engineers

**Steps:**

1. **Create Migration:**
   ```bash
   # Modify schema
   vim lib/db/schema.ts

   # Generate migration
   pnpm db:generate

   # Review generated SQL
   cat drizzle/migrations/XXXX_migration_name.sql
   ```

2. **Test on Preview:**
   ```bash
   # Apply to preview database
   DATABASE_URL=$PREVIEW_DATABASE_URL pnpm db:migrate

   # Verify schema
   DATABASE_URL=$PREVIEW_DATABASE_URL pnpm db:studio
   ```

3. **Deploy to Production:**
   ```bash
   # Commit migration
   git add lib/db/schema.ts drizzle/migrations/
   git commit -m "feat: Add new feature columns"

   # Push to main (triggers auto-deployment)
   git push origin main

   # Migration runs automatically via postbuild script
   ```

4. **Verify:**
   ```bash
   # Check Vercel build logs for migration success
   vercel logs --prod | grep "db:migrate"

   # Query production database
   psql $PRODUCTION_DATABASE_URL -c "\d ideas"
   ```

### Runbook: Scale for Traffic Spike

**Indicators:**
- Page load times > 5s
- API response times > 2s
- Database connection errors

**Actions:**

1. **Check Current Load:**
   ```bash
   # Vercel Analytics → Real-time traffic
   # Neon Dashboard → Connection count
   ```

2. **Scale Vercel Functions:**
   - Automatic (Vercel scales serverless functions automatically)
   - Monitor in Vercel Dashboard → Functions

3. **Scale Database:**
   ```bash
   # Increase Neon compute units (if on paid plan)
   neon compute-units set --compute 2

   # Or add read replicas
   neon branches create --name read-replica --parent main
   ```

4. **Enable Caching:**
   ```typescript
   // Enable Vercel edge caching for static pages
   export const revalidate = 60; // 60 seconds
   ```

5. **Rate Limit Aggressively:**
   ```typescript
   // Temporarily reduce rate limits
   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(5, '10 s'), // Reduced from 10
   });
   ```

### Runbook: Update Runner Desktop App

**Steps:**

1. **Build New Version:**
   ```bash
   cd apps/runner-desktop

   # Update version in package.json
   vim package.json
   # "version": "1.1.0"

   # Build and sign
   pnpm run package
   ```

2. **Create GitHub Release:**
   ```bash
   # Tag release
   git tag runner-desktop-v1.1.0
   git push origin runner-desktop-v1.1.0

   # Upload DMG/EXE to release
   gh release create runner-desktop-v1.1.0 \
     dist/apps/runner-desktop/coda-runner-companion-mac-arm64.dmg \
     dist/apps/runner-desktop/coda-runner-companion-win-x64.exe
   ```

3. **Update Download Links:**
   ```bash
   # Update NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE in Vercel
   vercel env add NEXT_PUBLIC_RUNNER_DOWNLOAD_BASE production
   # https://github.com/yourorg/coda/releases/download/runner-desktop-v1.1.0
   ```

4. **Notify Users:**
   - Add banner to DevMode page: "New runner version available"
   - Send email to active DevMode users (if mailing list exists)

## Security Operations

### SSL/TLS Certificates

**Vercel Managed:**
- Automatic SSL certificate provisioning
- Auto-renewal (Let's Encrypt)
- No manual action required

**Fly.io Relay:**
```bash
# Verify SSL certificate
flyctl certs show --app coda-relay

# Renew if needed (automatic)
flyctl certs renew --app coda-relay
```

### Secret Rotation

**Rotate Auth Secret:**

1. Generate new secret:
   ```bash
   openssl rand -base64 32
   ```

2. Update Vercel environment variable:
   ```bash
   vercel env add NEXTAUTH_SECRET production
   # Paste new secret
   ```

3. Redeploy (invalidates all sessions):
   ```bash
   vercel --prod
   ```

4. Users will need to log in again

**Rotate Database Password:**

1. Update password in Neon dashboard
2. Get new connection string
3. Update `DATABASE_URL` in Vercel
4. Redeploy

### Audit Logs (Future)

**Implementation:**

```typescript
// lib/utils/audit.ts
export async function logAudit(
  userId: string,
  action: string,
  resource: string,
  metadata?: object
) {
  await db.insert(auditLogs).values({
    userId,
    action,
    resource,
    metadata,
    ipAddress: getClientIp(),
    userAgent: getUserAgent(),
    timestamp: new Date(),
  });
}
```

**Usage:**

```typescript
await logAudit(userId, 'delete', 'idea', { ideaId });
await logAudit(userId, 'export', 'idea', { ideaId, format: 'json' });
```

## Disaster Recovery

### Backup Strategy

**Database Backups:**
- **Automatic:** Neon performs continuous backups (7-day retention)
- **Manual:** Export critical data daily via cron job (future)

**Code Backups:**
- Git repository (GitHub)
- Vercel deployments (rollback available)

### Recovery Time Objective (RTO)

- **RTO:** < 1 hour (time to restore service)
- **RPO:** < 5 minutes (acceptable data loss)

### Disaster Recovery Plan

**Scenario 1: Vercel Outage**

1. Deploy to backup hosting (AWS/GCP)
2. Update DNS to point to backup
3. Restore database from Neon backup
4. Estimated RTO: 2 hours

**Scenario 2: Database Corruption**

1. Identify corruption point via logs
2. Create Neon branch from last known good state
3. Update `DATABASE_URL` to restored branch
4. Redeploy application
5. Estimated RTO: 30 minutes

**Scenario 3: Complete Data Loss**

1. Restore from Neon point-in-time backup
2. Restore code from Git
3. Redeploy application
4. Notify users of data loss window
5. Estimated RTO: 1 hour

## Cost Management

### Current Costs (Estimated, Oct 2025)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Vercel Postgres (Neon) | Free | $0 |
| Upstash Redis | Free | $0 |
| Fly.io Relay | Hobby | $5 |
| **Total** | | **$25** |

### Cost Optimization Tips

**1. Optimize Vercel Function Execution:**
- Reduce bundle size (tree shaking, lazy loading)
- Cache API responses
- Use edge middleware for simple checks

**2. Reduce Database Queries:**
- Implement read replicas for heavy read workloads
- Cache frequently accessed data in Redis
- Use connection pooling efficiently

**3. Monitor Bandwidth:**
- Compress API responses (gzip/brotli)
- Optimize image sizes (next/image)
- Use CDN for static assets

### Cost Projections (1,000 Users)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| Vercel | Pro | $20 |
| Vercel Postgres | Paid | $50 |
| Upstash Redis | Paid | $10 |
| Fly.io Relay | Paid | $20 |
| Sentry | Team | $30 |
| **Total** | | **$130** |

## Conclusion

**Key Operational Principles:**

1. **Automate everything:** Deployments, migrations, monitoring
2. **Monitor proactively:** Set up alerts before issues occur
3. **Document incidents:** Learn from failures, update runbooks
4. **Test disaster recovery:** Regularly practice backup restoration
5. **Optimize costs:** Monitor usage, scale appropriately

**Operational Maturity Roadmap:**

- **Current (MVP):** Manual monitoring, basic logging
- **Next (6 months):** Automated alerts, error tracking (Sentry), uptime monitoring
- **Future (12 months):** Full observability stack, auto-scaling, chaos engineering

---

**Related Documents:**
- `01-architecture-deep-dive.md` - System architecture
- `02-development-workflow.md` - Development practices
- `04-data-layer-schema.md` - Database operations
- `07-security-compliance.md` - Security operations
