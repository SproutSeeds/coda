# Technical Roadmap & Future Architecture

## Executive Summary

This document outlines Coda's technical roadmap, planned features, architectural improvements, and strategic technology decisions for the next 12-24 months. It provides guidance for prioritization, resource allocation, and long-term technical vision.

## Current State Assessment (Q4 2025)

### What's Working Well

**✅ Core Infrastructure:**
- Next.js 15 App Router provides excellent DX and performance
- Drizzle ORM enables type-safe, predictable database operations
- Vercel deployment pipeline is reliable and requires minimal maintenance
- Upstash Redis handles rate limiting efficiently within free tier

**✅ DevMode System:**
- Electron desktop app successfully deployed and notarized (macOS)
- tmux integration provides persistent terminal sessions
- WebSocket relay handles real-time terminal streaming
- Log batching optimizations have reduced database load by 90%

**✅ Developer Experience:**
- Branch-first workflow with Vercel preview builds catches issues early
- Spec-driven development keeps team aligned
- Type safety across stack reduces runtime errors
- Automated migrations via postbuild script

### Known Limitations

**❌ Scalability Concerns:**
- No read replicas (all queries hit primary database)
- No caching layer for frequently accessed data
- Potential connection pool exhaustion at scale
- Monolithic deployment (all features in single Next.js app)

**❌ Observability Gaps:**
- No centralized error tracking (Sentry not yet implemented)
- Limited application metrics beyond Vercel Analytics
- No distributed tracing for debugging performance issues
- Manual log inspection for debugging

**❌ DevMode Limitations:**
- Single runner per user (no multi-runner support)
- No job queue priority or scheduling
- Terminal sessions not recorded/replayable
- Limited runner telemetry

**❌ Feature Gaps:**
- No real-time collaboration (multi-user editing)
- No mobile app (responsive web only)
- Limited search (no full-text search)
- No AI/ML features (agent integration planned but not implemented)

## Roadmap Overview

### Phase 1: Foundation & Reliability (Next 3-6 Months)

**Goals:**
- Achieve 99.9% uptime
- Implement comprehensive observability
- Optimize performance for 1,000+ concurrent users
- Establish automated testing coverage > 80%

**Key Initiatives:**

1. **Observability Stack**
   - Implement Sentry for error tracking
   - Add Datadog/Grafana for application metrics
   - Implement distributed tracing (OpenTelemetry)
   - Set up uptime monitoring (Pingdom/UptimeRobot)

2. **Performance Optimization**
   - Add Redis caching layer for idea lists
   - Implement database read replicas (Neon)
   - Optimize bundle size (reduce by 30%)
   - Add service worker for offline capability

3. **Testing Infrastructure**
   - Increase unit test coverage to 80%
   - Add visual regression tests (Chromatic)
   - Implement load testing (k6)
   - Set up CI/CD pipeline (GitHub Actions)

4. **DevMode Improvements**
   - Multi-runner support (distribute jobs)
   - Job queue with priority scheduling
   - Runner health monitoring
   - Terminal session recording/playback

### Phase 2: Scale & Expand (6-12 Months)

**Goals:**
- Support 10,000+ active users
- Expand DevMode capabilities
- Add AI/ML features
- Improve user engagement

**Key Initiatives:**

1. **Microservices Architecture**
   - Extract DevMode into separate service
   - Implement API gateway (Kong/Tyk)
   - Add message queue (Kafka/RabbitMQ)
   - Deploy to Kubernetes (GKE/EKS)

2. **AI/ML Integration**
   - Idea summarization (GPT-4)
   - Feature suggestion based on idea content
   - Automated task breakdown
   - Code generation for feature specs

3. **Real-Time Collaboration**
   - Multi-user editing (Yjs CRDTs)
   - Presence indicators
   - Live cursors
   - Comment threads

4. **Mobile Experience**
   - Native iOS app (React Native)
   - Native Android app (React Native)
   - Offline-first architecture
   - Push notifications

### Phase 3: Innovation & Differentiation (12-24 Months)

**Goals:**
- Become platform for agentic workflows
- Enable third-party integrations
- Build marketplace for templates/workflows
- Achieve product-market fit at enterprise scale

**Key Initiatives:**

1. **Platform Features**
   - Public API (REST + GraphQL)
   - Webhook system for external integrations
   - OAuth provider (allow third-party apps)
   - Plugin architecture

2. **Enterprise Features**
   - SSO/SAML authentication
   - Role-based access control (teams)
   - Audit logs with retention
   - SLA guarantees (99.99% uptime)

3. **Marketplace**
   - Template gallery for common workflows
   - Workflow automation marketplace
   - Integration directory (GitHub, Jira, Slack)
   - Revenue sharing for creators

4. **Advanced DevMode**
   - Multi-language support (Python, Go, Rust)
   - Containerized job execution (Docker/Podman)
   - Distributed job scheduling (Nomad/Kubernetes)
   - GPU support for ML workloads

## Detailed Technical Initiatives

### 1. Implement Sentry Error Tracking

**Timeline:** 2 weeks

**Implementation:**

```bash
# Install Sentry
pnpm add @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

**Benefits:**
- Real-time error alerts
- Stack traces with source maps
- Performance monitoring
- User session replay

**Cost:** $29/month (Team plan)

### 2. Add Redis Caching Layer

**Timeline:** 1 month

**Architecture:**

```typescript
// lib/cache/redis.ts
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function getCachedIdeas(userId: string) {
  const cacheKey = `ideas:${userId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached as string);
  }

  const ideas = await db.query.ideas.findMany({
    where: eq(ideas.userId, userId),
  });

  await redis.set(cacheKey, JSON.stringify(ideas), { ex: 60 }); // 60s TTL

  return ideas;
}

export async function invalidateIdeaCache(userId: string) {
  await redis.del(`ideas:${userId}`);
}
```

**Benefits:**
- Reduce database load by 50%
- Improve response times (10ms vs 100ms)
- Lower Neon costs

**Cost:** $10/month (Upstash Pro)

### 3. Database Read Replicas

**Timeline:** 2 weeks

**Architecture:**

```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const primaryUrl = process.env.DATABASE_URL!;
const replicaUrl = process.env.DATABASE_REPLICA_URL!;

export const dbPrimary = drizzle(postgres(primaryUrl));
export const dbReplica = drizzle(postgres(replicaUrl));

// Use replica for read-only queries
export async function getIdeas(userId: string) {
  return dbReplica.query.ideas.findMany({
    where: eq(ideas.userId, userId),
  });
}

// Use primary for writes
export async function createIdea(data: InsertIdea) {
  return dbPrimary.insert(ideas).values(data).returning();
}
```

**Benefits:**
- Offload read queries (80% of traffic)
- Improve primary database availability
- Scale read capacity independently

**Cost:** $50/month (Neon read replica)

### 4. Microservices: Extract DevMode Service

**Timeline:** 3 months

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Web App                              │
│  - Idea/Feature CRUD                                             │
│  - Authentication                                                │
│  - Dashboard UI                                                  │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Kong)                           │
│  - Rate limiting                                                 │
│  - Authentication                                                │
│  - Request routing                                               │
└─────────────────────────────────────────────────────────────────┘
         │
         ├───────────────────┬────────────────────┐
         ▼                   ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  DevMode Service │ │  Job Service     │ │  Log Service     │
│  - Pairing       │ │  - Job queue     │ │  - Log ingestion │
│  - Runner mgmt   │ │  - Scheduling    │ │  - Log storage   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

**Benefits:**
- Independent scaling (scale DevMode service without scaling web app)
- Technology flexibility (could use Go/Rust for performance)
- Fault isolation (DevMode issues don't affect main app)
- Team autonomy (dedicated DevMode team)

**Challenges:**
- Increased operational complexity
- Distributed transactions (saga pattern)
- Service discovery and communication
- Monitoring across services

**Cost:** $200/month (additional infrastructure)

### 5. AI/ML Integration: Idea Summarization

**Timeline:** 2 months

**Implementation:**

```typescript
// lib/ai/openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarizeIdea(ideaContent: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a product manager. Summarize the following idea into a concise 2-sentence summary.',
      },
      {
        role: 'user',
        content: ideaContent,
      },
    ],
    max_tokens: 100,
  });

  return response.choices[0].message.content;
}

// Usage in server action
export async function generateIdeaSummary(ideaId: string) {
  const idea = await db.query.ideas.findFirst({
    where: eq(ideas.id, ideaId),
    with: { features: true },
  });

  const content = `${idea.title}\n\n${idea.notes}\n\nFeatures:\n${idea.features.map(f => `- ${f.title}`).join('\n')}`;

  const summary = await summarizeIdea(content);

  await db.update(ideas)
    .set({ aiSummary: summary })
    .where(eq(ideas.id, ideaId));

  return summary;
}
```

**Features:**
- Auto-generate idea summaries
- Suggest related features
- Break down complex features into tasks
- Generate test cases from feature specs

**Cost:** $100/month (OpenAI API usage)

### 6. Real-Time Collaboration (Yjs CRDTs)

**Timeline:** 4 months

**Architecture:**

```typescript
// lib/collab/yjs-provider.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function createCollabProvider(ideaId: string) {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(
    process.env.NEXT_PUBLIC_COLLAB_SERVER_URL!,
    `idea-${ideaId}`,
    ydoc
  );

  return { ydoc, provider };
}

// Usage in component
function IdeaEditor({ ideaId }: { ideaId: string }) {
  const { ydoc, provider } = createCollabProvider(ideaId);
  const ytext = ydoc.getText('title');

  // Bind to input
  ytext.observe((event) => {
    // Update UI
  });

  return <input onChange={(e) => ytext.insert(0, e.target.value)} />;
}
```

**Features:**
- Multi-user editing (Google Docs-style)
- Presence indicators (who's viewing)
- Live cursors
- Comment threads
- Conflict-free merging

**Challenges:**
- WebSocket server infrastructure
- Persistence layer (save CRDTs to Postgres)
- Performance with large documents
- User education (new UX paradigm)

**Cost:** $100/month (WebSocket infrastructure)

### 7. Native Mobile Apps (React Native)

**Timeline:** 6 months

**Technology Stack:**
- React Native (cross-platform)
- Expo (managed workflow)
- React Query (data fetching)
- Zustand (state management)
- React Native Reanimated (animations)

**Features:**
- Offline-first (local SQLite cache)
- Push notifications (idea updates, DevMode jobs)
- Native terminal (for DevMode)
- Biometric authentication (Face ID, fingerprint)

**Challenges:**
- Code sharing with web app (50-70% reuse)
- App store approval process
- Native module integration (terminal)
- Testing on physical devices

**Cost:** $500/month (development + app store fees)

## Technical Debt & Improvements

### High Priority (Next 6 Months)

**1. Migrate from JWT to Refresh Token Pattern**

**Current:** Long-lived JWT tokens (30 days)
**Problem:** Cannot revoke tokens without database check
**Solution:** Short-lived access tokens (1 hour) + refresh tokens (30 days)

```typescript
// lib/auth/tokens.ts
export function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, SECRET, { expiresIn: '30d' });

  // Store refresh token in database (for revocation)
  await db.insert(refreshTokens).values({
    userId,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken, refreshToken };
}
```

**2. Implement Feature Flags (LaunchDarkly/Posthog)**

**Benefits:**
- Gradual rollout (canary releases)
- A/B testing
- Kill switch for problematic features
- User targeting (beta users)

**3. Add Comprehensive Logging (Logtail/Datadog)**

**Current:** console.log statements
**Solution:** Structured logging with levels, context

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Usage
logger.info({ userId, ideaId }, 'Idea created');
logger.error({ error: err.message, stack: err.stack }, 'Database query failed');
```

### Medium Priority (6-12 Months)

**1. GraphQL API (Alternative to REST)**

**Benefits:**
- Flexible queries (fetch exactly what you need)
- Type safety (code generation)
- Real-time subscriptions (GraphQL subscriptions)

**2. Event Sourcing for Audit Trail**

**Current:** Direct database updates
**Solution:** Store events, rebuild state from events

```typescript
// Event sourcing pattern
const events = [
  { type: 'IdeaCreated', ideaId, userId, timestamp },
  { type: 'IdeaTitleUpdated', ideaId, title, timestamp },
  { type: 'IdeaDeleted', ideaId, timestamp },
];

// Rebuild state
function rebuildIdea(ideaId: string) {
  const events = await db.query.events.findMany({
    where: eq(events.entityId, ideaId),
    orderBy: asc(events.timestamp),
  });

  let idea = {};
  for (const event of events) {
    idea = applyEvent(idea, event);
  }
  return idea;
}
```

**3. Distributed Caching (Redis Cluster)**

**Current:** Single Redis instance (Upstash)
**Solution:** Multi-node Redis cluster for high availability

### Low Priority (12+ Months)

**1. Multi-Tenancy Architecture**

**Current:** Single-tenant (per-user isolation via userId)
**Solution:** Tenant-level isolation (teams/organizations)

**2. Multi-Region Deployment**

**Current:** Single region (US East)
**Solution:** Deploy to multiple regions (US, EU, Asia) for lower latency

**3. Blockchain Integration (Idea Provenance)**

**Use Case:** Immutable proof of idea creation timestamp
**Technology:** Ethereum smart contracts or IPFS

## Cost Projections

### Current State (< 100 Users)

| Service | Monthly Cost |
|---------|--------------|
| Vercel Pro | $20 |
| Vercel Postgres | $0 (free tier) |
| Upstash Redis | $0 (free tier) |
| Fly.io Relay | $5 |
| **Total** | **$25** |

### Phase 1 (1,000 Users)

| Service | Monthly Cost |
|---------|--------------|
| Vercel Pro | $20 |
| Vercel Postgres | $50 |
| Upstash Redis | $10 |
| Fly.io Relay | $20 |
| Sentry | $29 |
| OpenAI API | $100 |
| **Total** | **$229** |

### Phase 2 (10,000 Users)

| Service | Monthly Cost |
|---------|--------------|
| Vercel Pro | $20 |
| Vercel Postgres | $200 |
| Upstash Redis | $50 |
| Fly.io Relay | $100 |
| Sentry | $99 |
| OpenAI API | $500 |
| Datadog | $150 |
| LaunchDarkly | $50 |
| **Total** | **$1,169** |

### Phase 3 (100,000 Users)

| Service | Monthly Cost |
|---------|--------------|
| GKE Cluster | $1,000 |
| CloudSQL Postgres | $1,500 |
| Redis (Managed) | $300 |
| Sentry | $299 |
| OpenAI API | $2,000 |
| Datadog | $500 |
| CDN (Cloudflare) | $200 |
| **Total** | **$5,799** |

## Success Metrics

### Engineering Metrics

**Reliability:**
- Uptime: 99.9% (Phase 1) → 99.99% (Phase 3)
- Mean Time to Recovery (MTTR): < 30 minutes
- Change failure rate: < 5%

**Performance:**
- P95 API response time: < 200ms
- P95 page load time: < 2s
- Time to Interactive (TTI): < 3s

**Quality:**
- Test coverage: > 80%
- Critical bug escape rate: < 1%
- Security vulnerabilities: Zero high/critical

### Product Metrics

**Adoption:**
- Monthly Active Users (MAU): 10,000 (Phase 2)
- Daily Active Users (DAU): 2,000
- DAU/MAU ratio: > 20%

**Engagement:**
- Ideas created per user per month: > 5
- Features created per idea: > 3
- Time spent per session: > 10 minutes

**DevMode (if applicable):**
- Runners paired per active user: > 0.5
- Jobs executed per day: > 100
- Terminal sessions per day: > 50

## Conclusion

**Strategic Priorities:**

1. **Short-term (0-6 months):** Reliability, observability, performance
2. **Mid-term (6-12 months):** Scale, AI integration, mobile
3. **Long-term (12-24 months):** Platform features, enterprise, marketplace

**Key Technology Bets:**

- **Next.js App Router:** Continue investment, proven scalability
- **Drizzle ORM:** Lightweight, type-safe, good for our use case
- **Vercel:** Excellent DX, but evaluate cost at scale (Phase 3 may require migration)
- **AI/ML:** Core differentiator, invest heavily in GPT-4 integration
- **Real-time collaboration:** High complexity, high value (Phase 2 priority)

**Decision Points:**

- **Q1 2026:** Evaluate Vercel vs self-hosted Kubernetes (cost inflection point)
- **Q2 2026:** Decide on monolith vs microservices (based on team size)
- **Q3 2026:** Assess mobile app traction (continue or sunset)
- **Q4 2026:** Review AI/ML ROI (feature usage, user feedback)

---

**Related Documents:**
- `01-architecture-deep-dive.md` - Current architecture
- `05-operations-deployment.md` - Deployment procedures
- `PRODUCT_PLAYBOOK_REFERENCE.md` - Product strategy
